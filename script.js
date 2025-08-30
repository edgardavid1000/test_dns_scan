
let isScanning = false;
const foundSubdomains = new Set();
let activeCount = 0;

const STATUS_TEXT = {
    checking: 'Verificando',
    found: 'Encontrado',
    unknown: 'Posible'
};

// Iniciar escaneo con el botón o la tecla Enter
document.getElementById('scanButton').addEventListener('click', startScan);
document.getElementById('domainInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isScanning) {
        startScan();
    }
});

function resetUI() {
    document.getElementById('results').innerHTML = '';
    document.getElementById('activeCount').textContent = '0';
    document.getElementById('scanProgress').textContent = '0%';
    document.getElementById('stats').style.display = 'flex';
    activeCount = 0;
}

async function startScan() {
    if (isScanning) return;
    const input = document.getElementById('domainInput');
    let domain = input.value.trim();
    if (!domain) {
        showError('Por favor ingresa un dominio válido');
        return;
    }

    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    resetUI();
    isScanning = true;
    foundSubdomains.clear();

    const button = document.getElementById('scanButton');
    button.disabled = true;
    button.innerHTML = 'Escaneando <span class="spinner"></span>';

    await fetchSubdomainsFromAPIs(domain);

    isScanning = false;
    button.disabled = false;
    button.textContent = 'Escanear';
}

async function fetchSubdomainsFromAPIs(domain) {
    const services = [
        `https://jldc.me/anubis/subdomains/${domain}`,
        `https://crt.sh/?q=%25.${domain}&output=json`,
        `https://dns.bufferover.run/dns?q=.${domain}`,
        `https://api.hackertarget.com/hostsearch/?q=${domain}`,
        `https://sonar.omnisint.io/subdomains/${domain}`
    ];

    const total = services.length;
    for (let i = 0; i < total && isScanning; i++) {
        const service = services[i];
        try {
            const response = await fetch(service);
            if (!response.ok) continue;
            const text = await response.text();
            processServiceData(service, text, domain);
        } catch (err) {
            console.log(`Service ${service} failed:`, err);
        }
        const progress = Math.round(((i + 1) / total) * 100);
        document.getElementById('scanProgress').textContent = `${progress}%`;
    }
}

function processServiceData(service, data, domain) {
    let subs = [];
    try {
        if (service.includes('jldc.me')) {
            subs = JSON.parse(data);
        } else if (service.includes('crt.sh')) {
            const json = JSON.parse(data);
            json.forEach((entry) => {
                entry.name_value.split('\n').forEach((name) => subs.push(name.trim()));
            });
        } else if (service.includes('bufferover')) {
            const json = JSON.parse(data);
            const entries = [...(json.FDNS_A || []), ...(json.RDNS || []), ...(json.FDNS_CNAME || [])];
            entries.forEach((item) => {
                const parts = item.split(',');
                if (parts[1]) subs.push(parts[1]);
            });
        } else if (service.includes('hackertarget')) {
            subs = data.split('\n').map((line) => line.split(',')[0]);
        } else if (service.includes('omnisint')) {
            subs = JSON.parse(data);
        }
    } catch (e) {
        const regex = new RegExp(`([a-zA-Z0-9.-]+\\.)${domain.replace('.', '\\.')}`, 'gi');
        subs = data.match(regex) || [];
    }

    subs.forEach((sub) => {
        if (sub.endsWith(domain)) {
            addSubdomainToResults(sub);
        }
    });
}

function addSubdomainToResults(subdomain) {
    if (foundSubdomains.has(subdomain)) return;
    foundSubdomains.add(subdomain);

    const resultsDiv = document.getElementById('results');
    const item = document.createElement('div');
    item.className = 'subdomain-item';
    item.innerHTML = `
        <a href="https://${subdomain}" target="_blank" class="subdomain-url">
            ${subdomain}
        </a>
        <span class="status-badge status-checking">${STATUS_TEXT['checking']}</span>
    `;
    resultsDiv.appendChild(item);

    checkSubdomain(subdomain, item);
}

async function checkSubdomain(subdomain, item) {
    const badge = item.querySelector('.status-badge');
    try {
        const response = await fetch(`https://dns.google/resolve?name=${subdomain}`, {
            headers: { 'accept': 'application/dns-json' }
        });
        const data = await response.json();
        const exists = data.Answer && data.Answer.length > 0;
        if (exists) {
            badge.className = 'status-badge status-found';
            badge.textContent = STATUS_TEXT['found'];
            incrementActiveCount();
        } else {
            foundSubdomains.delete(subdomain);
            item.remove();
        }
    } catch (err) {
        badge.className = 'status-badge status-unknown';
        badge.textContent = STATUS_TEXT['unknown'];
    }
}

function incrementActiveCount() {
    activeCount += 1;
    document.getElementById('activeCount').textContent = activeCount.toString();
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
}
