let isScanning = false;
const foundSubdomains = new Set();
const validatedSubdomains = new Set(); // Nuevo Set para trackear subdominios validados
let activeCount = 0;
let currentDomain = '';

const STATUS_TEXT = {
    checking: 'Verificando',
    found: 'Encontrado',
    unknown: 'Posible',
    error: 'Error'
};

// Iniciar escaneo con el botón o la tecla Enter
document.getElementById('scanButton').addEventListener('click', startScan);
document.getElementById('domainInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isScanning) {
        startScan();
    }
});
document.getElementById('copyButton').addEventListener('click', copyResults);
document.getElementById('validateButton').addEventListener('click', validateAllSubdomains);

function resetUI() {
    document.getElementById('results').innerHTML = '';
    document.getElementById('activeCount').textContent = '0';
    document.getElementById('scanProgress').textContent = '0%';
    document.getElementById('stats').style.display = 'flex';
    document.getElementById('copyButton').style.display = 'none';
    document.getElementById('validateButton').style.display = 'none';
    activeCount = 0;
    validatedSubdomains.clear(); // Limpiar subdominios validados
}

function copyResults() {
    // Copiar solo los subdominios que están actualmente visibles
    const visibleSubdomains = Array.from(document.querySelectorAll('.subdomain-url'))
        .map(el => el.textContent);
    
    if (visibleSubdomains.length === 0) {
        alert('No hay subdominios para copiar');
        return;
    }
    
    navigator.clipboard.writeText(visibleSubdomains.join('\n'))
        .then(() => alert(`${visibleSubdomains.length} subdominios copiados al portapapeles`))
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
        document.getElementById('validateButton').style.display = subs.length ? 'block' : 'none';
        
        if (subs.length === 0) {
            document.getElementById('results').innerHTML = '<div class="no-results">No se encontraron subdominios</div>';
        }
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
    item.dataset.subdomain = subdomain; // Agregar data attribute para identificación
    item.innerHTML = `
        <a href="https://${subdomain}" target="_blank" class="subdomain-url">
            ${subdomain}
        </a>
        <span class="status-badge status-unknown">${STATUS_TEXT['unknown']}</span>
    `;
    resultsDiv.appendChild(item);
}

async function validateAllSubdomains() {
    const items = Array.from(document.querySelectorAll('.subdomain-item'));
    if (!items.length) return;

    const button = document.getElementById('validateButton');
    button.disabled = true;
    button.innerHTML = 'Validando <span class="spinner"></span>';

    // Reset counters
    activeCount = 0;
    document.getElementById('activeCount').textContent = '0';
    
    // Validar todos los subdominios en paralelo
    await Promise.all(items.map(item => {
        const sub = item.dataset.subdomain;
        return checkSubdomain(sub, item);
    }));

    button.disabled = false;
    button.textContent = 'Validar';

    // Actualizar botón de copiar si quedan subdominios
    const remainingItems = document.querySelectorAll('.subdomain-item').length;
    document.getElementById('copyButton').style.display = remainingItems > 0 ? 'block' : 'none';
}

async function checkSubdomain(subdomain, item) {
    const badge = item.querySelector('.status-badge');
    badge.className = 'status-badge status-checking';
    badge.textContent = STATUS_TEXT['checking'];
    
    try {
        const response = await fetch(`/.netlify/functions/validate?subdomain=${encodeURIComponent(subdomain)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.valid) {
            badge.className = 'status-badge status-found';
            badge.textContent = STATUS_TEXT['found'];
            validatedSubdomains.add(subdomain); // Agregar a subdominios validados
            incrementActiveCount();
        } else {
            // Solo remover del DOM, NO del Set foundSubdomains
            // para mantener la lista original intacta
            item.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (item.parentNode) {
                    item.parentNode.removeChild(item);
                }
            }, 300);
        }
    } catch (err) {
        console.error('Error validating subdomain:', subdomain, err);
        badge.className = 'status-badge status-error';
        badge.textContent = STATUS_TEXT['error'];
        // En caso de error, mantener el subdominio visible
    }
}

// Agregar animación fadeOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(-10px);
        }
    }
`;
document.head.appendChild(style);

function incrementActiveCount() {
    activeCount += 1;
    document.getElementById('activeCount').textContent = activeCount.toString();
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
}
