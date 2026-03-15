#!/usr/bin/env node
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    buildReplayPayload,
    buildReplayStandaloneHtml,
    buildSlidesStandaloneHtml,
} from './replay-standalone.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OPENAPI_PATH = path.join(REPO_ROOT, 'docs', 'developer', 'replay-api', 'openapi.yaml');

const HOST = process.env.REPLAY_API_HOST || '0.0.0.0';
const PORT = Math.max(1, Math.min(65535, Number(process.env.REPLAY_API_PORT || process.env.PORT || 8090) || 8090));
const MAX_BODY_BYTES = Math.max(1024 * 1024, Number(process.env.REPLAY_API_MAX_BODY || 30 * 1024 * 1024) || (30 * 1024 * 1024));

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(text),
        'Cache-Control': 'no-store',
    });
    res.end(text);
}

function samePath(url, expected) {
    return url.pathname.replace(/\/+$/, '') === expected.replace(/\/+$/, '');
}

async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        total += chunk.length;
        if (total > MAX_BODY_BYTES) {
            const err = new Error(`Payload too large (>${MAX_BODY_BYTES} bytes)`);
            err.code = 'PAYLOAD_TOO_LARGE';
            throw err;
        }
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
}

async function readBuildRequest(req, res) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        sendJson(res, 415, { error: 'Content-Type attendu: application/json' });
        return null;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        const code = err?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
        sendJson(res, code, { error: err?.message || 'Body JSON invalide' });
        return null;
    }

    if (!body || typeof body !== 'object') {
        sendJson(res, 400, { error: 'Body JSON invalide' });
        return null;
    }
    if (!body.slidesData || typeof body.slidesData !== 'object') {
        sendJson(res, 400, { error: 'Champ requis manquant: slidesData (objet)' });
        return null;
    }
    return body;
}

async function buildReplayPayloadFromRequest(body) {
    return buildReplayPayload({
        slidesData: body.slidesData,
        sessionData: body.sessionData && typeof body.sessionData === 'object' ? body.sessionData : null,
        inlineAudioTracks: Array.isArray(body.inlineAudioTracks) ? body.inlineAudioTracks : [],
        defaultSlideMs: Number(body.defaultSlideMs) || undefined,
        title: typeof body.title === 'string' ? body.title : '',
    });
}

function buildReplayStats(payload) {
    return {
        slideCount: Array.isArray(payload.slidesData?.slides) ? payload.slidesData.slides.length : 0,
        eventCount: Array.isArray(payload.session?.events) ? payload.session.events.length : 0,
        audioTrackCount: Array.isArray(payload.audioTracks) ? payload.audioTracks.length : 0,
        durationMs: Number(payload.session?.durationMs || 0),
    };
}

async function handleBuild(req, res) {
    const body = await readBuildRequest(req, res);
    if (!body) return;

    try {
        const payload = await buildReplayPayloadFromRequest(body);
        const html = await buildReplayStandaloneHtml(payload);
        sendJson(res, 200, {
            html,
            stats: buildReplayStats(payload),
        });
    } catch (err) {
        sendJson(res, 400, { error: err?.message || 'Erreur de génération replay' });
    }
}

async function handleDryRun(req, res) {
    const body = await readBuildRequest(req, res);
    if (!body) return;

    try {
        const payload = await buildReplayPayloadFromRequest(body);
        sendJson(res, 200, {
            ok: true,
            stats: buildReplayStats(payload),
        });
    } catch (err) {
        sendJson(res, 400, { error: err?.message || 'Erreur de validation replay' });
    }
}

