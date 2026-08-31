/**
 * @module slides/html-sanitizer
 * @public
 * @internal Module Slides chargé côté navigateur (et sous Node dans les tests).
 */
/*
 * html-sanitizer.js — assainissement HTML par liste blanche pour le contenu de slides.
 *
 * Chantier 8 (sécurité) — voir docs/developer/PRESENTAFORGE_PLAN_EXECUTION_2026-08.md
 * et docs/developer/SECURITY_MODEL.md.
 *
 * Deux moteurs, une seule liste blanche :
 *   1. `window.DOMPurify` (vendored : vendor/dompurify/<version>/purify.min.js) quand il
 *      est chargé — moteur de référence (parser DOM réel + heuristiques Cure53).
 *   2. Un sanitiseur portable, sans dépendance ni DOM, sinon (viewer sans vendor,
 *      sandboxes `node:vm` des tests, contextes SSR / export inline). Il applique la
 *      MÊME liste blanche de balises/attributs et échoue fermé (tout ce qui n'est pas
 *      explicitement autorisé est retiré).
 *
 * API : OEIHtmlSanitizer.sanitize(html, profile) → string
 *   profile ∈ { 'inline', 'slide-rich' } (défaut : 'inline').
 *   - 'inline'     : b/strong/i/em/u/code/sub/sup/br, aucun attribut. Utilisé par
 *                    SlidesShared.formatInlineRichText (puces, notes, colonnes texte).
 *   - 'slide-rich' : sous-ensemble bloc + inline raisonnable pour des slides, attributs
 *                    sûrs, schémas d'URL http(s)/mailto/tel/ftp + data:image (hors SVG).
 *                    Utilisé à l'import (import-pipeline.js) sur les champs HTML libres
 *                    (blank slide.html, text/heading el.data.html).
 */
