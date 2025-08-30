// Lista común de subdominios para verificar
const commonSubdomains = [
    'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'webdisk', 'ns2',
    'cpanel', 'whm', 'autodiscover', 'autoconfig', 'ns', 'test', 'api', 'app', 'admin',
    'blog', 'dev', 'staging', 'beta', 'alpha', 'demo', 'docs', 'help', 'support', 'portal',
    'secure', 'shop', 'store', 'cdn', 'assets', 'images', 'img', 'static', 'media',
    'mobile', 'm', 'api2', 'api1', 'web', 'old', 'new', 'backup', 'server', 'vpn',
    'remote', 'ssh', 'sftp', 'mysql', 'db', 'database', 'panel', 'git', 'repo',
    'jenkins', 'gitlab', 'jira', 'confluence', 'wiki', 'forum', 'community', 'status',
    'monitor', 'nagios', 'zabbix', 'grafana', 'prometheus', 'elastic', 'kibana', 'logstash',
    'search', 'solr', 'elasticsearch', 'redis', 'cache', 'memcached', 'rabbitmq', 'kafka',
    'jenkins', 'ci', 'cd', 'build', 'deploy', 'docker', 'kubernetes', 'k8s', 'registry',
    'nexus', 'artifactory', 'sonar', 'sonarqube', 'quality', 'qa', 'uat', 'prod',
    'production', 'development', 'local', 'services', 'microservices', 'gateway', 'proxy',
    'lb', 'loadbalancer', 'balancer', 'firewall', 'waf', 'ids', 'ips', 'siem',
    'auth', 'oauth', 'sso', 'login', 'signin', 'signup', 'register', 'account', 'accounts',
    'user', 'users', 'profile', 'profiles', 'dashboard', 'console', 'manager', 'crm',
    'erp', 'hr', 'finance', 'accounting', 'billing', 'invoice', 'payment', 'payments',
    'checkout', 'cart', 'order', 'orders', 'customer', 'customers', 'client', 'clients',
    'partner', 'partners', 'vendor', 'vendors', 'supplier', 'suppliers', 'contractor',
    'download', 'downloads', 'upload', 'uploads', 'file', 'files', 'share', 'cloud',
    'storage', 'backup', 'archive', 'archives', 'vault', 'secure', 'private', 'public',
    'internal', 'external', 'extranet', 'intranet', 'owa', 'exchange', 'outlook', 'mail1',
    'mail2', 'mx', 'mx1', 'mx2', 'email', 'newsletter', 'campaign', 'marketing', 'seo',
    'analytics', 'stats', 'statistics', 'metrics', 'reports', 'reporting', 'data',
    'bigdata', 'ai', 'ml', 'machinelearning', 'deeplearning', 'tensorflow', 'pytorch'
];

let isScanning = false;
const foundSubdomains = new Set();
let activeCount = 0;

const STATUS_TEXT = {
    checking: 'Verificando',
    found: 'Encontrado',
    'not-found': 'No encontrado',
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
    document.getElementById('totalFound').textContent = '0';
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

    await Promise.all([
        fetchSubdomainsFromAPIs(domain),
        checkCommonSubdomains(domain)
    ]);

    isScanning = false;
    button.disabled = false;
    button.textContent = 'Escanear';
}

async function fetchSubdomainsFromAPIs(domain) {
    const services = [
        `https://jldc.me/anubis/subdomains/${domain}`,
        `https://crt.sh/?q=%25.${domain}&output=json`
    ];

    for (const service of services) {
        if (!isScanning) break;
        try {
            const response = await fetch(service);
            if (!response.ok) continue;
            const text = await response.text();
            processServiceData(service, text, domain);
        } catch (err) {
            console.log(`Service ${service} failed:`, err);
        }
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

async function checkCommonSubdomains(domain) {
    const total = commonSubdomains.length;
    for (let i = 0; i < total && isScanning; i++) {
        const subdomain = `${commonSubdomains[i]}.${domain}`;
        addSubdomainToResults(subdomain);
        const progress = Math.round(((i + 1) / total) * 100);
        document.getElementById('scanProgress').textContent = `${progress}%`;
        await new Promise((r) => setTimeout(r, 50));
    }
}

function addSubdomainToResults(subdomain) {
    if (foundSubdomains.has(subdomain)) return;
    foundSubdomains.add(subdomain);
    updateStats();

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

    const badge = item.querySelector('.status-badge');
    checkSubdomain(subdomain, badge);
}

async function checkSubdomain(subdomain, badge) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${subdomain}`, {
            headers: { 'accept': 'application/dns-json' }
        });
        const data = await response.json();
        const exists = data.Answer && data.Answer.length > 0;
        const status = exists ? 'found' : 'not-found';
        badge.className = `status-badge status-${status}`;
        badge.textContent = STATUS_TEXT[status];
        if (exists) incrementActiveCount();
    } catch (err) {
        badge.className = 'status-badge status-unknown';
        badge.textContent = STATUS_TEXT['unknown'];
    }
}

function updateStats() {
    document.getElementById('totalFound').textContent = foundSubdomains.size;
}

function incrementActiveCount() {
    activeCount += 1;
    document.getElementById('activeCount').textContent = activeCount.toString();
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
}
