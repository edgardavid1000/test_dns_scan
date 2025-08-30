const dns = require('dns').promises;

exports.handler = async function(event) {
  const subdomain = event.queryStringParameters?.subdomain;
  if (!subdomain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Subdomain parameter is required' })
    };
  }

  let valid = true;
  try {
    await dns.lookup(subdomain);
  } catch {
    valid = false;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valid })
  };
};
