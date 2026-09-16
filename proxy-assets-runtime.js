(() => {
  const app = document.getElementById('app');
  if (!app) return;

  const manifests = {
    overview: ['./proxy-assets/overview-1.b64', './proxy-assets/overview-2.b64'],
    settings: ['./proxy-assets/settings-1.b64', './proxy-assets/settings-2.b64'],
    list: ['./proxy-assets/list.b64']
  };
  const cache = new Map();

  async function loadDataUrl(key) {
    if (cache.has(key)) return cache.get(key);
    const files = manifests[key] || [];
    const parts = await Promise.all(files.map(async file => {
      const response = await fetch(`${file}?v=20260916-2`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Proxy asset not found: ${file}`);
      return (await response.text()).replace(/\s+/g, '');
    }));
    const url = `data:image/webp;base64,${parts.join('')}`;
    cache.set(key, url);
    return url;
  }

  let applying = false;
  async function apply() {
    if (applying) return;
    const page = document.querySelector('.gf-course-page');
    if (!page || page.dataset.proxyImagesReady === '1') return;
    const shots = [...page.querySelectorAll('.gf-full-shot img')];
    if (shots.length < 3) return;
    applying = true;
    try {
      const [overview, settings, list] = await Promise.all([
        loadDataUrl('overview'),
        loadDataUrl('settings'),
        loadDataUrl('list')
      ]);
      if (!document.body.contains(page)) return;
      shots[0].src = overview;
      shots[1].src = settings;
      shots[2].src = list;
      page.dataset.proxyImagesReady = '1';
    } catch (error) {
      console.error('GuideFlow proxy screenshot loader:', error);
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(app, { childList: true, subtree: true });
  requestAnimationFrame(apply);
})();
