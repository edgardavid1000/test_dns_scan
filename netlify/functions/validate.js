exports.handler = async function(event) {
  const subdomain = event.queryStringParameters?.subdomain;
  if (!subdomain) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Subdomain parameter is required' })
    };
  }

  let valid = false;
  
  try {
    // Use a public DNS check API instead of Node's dns module
    const response = await fetch(`https://dns.google/resolve?name=${subdomain}&type=A`);
    if (response.ok) {
      const data = await response.json();
      // Check if there are Answer records
      valid = data.Status === 0 && data.Answer && data.Answer.length > 0;
    }
  } catch (error) {
    console.error('Error checking subdomain:', error);
    valid = false;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ valid })
  };
};
