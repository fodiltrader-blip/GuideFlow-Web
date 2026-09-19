// GuideFlow Owner Preview helper
// Keeps preview separate from the student access system.
(function () {
  const OWNER_TOKEN_KEY = 'guideflow_owner_preview_token';

  function getOwnerPreviewToken() {
    return localStorage.getItem(OWNER_TOKEN_KEY) || '';
  }

  function injectOwnerPreviewLink() {
    const links = [...document.querySelectorAll('a')];
    const target = links.find(link => link.textContent.includes('فتح GuideFlow'));
    if (!target || document.getElementById('ownerPreviewLink')) return;

    const preview = target.cloneNode(true);
    preview.id = 'ownerPreviewLink';
    preview.textContent = 'معاينة كمالك ↗';
    preview.href = '#';
    preview.addEventListener('click', event => {
      event.preventDefault();
      window.GuideFlowOwnerPreview.open();
    });
    target.insertAdjacentElement('afterend', preview);
  }

  window.GuideFlowOwnerPreview = {
    setToken(token) {
      if (!token) return;
      localStorage.setItem(OWNER_TOKEN_KEY, token);
    },
    open() {
      const token = getOwnerPreviewToken();
      if (!token) {
        alert('لم يتم إعداد رابط معاينة المالك بعد.');
        return;
      }
      window.open(`./#/access/${encodeURIComponent(token)}`, '_blank', 'noopener');
    }
  };

  const observer = new MutationObserver(injectOwnerPreviewLink);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectOwnerPreviewLink();
})();
