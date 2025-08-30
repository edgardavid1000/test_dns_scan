
let isScanning = false;
const foundSubdomains = new Set();
let activeCount = 0;
let currentDomain = '';

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
document.getElementById('copyButton').addEventListener('click', copyResults);

function resetUI() {
    document.getElementById('results').innerHTML = '';
    document.getElementById('activeCount').textContent = '0';
    document.getElementById('scanProgress').textContent = '0%';
    document.getElementById('stats').style.display = 'flex';
    document.getElementById('copyButton').style.display = 'none';
    activeCount = 0;
}

function copyResults() {
    const subs = Array.from(foundSubdomains);
    navigator.clipboard.writeText(subs.join('\n'))
        .then(() => alert('Subdominios copiados al portapapeles'))
        .catch(() => showError('No se pudo copiar al portapapeles'));
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
    currentDomain = domain;

    const button = document.getElementById('scanButton');
    button.disabled = true;
    button.innerHTML = 'Escaneando <span class="spinner"></span>';

    await fetchSubdomainsFromFunction(domain);

    isScanning = false;
    button.disabled = false;
    button.textContent = 'Escanear';
}

async function fetchSubdomainsFromFunction(domain) {
    try {
        const response = await fetch(`/.netlify/functions/scan?domain=${encodeURIComponent(domain)}`);
        if (!response.ok) {
            showError('Error al comunicarse con el servidor');
            return;
        }
        const subs = await response.json();
        subs.forEach((sub) => addSubdomainToResults(sub));
        document.getElementById('scanProgress').textContent = '100%';
        document.getElementById('copyButton').style.display = subs.length ? 'block' : 'none';
    } catch (err) {
        showError('No se pudo completar el escaneo');
    }
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
