(() => {
  const originalFetch = window.fetch.bind(window);
  const CONTENTS_URL = /^https:\/\/api\.github\.com\/repos\/fodiltrader-blip\/(GuideFlow|GuideFlow-Web)\/contents\//;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function requestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function requestMethod(input, init = {}) {
    return String(init.method || input?.method || 'GET').toUpperCase();
  }

  async function readErrorMessage(response) {
    try {
      const data = await response.clone().json();
      return data?.message || '';
    } catch {
      try { return await response.clone().text(); } catch { return ''; }
    }
  }

  function isShaConflict(response, message = '') {
    if (response.ok) return false;
    return /does not match|sha|conflict|fast forward|is at [a-f0-9]+ but expected/i.test(message || '');
  }

  function decodeBase64Utf8(value = '') {
    const binary = atob(String(value).replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(value = '') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function mergeAccessJson(latestContent, intendedContent) {
    try {
      const latest = JSON.parse(decodeBase64Utf8(latestContent));
      const intended = JSON.parse(decodeBase64Utf8(intendedContent));
      if (!Array.isArray(latest?.entries) || !Array.isArray(intended?.entries)) return intendedContent;

      const byId = new Map(latest.entries.map(entry => [entry.id, entry]));
      for (const entry of intended.entries) byId.set(entry.id, entry);

      const merged = {
        ...latest,
        ...intended,
        version: Math.max(Number(latest.version || 1), Number(intended.version || 1)),
        entries: [...byId.values()]
      };
      return encodeBase64Utf8(`${JSON.stringify(merged, null, 2)}\n`);
    } catch {
      return intendedContent;
    }
  }

  async function getLatestFile(url, init, branch) {
    const separator = url.includes('?') ? '&' : '?';
    const headers = new Headers(init?.headers || {});
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');

    const latest = await originalFetch(
      `${url}${separator}ref=${encodeURIComponent(branch || 'main')}&_gf=${Date.now()}-${Math.random()}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store'
      }
    );
    if (!latest.ok) throw new Error(`Unable to refresh GitHub file SHA (${latest.status})`);
    const data = await latest.json();
    if (!data?.sha) throw new Error('GitHub did not return the latest file SHA.');
    return data;
  }

  window.fetch = async function guideFlowAdminFetch(input, init = {}) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    if (method !== 'PUT' || !CONTENTS_URL.test(url) || !init?.body) {
      return originalFetch(input, init);
    }

    let body;
    try {
      body = JSON.parse(init.body);
    } catch {
      return originalFetch(input, init);
    }

    let response = await originalFetch(input, init);
    if (response.ok || !body?.sha) return response;

    let message = await readErrorMessage(response);
    if (!isShaConflict(response, message)) return response;

    // GitHub's Contents API uses optimistic locking with the blob SHA. When a
    // previous write has just changed the file, refresh the current SHA and
    // safely retry. access.json is merged by entry id so a retry cannot erase
    // another access record that arrived between the read and the write.
    for (let attempt = 0; attempt < 7; attempt += 1) {
      try {
        await wait(220 * (attempt + 1));
        const latest = await getLatestFile(url, init, body.branch || 'main');
        body.sha = latest.sha;

        if (/\/data\/access\.json(?:\?|$)/.test(url) && latest.content && body.content) {
          body.content = mergeAccessJson(latest.content, body.content);
        }

        response = await originalFetch(input, {
          ...init,
          cache: 'no-store',
          body: JSON.stringify(body)
        });
        if (response.ok) return response;

        message = await readErrorMessage(response);
        if (!isShaConflict(response, message)) return response;
      } catch (error) {
        console.warn('GuideFlow GitHub write retry:', error);
      }
    }

    return response;
  };
})();
