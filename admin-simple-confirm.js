(() => {
  const nativePrompt = window.prompt.bind(window);
  const nativeConfirm = window.confirm.bind(window);

  window.prompt = function guideFlowPrompt(message = '', defaultValue = '') {
    const text = String(message || '');
    if (/DELETE ALL/i.test(text)) {
      const cleaned = text
        .replace(/اكتب\s*DELETE ALL\s*للتأكيد[:：]?/gi, '')
        .replace(/DELETE ALL/gi, '')
        .trim();
      return nativeConfirm(`${cleaned}\n\nهل أنت متأكد من الحذف النهائي؟`) ? 'DELETE ALL' : null;
    }
    return nativePrompt(message, defaultValue);
  };
})();
