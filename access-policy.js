const originalFetch = window.fetch.bind(window);

window.fetch = async function guideFlowFetch(input, init) {
  const response = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input?.url || '';

  if (!url.includes('/data/access.json') && !url.endsWith('./data/access.json') && !url.endsWith('data/access.json')) {
    return response;
  }

  try {
    const data = await response.clone().json();
    const now = Date.now();
    if (Array.isArray(data.entries)) {
      data.entries = data.entries.map(entry => {
        if (!entry?.active || !entry?.expiresAt) return entry;
        const expiry = new Date(entry.expiresAt).getTime();
        if (Number.isFinite(expiry) && expiry <= now) return { ...entry, active: false };
        return entry;
      });
    }
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch {
    return response;
  }
};
