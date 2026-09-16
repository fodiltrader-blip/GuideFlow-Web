(() => {
  let cachedVersion = '';
  let cachedMap = null;
  let loading = null;

  async function currentRelease() {
    if (window.GuideFlowRelease?.current?.mode === 'versioned') return window.GuideFlowRelease.current;
    if (window.GuideFlowRelease?.refresh) return window.GuideFlowRelease.refresh();
    try {
      const response = await fetch(`./data/current.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async function releaseVisualMap() {
    const current = await currentRelease();
    if (!current?.version || !current?.assetBase) return { current: null, map: null };
    if (cachedVersion === current.version && cachedMap) return { current, map: cachedMap };
    if (loading) return loading;

    loading = (async () => {
      try {
        const base = `./${String(current.assetBase).replace(/^\.\//, '').replace(/\/?$/, '/')}`;
        const response = await fetch(`${base}visual-map.json`, { cache: 'default' });
        const map = response.ok ? await response.json() : null;
        cachedVersion = current.version;
        cachedMap = map;
        return { current, map };
      } catch {
        return { current, map: null };
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  function legacyFile(lessonId, lang) {
    if (lessonId === 'adspower-interface') return lang === 'fr' ? 'adspower-fr.svg' : 'adspower-ar.svg';
    if (lessonId === 'iproyal-intro') return 'iproyal-intro.svg';
    if (lessonId === 'iproyal-get-proxy') return 'iproyal-proxy.svg';
    return '';
  }

  async function mediaForLesson() {
    const lessonId = document.querySelector('.lesson-link.active')?.dataset?.lesson || '';
    const lang = document.documentElement.lang || 'ar';
    if (!lessonId) return '';

    const { current, map } = await releaseVisualMap();
    const mapped = map?.[lessonId]?.[lang] || map?.[lessonId]?.ar || map?.[lessonId]?.fr || '';
    const file = mapped || legacyFile(lessonId, lang);
    if (!file) return '';

    if (current?.mode === 'versioned' && current.assetBase) {
      const base = `./${String(current.assetBase).replace(/^\.\//, '').replace(/\/?$/, '/')}`;
      return `${base}${encodeURI(file)}`;
    }
    return `./media/${encodeURI(file)}`;
  }

  async function installVisual() {
    const grid = document.querySelector('.visual-grid');
    if (!grid) return;
    const src = await mediaForLesson();
    if (!src) return;

    const current = grid.querySelector('.guideflow-course-visual');
    if (current?.dataset.src === src) return;

    const oldVisual = grid.querySelector('.interface-mock, .concept-panel, .guideflow-course-visual');
    const frame = document.createElement('figure');
    frame.className = 'guideflow-course-visual';
    frame.dataset.src = src;
    frame.innerHTML = `<a href="${src}" target="_blank" rel="noopener" class="guideflow-image-link"><img src="${src}" alt="GuideFlow course visual" loading="eager"></a><figcaption>${document.documentElement.lang === 'fr' ? 'Image complète — cliquez pour l’ouvrir en taille réelle.' : 'الصورة كاملة — اضغط عليها لفتحها بالحجم الأصلي.'}</figcaption>`;

    if (oldVisual) oldVisual.replaceWith(frame);
    else grid.prepend(frame);
  }

  const style = document.createElement('style');
  style.textContent = `
    .guideflow-course-visual{margin:0;border-radius:18px;overflow:hidden;background:var(--panel);border:1px solid var(--line);display:flex;flex-direction:column;box-shadow:0 18px 44px rgba(14,25,38,.12)}
    .guideflow-image-link{display:block;width:100%;line-height:0;background:#0d1622;cursor:zoom-in}
    .guideflow-course-visual img{display:block;width:100%;height:auto;max-width:100%;object-fit:contain;object-position:center;background:#0d1622}
    .guideflow-course-visual figcaption{padding:10px 14px;background:var(--panel);color:var(--muted);font-size:11px;border-top:1px solid var(--line);line-height:1.6}
  `;
  document.head.appendChild(style);

  const root = document.getElementById('app');
  if (!root) return;
  const observer = new MutationObserver(() => requestAnimationFrame(() => installVisual()));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(() => installVisual()));
  requestAnimationFrame(() => installVisual());
})();
