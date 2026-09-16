(() => {
  const app = document.getElementById('app');
  if (!app) return;

  const media = window.GuideFlowMedia || {};
  const baseUrl = String(media.baseUrl || '').replace(/\/$/, '');
  const configuredAssets = media.assets || {};

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

  function r2Url(key, lang = activeLanguage()) {
    const path = localizedAssets(lang)[key];
    if (!baseUrl || !path) return '';
    return `${baseUrl}/${String(path).replace(/^\/+/, '')}`;
  }

  function installR2(image, key, lang) {
    const src = r2Url(key, lang);
    if (!src) return;
    image.onerror = null;
    image.src = src;
  }

  let applying = false;
  function apply() {
    if (applying) return;
    const page = document.querySelector('.gf-course-page');
    if (!page) return;
    const lang = activeLanguage();
    if (page.dataset.proxyImagesReady === lang) return;
    const shots = [...page.querySelectorAll('.gf-full-shot img')];
    if (shots.length < 3) return;

    applying = true;
    try {
      installR2(shots[0], 'overview', lang);
      installR2(shots[1], 'settings', lang);
      installR2(shots[2], 'list', lang);
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
