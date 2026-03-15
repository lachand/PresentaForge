// @ts-check
/**
 * Whiteboard controller for viewer/presenter mode.
 * Keeps all drawing state isolated from viewer-main.
 *
 * Coordinates are stored in a canonical 1280x720 space so that
 * drawings can be synced and replayed independently of viewport size.
 *
 * @typedef {{ x: number, y: number }} WhiteboardPoint
 * @typedef {{
 *   kind: 'stroke',
 *   tool: 'pen' | 'highlighter' | 'eraser',
 *   color: string,
 *   size: number,
 *   points: WhiteboardPoint[]
 * }} WhiteboardStroke
 * @typedef {{
 *   kind: 'shape',
 *   shape: 'rect' | 'circle' | 'arrow',
 *   color: string,
 *   size: number,
 *   startX: number,
 *   startY: number,
 *   endX: number,
 *   endY: number
 * }} WhiteboardShape
 * @typedef {WhiteboardStroke | WhiteboardShape} WhiteboardCommand
 * @typedef {{ left: number, top: number, width: number, height: number }} WhiteboardDrawRect
 * @typedef {{
 *   active: boolean,
 *   slideIndex: number,
 *   updatedAt: number,
 *   canvasWidth: number,
 *   canvasHeight: number,
 *   commands: WhiteboardCommand[]
 * }} WhiteboardSyncState
 * @typedef {{
 *   active: boolean,
 *   slideIndex: number,
 *   updatedAt: number,
 *   canvasWidth: number,
 *   canvasHeight: number,
 *   commandCount: number,
 *   imageDataUrl: string,
 *   reason: string
 * }} WhiteboardRecordedFrame
 * @param {{
 *   roomIsActive: () => boolean,
 *   roomBroadcast: (msg: any) => void,
 *   ROOM_MSG: Record<string, string>,
 *   getCurrentSlideIndex: () => number,
 *   storageKey?: string,
 *   storageGetJSON?: (key: string, fallback?: any) => any,
 *   storageSetJSON?: (key: string, value: any) => boolean,
 *   getDrawRect?: () => Partial<WhiteboardDrawRect> | DOMRect | null,
 *   onSyncState?: (state: WhiteboardSyncState & { reason: string }) => void,
 *   shouldRecordFrame?: () => boolean,
 *   onRecordFrame?: (frame: WhiteboardRecordedFrame) => void,
 *   now?: () => number,
 * }} deps
 */
