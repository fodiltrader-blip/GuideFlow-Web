// Progressive image viewer shared by the existing specialized lesson renderers.
(() => {
  const app = document.getElementById('app');
  if (!app || !window.HTMLDialogElement) return;
  const text = () => document.documentElement.lang === 'fr'
    ? { open: 'Agrandir l’image', close: 'Fermer', size: 'Taille originale', fit: 'Adapter à la fenêtre' }
    : { open: 'تكبير الصورة', close: 'إغلاق', size: 'الحجم الأصلي', fit: 'ملاءمة النافذة' };
  let trigger;
  const dialog = document.createElement('dialog');
  dialog.className = 'student-image-dialog';
  dialog.setAttribute('aria-labelledby', 'studentImageTitle');
  dialog.innerHTML = `<div class="student-image-toolbar"><p id="studentImageTitle"></p><button type="button" data-size aria-pressed="false"></button><button type="button" data-close autofocus></button></div><div class="student-image-stage"><img alt=""></div>`;
  document.body.append(dialog);
  const title = dialog.querySelector('p');
  const image = dialog.querySelector('img');
  const stage = dialog.querySelector('.student-image-stage');
  const size = dialog.querySelector('[data-size]');
  const close = dialog.querySelector('[data-close]');
  close.addEventListener('click', () => dialog.close());
  size.addEventListener('click', () => {
    const original = stage.classList.toggle('is-original');
    size.setAttribute('aria-pressed', String(original));
    size.textContent = original ? text().fit : text().size;
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('student-image-open');
    image.removeAttribute('src');
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  app.addEventListener('click', event => {
    const button = event.target.closest('.student-image-button');
    if (!button) return;
    const source = button.querySelector('img');
    if (!source) return;
    trigger = button;
    const t = text();
    title.textContent = source.alt || t.open;
    image.alt = source.alt;
    image.src = source.currentSrc || source.src;
    stage.classList.remove('is-original');
    size.setAttribute('aria-pressed', 'false');
    size.textContent = t.size;
    close.textContent = t.close;
    dialog.showModal();
    stage.scrollTo(0, 0);
    document.body.classList.add('student-image-open');
  });
  function enhanceImages() {
    app.querySelectorAll('.gf-full-shot > img').forEach(img => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'student-image-button';
      button.setAttribute('aria-label', `${text().open}: ${img.alt}`);
      button.setAttribute('aria-haspopup', 'dialog');
      img.replaceWith(button);
      button.append(img);
      const hint = document.createElement('span');
      hint.className = 'student-image-hint';
      hint.textContent = text().open;
      hint.setAttribute('aria-hidden', 'true');
      button.append(hint);
    });
  }
  const observer = new MutationObserver(enhanceImages);
  observer.observe(app, { childList: true, subtree: true });
  enhanceImages();
})();
