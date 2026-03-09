#!/usr/bin/env node
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    buildReplayPayload,
    buildReplayStandaloneHtml,
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

async function handleBuild(req, res) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        sendJson(res, 415, { error: 'Content-Type attendu: application/json' });
        return;
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        const code = err?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
        sendJson(res, code, { error: err?.message || 'Body JSON invalide' });
        return;
    }

    if (!body || typeof body !== 'object') {
        sendJson(res, 400, { error: 'Body JSON invalide' });
        return;
    }
    if (!body.slidesData || typeof body.slidesData !== 'object') {
        sendJson(res, 400, { error: 'Champ requis manquant: slidesData (objet)' });
        return;
    }

    try {
        const payload = await buildReplayPayload({
            slidesData: body.slidesData,
            sessionData: body.sessionData && typeof body.sessionData === 'object' ? body.sessionData : null,
            inlineAudioTracks: Array.isArray(body.inlineAudioTracks) ? body.inlineAudioTracks : [],
            defaultSlideMs: Number(body.defaultSlideMs) || undefined,
            title: typeof body.title === 'string' ? body.title : '',
        });
        const html = await buildReplayStandaloneHtml(payload);
        sendJson(res, 200, {
            html,
            stats: {
                slideCount: Array.isArray(payload.slidesData?.slides) ? payload.slidesData.slides.length : 0,
                eventCount: Array.isArray(payload.session?.events) ? payload.session.events.length : 0,
                audioTrackCount: Array.isArray(payload.audioTracks) ? payload.audioTracks.length : 0,
                durationMs: Number(payload.session?.durationMs || 0),
            },
        });
    } catch (err) {
        sendJson(res, 400, { error: err?.message || 'Erreur de génération replay' });
    }
}

export function createReplayApiServer() {
    return createServer(async (req, res) => {
        const method = String(req.method || 'GET').toUpperCase();
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (method === 'GET' && samePath(url, '/api/replay/healthz')) {
            sendJson(res, 200, { ok: true, service: 'replay-api' });
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
        console.log('POST /api/replay/build');
        console.log('GET  /api/replay/healthz');
        console.log('GET  /api/replay/openapi.yaml');
    });
    return server;
}

const cliEntryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === cliEntryUrl) {
    startReplayApiServer();
}