export function createWhiteboardController(deps) {
    const WB_SHAPE_TOOLS = ['rect', 'circle', 'arrow'];
    const WB_ALL_TOOLS = ['pen', 'highlighter', 'eraser', 'rect', 'circle', 'arrow', 'select'];
    const PERSIST_VERSION = 1;
    const BASE_WIDTH = 1280;
    const BASE_HEIGHT = 720;

    const now = typeof deps.now === 'function' ? deps.now : () => Date.now();

    const wb = {
        active: false,
        tool: 'pen',
        color: '#ffffff',
        size: 3,
        drawing: false,
        ctx: null,
        canvas: null,
        preview: null,
        pCtx: null,
        startX: 0,
        startY: 0,
        currentPath: null,
        eraserSnapshot: /** @type {ImageData|null} */ (null),
        drawings: /** @type {Record<string, WhiteboardCommand[]>} */ ({}),
        currentSlide: 0,
        persistTimer: null,
        drawRect: /** @type {WhiteboardDrawRect} */ ({ left: 0, top: 0, width: BASE_WIDTH, height: BASE_HEIGHT }),
        selectedCommandIdx: -1,
    };
    const canPersist = !!deps.storageKey && typeof deps.storageGetJSON === 'function' && typeof deps.storageSetJSON === 'function';
    let initialized = false;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * @returns {WhiteboardDrawRect}
     */
    function resolveDrawRect() {
        const fallback = {
            left: 0,
            top: 0,
            width: Math.max(8, Number(window.innerWidth || BASE_WIDTH)),
            height: Math.max(8, Number(window.innerHeight || BASE_HEIGHT)),
        };
        if (typeof deps.getDrawRect !== 'function') return fallback;
        let raw = null;
        try {
            raw = deps.getDrawRect();
        } catch (_) {
            raw = null;
        }
        if (!raw || typeof raw !== 'object') return fallback;
        const left = Number(raw.left);
        const top = Number(raw.top);
        const width = Number(raw.width);
        const height = Number(raw.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) return fallback;
        return {
            left: Number.isFinite(left) ? left : fallback.left,
            top: Number.isFinite(top) ? top : fallback.top,
            width,
            height,
        };
    }

    /**
     * @param {WhiteboardPoint} point
     * @param {WhiteboardDrawRect} rect
     */
    function toViewportPoint(point, rect) {
        return {
            x: rect.left + (point.x / BASE_WIDTH) * rect.width,
            y: rect.top + (point.y / BASE_HEIGHT) * rect.height,
        };
    }

    /**
     * @param {PointerEvent} event
     * @param {boolean} allowOutside
     * @returns {WhiteboardPoint | null}
     */
    function pointerToBasePoint(event, allowOutside) {
        const rect = wb.drawRect || resolveDrawRect();
        const cx = Number(event.clientX);
        const cy = Number(event.clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
        const rawX = cx - rect.left;
        const rawY = cy - rect.top;
        if (!allowOutside) {
            if (rawX < 0 || rawY < 0 || rawX > rect.width || rawY > rect.height) return null;
        }
        const localX = clamp(rawX, 0, rect.width);
        const localY = clamp(rawY, 0, rect.height);
        const x = (localX / Math.max(1, rect.width)) * BASE_WIDTH;
        const y = (localY / Math.max(1, rect.height)) * BASE_HEIGHT;
        return { x: clamp(x, 0, BASE_WIDTH), y: clamp(y, 0, BASE_HEIGHT) };
    }

    function init() {
        if (initialized) return;
        initialized = true;
        wb.canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wb-canvas'));
        wb.ctx = wb.canvas.getContext('2d');
        wb.preview = /** @type {HTMLCanvasElement} */ (document.getElementById('wb-preview'));
        wb.pCtx = wb.preview.getContext('2d');

        if (!wb.canvas || !wb.ctx || !wb.preview || !wb.pCtx) return;

        loadPersisted();
        wb.currentSlide = normalizeSlideIndex(deps.getCurrentSlideIndex?.());
        resize();
        window.addEventListener('resize', resize);

        wb.canvas.addEventListener('pointerdown', start);
        wb.canvas.addEventListener('pointermove', move);
        wb.canvas.addEventListener('pointerup', end);
        wb.canvas.addEventListener('pointerleave', end);

        document.getElementById('wb-pen')?.addEventListener('click', () => setTool('pen'));
        document.getElementById('wb-highlighter')?.addEventListener('click', () => setTool('highlighter'));
        document.getElementById('wb-eraser')?.addEventListener('click', () => setTool('eraser'));
        document.getElementById('wb-rect')?.addEventListener('click', () => setTool('rect'));
        document.getElementById('wb-circle')?.addEventListener('click', () => setTool('circle'));
        document.getElementById('wb-arrow')?.addEventListener('click', () => setTool('arrow'));
        document.getElementById('wb-select')?.addEventListener('click', () => setTool('select'));
        document.getElementById('wb-delete')?.addEventListener('click', deleteSelected);
        document.querySelectorAll('.wb-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.wb-color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                wb.color = /** @type {HTMLElement} */ (btn).dataset.color || '#ffffff';
                // Only switch to pen if we were on eraser or select — keep highlighter/shapes
                const keepTools = ['pen', 'highlighter', 'rect', 'circle', 'arrow'];
                if (!keepTools.includes(wb.tool)) setTool('pen');
            });
        });
        document.getElementById('wb-size')?.addEventListener('input', e => {
            wb.size = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 3;
        });
        document.getElementById('wb-clear')?.addEventListener('click', clearCurrent);
        document.getElementById('wb-close')?.addEventListener('click', toggle);
        document.getElementById('btn-whiteboard')?.addEventListener('click', toggle);
        document.addEventListener('keydown', e => {
            if (!wb.active) return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && wb.tool === 'select') {
                deleteSelected();
            }
        });

        emitSyncState('init', false);
    }

    /**
     * @param {any} value
     * @returns {number}
     */
    function normalizeSlideIndex(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.trunc(n));
    }

    function storageGetCommands(slide) {
        const key = String(slide);
        if (!Array.isArray(wb.drawings[key])) wb.drawings[key] = [];
        return wb.drawings[key];
    }

    function applyStrokeStyle(ctx, tool, color, size) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = size * 2;
            ctx.globalAlpha = 1;
            return;
        }
        if (tool === 'highlighter') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = size * 2.5;
            ctx.globalAlpha = 0.25;
            return;
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.globalAlpha = 1;
    }

    /**
     * Draw a smooth Bézier path through the given points.
     * Uses midpoint quadratic curves so strokes look fluid instead of polygonal.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ x: number, y: number }[]} pts
     */
    function drawSmoothPath(ctx, pts) {
        if (pts.length < 2) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
            ctx.lineTo(pts[1].x, pts[1].y);
            return;
        }
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2;
            const my = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }

    /**
     * Point-to-segment distance (2D).
     * @param {number} px @param {number} py
     * @param {number} ax @param {number} ay
     * @param {number} bx @param {number} by
     * @returns {number}
     */
    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    /**
     * Hit-test stored commands in canonical space. Returns last (topmost) matching index or -1.
     * @param {WhiteboardCommand[]} commands
     * @param {number} cx @param {number} cy
     * @returns {number}
     */
    function hitTestCommands(commands, cx, cy) {
        const BASE_THRESHOLD = 10;
        for (let i = commands.length - 1; i >= 0; i--) {
            const cmd = commands[i];
            const threshold = BASE_THRESHOLD + (cmd.size || 3);
            if (cmd.kind === 'stroke') {
                const pts = cmd.points;
                for (let j = 0; j < pts.length - 1; j++) {
                    if (distToSegment(cx, cy, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) <= threshold) {
                        return i;
                    }
                }
            } else if (cmd.kind === 'shape') {
                if (cmd.shape === 'rect') {
                    const x1 = Math.min(cmd.startX, cmd.endX);
                    const y1 = Math.min(cmd.startY, cmd.endY);
                    const x2 = Math.max(cmd.startX, cmd.endX);
                    const y2 = Math.max(cmd.startY, cmd.endY);
                    const dLeft   = distToSegment(cx, cy, x1, y1, x1, y2);
                    const dRight  = distToSegment(cx, cy, x2, y1, x2, y2);
                    const dTop    = distToSegment(cx, cy, x1, y1, x2, y1);
                    const dBottom = distToSegment(cx, cy, x1, y2, x2, y2);
                    if (Math.min(dLeft, dRight, dTop, dBottom) <= threshold) return i;
                } else if (cmd.shape === 'circle') {
                    const r = Math.hypot(cmd.endX - cmd.startX, cmd.endY - cmd.startY);
                    if (Math.abs(Math.hypot(cx - cmd.startX, cy - cmd.startY) - r) <= threshold) return i;
                } else if (cmd.shape === 'arrow') {
                    if (distToSegment(cx, cy, cmd.startX, cmd.startY, cmd.endX, cmd.endY) <= threshold) return i;
                }
            }
        }
        return -1;
    }

    /**
     * Draw a selection highlight for the command at index on the preview canvas.
     * @param {number} idx
     */
    function drawSelectionHighlight(idx) {
        if (!wb.pCtx || !wb.preview || idx < 0) return;
        const commands = storageGetCommands(wb.currentSlide);
        const cmd = commands[idx];
        if (!cmd) return;
        wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
        wb.pCtx.save();
        wb.pCtx.translate(wb.drawRect.left, wb.drawRect.top);
        wb.pCtx.scale(wb.drawRect.width / BASE_WIDTH, wb.drawRect.height / BASE_HEIGHT);
        // Draw thick semi-transparent cyan halo
        wb.pCtx.globalAlpha = 0.45;
        wb.pCtx.globalCompositeOperation = 'source-over';
        wb.pCtx.strokeStyle = '#00e5ff';
        wb.pCtx.lineCap = 'round';
        wb.pCtx.lineJoin = 'round';
        if (cmd.kind === 'stroke') {
            wb.pCtx.lineWidth = (cmd.size + 8) * (cmd.tool === 'highlighter' ? 2.5 : 1);
            wb.pCtx.beginPath();
            drawSmoothPath(wb.pCtx, cmd.points);
            wb.pCtx.stroke();
        } else if (cmd.kind === 'shape') {
            wb.pCtx.lineWidth = cmd.size + 8;
            if (cmd.shape === 'rect') {
                wb.pCtx.strokeRect(cmd.startX, cmd.startY, cmd.endX - cmd.startX, cmd.endY - cmd.startY);
            } else if (cmd.shape === 'circle') {
                const r = Math.hypot(cmd.endX - cmd.startX, cmd.endY - cmd.startY);
                wb.pCtx.beginPath();
                wb.pCtx.arc(cmd.startX, cmd.startY, r, 0, Math.PI * 2);
                wb.pCtx.stroke();
            } else if (cmd.shape === 'arrow') {
                drawArrow(wb.pCtx, cmd.startX, cmd.startY, cmd.endX, cmd.endY, cmd.size + 8);
            }
        }
        wb.pCtx.restore();
        // Show delete button
        document.getElementById('wb-delete')?.classList.remove('hidden');
    }

    function clearSelection() {
        if (wb.selectedCommandIdx < 0) return;
        wb.selectedCommandIdx = -1;
        if (wb.pCtx && wb.preview) wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
        document.getElementById('wb-delete')?.classList.add('hidden');
    }

    function deleteSelected() {
        if (wb.selectedCommandIdx < 0) return;
        const commands = storageGetCommands(wb.currentSlide);
        commands.splice(wb.selectedCommandIdx, 1);
        clearSelection();
        renderSlide(wb.currentSlide);
        persistSoon();
        emitSyncState('delete', true);
    }

    function drawArrow(ctx, x1, y1, x2, y2, lineWidth) {
        const headlen = 10 + lineWidth;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {WhiteboardCommand} command
     */
    function drawCommandCanonical(ctx, command) {
        if (!command || typeof command !== 'object') return;
        if (command.kind === 'stroke') {
            if (!Array.isArray(command.points) || command.points.length < 2) return;
            ctx.save();
            applyStrokeStyle(ctx, command.tool, command.color, command.size);
            ctx.beginPath();
            drawSmoothPath(ctx, command.points);
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (command.kind === 'shape') {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = command.color;
            ctx.lineWidth = command.size;

            if (command.shape === 'rect') {
                ctx.strokeRect(command.startX, command.startY, command.endX - command.startX, command.endY - command.startY);
            } else if (command.shape === 'circle') {
                const r = Math.hypot(command.endX - command.startX, command.endY - command.startY);
                ctx.beginPath();
                ctx.arc(command.startX, command.startY, r, 0, Math.PI * 2);
                ctx.stroke();
            } else if (command.shape === 'arrow') {
                drawArrow(ctx, command.startX, command.startY, command.endX, command.endY, command.size);
            }
            ctx.restore();
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {WhiteboardCommand} command
     * @param {WhiteboardDrawRect} rect
     */
    function drawCommandInRect(ctx, command, rect) {
        ctx.save();
        ctx.translate(rect.left, rect.top);
        ctx.scale(rect.width / BASE_WIDTH, rect.height / BASE_HEIGHT);
        drawCommandCanonical(ctx, command);
        ctx.restore();
    }

    function clearCanvasLayers() {
        if (wb.ctx && wb.canvas) wb.ctx.clearRect(0, 0, wb.canvas.width, wb.canvas.height);
        if (wb.pCtx && wb.preview) wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
    }

    function renderSlide(idx) {
        if (!wb.ctx || !wb.canvas || !wb.pCtx || !wb.preview) return;
        wb.drawRect = resolveDrawRect();
        wb.ctx.clearRect(0, 0, wb.canvas.width, wb.canvas.height);
        const commands = storageGetCommands(idx);
        commands.forEach(cmd => drawCommandInRect(wb.ctx, cmd, wb.drawRect));
        wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
        if (wb.selectedCommandIdx >= 0) {
            drawSelectionHighlight(wb.selectedCommandIdx);
        }
    }

    function resize() {
        if (!wb.canvas || !wb.preview || !wb.ctx || !wb.pCtx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(window.innerWidth || BASE_WIDTH));
        const h = Math.max(1, Math.floor(window.innerHeight || BASE_HEIGHT));

        wb.canvas.width = Math.floor(w * dpr);
        wb.canvas.height = Math.floor(h * dpr);
        wb.canvas.style.width = `${w}px`;
        wb.canvas.style.height = `${h}px`;
        if (typeof wb.ctx.setTransform === 'function') wb.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        wb.preview.width = Math.floor(w * dpr);
        wb.preview.height = Math.floor(h * dpr);
        wb.preview.style.width = `${w}px`;
        wb.preview.style.height = `${h}px`;
        if (typeof wb.pCtx.setTransform === 'function') wb.pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (wb.active) renderSlide(wb.currentSlide);
        else clearCanvasLayers();
    }

    function persistSoon() {
        if (!canPersist) return;
        if (wb.persistTimer) clearTimeout(wb.persistTimer);
        wb.persistTimer = setTimeout(() => {
            wb.persistTimer = null;
            deps.storageSetJSON?.(deps.storageKey, {
                v: PERSIST_VERSION,
                updatedAt: now(),
                slides: wb.drawings,
            });
        }, 220);
    }

    function sanitizePoint(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const x = Number(raw.x);
        const y = Number(raw.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {
            x: clamp(x, 0, BASE_WIDTH),
            y: clamp(y, 0, BASE_HEIGHT),
        };
    }

    /**
     * @param {unknown} raw
     * @returns {WhiteboardCommand[]}
     */
    function sanitizeCommands(raw) {
        if (!Array.isArray(raw)) return [];
        /** @type {WhiteboardCommand[]} */
        const out = [];
        raw.forEach(item => {
            if (!item || typeof item !== 'object') return;
            if (item.kind === 'stroke') {
                const tool = WB_ALL_TOOLS.includes(item.tool) ? item.tool : 'pen';
                if (!['pen', 'highlighter', 'eraser'].includes(tool)) return;
                const size = Number(item.size);
                if (!Number.isFinite(size) || size <= 0) return;
                const color = typeof item.color === 'string' ? item.color : '#ffffff';
                const points = Array.isArray(item.points) ? item.points.map(sanitizePoint).filter(Boolean) : [];
                if (points.length < 2) return;
                out.push({
                    kind: 'stroke',
                    tool,
                    color,
                    size,
                    points,
                });
                return;
            }
            if (item.kind === 'shape') {
                const shape = WB_SHAPE_TOOLS.includes(item.shape) ? item.shape : 'rect';
                const size = Number(item.size);
                const sx = clamp(Number(item.startX), 0, BASE_WIDTH);
                const sy = clamp(Number(item.startY), 0, BASE_HEIGHT);
                const ex = clamp(Number(item.endX), 0, BASE_WIDTH);
                const ey = clamp(Number(item.endY), 0, BASE_HEIGHT);
                if (![size, sx, sy, ex, ey].every(Number.isFinite) || size <= 0) return;
                const color = typeof item.color === 'string' ? item.color : '#ffffff';
                out.push({
                    kind: 'shape',
                    shape,
                    color,
                    size,
                    startX: sx,
                    startY: sy,
                    endX: ex,
                    endY: ey,
                });
            }
        });
        return out;
    }

    function loadPersisted() {
        if (!canPersist) return;
        const payload = deps.storageGetJSON?.(deps.storageKey, null);
        if (!payload || typeof payload !== 'object' || payload.v !== PERSIST_VERSION) return;
        const slides = payload.slides;
        if (!slides || typeof slides !== 'object') return;

        wb.drawings = {};
        Object.entries(slides).forEach(([slideKey, commands]) => {
            wb.drawings[String(slideKey)] = sanitizeCommands(commands);
        });
    }

    /**
     * @returns {WhiteboardSyncState}
     */
    function getSyncState() {
        const slideIndex = normalizeSlideIndex(wb.currentSlide);
        const commands = sanitizeCommands(storageGetCommands(slideIndex));
        return {
            active: !!wb.active,
            slideIndex,
            updatedAt: now(),
            canvasWidth: BASE_WIDTH,
            canvasHeight: BASE_HEIGHT,
            commands,
        };
    }

    /**
     * @param {number} slideIndex
     * @returns {string}
     */
    function buildSlideImageDataUrl(slideIndex) {
        try {
            const offscreen = document.createElement('canvas');
            offscreen.width = BASE_WIDTH;
            offscreen.height = BASE_HEIGHT;
            const ctx = offscreen.getContext('2d');
            if (!ctx) return '';
            ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
            const commands = sanitizeCommands(storageGetCommands(slideIndex));
            commands.forEach(command => drawCommandCanonical(ctx, command));
            return offscreen.toDataURL('image/png');
        } catch (_) {
            return '';
        }
    }

    /**
     * @param {string} reason
     * @param {boolean} recordFrame
     */
    function emitSyncState(reason = '', recordFrame = false) {
        const state = getSyncState();
        if (typeof deps.onSyncState === 'function') {
            deps.onSyncState({ ...state, reason: String(reason || '').slice(0, 40) });
        }
        if (recordFrame && typeof deps.onRecordFrame === 'function') {
            const shouldRecordFrame = typeof deps.shouldRecordFrame === 'function' ? deps.shouldRecordFrame() : true;
            if (!shouldRecordFrame) return state;
            const imageDataUrl = buildSlideImageDataUrl(state.slideIndex);
            deps.onRecordFrame({
                active: state.active,
                slideIndex: state.slideIndex,
                updatedAt: state.updatedAt,
                canvasWidth: state.canvasWidth,
                canvasHeight: state.canvasHeight,
                commandCount: state.commands.length,
                imageDataUrl,
                reason: String(reason || '').slice(0, 40),
            });
        }
        return state;
    }

    function toggle() {
        if (!wb.canvas || !wb.preview) return;
        wb.active = !wb.active;
        wb.canvas.classList.toggle('active', wb.active);
        wb.preview.classList.toggle('active', wb.active);
        document.getElementById('wb-toolbar')?.classList.toggle('active', wb.active);
        document.getElementById('btn-whiteboard')?.classList.toggle('active', wb.active);
        document.getElementById('pv-btn-whiteboard')?.classList.toggle('active', wb.active);

        if (wb.active) {
            wb.currentSlide = normalizeSlideIndex(deps.getCurrentSlideIndex?.());
            renderSlide(wb.currentSlide);
            if (deps.roomIsActive()) {
                deps.roomBroadcast({ type: deps.ROOM_MSG.REACTION_SHOW, emoji: '✏️', pseudo: 'Prof' });
            }
        } else {
            persistSoon();
            clearCanvasLayers();
        }
        emitSyncState('toggle', true);
    }

    function setTool(tool) {
        if (tool !== 'select') clearSelection();
        wb.tool = tool;
        document.querySelectorAll('.wb-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`wb-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    /**
     * @param {PointerEvent} event
     */
    function start(event) {
        if (!wb.active || !wb.canvas || !wb.ctx) return;
        wb.drawRect = resolveDrawRect();
        const point = pointerToBasePoint(event, false);
        if (!point) return;

        if (wb.tool === 'select') {
            // Hit test in canonical space
            const commands = storageGetCommands(wb.currentSlide);
            const idx = hitTestCommands(commands, point.x, point.y);
            if (idx !== wb.selectedCommandIdx) {
                clearSelection();
            }
            wb.selectedCommandIdx = idx;
            if (idx >= 0) {
                drawSelectionHighlight(idx);
            }
            return;
        }

        clearSelection();
        wb.drawing = true;
        wb.startX = point.x;
        wb.startY = point.y;

        if (!WB_SHAPE_TOOLS.includes(wb.tool)) {
            /** @type {WhiteboardStroke} */
            wb.currentPath = {
                kind: 'stroke',
                tool: wb.tool === 'eraser' ? 'eraser' : (wb.tool === 'highlighter' ? 'highlighter' : 'pen'),
                color: wb.color,
                size: wb.size,
                points: [point],
            };
            // Eraser: snapshot the main canvas so we can restore+redraw on every move
            if (wb.tool === 'eraser' && wb.canvas) {
                wb.eraserSnapshot = wb.ctx.getImageData(0, 0, wb.canvas.width, wb.canvas.height);
            }
        }
    }

    /**
     * Redraw the current in-progress stroke on the preview canvas using smooth Bézier curves.
     * Called every pointermove — clears preview and redraws from scratch for smooth result.
     */
    function redrawLiveStroke() {
        if (!wb.currentPath || !wb.pCtx || !wb.preview) return;
        const pts = wb.currentPath.points;
        if (pts.length < 2) return;

        // Eraser: restore snapshot on main canvas then draw the eraser path there
        if (wb.currentPath.tool === 'eraser' && wb.eraserSnapshot && wb.ctx && wb.canvas) {
            wb.ctx.putImageData(wb.eraserSnapshot, 0, 0);
            wb.ctx.save();
            wb.ctx.translate(wb.drawRect.left, wb.drawRect.top);
            wb.ctx.scale(wb.drawRect.width / BASE_WIDTH, wb.drawRect.height / BASE_HEIGHT);
            applyStrokeStyle(wb.ctx, 'eraser', wb.currentPath.color, wb.currentPath.size);
            wb.ctx.beginPath();
            drawSmoothPath(wb.ctx, pts);
            wb.ctx.stroke();
            wb.ctx.restore();
            wb.ctx.globalCompositeOperation = 'source-over';
            return;
        }

        // Other strokes: draw on preview canvas
        wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
        wb.pCtx.save();
        wb.pCtx.translate(wb.drawRect.left, wb.drawRect.top);
        wb.pCtx.scale(wb.drawRect.width / BASE_WIDTH, wb.drawRect.height / BASE_HEIGHT);
        applyStrokeStyle(wb.pCtx, wb.currentPath.tool, wb.currentPath.color, wb.currentPath.size);
        wb.pCtx.beginPath();
        drawSmoothPath(wb.pCtx, pts);
        wb.pCtx.stroke();
        wb.pCtx.restore();
    }

    /**
     * @param {PointerEvent} event
     */
    function move(event) {
        if (!wb.active || !wb.drawing || !wb.ctx || !wb.pCtx || !wb.preview) return;
        const point = pointerToBasePoint(event, true);
        if (!point) return;

        if (WB_SHAPE_TOOLS.includes(wb.tool)) {
            wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
            /** @type {WhiteboardShape} */
            const shapeCommand = {
                kind: 'shape',
                shape: /** @type {'rect'|'circle'|'arrow'} */ (wb.tool),
                color: wb.color,
                size: wb.size,
                startX: wb.startX,
                startY: wb.startY,
                endX: point.x,
                endY: point.y,
            };
            drawCommandInRect(wb.pCtx, shapeCommand, wb.drawRect);
            return;
        }

        if (!wb.currentPath) return;
        wb.currentPath.points.push(point);
        // All strokes: clear preview and redraw smooth Bézier path from scratch
        redrawLiveStroke();
    }

    /**
     * @param {PointerEvent} event
     */
    function end(event) {
        if (!wb.active || !wb.drawing || !wb.ctx || !wb.pCtx || !wb.preview) return;
        wb.drawing = false;

        const point = pointerToBasePoint(event, true)
            || /** @type {WhiteboardPoint} */ ({ x: wb.startX, y: wb.startY });

        if (WB_SHAPE_TOOLS.includes(wb.tool)) {
            /** @type {WhiteboardShape} */
            const shapeCommand = {
                kind: 'shape',
                shape: /** @type {'rect'|'circle'|'arrow'} */ (wb.tool),
                color: wb.color,
                size: wb.size,
                startX: wb.startX,
                startY: wb.startY,
                endX: point.x,
                endY: point.y,
            };
            storageGetCommands(wb.currentSlide).push(shapeCommand);
            drawCommandInRect(wb.ctx, shapeCommand, wb.drawRect);
            wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
            persistSoon();
            emitSyncState('draw', true);
            return;
        }

        if (wb.currentPath && wb.currentPath.points.length > 1) {
            wb.currentPath.points.push(point);
            storageGetCommands(wb.currentSlide).push(wb.currentPath);
            // Commit: clear preview canvas, render final smooth stroke once on main canvas
            wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
            // Eraser: main canvas already up-to-date from last redrawLiveStroke call
            if (wb.currentPath.tool !== 'eraser') {
                drawCommandInRect(wb.ctx, wb.currentPath, wb.drawRect);
            }
            wb.eraserSnapshot = null;
            wb.ctx.globalAlpha = 1;
            wb.ctx.globalCompositeOperation = 'source-over';
            persistSoon();
            emitSyncState('draw', true);
        }
        wb.currentPath = null;
    }

    function clearCurrent() {
        clearSelection();
        delete wb.drawings[String(wb.currentSlide)];
        renderSlide(wb.currentSlide);
        persistSoon();
        emitSyncState('clear', true);
    }

    /**
     * @param {number} newIndex
     */
    function onSlideChange(newIndex) {
        wb.currentSlide = normalizeSlideIndex(newIndex);
        if (!wb.active) return;
        renderSlide(wb.currentSlide);
        emitSyncState('slide', true);
    }

    function refresh() {
        if (!wb.active) return;
        renderSlide(wb.currentSlide);
    }

    /**
     * @param {string} [reason]
     */
    function captureFrame(reason = 'capture') {
        emitSyncState(reason, true);
    }

    return {
        init,
        toggle,
        onSlideChange,
        refresh,
        captureFrame,
        getSyncState,
    };
}
