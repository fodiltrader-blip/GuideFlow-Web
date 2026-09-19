// GuideFlow Owner Preview helper
// Keeps preview separate from the student access system.
(function () {
  const OWNER_TOKEN_KEY = 'guideflow_owner_preview_token';

  function getOwnerPreviewToken() {
    return localStorage.getItem(OWNER_TOKEN_KEY) || '';
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
})();
