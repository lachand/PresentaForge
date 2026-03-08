// @ts-check
/**
 * Whiteboard controller for viewer mode.
 * Keeps all drawing state isolated from viewer-main.
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
 * @param {{
 *   roomIsActive: () => boolean,
 *   roomBroadcast: (msg: any) => void,
 *   ROOM_MSG: Record<string, string>,
 *   getCurrentSlideIndex: () => number,
 *   storageKey?: string,
 *   storageGetJSON?: (key: string, fallback?: any) => any,
 *   storageSetJSON?: (key: string, value: any) => boolean
 * }} deps
 */
export function createWhiteboardController(deps) {
    const WB_SHAPE_TOOLS = ['rect', 'circle', 'arrow'];
    const WB_ALL_TOOLS = ['pen', 'highlighter', 'eraser', 'rect', 'circle', 'arrow'];
    const PERSIST_VERSION = 1;

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
        drawings: /** @type {Record<string, WhiteboardCommand[]>} */ ({}),
        currentSlide: 0,
        persistTimer: null,
    };
    const canPersist = !!deps.storageKey && typeof deps.storageGetJSON === 'function' && typeof deps.storageSetJSON === 'function';
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;
        wb.canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wb-canvas'));
        wb.ctx = wb.canvas.getContext('2d');
        wb.preview = /** @type {HTMLCanvasElement} */ (document.getElementById('wb-preview'));
        wb.pCtx = wb.preview.getContext('2d');

        loadPersisted();
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
        document.querySelectorAll('.wb-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.wb-color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                wb.color = /** @type {HTMLElement} */ (btn).dataset.color || '#ffffff';
                setTool('pen');
            });
        });
        document.getElementById('wb-size')?.addEventListener('input', e => {
            wb.size = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 3;
        });
        document.getElementById('wb-clear')?.addEventListener('click', clearCurrent);
        document.getElementById('wb-close')?.addEventListener('click', toggle);
        document.getElementById('btn-whiteboard')?.addEventListener('click', toggle);
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
            ctx.globalAlpha = 0.35;
            return;
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.globalAlpha = 1;
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
    function drawCommand(ctx, command) {
        if (!command || typeof command !== 'object') return;
        if (command.kind === 'stroke') {
            if (!Array.isArray(command.points) || command.points.length < 2) return;
            const first = command.points[0];
            ctx.save();
            applyStrokeStyle(ctx, command.tool, command.color, command.size);
            ctx.beginPath();
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < command.points.length; i++) {
                const p = command.points[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.closePath();
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

    function renderSlide(idx) {
        wb.ctx.clearRect(0, 0, wb.canvas.width, wb.canvas.height);
        const commands = storageGetCommands(idx);
        commands.forEach(cmd => drawCommand(wb.ctx, cmd));
        wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
    }

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        wb.canvas.width = w * dpr;
        wb.canvas.height = h * dpr;
        wb.canvas.style.width = `${w}px`;
        wb.canvas.style.height = `${h}px`;
        wb.ctx.scale(dpr, dpr);

        wb.preview.width = w * dpr;
        wb.preview.height = h * dpr;
        wb.preview.style.width = `${w}px`;
        wb.preview.style.height = `${h}px`;
        wb.pCtx.scale(dpr, dpr);

        renderSlide(wb.currentSlide);
    }

    function persistSoon() {
        if (!canPersist) return;
        if (wb.persistTimer) clearTimeout(wb.persistTimer);
        wb.persistTimer = setTimeout(() => {
            wb.persistTimer = null;
            deps.storageSetJSON?.(deps.storageKey, {
                v: PERSIST_VERSION,
                updatedAt: Date.now(),
                slides: wb.drawings,
            });
        }, 220);
    }

    function sanitizePoint(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const x = Number(raw.x);
        const y = Number(raw.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
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
                const sx = Number(item.startX);
                const sy = Number(item.startY);
                const ex = Number(item.endX);
                const ey = Number(item.endY);
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

    function toggle() {
        wb.active = !wb.active;
        wb.canvas.classList.toggle('active', wb.active);
        wb.preview.classList.toggle('active', wb.active);
        document.getElementById('wb-toolbar')?.classList.toggle('active', wb.active);
        document.getElementById('btn-whiteboard')?.classList.toggle('active', wb.active);

        if (wb.active) {
            wb.currentSlide = deps.getCurrentSlideIndex();
            renderSlide(wb.currentSlide);
            if (deps.roomIsActive()) deps.roomBroadcast({ type: deps.ROOM_MSG.REACTION_SHOW, emoji: '✏️', pseudo: 'Prof' });
        } else {
            persistSoon();
        }
    }

    function setTool(tool) {
        wb.tool = tool;
        document.querySelectorAll('.wb-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`wb-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    /**
     * @param {PointerEvent} e
     */
    function start(e) {
        if (!wb.active) return;
        wb.drawing = true;
        const rect = wb.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        wb.startX = x;
        wb.startY = y;

        if (!WB_SHAPE_TOOLS.includes(wb.tool)) {
            /** @type {WhiteboardStroke} */
            wb.currentPath = {
                kind: 'stroke',
                tool: wb.tool === 'eraser' ? 'eraser' : (wb.tool === 'highlighter' ? 'highlighter' : 'pen'),
                color: wb.color,
                size: wb.size,
                points: [{ x, y }],
            };
            applyStrokeStyle(wb.ctx, wb.currentPath.tool, wb.currentPath.color, wb.currentPath.size);
            wb.ctx.beginPath();
            wb.ctx.moveTo(x, y);
        }
    }

    /**
     * @param {PointerEvent} e
     */
    function move(e) {
        if (!wb.active || !wb.drawing) return;
        const rect = wb.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

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
                endX: x,
                endY: y,
            };
            drawCommand(wb.pCtx, shapeCommand);
            return;
        }

        if (!wb.currentPath) return;
        wb.currentPath.points.push({ x, y });
        applyStrokeStyle(wb.ctx, wb.currentPath.tool, wb.currentPath.color, wb.currentPath.size);
        wb.ctx.lineTo(x, y);
        wb.ctx.stroke();
    }

    /**
     * @param {PointerEvent} e
     */
    function end(e) {
        if (!wb.active || !wb.drawing) return;
        wb.drawing = false;

        if (WB_SHAPE_TOOLS.includes(wb.tool)) {
            const rect = wb.canvas.getBoundingClientRect();
            const x2 = e.clientX - rect.left;
            const y2 = e.clientY - rect.top;
            /** @type {WhiteboardShape} */
            const shapeCommand = {
                kind: 'shape',
                shape: /** @type {'rect'|'circle'|'arrow'} */ (wb.tool),
                color: wb.color,
                size: wb.size,
                startX: wb.startX,
                startY: wb.startY,
                endX: x2,
                endY: y2,
            };
            storageGetCommands(wb.currentSlide).push(shapeCommand);
            drawCommand(wb.ctx, shapeCommand);
            wb.pCtx.clearRect(0, 0, wb.preview.width, wb.preview.height);
            persistSoon();
            return;
        }

        if (wb.currentPath && wb.currentPath.points.length > 1) {
            const rect = wb.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            wb.currentPath.points.push({ x, y });
            storageGetCommands(wb.currentSlide).push(wb.currentPath);
            wb.ctx.closePath();
            wb.ctx.globalAlpha = 1;
            wb.ctx.globalCompositeOperation = 'source-over';
            persistSoon();
        }
        wb.currentPath = null;
    }

    function clearCurrent() {
        delete wb.drawings[String(wb.currentSlide)];
        renderSlide(wb.currentSlide);
        persistSoon();
    }

    /**
     * @param {number} newIndex
     */
    function onSlideChange(newIndex) {
        if (!wb.active) return;
        wb.currentSlide = newIndex;
        renderSlide(newIndex);
    }

    return {
        init,
        toggle,
        onSlideChange,
    };
}
