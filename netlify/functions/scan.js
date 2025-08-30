exports.config = {
  maxDuration: 26
};

exports.handler = async function (event) {
  const domain = event.queryStringParameters?.domain;
  if (!domain) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Domain parameter is required' })
    };
  }

  const services = [
    { url: `https://crt.sh/?q=%25.${domain}&output=json`, type: 'crt' },
    { url: `https://api.hackertarget.com/hostsearch/?q=${domain}`, type: 'hackertarget' }
  ];

  const found = new Set();

  const extractors = {
    crt: (data) => {
      try {
        const json = JSON.parse(data);
        const subs = [];
        if (Array.isArray(json)) {
          json.forEach(entry => {
            if (entry.name_value) {
              entry.name_value.split('\n').forEach(name => {
                const trimmed = name.trim();
                if (trimmed && !trimmed.includes('*')) {
                  subs.push(trimmed);
                }
              });
            }
          });
        }
        return subs;
      } catch (e) {
        console.error('Error parsing crt.sh data:', e);
        return [];
      }
    },
    hackertarget: (data) => {
      try {
        if (data.includes('error')) return [];
        return data.split('\n')
          .filter(line => line && !line.includes('error'))
          .map(line => {
            const parts = line.split(',');
            return parts[0] ? parts[0].trim() : null;
          })
          .filter(Boolean);
      } catch (e) {
        console.error('Error parsing hackertarget data:', e);
        return [];
      }
    }
  };

  async function processService(service) {
    try {
      const response = await fetch(service.url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        console.log(`Service ${service.type} returned status ${response.status}`);
        return;
      }
      
      const text = await response.text();
      if (!text) return;
      
      const extractor = extractors[service.type];
      if (!extractor) return;
      
      const subs = extractor(text);
      subs.forEach(sub => {
        if (sub && sub.endsWith(domain)) {
          found.add(sub.toLowerCase());
        }
      });
    } catch (error) {
      console.error(`Error processing ${service.type}:`, error);
    }
  }

  await Promise.all(services.map(processService));

  // Add the main domain if not already present
  if (!found.has(domain)) {
    found.add(domain);
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(Array.from(found).sort())
  };
};
