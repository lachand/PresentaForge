/**
 * PseudocodeSupport - moteur commun pour rendu et inspection du pseudo-code.
 */
const PseudocodeSupport = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    },

    getBlocks(data) {
        const blocks = data?.pseudocode || data?.pseudoCode;
        return Array.isArray(blocks) ? blocks : [];
    },

    getKeywordTokens(options = {}) {
        const baseTokens = [
            'tant que', 'pour chaque', 'sinon si', 'fonction', 'retourner',
            'si', 'sinon', 'pour', 'faire', 'erreur', 'et', 'ou', 'non',
            'while', 'for each', 'else if', 'function', 'return',
            'if', 'else', 'for', 'error', 'and', 'or', 'not'
        ];

        const domainTokens = this.getDomainKeywordTokens(options.domain);
        const customTokens = Array.isArray(options.keywordTokens)
            ? options.keywordTokens
            : [];

        const merged = [...baseTokens, ...domainTokens, ...customTokens]
            .map((token) => String(token || '').trim())
            .filter(Boolean);

        const seen = new Set();
        const unique = [];
        merged.forEach((token) => {
            const key = token.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(token);
        });
        return unique;
    },

    normalizeDomain(domain) {
        const value = String(domain || '').trim().toLowerCase();
        if (!value) return '';
        const aliases = {
            'graphes': 'graphes',
            'graphe': 'graphes',
            'tri': 'tri',
            'recherche': 'recherche',
            'structures': 'structures',
            'structure': 'structures',
            'reseau': 'reseau',
            'network': 'reseau',
            'bdd': 'bdd',
            'database': 'bdd',
            'systemes': 'systemes',
            'systeme': 'systemes',
            'systems': 'systemes',
            'securite': 'securite',
            'security': 'securite',
            'stats': 'stats',
            'statistiques': 'stats',
            'statistics': 'stats',
            'probabilite': 'stats',
            'probabilites': 'stats',
            'web': 'web',
            'automates': 'automates',
            'automate': 'automates',
            'concepts': 'concepts',
            'concept': 'concepts'
        };
        return aliases[value] || value;
    },

    getDomainKeywordTokens(domain) {
        const normalized = this.normalizeDomain(domain);
        if (!normalized) return [];

        const map = {
            tri: [
                'pivot', 'partition', 'fusion', 'merge', 'swap',
                'tableau', 'arr', 'low', 'high', 'mid', 'milieu',
                'minindex', 'key', 'seau', 'radix', 'compter'
            ],
            recherche: [
                'cible', 'milieu', 'bas', 'haut', 'tableautrie',
                'tableau', 'dichotomique', 'sequentielle', 'indice'
            ],
            graphes: [
                'graphe', 'sommet', 'voisin', 'dist', 'distance', 'pred',
                'open_set', 'closed_set', 'source', 'objectif', 'depart',
                'arrivee', 'relacher', 'poids', 'file', 'pile'
            ],
            structures: [
                'pile', 'file', 'tas', 'arbre', 'noeud', 'tete', 'sommet',
                'racine', 'gauche', 'droit', 'parent', 'enfiler', 'defiler',
                'empiler', 'depiler', 'inserer', 'supprimer', 'rechercher',
                'table', 'bucket'
            ],
            reseau: [
                'client', 'serveur', 'paquet', 'trame', 'route', 'protocole',
                'couche', 'pdu', 'ip', 'mac', 'ttl', 'seq', 'ack',
                'portsource', 'portdest', 'routage', 'prefixe', 'next_hop'
            ],
            bdd: [
                'requete', 'relation', 'projection', 'selection', 'jointure',
                'tuple', 'schema', 'table', 'groupe', 'predicat', 'normaliser',
                'bcnf', 'dependance', 'attribut'
            ],
            systemes: [
                'processus', 'planning', 'mutex', 'verrou', 'cadre', 'memoire',
                'page', 'fault', 'pipeline', 'instruction', 'cpu', 'quantum',
                'ordonnancement', 'deadlock', 'wait'
            ],
            securite: [
                'chiffrer', 'dechiffrer', 'cle', 'signature', 'hash',
                'certificat', 'secret', 'tls', 'rsa', 'nonce', 'pow_mod',
                'inverse_modulaire', 'clienthello', 'serverhello'
            ],
            stats: [
                'probabilite', 'frequence', 'essai', 'tirage', 'evenement',
                'moyenne', 'mediane', 'quartile', 'iqr', 'variance',
                'ecart_type', 'histogramme', 'boxplot', 'outlier',
                'prevalence', 'sensibilite', 'specificite', 'posterior',
                'esperance', 'mu', 'combinatoire', 'combinaison',
                'permutation', 'arrangement', 'factorielle',
                'normale', 'tcl', 'echantillon', 'independance',
                'conditionnelle', 'intersection', 'union', 'complement',
                'cardinal', 'couplage', 'intervalle', 'confiance',
                'marge', 'couverture', 'hypothese', 'p_value',
                'alpha', 'rejet', 'puissance', 'statistique'
            ],
            web: [
                'dom', 'evenement', 'selecteur', 'listener', 'render',
                'requete', 'reponse', 'fetch'
            ],
            automates: [
                'etat', 'transition', 'symbole', 'ruban', 'tete',
                'automate', 'acceptation'
            ],
            concepts: [
                'recursion', 'memoisation', 'traceback', 'capacite',
                'poids', 'lcs', 'knapsack', 'table'
            ]
        };

        return map[normalized] || [];
    },

    escapeRegExp(text) {
        return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    highlightKeywordTokens(lineHtml, options = {}) {
        const source = String(lineHtml || '');
        if (!source) return source;

        const tokens = this.getKeywordTokens(options).slice().sort((a, b) => b.length - a.length);
        const alternates = tokens
            .map((token) => token
                .split(/\s+/)
                .map((part) => this.escapeRegExp(part))
                .filter(Boolean)
                .join('\\s+'))
            .filter(Boolean);

        if (alternates.length === 0) return source;

        const pattern = new RegExp('(^|[^A-Za-z0-9_])(' + alternates.join('|') + ')(?=$|[^A-Za-z0-9_])', 'gi');
        return source.replace(pattern, (match, prefix, keyword) => {
            return prefix + '<span class="keyword">' + keyword + '</span>';
        });
    },

    renderLineContent(line, options = {}) {
        const raw = line == null ? '' : String(line);
        const autoKeywordHighlight = options.autoKeywordHighlight !== false;
        if (options.allowLineMarkup === false) {
            const escaped = this.escapeHtml(raw);
            return autoKeywordHighlight ? this.highlightKeywordTokens(escaped, options) : escaped;
        }

        // Autoriser un sous-ensemble de balises de mise en forme utilises dans les JSON.
        const stripped = raw.replace(/<\/?(span|code|strong|em|mark)\b[^>]*>/gi, '');
        if (stripped.includes('<') || stripped.includes('>')) {
            const escaped = this.escapeHtml(raw);
            return autoKeywordHighlight ? this.highlightKeywordTokens(escaped, options) : escaped;
        }

        const hasInlineMarkup = /<\/?(span|code|strong|em|mark)\b[^>]*>/i.test(raw);
        if (hasInlineMarkup) {
            return raw;
        }

        return autoKeywordHighlight ? this.highlightKeywordTokens(raw, options) : raw;
    },

    getInspectorStore() {
        if (!this._inspectorStore) {
            this._inspectorStore = new WeakMap();
        }
        return this._inspectorStore;
    },

    resolveInspectorContainer(containerOrId) {
        if (containerOrId && typeof containerOrId === 'object' && containerOrId.nodeType === 1) {
            return containerOrId;
        }
        const containerId = typeof containerOrId === 'string' ? containerOrId : 'pseudocode-container';
        return document.getElementById(containerId);
    },

    unbindLineInspector(containerOrId = 'pseudocode-container') {
        const container = this.resolveInspectorContainer(containerOrId);
        if (!container) return false;
        const store = this.getInspectorStore();
        const record = store.get(container);
        if (record && typeof record.abort === 'function') {
            record.abort();
        }
        store.delete(container);
        return true;
    },

    renderFromData(data, options = {}) {
        const containerId = options.containerId || 'pseudocode-container';
        const container = document.getElementById(containerId);
        if (!container) return false;

        const blocks = this.getBlocks(data);
        if (blocks.length === 0) return false;

        const lineIdBuilder = typeof options.lineIdBuilder === 'function'
            ? options.lineIdBuilder
            : ((block, lineIndex, lineNumber) => `line${lineNumber}`);

        const renderOptions = {
            ...options,
            domain: options.domain || data?.metadata?.category || ''
        };

        let lineNumber = 1;
        let html = '<div class="card algorithm-code">';

        blocks.forEach((block, blockIdx) => {
            if (block.title && options.showBlockTitles) {
                html += '<div class="text-sm text-muted" style="margin:0.25rem 0 0.35rem 0;">' + this.escapeHtml(block.title) + '</div>';
            }

            (block.lines || []).forEach((line, lineIndex) => {
                const lineId = lineIdBuilder(block, lineIndex, lineNumber);
                html += '<span class="line" id="' + this.escapeHtml(lineId) + '">' + this.renderLineContent(line, renderOptions) + '</span>';
                lineNumber += 1;
            });

            if (blockIdx < blocks.length - 1) {
                html += '<span class="line"></span>';
            }
        });

        html += '</div>';
        container.innerHTML = html;
        return true;
    },

    resolveExplanation(data, lineId, lineText, options = {}) {
        const byLineId = data?.explanations?.byLineId || {};
        const direct = data?.explanations || {};
        const raw = byLineId[lineId] || direct[lineId];

        if (raw && typeof raw === 'object') {
            return {
                what: raw.what || raw.explanation || this.defaultWhat(lineText, options.fallbackWhat),
                why: raw.why || this.defaultWhy(lineText, options.fallbackWhy)
            };
        }

        if (typeof raw === 'string' && raw.trim()) {
            return {
                what: raw.trim(),
                why: this.defaultWhy(lineText, options.fallbackWhy)
            };
        }

        return {
            what: this.defaultWhat(lineText, options.fallbackWhat),
            why: this.defaultWhy(lineText, options.fallbackWhy)
        };
    },

    defaultWhat(lineText, override) {
        if (typeof override === 'function') return override(lineText);
        const txt = (lineText || '').toLowerCase();
        if (txt.includes('tant que') || txt.includes('while') || txt.includes('for')) {
            return 'Cette ligne pilote une itération: on répète des opérations tant que la condition est vraie.';
        }
        if (txt.includes('si') || txt.includes('if')) {
            return 'Cette ligne effectue un test conditionnel pour choisir le prochain chemin d\'exécution.';
        }
        if (txt.includes('retourner') || txt.includes('return')) {
            return 'Cette ligne termine la branche en renvoyant un résultat.';
        }
        if (txt.includes('swap') || txt.includes('permut')) {
            return 'Cette ligne échange des valeurs pour rapprocher la structure de son état attendu.';
        }
        if (txt.includes('pivot')) {
            return 'Cette ligne positionne ou utilise le pivot pour séparer les données.';
        }
        return 'Cette ligne applique une étape de transformation de l\'état courant.';
    },

    defaultWhy(lineText, override) {
        if (typeof override === 'function') return override(lineText);
        const txt = (lineText || '').toLowerCase();
        if (txt.includes('tant que') || txt.includes('while') || txt.includes('for')) {
            return 'On a besoin de répéter ce traitement sur plusieurs éléments pour faire progresser l\'algorithme.';
        }
        if (txt.includes('si') || txt.includes('if')) {
            return 'Le comportement dépend de l\'état courant: ce test évite une action incorrecte.';
        }
        if (txt.includes('retourner') || txt.includes('return')) {
            return 'Le résultat pour cette branche est finalisé: continuer serait inutile ou faux.';
        }
        if (txt.includes('swap') || txt.includes('permut')) {
            return 'L\'échange restaure l\'ordre local attendu et rapproche le tableau de l\'état trié.';
        }
        if (txt.includes('pivot')) {
            return 'Le pivot sert de frontière pour découper le problème en sous-problèmes plus simples.';
        }
        return 'Cette action fait avancer l\'algorithme vers son objectif (trier, chercher ou construire).';
    },

    bindLineInspector(data, options = {}) {
        const containerId = options.containerId || 'pseudocode-container';
        const explainId = options.explainId || 'explain-output';
        const container = document.getElementById(containerId);
        if (!container) return false;

        this.unbindLineInspector(container);

        const explainOutput = options.explainOutput || document.getElementById(explainId);
        const lines = [...container.querySelectorAll('.algorithm-code .line[id]')];
        if (lines.length === 0) return false;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const listenerOptions = controller ? { signal: controller.signal } : undefined;

        const onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
        const renderExplanation = options.renderExplanation !== false;
        const defaultEmptyMessage = options.emptyMessage || 'Aucune ligne sélectionnée. Cliquez sur une ligne de pseudo-code.';

        lines.forEach((line) => {
            line.classList.add('line-clickable');
            line.title = options.clickTitle || 'Cliquer pour voir quoi/pourquoi';
            line.addEventListener('click', () => {
                lines.forEach((el) => el.classList.remove('inspected'));
                line.classList.add('inspected');

                const lineId = line.id;
                const lineText = line.textContent.trim().replace(/\s+/g, ' ');
                const explanation = this.resolveExplanation(data, lineId, lineText, {
                    fallbackWhat: options.fallbackWhat,
                    fallbackWhy: options.fallbackWhy
                });

                if (renderExplanation && explainOutput) {
                    explainOutput.innerHTML =
                        '<strong>Quoi ?</strong> ' + this.escapeHtml(explanation.what) +
                        '<br><strong>Pourquoi ?</strong> ' + this.escapeHtml(explanation.why);
                }

                if (onSelect) {
                    onSelect({ lineId, lineText, explanation, line });
                }
            }, listenerOptions);
        });

        if (options.initializeEmpty !== false && explainOutput && !explainOutput.textContent.trim()) {
            explainOutput.textContent = defaultEmptyMessage;
        }

        const store = this.getInspectorStore();
        store.set(container, {
            abort: () => controller?.abort()
        });

        return true;
    },

    mountFromData(data, options = {}) {
        const rendered = this.renderFromData(data, options);
        if (!rendered) return false;
        this.bindLineInspector(data, options);
        return true;
    }
};

if (typeof window !== 'undefined') {
    window.PseudocodeSupport = PseudocodeSupport;
}
