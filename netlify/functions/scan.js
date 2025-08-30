const fetch = require('node-fetch');

exports.handler = async function (event) {
  const domain = event.queryStringParameters?.domain;
  if (!domain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Domain parameter is required' })
    };
  }

  const services = [
    { url: `https://jldc.me/anubis/subdomains/${domain}`, type: 'anubis' },
    { url: `https://crt.sh/?q=%25.${domain}&output=json`, type: 'crt' },
    { url: `https://dns.bufferover.run/dns?q=.${domain}`, type: 'bufferover' },
    { url: `https://api.hackertarget.com/hostsearch/?q=${domain}`, type: 'hackertarget' },
    { url: `https://sonar.omnisint.io/subdomains/${domain}`, type: 'omnisint' }
  ];

  const found = new Set();

  const extractors = {
    anubis: data => JSON.parse(data),
    crt: data => {
      const json = JSON.parse(data);
      const subs = [];
      json.forEach(entry =>
        entry.name_value.split('\n').forEach(name => subs.push(name.trim()))
      );
      return subs;
    },
    bufferover: data => {
      const json = JSON.parse(data);
      const entries = [
        ...(json.FDNS_A || []),
        ...(json.RDNS || []),
        ...(json.FDNS_CNAME || [])
      ];
      return entries
        .map(item => item.split(',')[1])
        .filter(Boolean);
    },
    hackertarget: data => data.split('\n').map(line => line.split(',')[0]),
    omnisint: data => JSON.parse(data)
  };

  async function processService(service) {
    try {
      const response = await fetch(service.url, {
        headers: { 'User-Agent': 'subdomain-scanner' }
      });
      if (!response.ok) return;
      const text = await response.text();
      const subs = (extractors[service.type] || (() => []))(text);
      subs.forEach(sub => {
        if (sub.endsWith(domain)) {
          found.add(sub.toLowerCase());
        }
      });
    } catch {
      // ignore individual service failures
    }
  }

  await Promise.all(services.map(processService));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.from(found).sort())
  };
};
