(() => {
  const mediaForLesson = () => {
    const title = document.querySelector('.lesson-intro h1')?.textContent?.trim() || '';
    const tool = document.querySelector('.lesson-meta b')?.textContent?.trim() || '';
    const lang = document.documentElement.lang || 'ar';

    if (/AdsPower/i.test(tool)) {
      return lang === 'fr' ? './media/adspower-fr.svg' : './media/adspower-ar.svg';
    }

    if (/IPRoyal/i.test(tool)) {
      if (/ما هو|Qu.?est-ce/i.test(title)) return './media/iproyal-intro.svg';
      if (/سحب|Récupérer|proxy/i.test(title)) return './media/iproyal-proxy.svg';
    }

    return '';
  };

  function installVisual() {
    const grid = document.querySelector('.visual-grid');
    if (!grid) return;
    const src = mediaForLesson();
    if (!src) return;

    const current = grid.querySelector('.guideflow-course-visual');
    if (current?.dataset.src === src) return;

    const oldVisual = grid.querySelector('.interface-mock, .concept-panel, .guideflow-course-visual');
    const frame = document.createElement('figure');
    frame.className = 'guideflow-course-visual';
    frame.dataset.src = src;
    frame.innerHTML = `<img src="${src}?v=20260916-1" alt="GuideFlow course visual" loading="eager"><figcaption>${document.documentElement.lang === 'fr' ? 'Repère visuel utilisé dans cette leçon.' : 'الصورة التعليمية المعتمدة في هذا الدرس.'}</figcaption>`;

    if (oldVisual) oldVisual.replaceWith(frame);
    else grid.prepend(frame);
  }

  const style = document.createElement('style');
  style.textContent = `
    .guideflow-course-visual{margin:0;min-height:390px;border-radius:18px;overflow:hidden;background:#0d1622;border:1px solid var(--line);display:flex;flex-direction:column;box-shadow:0 18px 44px rgba(14,25,38,.12)}
    .guideflow-course-visual img{display:block;width:100%;height:auto;max-height:620px;object-fit:contain;background:#0d1622}
    .guideflow-course-visual figcaption{padding:10px 14px;background:var(--panel);color:var(--muted);font-size:11px;border-top:1px solid var(--line)}
    @media(max-width:980px){.guideflow-course-visual{min-height:0}.guideflow-course-visual img{max-height:none}}
  `;
  document.head.appendChild(style);

  const root = document.getElementById('app');
  if (!root) return;
  const observer = new MutationObserver(() => requestAnimationFrame(installVisual));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(installVisual));
  requestAnimationFrame(installVisual);
})();
