// @ts-check
/* drawio-embed-protocol.js — protocole postMessage de draw.io Embed Mode (pur, sans DOM) */
(function initDrawioEmbedProtocol(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEIDrawioProtocol) return;

    const EMBED_ORIGIN = 'https://embed.diagrams.net';

    const DEFAULT_XML = '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" '
        + 'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" '
        + 'pageHeight="1100" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel>';

    const buildEmbedSrc = () => `${EMBED_ORIGIN}/?embed=1&proto=json&ui=min&spin=1&saveAndExit=1&noExitBtn=1`;

    const isTrustedOrigin = origin => origin === EMBED_ORIGIN;

    const parseMessage = raw => {
        if (raw == null) return null;
        if (typeof raw === 'object') return raw;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    };

    const buildLoadAction = xml => JSON.stringify({ action: 'load', xml: xml || DEFAULT_XML });

    const buildExportAction = (format = 'svg') => JSON.stringify({ action: 'export', format });

    const decodeSvgDataUri = dataUri => {
        const marker = 'base64,';
        const idx = typeof dataUri === 'string' ? dataUri.indexOf(marker) : -1;
        if (idx === -1) return '';
        const b64 = dataUri.slice(idx + marker.length);
        try {
            // Un diagramme peut contenir des caractères accentués (libellés en français) —
            // atob() seul ne décode qu'en chaîne "binaire" (Latin-1), il faut repasser par
            // les octets bruts + TextDecoder pour un décodage UTF-8 correct.
            if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
            if (typeof root.atob === 'function') {
                const binary = root.atob(b64);
                const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                return new TextDecoder('utf-8').decode(bytes);
            }
        } catch (_) {
            return '';
        }
        return '';
    };

    root.OEIDrawioProtocol = Object.freeze({
        EMBED_ORIGIN,
        DEFAULT_XML,
        buildEmbedSrc,
        isTrustedOrigin,
        parseMessage,
        buildLoadAction,
        buildExportAction,
        decodeSvgDataUri,
        testUtils: Object.freeze({
            EMBED_ORIGIN,
            DEFAULT_XML,
            buildEmbedSrc,
            isTrustedOrigin,
            parseMessage,
            buildLoadAction,
            buildExportAction,
            decodeSvgDataUri,
        }),
    });
})(window);
