#!/usr/bin/env node
/**
 * Serveur relay WebSocket PresentaForge — dev local (`npm run relay:server` / `relay:kit`).
 *
 * Même logique que `relay/relay-server.mjs` (via `relay/relay-core.mjs`) mais avec l'API
 * replay servie sur le même port pour le confort du dev. En prod, Render déploie les deux
 * comme services séparés (voir `render.yaml`).
 */

import { createRelayServer } from '../../relay/relay-core.mjs';
import { handleApiRequest } from './replay-api-server.mjs';

const relay = createRelayServer({ handleApiRequest });
relay.listen();

function shutdown() {
    relay.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
