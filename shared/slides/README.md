# `shared/slides/` — runtime PresentaForge

Runtime et UI du sous-système slides. **Vanilla JS, aucun build step.** Voir
`slides/CLAUDE.md` (miroir, périmètre) et `docs/developer/PRESENTAFORGE_REVUE_CODE_2026-08.md`
(état courant).

## Chaîne de rendu (le cœur)

```
SlidesShared.buildRenderOptions(data)        // options canoniques : chapterNumbers,
   → SlidesRenderer.renderSlide(slide, i, opts)   //   captionRegistry, footerConfig, typography
   → SlidesRenderer.mountRuntimeElements(container, reveal, { includeSpecial, includeWidgets })
        ├─ éléments spéciaux  (OEISlidesSpecialRuntime : KaTeX / Mermaid / timer / code-live /
        │                       quiz-live / live-runtime)
        └─ widgets            (mountWidgets → OEI_WIDGET_REGISTRY → Cls.mount(slot, cfg))
```

`slides-core.js` = `SlidesShared` + `SlidesRenderer` + `SlidesThemes` (délégué à
`slides-themes.js`). **Toute nouvelle surface de rendu réutilise ce chemin, ne le
réimplémente pas.** Les slides `type:"canvas"` sont déléguées à
`slides-renderer-canvas.js` (préfixe CSS `sl-`) ; l'éditeur a un 2ᵉ moteur pour le WYSIWYG
(`slides-canvas-content-runtime.js`, préfixe `cel-`) — chantier d'unification en cours.

## Ordre de chargement (fragile — scripts classiques)

`slides-typography.js` **avant** `slides-core.js` **avant** `slides-themes.js` /
`slides-diagram-renderer.js` / `slides-renderer-canvas.js`. Les sous-runtimes
`slides-special-*-runtime.js` avant `slides-special-runtime.js` avant `slides-core.js`.
Vérifié par `tools/slides/refactor-guard.mjs` (`loadedBefore`). Chaque page a sa séquence :
`slides/viewer.html` (scripts inline), `slides/editor-bootstrap.js` /
`slides/student-bootstrap.js` (loader ESM séquentiel).

## Contrats

| Contrat | Fichier | Testé |
|---|---|---|
| Deck / slide | schéma implicite (renderer + `import-pipeline.js`), `schemaVersion = 2`, migration `migratePresentationSchema` | `render-golden`, `import-pipeline` |
| Temps réel | `realtime-contract.js` (`SYNC_MSG` BroadcastChannel, `ROOM_MSG` PeerJS/relay) | `realtime-contract.test.mjs` |
| Transport | `network-session.js` (PeerJS + fallback relay) | `network-session.test.mjs` |
| Relay serveur | `relay/relay-core.mjs` | `relay-server.test.mjs` |
| Replay | `replay-contract.mjs` (`oei-replay-*-v1`) | `replay-contract` / `replay-interop` |
| Plugins widgets | `widget-plugins.js` (`OEIWidgetPlugins.install/remove/…`, `apiVersion`) | `plugin-policy.test.mjs` |
| Registre widgets | `shared/components/base/WidgetRegistry.js` (`OEI_WIDGET_REGISTRY`) | `widget-registry.test.mjs` |
| Storage | `storage.js` (`oei-v2-*` + fallback `v1`/legacy) | — |

## Barrière QA

```bash
npm run qa:slides          # guard + audit inline + audit sécurité + budgets + node:test + docs API
UPDATE_GOLDEN=1 node --test tests/slides/render-golden.test.mjs   # régénérer les golden après un changement de rendu VOULU
bash tools/slides/capture-render-matrix.sh                        # captures headless multi-surfaces
```

Budgets : `tools/slides/refactor-metrics-budget.json` (ratchet, ne doivent que baisser).

## Gros fichiers / dette

`student-main.js` (île de rendu, Lot 20), `editor-ai-pipeline.js` (Lot 19),
`viewer-main.js`, `editor-props-panel.js`, `editor-export.js`. Détail et plan :
`docs/developer/PRESENTAFORGE_PLAN_EXECUTION_2026-08.md`.
