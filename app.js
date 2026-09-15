const app = document.getElementById('app');

const state = {
  payload: null,
  language: 'ar',
  view: 'dashboard',
  lessonId: null,
  accessLabel: '',
  theme: 'light'
};

const ui = {
  ar: {
    locked: 'هذا الدليل متاح عبر رابط دخول خاص.',
    invalid: 'رابط الدخول غير صالح أو تم إيقافه.',
    loading: 'جاري فتح الدليل…',
    home: 'الرئيسية',
    tools: 'أدوات العمل',
    training: 'دليل تدريبي وتشغيلي',
    hero: 'كل خطوة واضحة. كل مهمة موثقة.',
    heroBody: 'مرجع عملي للمتدرّب يجمع الأدوات والإجراءات والتحقق في واجهة واحدة منظمة.',
    start: 'ابدأ بأول درس',
    course: 'محتوى الدليل',
    available: 'متاح',
    objective: 'الهدف',
    responsible: 'المسؤول',
    status: 'الحالة',
    map: 'خريطة الواجهة',
    remember: 'الأماكن التي يجب معرفتها',
    result: 'النتيجة المتوقعة',
    stop: 'متى تتوقف؟',
    checklist: 'قائمة التحقق',
    source: 'المصدر',
    reviewed: 'آخر مراجعة',
    back: 'العودة للرئيسية',
    private: 'وصول خاص',
    protected: 'المحتوى مشفّر ويُفتح محليًا في المتصفح',
    noImage: 'الصورة الفعلية ستُضاف بعد تنقيح البيانات الظاهرة فيها.'
  },
  fr: {
    locked: 'Ce guide est accessible via un lien privé.',
    invalid: 'Le lien d’accès est invalide ou désactivé.',
    loading: 'Ouverture du guide…',
    home: 'Accueil',
    tools: 'Outils de travail',
    training: 'Guide de formation opérationnel',
    hero: 'Chaque étape est claire. Chaque tâche est documentée.',
    heroBody: 'Une référence pratique qui regroupe outils, procédures et vérifications dans une interface structurée.',
    start: 'Commencer la première leçon',
    course: 'Contenu du guide',
    available: 'Disponible',
    objective: 'Objectif',
    responsible: 'Responsable',
    status: 'Statut',
    map: 'Carte de l’interface',
    remember: 'Zones à connaître',
    result: 'Résultat attendu',
    stop: 'Quand s’arrêter ?',
    checklist: 'Checklist',
    source: 'Source',
    reviewed: 'Dernière révision',
    back: 'Retour à l’accueil',
    private: 'Accès privé',
    protected: 'Le contenu est chiffré et déchiffré localement dans le navigateur',
    noImage: 'La capture réelle sera ajoutée après masquage des données visibles.'
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bytesFromBase64Url(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function sha256Bytes(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

async function sha256Hex(text) {
  const bytes = await sha256Bytes(text);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function decryptBundle(bundle, token) {
  const keyBytes = await sha256Bytes(token);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesFromBase64Url(bundle.nonce) },
    key,
    bytesFromBase64Url(bundle.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function getAccessToken() {
  const match = location.hash.match(/^#\/access\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function renderGate(message, invalid = false) {
  const language = navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'ar';
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  app.innerHTML = `
    <main class="gate-shell">
      <section class="gate-card">
        <div class="brand-mark large">G</div>
        <span class="eyebrow">GUIDEFLOW</span>
        <h1>${language === 'ar' ? 'دليل العمل' : 'Guide de travail'}</h1>
        <p>${escapeHtml(message || ui[language].locked)}</p>
        <div class="security-note ${invalid ? 'danger-note' : ''}">${invalid ? '!' : '⌁'} ${escapeHtml(ui[language].private)}</div>
      </section>
    </main>`;
}

function renderLoading() {
  app.innerHTML = `<div class="boot"><div class="brand-mark">G</div><p>GuideFlow</p><span>${escapeHtml(ui.ar.loading)}</span></div>`;
}

function currentContent() {
  return state.payload.languages[state.language];
}

function firstLesson() {
  return currentContent().modules?.[0]?.lessons?.[0] || null;
}

function findLesson(id) {
  for (const module of currentContent().modules || []) {
    const lesson = (module.lessons || []).find(item => item.id === id);
    if (lesson) return lesson;
  }
  return firstLesson();
}

function setLanguage(language) {
  state.language = language;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  renderApp();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = state.theme;
}

function openLesson(id) {
  state.view = 'lesson';
  state.lessonId = id;
  renderApp();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  state.view = 'dashboard';
  state.lessonId = null;
  renderApp();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function sidebar(content, t) {
  const modules = (content.modules || []).map(module => `
    <div class="side-module">
      <div class="side-module-title"><span>${escapeHtml(module.number || '')}</span><b>${escapeHtml(module.title)}</b></div>
      ${(module.lessons || []).map(lesson => `<button class="lesson-link ${state.lessonId === lesson.id ? 'active' : ''}" data-lesson="${escapeHtml(lesson.id)}"><i></i><span>${escapeHtml(lesson.tool || lesson.title)}</span></button>`).join('')}
    </div>`).join('');

  return `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">G</div><div><strong>GuideFlow</strong><span>${escapeHtml(content.courseTitle)}</span></div></div>
      <nav>
        <button class="nav-item ${state.view === 'dashboard' ? 'active' : ''}" id="homeBtn"><span>⌂</span>${escapeHtml(t.home)}</button>
        <div class="side-label">${escapeHtml(t.course)}</div>
        ${modules}
      </nav>
      <div class="private-box"><span>⌁</span><div><b>${escapeHtml(t.private)}</b><small>${escapeHtml(state.accessLabel || t.protected)}</small></div></div>
    </aside>`;
}

function dashboard(content, t) {
  const lesson = firstLesson();
  const modules = (content.modules || []).map(module => `
    <article class="module-row">
      <span class="module-no">${escapeHtml(module.number || '')}</span>
      <div class="module-copy"><strong>${escapeHtml(module.title)}</strong><div>${(module.lessons || []).map(item => `<button data-lesson="${escapeHtml(item.id)}">${escapeHtml(item.tool)} — ${escapeHtml(item.title)}</button>`).join('')}</div></div>
      <span class="available">${escapeHtml(t.available)}</span>
    </article>`).join('');

  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">${escapeHtml(t.training)}</span>
        <h1>${escapeHtml(t.hero)}</h1>
        <p>${escapeHtml(t.heroBody)}</p>
        ${lesson ? `<button class="primary-btn" data-lesson="${escapeHtml(lesson.id)}">${escapeHtml(t.start)} <span>←</span></button>` : ''}
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-window"><div class="art-bar"><i></i><i></i><i></i></div><div class="art-body"><div class="art-side"></div><div class="art-main"><span></span><span></span><div class="art-cards"><b></b><b></b><b></b></div><div class="art-screen"></div></div></div></div>
        <em class="badge b1">GuideFlow</em><em class="badge b2">AR / FR</em>
      </div>
    </section>
    <section class="section-head"><div><span class="eyebrow dark-eye">${escapeHtml(t.course)}</span><h2>${escapeHtml(content.courseSubtitle)}</h2></div><span class="version">V1</span></section>
    <div class="module-list">${modules}</div>`;
}

function interfaceMock(lesson, t) {
  return `
    <div class="interface-mock">
      <div class="mock-top"><span></span><span></span><span></span></div>
      <div class="mock-layout">
        <div class="mock-sidebar">
          <b>New Profile</b><span>Profiles</span><span>Groups</span><strong>Proxies</strong><span>Extensions</span><strong>Trash</strong>
        </div>
        <div class="mock-workspace"><div class="mock-empty">AdsPower</div><small>${escapeHtml(t.noImage)}</small></div>
      </div>
      <i class="pin p1">1</i><i class="pin p2">2</i><i class="pin p3">3</i>
    </div>`;
}

function lessonPage(content, t) {
  const lesson = findLesson(state.lessonId);
  if (!lesson) return '';
  return `
    <button class="back-btn" id="backBtn">← ${escapeHtml(t.back)}</button>
    <section class="lesson-intro">
      <div class="lesson-meta"><span>${escapeHtml(lesson.lessonNumber)}</span><b>${escapeHtml(lesson.tool)}</b></div>
      <h1>${escapeHtml(lesson.title)}</h1>
      <p>${escapeHtml(lesson.summary)}</p>
      <div class="stats"><div><span>${escapeHtml(t.objective)}</span><strong>${escapeHtml(lesson.objective)}</strong></div><div><span>${escapeHtml(t.responsible)}</span><strong>${escapeHtml(lesson.responsible)}</strong></div><div><span>${escapeHtml(t.status)}</span><strong>${escapeHtml(lesson.status)}</strong></div></div>
    </section>
    <section class="visual-card">
      <div class="visual-title"><div><span class="eyebrow dark-eye">${escapeHtml(t.map)}</span><h2>${escapeHtml(t.remember)}</h2></div></div>
      <div class="visual-grid">
        ${interfaceMock(lesson, t)}
        <div class="zone-list">${(lesson.zones || []).map((zone, index) => `<article class="zone z${index + 1}"><span>${zone.number}</span><div><small>${escapeHtml(zone.key)}</small><h3>${escapeHtml(zone.title)}</h3><p>${escapeHtml(zone.description)}</p></div></article>`).join('')}</div>
      </div>
    </section>
    <div class="rule"><strong>${escapeHtml(lesson.rule)}</strong><span>!</span></div>
    <div class="two-col">
      <section class="plain-card"><span class="eyebrow dark-eye">${escapeHtml(t.result)}</span><div class="chips">${(lesson.expected || []).map(item => `<b>${escapeHtml(item)}</b>`).join('')}</div></section>
      <section class="plain-card"><span class="eyebrow danger-eye">${escapeHtml(t.stop)}</span><ul>${(lesson.stopWhen || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
    </div>
    <section class="check-card"><div><span class="eyebrow dark-eye">${escapeHtml(t.checklist)}</span><h2>${escapeHtml(lesson.title)}</h2></div><div class="checks">${(lesson.checklist || []).map(item => `<label><input type="checkbox"><span>${escapeHtml(item)}</span></label>`).join('')}</div></section>
    <footer class="lesson-footer"><span><b>${escapeHtml(t.source)}:</b> ${escapeHtml(lesson.source)}</span><span><b>${escapeHtml(t.reviewed)}:</b> ${escapeHtml(lesson.lastReviewed)}</span></footer>`;
}

function renderApp() {
  const content = currentContent();
  const t = ui[state.language];
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.theme = state.theme;

  app.innerHTML = `
    <div class="app-shell">
      ${sidebar(content, t)}
      <main class="main-area">
        <header class="topbar">
          <div class="crumb"><span>GuideFlow</span><em>/</em><strong>${state.view === 'dashboard' ? escapeHtml(t.home) : escapeHtml(findLesson(state.lessonId)?.title || '')}</strong></div>
          <div class="top-actions"><button id="langBtn">${state.language === 'ar' ? 'FR' : 'AR'}</button><button id="themeBtn">◐</button></div>
        </header>
        <div class="page-wrap">${state.view === 'dashboard' ? dashboard(content, t) : lessonPage(content, t)}</div>
      </main>
    </div>`;

  document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click', () => openLesson(button.dataset.lesson)));
  document.getElementById('homeBtn')?.addEventListener('click', goHome);
  document.getElementById('backBtn')?.addEventListener('click', goHome);
  document.getElementById('langBtn')?.addEventListener('click', () => setLanguage(state.language === 'ar' ? 'fr' : 'ar'));
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
}

async function boot() {
  renderLoading();
  const token = getAccessToken();
  if (!token) {
    renderGate(ui.ar.locked);
    return;
  }
  try {
    const access = await fetch('./data/access.json', { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('access');
      return r.json();
    });
    const tokenHash = await sha256Hex(token);
    const entry = access.entries?.find(item => item.tokenHash === tokenHash && item.active === true);
    if (!entry) {
      renderGate(ui.ar.invalid, true);
      return;
    }
    const bundle = await fetch(`./data/${entry.bundle}`, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('bundle');
      return r.json();
    });
    state.payload = await decryptBundle(bundle, token);
    state.language = entry.language && state.payload.languages[entry.language] ? entry.language : 'ar';
    state.accessLabel = entry.label || '';
    renderApp();
  } catch (error) {
    console.error(error);
    renderGate(ui.ar.invalid, true);
  }
}

boot();
