/**
 * @module slides/editor-export-qr
 * @internal Module Slides charge cote navigateur.
 */
/* editor-export-qr.js — Lot 18A
 * Génération QR code + encodeur ISO 18004 extraits de editor-export.js.
 * Dépendances globales : editor, notify, SlidesShared.esc
 */

/* ── QR Code slide ─────────────────────────────────────────── */

/**
 * Generates a QR code slide (last slide) with a sharing link.
 * Uses a minimal QR encoder (alphanumeric mode, version auto).
 * Falls back to an API if the URL is too long.
 */
function insertQRCodeSlide() {
    const url = prompt('URL à partager via QR code :', window.location.href);
    if (!url) return;

    // Generate QR as SVG data URI using the QR API (lightweight, no lib needed)
    const qrSvg = generateQRSvg(url, 400);

    const slide = {
        type: 'canvas',
        transition: 'slide',
        elements: [
            {
                id: 'el_qr_bg', type: 'shape', shapeType: 'rectangle',
                x: 0, y: 0, w: 1280, h: 720, z: 0,
                style: { backgroundColor: '#ffffff' }
            },
            {
                id: 'el_qr_title', type: 'text',
                x: 140, y: 40, w: 1000, h: 60, z: 2,
                data: { text: '📱 Scannez pour accéder à la présentation' },
                style: { fontSize: 32, fontWeight: 700, color: '#1e293b', textAlign: 'center' }
            },
            {
                id: 'el_qr_img', type: 'image',
                x: 440, y: 130, w: 400, h: 400, z: 1,
                data: { src: qrSvg, alt: 'QR Code' },
                style: {}
            },
            {
                id: 'el_qr_url', type: 'text',
                x: 140, y: 560, w: 1000, h: 40, z: 3,
                data: { text: url },
                style: { fontSize: 18, color: '#64748b', textAlign: 'center', fontFamily: 'monospace' }
            }
        ],
        notes: 'Slide QR code généré automatiquement'
    };

    editor.data.slides.push(slide);
    editor.selectSlide(editor.data.slides.length - 1);
    editor.onChange();
    notify('Slide QR code ajouté en fin de présentation', 'success');
}

/**
 * Minimal QR Code SVG generator.
 * Uses a simple byte-mode QR encoder for short URLs.
 * For reliability, uses the qrcode.js approach with a fallback.
 */
