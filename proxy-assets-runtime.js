(() => {
  const app = document.getElementById('app');
  if (!app) return;

  // Cloudflare R2 is the primary image store. Legacy Base64 chunks remain only
  // as a temporary safety fallback until the three R2 objects are confirmed.
  const media = window.GuideFlowMedia || {};
  const baseUrl = String(media.baseUrl || '').replace(/\/$/, '');
  const configuredAssets = media.assets || {};
  const r2Assets = {
    overview: configuredAssets.iproyalOverview || '/images/iproyal/residential-interface.jpg',
    settings: configuredAssets.iproyalSettings || '/images/iproyal/proxy-settings.jpg',
    list: configuredAssets.iproyalList || '/images/iproyal/proxy-list.jpg'
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
    const path = r2Assets[key];
    if (!baseUrl || !path) return '';
    return `${baseUrl}/${String(path).replace(/^\/+/, '')}`;
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
