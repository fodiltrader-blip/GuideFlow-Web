(() => {
  let watching = false;
  let startedAt = 0;
  let timer = null;
  let initialVersion = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function readCurrent() {
    try {
      const response = await fetch(`./data/current.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  function statusBox() {
    return document.getElementById('statusBox');
  }

  function isPublishWait(text = '') {
    return /2\/3|تشفير نسخة الكورس الحية|تحديث النسخة الحية المشفّرة/.test(text);
  }

  async function watchPublish() {
    if (watching) return;
    watching = true;
    startedAt = Date.now();
    initialVersion = (await readCurrent())?.version || null;

    while (watching) {
      const box = statusBox();
      if (!box) {
        await sleep(600);
        continue;
      }

      const text = box.textContent || '';
      if (!isPublishWait(text)) {
        watching = false;
        break;
      }

      const current = await readCurrent();
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

      if (current?.version && current.version !== initialVersion) {
        box.textContent = `2/3 — تم إنشاء الإصدار ${current.version}. جاري تأكيد نشر GitHub Pages… (${elapsed}ث)`;
      } else if (elapsed >= 8) {
        box.textContent = `2/3 — جاري تجهيز الإصدار الكامل ونشره على GitHub Pages… (${elapsed}ث)`;
      }

      await sleep(1500);
    }
  }

  const observer = new MutationObserver(() => {
    const box = statusBox();
    if (box && isPublishWait(box.textContent || '')) watchPublish();
  });

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const box = statusBox();
    if (box && isPublishWait(box.textContent || '')) watchPublish();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
