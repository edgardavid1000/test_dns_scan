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
    // Incrementar timeout y usar múltiples métodos de validación
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
    
    try {
      // Método 1: Google DNS
      const response = await fetch(`https://dns.google/resolve?name=${subdomain}&type=A`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        valid = data.Status === 0 && data.Answer && data.Answer.length > 0;
      }
      
      // Si Google DNS no encontró nada, intentar con Cloudflare DNS
      if (!valid) {
        const cfResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${subdomain}&type=A`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/dns-json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (cfResponse.ok) {
          const cfData = await cfResponse.json();
          valid = cfData.Status === 0 && cfData.Answer && cfData.Answer.length > 0;
        }
      }
      
    } finally {
      clearTimeout(timeoutId);
    }
    
  } catch (error) {
    console.error('Error checking subdomain:', error);
    // En caso de error de red, asumir que el subdominio es válido
    // para evitar falsos negativos
    valid = true;
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
