#!/usr/bin/env node
/**
 * Serveur relay WebSocket PresentaForge — déploiement Render autonome (`rootDir: relay`).
 *
 * La logique est dans `relay-core.mjs` (partagée avec `tools/slides/relay-server.mjs`).
 * Ici : pas d'API replay (service séparé sur Render), et bootstrap + signaux.
 */

import { createRelayServer } from './relay-core.mjs';

const relay = createRelayServer({ handleApiRequest: async () => false });
relay.listen();

function shutdown() {
    relay.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