async function handleSlidesBuild(req, res) {
    const body = await readBuildRequest(req, res);
    if (!body) return;

    if (!body.slidesData || typeof body.slidesData !== 'object') {
        sendJson(res, 400, { error: 'slidesData (objet) requis' });
        return;
    }

    try {
        const html = await buildSlidesStandaloneHtml({
            slidesData: body.slidesData,
            title: typeof body.title === 'string' ? body.title : '',
        });
        const slideCount = Array.isArray(body.slidesData?.slides) ? body.slidesData.slides.length : 0;
        const level = String(body.slidesData?.metadata?.level ?? '').trim();
        sendJson(res, 200, {
            html,
            stats: {
                title: String(body.title || body.slidesData?.metadata?.title || ''),
                slideCount,
                ...(level ? { level } : {}),
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        sendJson(res, 400, { error: err?.message || 'Erreur de génération slides' });
    }
}

async function handleSlidesDryRun(req, res) {
    const body = await readBuildRequest(req, res);
    if (!body) return;

    if (!body.slidesData || typeof body.slidesData !== 'object') {
        sendJson(res, 400, { error: 'slidesData (objet) requis' });
        return;
    }

    const slideCount = Array.isArray(body.slidesData?.slides) ? body.slidesData.slides.length : 0;
    const level = String(body.slidesData?.metadata?.level ?? '').trim();
    sendJson(res, 200, {
        ok: true,
        stats: {
            title: String(body.title || body.slidesData?.metadata?.title || ''),
            slideCount,
            ...(level ? { level } : {}),
        },
    });
}

export function createReplayApiServer() {
    return createServer(async (req, res) => {
        const method = String(req.method || 'GET').toUpperCase();
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (method === 'GET' && samePath(url, '/api/replay/healthz')) {
            sendJson(res, 200, { ok: true, service: 'replay-api' });
            return;
        }

        if (method === 'GET' && (samePath(url, '/api/replay/docs') || samePath(url, '/api/replay/docs/'))) {
            const origin = `${url.protocol}//${url.host}`;
            const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Replay API \u2014 Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
  <style>html,body{margin:0;padding:0;background:#0b1120}#swagger-ui{max-width:1280px;margin:0 auto}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '${origin}/api/replay/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      docExpansion: 'list',
      displayRequestDuration: true,
      presets: [SwaggerUIBundle.presets.apis],
      requestInterceptor: req => { req.headers['Content-Type'] = 'application/json'; return req; }
    });
  </script>
</body>
</html>`;
            sendText(res, 200, html, 'text/html; charset=utf-8');
            return;
        }

        if (method === 'GET' && samePath(url, '/api/replay/openapi.yaml')) {
            try {
                const yaml = await fs.readFile(OPENAPI_PATH, 'utf8');
                sendText(res, 200, yaml, 'application/yaml; charset=utf-8');
            } catch (_) {
                sendJson(res, 500, { error: 'openapi.yaml introuvable' });
            }
            return;
        }

        if (method === 'POST' && samePath(url, '/api/replay/build')) {
            await handleBuild(req, res);
            return;
        }

        if (method === 'POST' && samePath(url, '/api/replay/dry-run')) {
            await handleDryRun(req, res);
            return;
        }

        if (method === 'POST' && samePath(url, '/api/slides/build')) {
            await handleSlidesBuild(req, res);
            return;
        }

        if (method === 'POST' && samePath(url, '/api/slides/dry-run')) {
            await handleSlidesDryRun(req, res);
            return;
        }

        sendJson(res, 404, { error: 'Not found' });
    });
}

export function startReplayApiServer({ host = HOST, port = PORT } = {}) {
    const server = createReplayApiServer();
    server.on('error', (err) => {
        console.error(`Replay API listen error on ${host}:${port} -> ${err?.message || err}`);
    });
    server.listen(port, host, () => {
        console.log(`Replay API listening on http://${host}:${port}`);
        console.log(`Swagger UI  → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api/replay/docs`);
        console.log('POST /api/replay/build');
        console.log('POST /api/replay/dry-run');
        console.log('POST /api/slides/build');
        console.log('POST /api/slides/dry-run');
        console.log('GET  /api/replay/healthz');
        console.log('GET  /api/replay/openapi.yaml');
        console.log('GET  /api/replay/docs');
    });
    return server;
}

const cliEntryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === cliEntryUrl) {
    startReplayApiServer();
}
