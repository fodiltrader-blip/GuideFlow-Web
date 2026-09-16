(() => {
  const app = document.getElementById('app');
  if (!app) return;

  // HQ IPRoyal screenshots are served from Cloudflare R2. During the migration,
  // keep the legacy Base64 assets as a fallback so the live lesson never loses
  // its screenshots if an R2 object is missing or temporarily unavailable.
  const R2_BASE = 'https://pub-6a3d51e9b5fa4255945d84fee5915dbf.r2.dev/images/iproyal/';
  const r2Assets = {
    overview: 'residential-interface.jpg',
    settings: 'proxy-settings.jpg',
    list: 'proxy-list.jpg'
  };

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

  function r2Url(key) {
    const file = r2Assets[key];
    return file ? `${R2_BASE}${encodeURIComponent(file)}` : '';
  }

  function installR2WithFallback(image, key) {
    const src = r2Url(key);
    if (!src) return;

    image.onerror = async () => {
      image.onerror = null;
      try {
        image.src = await loadDataUrl(key);
      } catch (error) {
        console.error(`GuideFlow proxy fallback failed (${key}):`, error);
      }
    };
    image.src = src;
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
      installR2WithFallback(shots[0], 'overview');
      installR2WithFallback(shots[1], 'settings');
      installR2WithFallback(shots[2], 'list');
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
