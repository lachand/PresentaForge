class FrameAnalyzerPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// Frame Analyzer
// ============================================================

var Frames = window.OEITrace;
var currentBytes = null;
var currentDecoded = null;
var currentFrameType = 'http';
var activeLayer = 'ethernet';

function loadFrame(type) {
    currentFrameType = Frames.FRAME_SAMPLES[type] ? type : 'http';
    currentBytes = Frames.FRAME_SAMPLES[currentFrameType].bytes;
    currentDecoded = Frames.decodeFrame(currentBytes);
    renderFrame();
    renderHexDump();
    renderStats();
    setActiveLayer('ethernet');
}

function setActiveLayer(layerName, options) {
    options = options || {};
    var keepExpanded = options.keepExpanded !== false;
    var collapseOthers = options.collapseOthers !== false;
    activeLayer = layerName;

    document.querySelectorAll('.layer').forEach(function(layer) {
        const isActive = layer.dataset.layer === layerName;
        layer.classList.toggle('active', isActive);
        if (isActive) {
            if (keepExpanded) {
                layer.classList.add('expanded');
            } else {
                layer.classList.remove('expanded');
            }
        } else if (collapseOthers) {
            layer.classList.remove('expanded');
        }
    });

    document.querySelectorAll('.field').forEach(function(field) {
        field.classList.toggle('active', field.dataset.layer === layerName);
    });

    document.querySelectorAll('.hex-byte').forEach(function(byteEl) {
        byteEl.classList.toggle('active', byteEl.dataset.layer === layerName);
    });
}

function renderFrame() {
    var container = document.getElementById('frameLayers');
    container.innerHTML = '';
    Frames.describeFrame(currentDecoded).forEach(function(layer) {
        container.appendChild(createLayer(layer.title, layer.id, layer.size, layer.fields));
    });
    if (currentDecoded.unsupported) {
        var note = document.createElement('div');
        note.className = 'feedback warning';
        note.textContent = currentDecoded.unsupported;
        container.appendChild(note);
    }
}

function createLayer(title, className, size, fields) {
    var layer = document.createElement('div');
    layer.className = 'layer layer-' + className;
    layer.dataset.layer = className;

    var header = document.createElement('div');
    header.className = 'layer-header';
    header.innerHTML = '<span>' + title + '</span><span class="layer-size">' + size + ' octets</span>';

    var body = document.createElement('div');
    body.className = 'layer-body';

    var fieldGrid = document.createElement('div');
    fieldGrid.className = 'field-grid';

    fields.forEach(function(f) {
        var field = document.createElement('div');
        field.className = 'field';
        field.dataset.layer = className;

        var name = document.createElement('div');
        name.className = 'field-name';
        name.textContent = f.name;

        var value = document.createElement('div');
        value.className = 'field-value' + (f.highlight ? ' highlight' : '');
        value.textContent = f.value;

        field.appendChild(name);
        field.appendChild(value);
        fieldGrid.appendChild(field);

        field.addEventListener('click', function(event) {
            event.stopPropagation();
            setActiveLayer(className, { keepExpanded: true, collapseOthers: true });
        });
    });

    body.appendChild(fieldGrid);

    layer.appendChild(header);
    layer.appendChild(body);

    header.addEventListener('click', function() {
        var isActive = layer.classList.contains('active');
        var isExpanded = layer.classList.contains('expanded');
        if (isActive && isExpanded) {
            setActiveLayer(className, { keepExpanded: false, collapseOthers: false });
        } else {
            setActiveLayer(className, { keepExpanded: true, collapseOthers: true });
        }
    });

    return layer;
}

function renderHexDump() {
    var container = document.getElementById('hexDump');
    container.innerHTML = '';

    Frames.hexDumpLines(currentBytes, currentDecoded.byteLayers).forEach(function(line) {
        var lineEl = document.createElement('div');
        lineEl.className = 'hex-line';

        var offset = document.createElement('span');
        offset.className = 'hex-offset';
        offset.textContent = line.offset;

        var bytes = document.createElement('div');
        bytes.className = 'hex-bytes';
        line.bytes.forEach(function(byte) {
            var byteEl = document.createElement('span');
            byteEl.className = 'hex-byte ' + byte.layer;
            byteEl.textContent = byte.hex;
            byteEl.dataset.layer = byte.layer;
            byteEl.addEventListener('click', function() {
                setActiveLayer(byte.layer, { keepExpanded: true, collapseOthers: true });
            });
            bytes.appendChild(byteEl);
        });

        var ascii = document.createElement('span');
        ascii.className = 'hex-ascii';
        ascii.textContent = line.ascii;

        lineEl.appendChild(offset);
        lineEl.appendChild(bytes);
        lineEl.appendChild(ascii);

        container.appendChild(lineEl);
    });
}

function renderStats() {
    var container = document.getElementById('statsGrid');
    container.innerHTML = '';

    var d = currentDecoded;
    var sizeOf = function(name) {
        return d.layers.filter(function(l) { return l.layer === name; })
            .reduce(function(n, l) { return n + l.end - l.start; }, 0);
    };
    var transport = d.transport ? sizeOf(d.transport.layer) : 0;

    var stats = [
        { label: 'Taille de la trame (sans FCS)', value: d.total + ' octets', className: '' },
        { label: 'Couche Ethernet', value: sizeOf('ethernet') + ' octets', className: 'ethernet' },
        { label: 'Couche IP', value: sizeOf('ip') + ' octets', className: 'ip' },
        { label: 'Couche Transport', value: transport + ' octets', className: 'transport' },
        { label: 'Données', value: sizeOf('data') + ' octets', className: '' },
        { label: 'Longueur totale IP', value: d.ip ? d.ip.totalLength + ' octets (hors Ethernet)' : '-', className: 'ip' }
    ];

    stats.forEach(function(stat) {
        var box = document.createElement('div');
        box.className = 'stat-box';

        var label = document.createElement('div');
        label.className = 'stat-label';
        label.textContent = stat.label;

        var value = document.createElement('div');
        value.className = 'stat-value ' + stat.className;
        value.textContent = stat.value;

        box.appendChild(label);
        box.appendChild(value);
        container.appendChild(box);
    });
}

// Initialize with HTTP frame
loadFrame('http');
        window.loadFrame = loadFrame;
    }
}

if (typeof window !== 'undefined') {
    window.FrameAnalyzerPage = FrameAnalyzerPage;
}
