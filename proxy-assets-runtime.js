(() => {
  const app = document.getElementById('app');
  if (!app) return;

  // Cloudflare R2 is the primary image store. Legacy Base64 chunks remain only
  // as a temporary safety fallback until all six localized R2 objects are confirmed.
  const media = window.GuideFlowMedia || {};
  const baseUrl = String(media.baseUrl || '').replace(/\/$/, '');
  const configuredAssets = media.assets || {};

  const manifests = {
    overview: ['./proxy-assets/overview-1.b64', './proxy-assets/overview-2.b64'],
    settings: ['./proxy-assets/settings-1.b64', './proxy-assets/settings-2.b64'],
    list: ['./proxy-assets/list.b64']
  };
  const cache = new Map();

  function activeLanguage() {
    return document.documentElement.lang === 'fr' ? 'fr' : 'ar';
  }

  function localizedAssets(lang = activeLanguage()) {
    const selected = configuredAssets?.[lang] || configuredAssets?.ar || configuredAssets || {};
    return {
      overview: selected.iproyalOverview || `/images/iproyal/${lang}/residential-interface.png`,
      settings: selected.iproyalSettings || `/images/iproyal/${lang}/proxy-settings.png`,
      list: selected.iproyalList || `/images/iproyal/${lang}/proxy-list.png`
    };
  }

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

  function r2Url(key, lang = activeLanguage()) {
    const path = localizedAssets(lang)[key];
    if (!baseUrl || !path) return '';
    return `${baseUrl}/${String(path).replace(/^\/+/, '')}`;
  }

  function installR2WithFallback(image, key, lang) {
    const src = r2Url(key, lang);
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
    if (!page) return;
    const lang = activeLanguage();
    if (page.dataset.proxyImagesReady === lang) return;
    const shots = [...page.querySelectorAll('.gf-full-shot img')];
    if (shots.length < 3) return;

    applying = true;
    try {
      installR2WithFallback(shots[0], 'overview', lang);
      installR2WithFallback(shots[1], 'settings', lang);
      installR2WithFallback(shots[2], 'list', lang);
      page.dataset.proxyImagesReady = lang;
    } catch (error) {
      console.error('GuideFlow proxy screenshot loader:', error);
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(app, { childList: true, subtree: true });
  const languageObserver = new MutationObserver(() => requestAnimationFrame(apply));
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('hashchange', () => requestAnimationFrame(apply));
  requestAnimationFrame(apply);
})();
