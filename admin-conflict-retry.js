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

  function isRetryableConflict(response, message = '') {
    if (![409, 422].includes(response.status)) return false;
    return /does not match|sha|conflict|update is not a fast forward/i.test(message || '');
  }

  async function readErrorMessage(response) {
    try {
      const data = await response.clone().json();
      return data?.message || '';
    } catch {
      try { return await response.clone().text(); } catch { return ''; }
    }
  }

  async function getLatestSha(url, init, branch) {
    const separator = url.includes('?') ? '&' : '?';
    const latest = await originalFetch(`${url}${separator}ref=${encodeURIComponent(branch || 'main')}`, {
      method: 'GET',
      headers: init?.headers || {}
    });
    if (!latest.ok) throw new Error(`Unable to refresh GitHub file SHA (${latest.status})`);
    const data = await latest.json();
    if (!data?.sha) throw new Error('GitHub did not return the latest file SHA.');
    return data.sha;
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
    if (!isRetryableConflict(response, message)) return response;

    // GitHub can briefly return an older blob SHA immediately after a previous
    // write. Refresh the current SHA and retry the same update safely.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await wait(180 * (attempt + 1));
        body.sha = await getLatestSha(url, init, body.branch || 'main');
        response = await originalFetch(input, {
          ...init,
          body: JSON.stringify(body)
        });
        if (response.ok) return response;
        message = await readErrorMessage(response);
        if (!isRetryableConflict(response, message)) return response;
      } catch (error) {
        console.warn('GuideFlow GitHub write retry:', error);
        return response;
      }
    }

    return response;
  };
})();
