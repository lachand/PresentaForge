class FrameAnalyzerPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// Frame Analyzer
// ============================================================

var frames = {
    http: {
        name: 'Requête HTTP GET',
        ethernet: {
            dest: '00:1a:2b:3c:4d:5e',
            src: 'aa:bb:cc:dd:ee:ff',
            type: '0x0800 (IPv4)',
            size: 14
        },
        ip: {
            version: '4',
            ihl: '5 (20 bytes)',
            tos: '0x00',
            length: '234 bytes',
            id: '0x1234',
            flags: 'DF (Don\'t Fragment)',
            ttl: '64',
            protocol: '6 (TCP)',
            checksum: '0xa3b2',
            src: '192.168.1.10',
            dest: '93.184.216.34',
            size: 20
        },
        tcp: {
            srcPort: '54321',
            destPort: '80 (HTTP)',
            seq: '1000',
            ack: '2000',
            flags: 'PSH, ACK',
            window: '65535',
            checksum: '0x9f2a',
            urgent: '0',
            size: 20
        },
        data: {
            content: 'GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0\r\n\r\n',
            size: 180
        }
    },
    dns: {
        name: 'Requête DNS',
        ethernet: {
            dest: '00:50:56:c0:00:08',
            src: '00:0c:29:3e:8f:a1',
            type: '0x0800 (IPv4)',
            size: 14
        },
        ip: {
            version: '4',
            ihl: '5 (20 bytes)',
            tos: '0x00',
            length: '74 bytes',
            id: '0x5678',
            flags: '0',
            ttl: '64',
            protocol: '17 (UDP)',
            checksum: '0xb4c3',
            src: '192.168.1.10',
            dest: '8.8.8.8',
            size: 20
        },
        udp: {
            srcPort: '49152',
            destPort: '53 (DNS)',
            length: '54 bytes',
            checksum: '0xc5d4',
            size: 8
        },
        data: {
            content: 'DNS Query: example.com (Type A)',
            size: 32
        }
    },
    icmp: {
        name: 'Ping (ICMP Echo Request)',
        ethernet: {
            dest: '00:1a:2b:3c:4d:5e',
            src: 'aa:bb:cc:dd:ee:ff',
            type: '0x0800 (IPv4)',
            size: 14
        },
        ip: {
            version: '4',
            ihl: '5 (20 bytes)',
            tos: '0x00',
            length: '84 bytes',
            id: '0xabcd',
            flags: '0',
            ttl: '64',
            protocol: '1 (ICMP)',
            checksum: '0xd6e5',
            src: '192.168.1.10',
            dest: '8.8.8.8',
            size: 20
        },
        data: {
            content: 'ICMP Echo Request: id=1234, seq=1, data=56 bytes',
            size: 64
        }
    }
};

var currentFrame = null;
var currentFrameType = 'http';
var activeLayer = 'ethernet';

function loadFrame(type) {
    currentFrameType = type;
    currentFrame = frames[type];
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

    // Ethernet layer
    var ethLayer = createLayer('Ethernet', 'ethernet', currentFrame.ethernet.size, [
        { name: 'Adresse MAC destination', value: currentFrame.ethernet.dest },
        { name: 'Adresse MAC source', value: currentFrame.ethernet.src },
        { name: 'Type/Longueur', value: currentFrame.ethernet.type }
    ]);
    container.appendChild(ethLayer);

    // IP layer
    var ipLayer = createLayer('IP', 'ip', currentFrame.ip.size, [
        { name: 'Version', value: currentFrame.ip.version },
        { name: 'IHL', value: currentFrame.ip.ihl },
        { name: 'Type de service', value: currentFrame.ip.tos },
        { name: 'Longueur totale', value: currentFrame.ip.length },
        { name: 'Identification', value: currentFrame.ip.id },
        { name: 'Flags', value: currentFrame.ip.flags },
        { name: 'TTL', value: currentFrame.ip.ttl, highlight: true },
        { name: 'Protocole', value: currentFrame.ip.protocol, highlight: true },
        { name: 'Checksum', value: currentFrame.ip.checksum },
        { name: 'Adresse IP source', value: currentFrame.ip.src, highlight: true },
        { name: 'Adresse IP destination', value: currentFrame.ip.dest, highlight: true }
    ]);
    container.appendChild(ipLayer);

    // Transport layer (TCP or UDP)
    if (currentFrame.tcp) {
        var tcpLayer = createLayer('TCP', 'tcp', currentFrame.tcp.size, [
            { name: 'Port source', value: currentFrame.tcp.srcPort, highlight: true },
            { name: 'Port destination', value: currentFrame.tcp.destPort, highlight: true },
            { name: 'Numéro de séquence', value: currentFrame.tcp.seq },
            { name: 'Numéro d\'acquittement', value: currentFrame.tcp.ack },
            { name: 'Flags', value: currentFrame.tcp.flags, highlight: true },
            { name: 'Fenêtre', value: currentFrame.tcp.window },
            { name: 'Checksum', value: currentFrame.tcp.checksum },
            { name: 'Pointeur urgent', value: currentFrame.tcp.urgent }
        ]);
        container.appendChild(tcpLayer);
    } else if (currentFrame.udp) {
        var udpLayer = createLayer('UDP', 'udp', currentFrame.udp.size, [
            { name: 'Port source', value: currentFrame.udp.srcPort, highlight: true },
            { name: 'Port destination', value: currentFrame.udp.destPort, highlight: true },
            { name: 'Longueur', value: currentFrame.udp.length },
            { name: 'Checksum', value: currentFrame.udp.checksum }
        ]);
        container.appendChild(udpLayer);
    }

    // Data layer
    var dataLayer = createLayer('Données', 'data', currentFrame.data.size, [
        { name: 'Contenu', value: currentFrame.data.content }
    ]);
    container.appendChild(dataLayer);
}