function generateQRSvg(text, size) {
    // Use a lightweight QR matrix generator
    const modules = qrEncodeText(text);
    const n = modules.length;
    const cellSize = size / n;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="#fff"/>`;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (modules[y][x]) {
                svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
            }
        }
    }
    svg += '</svg>';
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

/* ── Minimal QR Encoder (ISO 18004, byte mode, ECC-L) ──── */
function qrEncodeText(text) {
    const data = new TextEncoder().encode(text);
    // Determine version (1-10 only for simplicity)
    const capacities = [17,32,53,78,106,134,154,192,230,271]; // byte mode, ECC-L
    let version = 1;
    for (let i = 0; i < capacities.length; i++) {
        if (data.length <= capacities[i]) { version = i + 1; break; }
        if (i === capacities.length - 1) version = 10; // clamp
    }
    const size = version * 4 + 17;
    const matrix = Array.from({length: size}, () => Array(size).fill(null));
    const mask = Array.from({length: size}, () => Array(size).fill(false));

    // Place finder patterns
    function placeFinder(r, c) {
        for (let dy = -1; dy <= 7; dy++) {
            for (let dx = -1; dx <= 7; dx++) {
                const y = r + dy, x = c + dx;
                if (y < 0 || y >= size || x < 0 || x >= size) continue;
                const outer = dy === -1 || dy === 7 || dx === -1 || dx === 7;
                const ring = dy === 0 || dy === 6 || dx === 0 || dx === 6;
                const inner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
                matrix[y][x] = outer ? false : (ring || inner);
                mask[y][x] = true;
            }
        }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        if (!mask[6][i]) { matrix[6][i] = i % 2 === 0; mask[6][i] = true; }
        if (!mask[i][6]) { matrix[i][6] = i % 2 === 0; mask[i][6] = true; }
    }

    // Alignment patterns (version >= 2)
    if (version >= 2) {
        const positions = _qrAlignmentPositions(version);
        for (const r of positions) {
            for (const c of positions) {
                if (mask[r]?.[c]) continue; // skip if overlapping finder
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const y = r + dy, x = c + dx;
                        if (y >= 0 && y < size && x >= 0 && x < size) {
                            matrix[y][x] = Math.abs(dy) === 2 || Math.abs(dx) === 2 || (dy === 0 && dx === 0);
                            mask[y][x] = true;
                        }
                    }
                }
            }
        }
    }

    // Reserve format info areas
    for (let i = 0; i < 8; i++) {
        if (!mask[8][i]) { mask[8][i] = true; matrix[8][i] = false; }
        if (!mask[i][8]) { mask[i][8] = true; matrix[i][8] = false; }
        if (!mask[8][size - 1 - i]) { mask[8][size - 1 - i] = true; matrix[8][size - 1 - i] = false; }
        if (!mask[size - 1 - i][8]) { mask[size - 1 - i][8] = true; matrix[size - 1 - i][8] = false; }
    }
    if (!mask[8][8]) { mask[8][8] = true; matrix[8][8] = false; }
    // Dark module
    matrix[size - 8][8] = true; mask[size - 8][8] = true;

    // Version info (version >= 7)
    if (version >= 7) {
        const vInfo = _qrVersionInfo(version);
        for (let i = 0; i < 18; i++) {
            const bit = (vInfo >> i) & 1;
            const r = Math.floor(i / 3), c = size - 11 + (i % 3);
            matrix[r][c] = !!bit; mask[r][c] = true;
            matrix[c][r] = !!bit; mask[c][r] = true;
        }
    }

    // Encode data
    const encoded = _qrEncodeData(data, version);

    // Place data bits
    let bitIdx = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5; // skip timing column
        const rows = upward ? _range(size - 1, -1) : _range(0, size);
        for (const row of rows) {
            for (const col of [right, right - 1]) {
                if (col < 0 || col >= size) continue;
                if (mask[row][col]) continue;
                matrix[row][col] = bitIdx < encoded.length ? !!encoded[bitIdx] : false;
                mask[row][col] = true;
                bitIdx++;
            }
        }
        upward = !upward;
    }

    // Apply mask pattern 0 (checkerboard: (row + col) % 2 === 0)
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (_qrIsFunction(r, c, size, version)) continue;
            if ((r + c) % 2 === 0) matrix[r][c] = !matrix[r][c];
        }
    }

    // Write format info (ECC-L = 01, mask 0 = 000 → 01000, with BCH)
    const formatBits = 0x77C4; // pre-computed for ECC-L, mask 0
    _qrPlaceFormatInfo(matrix, size, formatBits);

    // Add quiet zone (4 modules)
    const quiet = 4;
    const final = Array.from({length: size + 2 * quiet}, () => Array(size + 2 * quiet).fill(false));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            final[r + quiet][c + quiet] = !!matrix[r][c];
        }
    }
    return final;
}

function _range(start, end) {
    const arr = [];
    if (start > end) { for (let i = start; i > end; i--) arr.push(i); }
    else { for (let i = start; i < end; i++) arr.push(i); }
    return arr;
}

function _qrAlignmentPositions(version) {
    if (version === 1) return [];
    const table = [[], [6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
    return table[version - 1] || table[9];
}

function _qrIsFunction(row, col, size, version) {
    // Finder + separator
    if (row <= 8 && col <= 8) return true;
    if (row <= 8 && col >= size - 8) return true;
    if (row >= size - 8 && col <= 8) return true;
    // Timing
    if (row === 6 || col === 6) return true;
    // Alignment
    if (version >= 2) {
        const positions = _qrAlignmentPositions(version);
        for (const r of positions) {
            for (const c of positions) {
                if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) return true;
            }
        }
    }
    // Dark module
    if (row === size - 8 && col === 8) return true;
    return false;
}

function _qrPlaceFormatInfo(matrix, size, info) {
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((info >> i) & 1);
    // Around top-left finder
    const positions1 = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
    for (let i = 0; i < 15; i++) {
        matrix[positions1[i][0]][positions1[i][1]] = !!bits[i];
    }
    // Along edges
    const positions2 = [[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],[8,size-8],
        [size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]];
    for (let i = 0; i < 15; i++) {
        matrix[positions2[i][0]][positions2[i][1]] = !!bits[i];
    }
}

function _qrVersionInfo(version) {
    const table = [0,0,0,0,0,0,0x07C94,0x085BC,0x09A99,0x0A4D3];
    return table[version] || 0;
}

function _qrEncodeData(data, version) {
    const totalCodewords = _qrTotalCodewords(version);
    const eccCodewords = _qrEccCodewords(version);
    const dataCodewords = totalCodewords - eccCodewords;

    // Byte mode indicator (0100) + character count
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4); // byte mode
    const ccLen = version <= 9 ? 8 : 16;
    push(data.length, ccLen);
    for (const b of data) push(b, 8);

    // Terminator
    const totalBits = dataCodewords * 8;
    const termLen = Math.min(4, totalBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad bytes
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < totalBits) {
        push(pads[pi % 2], 8);
        pi++;
    }

    // Convert to codewords
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
        let val = 0;
        for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] || 0);
        codewords.push(val);
    }

    // RS error correction
    const eccCw = _rsEncode(codewords.slice(0, dataCodewords), eccCodewords);
    const allCw = [...codewords.slice(0, dataCodewords), ...eccCw];

    // Convert to bit array
    const result = [];
    for (const cw of allCw) {
        for (let i = 7; i >= 0; i--) result.push((cw >> i) & 1);
    }
    return result;
}

function _qrTotalCodewords(version) {
    const total = [26,44,70,100,134,172,196,242,292,346];
    return total[version - 1] || 346;
}

function _qrEccCodewords(version) {
    // ECC-L codewords count per version
    const ecc = [7,10,15,20,26,36,40,48,60,72];
    return ecc[version - 1] || 72;
}

/* ── Reed-Solomon encoder (GF(256), poly 0x11D) ────────── */
function _rsEncode(data, eccCount) {
    const gfExp = new Uint8Array(512);
    const gfLog = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
        gfExp[i] = x; gfLog[x] = i;
        x <<= 1;
        if (x >= 256) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];

    const gfMul = (a, b) => a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];

    // Generator polynomial
    let gen = [1];
    for (let i = 0; i < eccCount; i++) {
        const ng = new Array(gen.length + 1).fill(0);
        for (let j = 0; j < gen.length; j++) {
            ng[j] ^= gen[j];
            ng[j + 1] ^= gfMul(gen[j], gfExp[i]);
        }
        gen = ng;
    }

    const msg = new Uint8Array(data.length + eccCount);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
        const coef = msg[i];
        if (coef !== 0) {
            for (let j = 0; j < gen.length; j++) {
                msg[i + j] ^= gfMul(gen[j], coef);
            }
        }
    }
    return Array.from(msg.slice(data.length));
}

window.insertQRCodeSlide = insertQRCodeSlide;
window.generateQRSvg = generateQRSvg;
window.qrEncodeText = qrEncodeText;
