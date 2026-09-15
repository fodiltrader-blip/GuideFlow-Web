(() => {
  const previousFetch = window.fetch.bind(window);
  const CURRENT = './data/current.json';

  function requestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function isLegacyLiveBundle(url) {
    return /(?:^|\/)data\/course-live\.json(?:\?|$)/.test(url);
  }

  async function readCurrent() {
    try {
      const response = await previousFetch(`${CURRENT}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const current = await response.json();
      if (current?.mode !== 'versioned' || !current?.bundle) return null;
      return current;
    } catch {
      return null;
    }
  }

  window.GuideFlowRelease = {
    current: null,
    async refresh() {
      this.current = await readCurrent();
      return this.current;
    }
  };

  window.fetch = async function guideFlowVersionedFetch(input, init = {}) {
    const url = requestUrl(input);
    if (!isLegacyLiveBundle(url)) return previousFetch(input, init);

    const current = await window.GuideFlowRelease.refresh();
    if (!current) return previousFetch(input, init);

    const target = `./${String(current.bundle).replace(/^\.\//, '')}`;
    const response = await previousFetch(target, { cache: 'default' });
    if (!response.ok) return response;

    return new Response(await response.clone().text(), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  };
})();
