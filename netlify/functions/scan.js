exports.handler = async function(event) {
  const domain = event.queryStringParameters && event.queryStringParameters.domain;
  if (!domain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Domain parameter is required' })
    };
  }

  const services = [
    `https://jldc.me/anubis/subdomains/${domain}`,
    `https://crt.sh/?q=%25.${domain}&output=json`,
    `https://dns.bufferover.run/dns?q=.${domain}`,
    `https://api.hackertarget.com/hostsearch/?q=${domain}`,
    `https://sonar.omnisint.io/subdomains/${domain}`
  ];

  const found = new Set();

  const extract = (service, data) => {
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
        const entries = [ ...(json.FDNS_A || []), ...(json.RDNS || []), ...(json.FDNS_CNAME || []) ];
        entries.forEach((item) => {
          const parts = item.split(',');
          if (parts[1]) subs.push(parts[1]);
        });
      } else if (service.includes('hackertarget')) {
        subs = data.split('\n').map(line => line.split(',')[0]);
      } else if (service.includes('omnisint')) {
        subs = JSON.parse(data);
      }
    } catch (e) {
      const regex = new RegExp(`([a-zA-Z0-9.-]+\\.)${domain.replace('.', '\\.')}`, 'gi');
      subs = data.match(regex) || [];
    }

    subs.forEach(sub => {
      if (sub.endsWith(domain)) {
        found.add(sub);
      }
    });
  };

  for (const service of services) {
    try {
      const response = await fetch(service);
      if (!response.ok) continue;
      const text = await response.text();
      extract(service, text);
    } catch (err) {
      // ignore individual service failures
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.from(found))
  };
};