function createLayer(title, className, size, fields) {
    var layer = document.createElement('div');
    layer.className = 'layer layer-' + className;
    layer.dataset.layer = className;

    var header = document.createElement('div');
    header.className = 'layer-header';
    header.innerHTML = '<span>' + title + '</span><span class="layer-size">' + size + ' bytes</span>';

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

    var dumpsByType = {
        http: [
            { offset: '0000', bytes: ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', '00', '1a', '2b', '3c', '4d', '5e', '08', '00'], layer: 'ethernet', ascii: '...........' },
            { offset: '000e', bytes: ['45', '00', '00', 'ea', '12', '34', '40', '00', '40', '06', 'a3', 'b2', 'c0', 'a8', '01', '0a'], layer: 'ip', ascii: 'E...@.@......' },
            { offset: '001e', bytes: ['5d', 'd8', '00', '22', 'c0', 'a8', '01', '64', 'd4', '31', '00', '50', '00', '00', '03', 'e8'], layer: 'tcp', ascii: '].."...d.1.P....' },
            { offset: '002e', bytes: ['00', '00', '07', 'd0', '50', '18', 'ff', 'ff', '9f', '2a', '00', '00', '47', '45', '54', '20'], layer: 'data', ascii: '....P...*..GET ' }
        ],
        dns: [
            { offset: '0000', bytes: ['00', '50', '56', 'c0', '00', '08', '00', '0c', '29', '3e', '8f', 'a1', '08', '00'], layer: 'ethernet', ascii: '..V.....)>....' },
            { offset: '000e', bytes: ['45', '00', '00', '4a', '56', '78', '00', '00', '40', '11', 'b4', 'c3', 'c0', 'a8', '01', '0a'], layer: 'ip', ascii: 'E..JVx..@......' },
            { offset: '001e', bytes: ['c0', 'a8', '01', '64', 'c0', '00', '00', '35', '00', '36', 'c5', 'd4', '12', '34', '01', '00'], layer: 'udp', ascii: '...d...5.6...4..' },
            { offset: '002e', bytes: ['00', '01', '00', '00', '00', '00', '00', '00', '07', '65', '78', '61', '6d', '70', '6c', '65'], layer: 'data', ascii: '.......example' }
        ],
        icmp: [
            { offset: '0000', bytes: ['00', '1a', '2b', '3c', '4d', '5e', 'aa', 'bb', 'cc', 'dd', 'ee', 'ff', '08', '00'], layer: 'ethernet', ascii: '..+<M^........' },
            { offset: '000e', bytes: ['45', '00', '00', '54', 'ab', 'cd', '00', '00', '40', '01', 'd6', 'e5', 'c0', 'a8', '01', '0a'], layer: 'ip', ascii: 'E..T....@......' },
            { offset: '001e', bytes: ['08', '08', '08', '08', '08', '00', '4d', '2f', '12', '34', '00', '01', '61', '62', '63', '64'], layer: 'data', ascii: '......M/.4..abcd' },
            { offset: '002e', bytes: ['65', '66', '67', '68', '69', '6a', '6b', '6c', '6d', '6e', '6f', '70', '71', '72', '73', '74'], layer: 'data', ascii: 'efghijklmnopqrst' }
        ]
    };

    var hexData = dumpsByType[currentFrameType] || dumpsByType.http;

    hexData.forEach(function(line) {
        var lineEl = document.createElement('div');
        lineEl.className = 'hex-line';

        var offset = document.createElement('span');
        offset.className = 'hex-offset';
        offset.textContent = line.offset;

        var bytes = document.createElement('div');
        bytes.className = 'hex-bytes';
        line.bytes.forEach(function(byte) {
            var byteEl = document.createElement('span');
            byteEl.className = 'hex-byte ' + line.layer;
            byteEl.textContent = byte;
            byteEl.dataset.layer = line.layer;
            byteEl.addEventListener('click', function() {
                setActiveLayer(line.layer, { keepExpanded: true, collapseOthers: true });
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

    var totalSize = currentFrame.ethernet.size + currentFrame.ip.size +
                    (currentFrame.tcp ? currentFrame.tcp.size : currentFrame.udp ? currentFrame.udp.size : 0) +
                    currentFrame.data.size;

    var stats = [
        { label: 'Taille totale', value: totalSize + ' bytes', className: '' },
        { label: 'Couche Ethernet', value: currentFrame.ethernet.size + ' bytes', className: 'ethernet' },
        { label: 'Couche IP', value: currentFrame.ip.size + ' bytes', className: 'ip' },
        { label: 'Couche Transport', value: (currentFrame.tcp ? currentFrame.tcp.size : currentFrame.udp ? currentFrame.udp.size : 0) + ' bytes', className: 'transport' },
        { label: 'Données', value: currentFrame.data.size + ' bytes', className: '' }
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