(function initHtmlSanitizer(global) {
    'use strict';

    if (global.OEIHtmlSanitizer) return;

    /* ── Listes blanches ─────────────────────────────────────────────── */

    const PROFILES = {
        inline: {
            tags: ['b', 'strong', 'i', 'em', 'u', 'code', 'sub', 'sup', 'br'],
            attr: [],
            allowStyle: false,
        },
        'slide-rich': {
            tags: [
                'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
                'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
                'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre',
                'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td',
                'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var', 'wbr',
            ],
            attr: [
                'align', 'alt', 'class', 'colspan', 'datetime', 'dir', 'headers', 'height', 'href',
                'lang', 'rel', 'rowspan', 'scope', 'span', 'src', 'start', 'style', 'target',
                'title', 'type', 'width',
            ],
            allowStyle: true,
        },
    };

    const VOID_TAGS = new Set(['br', 'hr', 'img', 'col', 'wbr']);

    // Balises dont le *contenu textuel* doit disparaître avec la balise (pas seulement
    // la balise). Tout le reste hors liste blanche : balise retirée, contenu conservé.
    const DROP_SUBTREE = new Set([
        'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'noembed', 'noframes',
        'template', 'title', 'textarea', 'xmp', 'frame', 'frameset', 'applet', 'meta', 'link',
        'base', 'form', 'input', 'button', 'select', 'option', 'optgroup', 'svg', 'math',
        'audio', 'video', 'source', 'track', 'canvas', 'map', 'area', 'portal',
    ]);

    const NAMED_ENTITY_RE = /^&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/;

    const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp']);
    const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp|x-icon)\s*[;,]/i;
    const CONTROL_CHARS_RE = /[\u0000-\u0020\u007f-\u00a0\u200b-\u200f\u2028\u2029\ufeff]+/g;

    /* ── Utilitaires de chaîne ───────────────────────────────────────── */

    function escapeText(text) {
        let out = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '<') { out += '&lt;'; continue; }
            if (ch === '>') { out += '&gt;'; continue; }
            if (ch === '"') { out += '&quot;'; continue; }
            if (ch === "'") { out += '&#39;'; continue; }
            if (ch === '&') {
                const m = NAMED_ENTITY_RE.exec(text.slice(i));
                if (m) { out += m[0]; i += m[0].length - 1; } else { out += '&amp;'; }
                continue;
            }
            out += ch;
        }
        return out;
    }

    function escapeAttr(value) {
        return escapeText(String(value == null ? '' : value)).replace(/`/g, '&#96;');
    }

    // Décodage « suffisant pour la vérification de schéma » — DOMPurify fait mieux, mais
    // ce moteur portable n'a besoin que de démasquer javascript:/data: obfusqués.
    function decodeForCheck(value) {
        return String(value == null ? '' : value)
            .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => cp(parseInt(h, 16)))
            .replace(/&#(\d+);?/g, (_, d) => cp(parseInt(d, 10)))
            .replace(/&(?:tab|newline|colon|semi|amp|lpar|rpar|sol);/gi, m => ({
                '&tab;': '\t', '&newline;': '\n', '&colon;': ':', '&semi;': ';',
                '&amp;': '&', '&lpar;': '(', '&rpar;': ')', '&sol;': '/',
            }[m.toLowerCase()] || ''))
            .replace(CONTROL_CHARS_RE, '');
    }

    function cp(code) {
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
        try { return String.fromCodePoint(code); } catch (_) { return ''; }
    }

    /* ── Validation d'URL / de style ─────────────────────────────────── */

    function isSafeUrl(rawValue) {
        const value = decodeForCheck(rawValue).trim();
        if (!value) return false;
        if (/^(?:javascript|vbscript|livescript|mocha|blob|filesystem):/i.test(value)) return false;
        if (/^data:/i.test(value)) return DATA_IMAGE_RE.test(value);
        const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i);
        if (!schemeMatch) return true; // pas de schéma → URL relative / ancre / requête
        return SAFE_URL_SCHEMES.has(schemeMatch[1].toLowerCase());
    }

    function sanitizeStyle(rawValue) {
        const value = String(rawValue == null ? '' : rawValue);
        if (/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import|<|>/i.test(value)) return '';
        if (/url\s*\(\s*['"]?\s*(?:javascript|vbscript|data|blob):/i.test(value)) return '';
        return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    }

    /* ── Parseur de balises (moteur portable) ────────────────────────── */

    function findTagEnd(html, start) {
        let quote = '';
        for (let i = start + 1; i < html.length; i++) {
            const ch = html[i];
            if (quote) { if (ch === quote) quote = ''; continue; }
            if (ch === '"' || ch === "'") { quote = ch; continue; }
            if (ch === '>') return i;
        }
        return -1;
    }

    const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

    function parseAttrs(src) {
        const attrs = [];
        ATTR_RE.lastIndex = 0;
        let m;
        while ((m = ATTR_RE.exec(src))) {
            if (!m[0]) { ATTR_RE.lastIndex++; continue; }
            let value = null;
            if (m[2] != null) value = m[3] != null ? m[3] : (m[4] != null ? m[4] : m[5]);
            attrs.push({ name: m[1].toLowerCase(), value });
        }
        return attrs;
    }

    function portableSanitize(html, profileName) {
        const profile = PROFILES[profileName] || PROFILES.inline;
        const allowedTags = new Set(profile.tags);
        const allowedAttr = new Set(profile.attr);
        const src = String(html == null ? '' : html);

        let out = '';
        let i = 0;
        let dropDepth = 0;       // > 0 : on est dans un sous-arbre à jeter
        let dropTag = '';

        while (i < src.length) {
            const lt = src.indexOf('<', i);
            if (lt === -1) {
                if (!dropDepth) out += escapeText(src.slice(i));
                break;
            }
            if (lt > i && !dropDepth) out += escapeText(src.slice(i, lt));

            // Commentaires / déclarations / instructions de traitement
            if (src.startsWith('<!--', lt)) {
                const end = src.indexOf('-->', lt + 4);
                i = end === -1 ? src.length : end + 3;
                continue;
            }
            if (src[lt + 1] === '!' || src[lt + 1] === '?') {
                const end = src.indexOf('>', lt);
                i = end === -1 ? src.length : end + 1;
                continue;
            }

            const gt = findTagEnd(src, lt);
            if (gt === -1) {
                if (!dropDepth) out += escapeText(src.slice(lt));
                break;
            }

            const rawTag = src.slice(lt + 1, gt).trim();
            i = gt + 1;
            const isClose = rawTag[0] === '/';
            const nameMatch = (isClose ? rawTag.slice(1) : rawTag).match(/^([a-zA-Z][a-zA-Z0-9]*)/);
            if (!nameMatch) continue;
            const tag = nameMatch[1].toLowerCase();

            if (dropDepth) {
                if (isClose && tag === dropTag) { dropDepth--; if (!dropDepth) dropTag = ''; }
                else if (!isClose && tag === dropTag && !VOID_TAGS.has(tag) && !/\/\s*$/.test(rawTag)) dropDepth++;
                continue;
            }

            if (isClose) {
                if (allowedTags.has(tag) && !VOID_TAGS.has(tag)) out += `</${tag}>`;
                continue;
            }

            const selfClose = /\/\s*$/.test(rawTag);

            if (DROP_SUBTREE.has(tag)) {
                if (!selfClose && !VOID_TAGS.has(tag)) { dropDepth = 1; dropTag = tag; }
                continue;
            }
            if (!allowedTags.has(tag)) continue; // balise inconnue : retirée, contenu gardé

            const attrsSrc = (isClose ? '' : rawTag.slice(nameMatch[0].length)).replace(/\/\s*$/, '');
            let attrStr = '';
            let hasBlankTarget = false;
            let hasRel = false;
            for (const { name, value } of parseAttrs(attrsSrc)) {
                if (name.startsWith('on')) continue;
                if (name === 'style') {
                    if (!profile.allowStyle) continue;
                    const clean = sanitizeStyle(value);
                    if (clean) attrStr += ` style="${escapeAttr(clean)}"`;
                    continue;
                }
                if (!allowedAttr.has(name)) continue;
                if ((name === 'href' || name === 'src') && !isSafeUrl(value)) continue;
                if (name === 'rel') hasRel = true;
                if (name === 'target') {
                    const t = String(value || '').toLowerCase();
                    if (t !== '_blank' && t !== '_self' && t !== '_parent' && t !== '_top') continue;
                    if (t === '_blank') hasBlankTarget = true;
                }
                attrStr += value == null ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
            }
            if (hasBlankTarget && !hasRel) attrStr += ' rel="noopener noreferrer"';

            out += `<${tag}${attrStr}>`;
        }

        return out;
    }

    /* ── Moteur DOMPurify (préféré si présent) ───────────────────────── */

    // DOMPurify autorise `data:` sur les balises média (img/audio/video…) indépendamment
    // de ALLOWED_URI_REGEXP. On referme cette porte via un hook : seules les images
    // matricielles (DATA_IMAGE_RE, donc pas de SVG) passent.
    function configureDOMPurify(DOMPurify) {
        if (!DOMPurify || DOMPurify.__oeiConfigured) return;
        if (typeof DOMPurify.addHook !== 'function') return;
        DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
            const name = String(data && data.attrName || '').toLowerCase();
            if (name !== 'src' && name !== 'href' && name !== 'xlink:href') return;
            const value = String(data && data.attrValue || '');
            if (/^\s*data:/i.test(value) && !DATA_IMAGE_RE.test(value.trim())) {
                data.keepAttr = false;
            }
        });
        DOMPurify.__oeiConfigured = true;
    }

    function domPurifySanitize(html, profileName) {
        const DOMPurify = global.DOMPurify;
        configureDOMPurify(DOMPurify);
        const profile = PROFILES[profileName] || PROFILES.inline;
        const cfg = {
            ALLOWED_TAGS: profile.tags.slice(),
            ALLOWED_ATTR: profile.attr.slice(),
            ALLOW_DATA_ATTR: false,
            ALLOW_ARIA_ATTR: false,
            ALLOW_UNKNOWN_PROTOCOLS: false,
            USE_PROFILES: false,
            FORBID_TAGS: ['style', 'svg', 'math', 'form', 'input', 'button'],
            FORBID_ATTR: ['srcset', 'formaction', 'xlink:href', 'ping'],
            KEEP_CONTENT: true,
            RETURN_TRUSTED_TYPE: false,
            // data:image seulement (pas de data: arbitraire, pas de SVG)
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$)|data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)[;,])/i,
        };
        let result = DOMPurify.sanitize(String(html == null ? '' : html), cfg);
        if (typeof result !== 'string' && result && typeof result.toString === 'function') result = result.toString();
        return typeof result === 'string' ? result : '';
    }

    function hasWorkingDOMPurify() {
        const DP = global.DOMPurify;
        return !!(DP && typeof DP.sanitize === 'function' && DP.isSupported === true);
    }

    /* ── API publique ───────────────────────────────────────────────── */

    function sanitize(html, profile) {
        const profileName = PROFILES[profile] ? profile : 'inline';
        if (html == null || html === '') return '';
        if (hasWorkingDOMPurify()) {
            try { return domPurifySanitize(html, profileName); } catch (_) { /* repli portable */ }
        }
        return portableSanitize(html, profileName);
    }

    const OEIHtmlSanitizer = {
        sanitize,
        /** @returns {boolean} true si DOMPurify (vendored) est le moteur actif. */
        usingDOMPurify: hasWorkingDOMPurify,
        /** Liste blanche d'un profil (copie), pour les audits/tests. */
        profile(name) {
            const p = PROFILES[name] || PROFILES.inline;
            return { tags: p.tags.slice(), attr: p.attr.slice(), allowStyle: p.allowStyle };
        },
        PROFILES: Object.freeze(Object.keys(PROFILES)),
        // exposé pour les tests (compare les 2 moteurs)
        _portableSanitize: portableSanitize,
    };

    global.OEIHtmlSanitizer = OEIHtmlSanitizer;
    if (typeof module !== 'undefined' && module.exports) module.exports = OEIHtmlSanitizer;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
