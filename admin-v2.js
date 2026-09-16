const root = document.getElementById('adminApp');

const OWNER = 'fodiltrader-blip';
const SOURCE_REPO = 'GuideFlow';
const WEB_REPO = 'GuideFlow-Web';
const BRANCH = 'main';
const LIVE_BUNDLE = 'course-live.json';
const PRIVATE_KEY_PATH = 'config/course-key.json';

let githubToken = '';
let accessState = null;
let coursePreview = null;
let busy = false;
let lastIssued = null;
let searchText = '';
let statusFilter = 'all';
let selectedIds = new Set();
let registryQueue = Promise.resolve();

const $ = selector => document.querySelector(selector);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value || '').replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Bytes(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

async function sha256Hex(text) {
  return [...await sha256Bytes(text)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptBytes(plaintextBytes, keyBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintextBytes));
  return { alg: 'AES-GCM-256', nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(ciphertext) };
}

async function encryptPayloadWithCourseKey(payload, courseKeyText) {
  return {
    ...await encryptBytes(new TextEncoder().encode(JSON.stringify(payload)), base64UrlToBytes(courseKeyText)),
    keyMode: 'private-course-key-v1',
    generatedAt: payload.generatedAt
  };
}

async function wrapCourseKey(courseKeyText, token) {
  return { ...await encryptBytes(new TextEncoder().encode(courseKeyText), await sha256Bytes(token)), kdf: 'SHA-256(token)' };
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function api(path, options = {}) {
  if (!githubToken) throw new Error('أدخل GitHub Token أولًا.');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getFile(repo, path) {
  const data = await api(`/repos/${OWNER}/${repo}/contents/${encodePath(path)}?ref=${BRANCH}&_gf=${Date.now()}`);
  return { sha: data.sha, text: base64ToUtf8(data.content || ''), raw: data };
}

async function putFile(repo, path, text, message, sha = null) {
  const body = { message, content: utf8ToBase64(text), branch: BRANCH };
  if (sha) body.sha = sha;
  return api(`/repos/${OWNER}/${repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteFile(repo, path, sha, message) {
  return api(`/repos/${OWNER}/${repo}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: BRANCH })
  });
}

async function readJson(repo, path) {
  const file = await getFile(repo, path);
  return { ...file, json: JSON.parse(file.text) };
}

async function readJsonOrNull(repo, path) {
  try { return await readJson(repo, path); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function buildLanguage(lang) {
  const coursesFile = await readJson(SOURCE_REPO, `content/${lang}/courses.json`);
  const modules = [];
  for (let index = 0; index < (coursesFile.json.courses || []).length; index++) {
    const course = coursesFile.json.courses[index];
    const lessons = [];
    for (const lessonRef of course.lessons || []) {
      const lessonFile = await readJson(SOURCE_REPO, `content/${lang}/lessons/${lessonRef.id}.json`);
      lessons.push(lessonFile.json);
    }
    modules.push({ id: course.id, number: String(index + 1).padStart(2, '0'), title: course.title, lessons });
  }
  return {
    courseTitle: lang === 'ar' ? 'دليل العمل' : 'Guide de travail',
    courseSubtitle: lang === 'ar' ? 'ابدأ من الأدوات، ثم انتقل إلى التنفيذ' : 'Commencez par les outils, puis passez à l’exécution',
    modules
  };
}

async function buildPayload() {
  const [ar, fr] = await Promise.all([buildLanguage('ar'), buildLanguage('fr')]);
  return { version: 2, generatedAt: new Date().toISOString(), languages: { ar, fr } };
}

async function getOrCreateCourseKey() {
  const existing = await readJsonOrNull(SOURCE_REPO, PRIVATE_KEY_PATH);
  if (existing?.json?.key) return existing.json.key;
  const key = randomToken(32);
  const config = { version: 1, algorithm: 'AES-GCM-256', createdAt: new Date().toISOString(), key };
  await putFile(SOURCE_REPO, PRIVATE_KEY_PATH, `${JSON.stringify(config, null, 2)}\n`, 'Create GuideFlow private live course key');
  return key;
}

async function publishLivePayload(payload) {
  const courseKey = await getOrCreateCourseKey();
  const encrypted = await encryptPayloadWithCourseKey(payload, courseKey);
  const existing = await readJsonOrNull(WEB_REPO, `data/${LIVE_BUNDLE}`);
  await putFile(
    WEB_REPO,
    `data/${LIVE_BUNDLE}`,
    `${JSON.stringify(encrypted, null, 2)}\n`,
    `Publish GuideFlow course update ${payload.generatedAt}`,
    existing?.sha || null
  );
  return courseKey;
}

function setStatus(message, type = 'info') {
  const box = $('#statusBox');
  if (!box) return;
  box.className = `status-box ${type}`;
  box.textContent = message;
  box.hidden = !message;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('[data-lock-on-busy], #connectBtn, #createBtn, #publishTopBtn, #publishCourseBtn').forEach(el => {
    el.disabled = value;
  });
}

function entryState(entry) {
  if (!entry.active) return { text: 'موقوف', cls: 'off' };
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return { text: 'منتهي', cls: 'expired' };
  return { text: 'نشط', cls: 'on' };
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-DZ', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function lessonCount(payload, lang = 'ar') {
  return (payload?.languages?.[lang]?.modules || []).reduce((total, module) => total + (module.lessons || []).length, 0);
}

function allEntries() {
  return Array.isArray(accessState?.json?.entries) ? accessState.json.entries : [];
}

function filteredEntries() {
  const q = searchText.trim().toLowerCase();
  return allEntries().filter(entry => {
    const state = entryState(entry);
    const matchesStatus = statusFilter === 'all' || state.cls === statusFilter;
    const haystack = `${entry.label || ''} ${entry.id || ''} ${entry.language || ''} ${entry.mode || ''}`.toLowerCase();
    return matchesStatus && (!q || haystack.includes(q));
  });
}

function stats() {
  const entries = allEntries();
  return {
    total: entries.length,
    active: entries.filter(entry => entryState(entry).cls === 'on').length,
    off: entries.filter(entry => entryState(entry).cls === 'off').length,
    expired: entries.filter(entry => entryState(entry).cls === 'expired').length
  };
}

function previewLanguage(content, label, code) {
  const modules = (content?.modules || []).map(module => `
    <div class="preview-module">
      <div class="preview-module-head"><span>${escapeHtml(module.number)}</span><strong>${escapeHtml(module.title)}</strong></div>
      <div class="preview-lessons">
        ${(module.lessons || []).map(lesson => `
          <article>
            <span class="preview-lesson-no">${escapeHtml(lesson.lessonNumber || '')}</span>
            <div><small>${escapeHtml(lesson.tool || '')}</small><b>${escapeHtml(lesson.title)}</b><p>${escapeHtml(lesson.summary || '')}</p></div>
          </article>`).join('')}
      </div>
    </div>`).join('');
  return `
    <section class="preview-language">
      <div class="preview-language-title"><div><span class="lang-pill">${code}</span><strong>${escapeHtml(label)}</strong></div><small>${escapeHtml(content?.courseTitle || '')}</small></div>
      ${modules}
    </section>`;
}

function coursePreviewHtml() {
  if (!coursePreview) return '<p class="empty-preview">لم يتم تحميل محتوى الكورس بعد.</p>';
  return `
    <div class="course-meta">
      <div><span>آخر قراءة من المصدر</span><strong>${formatDate(coursePreview.generatedAt, true)}</strong></div>
      <div><span>الدروس</span><strong>${lessonCount(coursePreview, 'ar')}</strong></div>
      <div><span>اللغات</span><strong>AR + FR</strong></div>
      <button class="primary-btn" id="publishCourseBtn">نشر إصدار جديد</button>
    </div>
    <details class="course-details">
      <summary>عرض محتوى الكورس</summary>
      <div class="course-preview-grid">
        ${previewLanguage(coursePreview.languages.ar, 'العربية', 'AR')}
        ${previewLanguage(coursePreview.languages.fr, 'Français', 'FR')}
      </div>
    </details>`;
}

function entryRow(entry) {
  const state = entryState(entry);
  const mode = entry.mode === 'live' ? '<span class="mode-pill live">LIVE</span>' : '<span class="mode-pill legacy">Snapshot</span>';
  const checked = selectedIds.has(entry.id) ? 'checked' : '';
  return `<tr class="${checked ? 'selected-row' : ''}">
    <td class="select-cell"><input class="row-check" type="checkbox" data-select="${escapeHtml(entry.id)}" ${checked}></td>
    <td><strong>${escapeHtml(entry.label || entry.id)}</strong><small>${escapeHtml(entry.id)}</small></td>
    <td>${mode}</td>
    <td><span class="lang-pill">${entry.language === 'fr' ? 'FR' : 'AR'}</span></td>
    <td>${formatDate(entry.createdAt)}</td>
    <td>${formatDate(entry.expiresAt)}</td>
    <td><span class="state ${state.cls}"><i></i>${state.text}</span></td>
    <td class="row-actions">
      <button class="mini-btn ${entry.active ? 'warning' : 'success'}" data-toggle="${escapeHtml(entry.id)}">${entry.active ? 'إيقاف' : 'تفعيل'}</button>
      <button class="mini-btn danger" data-delete="${escapeHtml(entry.id)}">حذف نهائي</button>
    </td>
  </tr>`;
}

function issuedCard(item) {
  return `<div class="issued-card">
    <div><span class="kicker">تم إنشاء الرابط LIVE</span><h3>${escapeHtml(item.label)}</h3><p>انسخ الرابط الآن. قد يحتاج GitHub Pages بضع ثوانٍ قبل أن يصبح الرابط متاحًا على النسخة العامة.</p></div>
    <div class="issued-link"><input value="${escapeHtml(item.link)}" readonly><button id="copyIssued">نسخ</button><button id="openIssued" class="secondary-btn">فتح</button></div>
  </div>`;
}

function render() {
  if (!githubToken || !accessState) return renderConnect();
  const s = stats();
  const entries = filteredEntries();
  const visibleIds = entries.map(entry => entry.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  root.innerHTML = `
    <div class="admin-shell v2">
      <aside class="admin-side">
        <div class="admin-brand"><span>G</span><div><b>GuideFlow</b><small>Admin Studio</small></div></div>
        <nav>
          <a href="#overview">نظرة عامة</a>
          <a href="#course">محتوى الكورس</a>
          <a href="#create">إنشاء رابط</a>
          <a href="#links">إدارة الروابط</a>
          <a href="./" target="_blank" rel="noopener">فتح GuideFlow ↗</a>
        </nav>
        <div class="token-state"><i></i><div><b>GitHub متصل</b><small>التوكن في ذاكرة الصفحة فقط</small></div></div>
        <button class="ghost-btn" id="disconnectBtn">إنهاء الجلسة</button>
      </aside>

      <main class="admin-main">
        <header class="admin-top" id="overview">
          <div><span>GUIDEFLOW CONTROL CENTER</span><h1>إدارة الكورس والوصول</h1><p>إدارة سريعة للروابط، الحالات، الحذف والنشر من مكان واحد.</p></div>
          <div class="admin-actions">
            <button class="secondary-btn" id="refreshBtn">↻ تحديث البيانات</button>
            <button class="primary-btn" id="publishTopBtn" data-lock-on-busy>نشر إصدار جديد</button>
          </div>
        </header>

        <div id="statusBox" class="status-box" hidden></div>

        <section class="stats-grid">
          <article><span>كل الروابط</span><strong>${s.total}</strong><small>إجمالي السجلات</small></article>
          <article class="good"><span>نشطة</span><strong>${s.active}</strong><small>يمكنها الوصول</small></article>
          <article class="bad"><span>موقوفة</span><strong>${s.off}</strong><small>تم تعطيلها</small></article>
          <article class="warn"><span>منتهية</span><strong>${s.expired}</strong><small>تجاوزت تاريخ الانتهاء</small></article>
        </section>

        <section class="course-panel" id="course">
          <div class="section-title">
            <div><span class="kicker">COURSE CONTENT</span><h2>محتوى الكورس</h2><p class="section-subtitle">معاينة المصدر الخاص ونشر إصدار مشفّر جديد للعملاء.</p></div>
            <span class="count">${lessonCount(coursePreview, 'ar')}</span>
          </div>
          ${coursePreviewHtml()}
        </section>

        <section class="create-panel" id="create">
          <div class="panel-head"><div><span class="kicker">NEW ACCESS</span><h2>إنشاء رابط وصول</h2><p>أنشئ رابط LIVE لمتدرّب جديد. يبقى الرابط نفسه صالحًا عند نشر تحديثات لاحقة للكورس.</p></div><div class="shield">⌁</div></div>
          <div class="form-grid">
            <label><span>اسم / وصف المتدرّب</span><input id="labelInput" maxlength="80" placeholder="مثال: Ahmed — Formation 01"></label>
            <label><span>اللغة الافتراضية</span><select id="languageInput"><option value="ar">العربية</option><option value="fr">Français</option></select></label>
            <label><span>تاريخ الانتهاء <em>اختياري</em></span><input id="expiryInput" type="date"></label>
          </div>
          <button class="primary-btn" id="createBtn" data-lock-on-busy>إنشاء الرابط المشفّر</button>
          ${lastIssued ? issuedCard(lastIssued) : ''}
        </section>

        <section class="links-panel" id="links">
          <div class="section-title links-title">
            <div><span class="kicker">ACCESS REGISTRY</span><h2>إدارة الروابط</h2><p class="section-subtitle">التغييرات في الحالة تظهر فورًا هنا، ثم تُحفظ على GitHub بالتسلسل في الخلفية.</p></div>
            <span class="count">${allEntries().length}</span>
          </div>

          <div class="links-tools">
            <div class="search-box"><span>⌕</span><input id="linksSearch" value="${escapeHtml(searchText)}" placeholder="ابحث بالاسم أو ID…"></div>
            <select id="statusFilter">
              <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>كل الحالات</option>
              <option value="on" ${statusFilter === 'on' ? 'selected' : ''}>نشطة</option>
              <option value="off" ${statusFilter === 'off' ? 'selected' : ''}>موقوفة</option>
              <option value="expired" ${statusFilter === 'expired' ? 'selected' : ''}>منتهية</option>
            </select>
            <button class="secondary-btn" id="selectVisibleBtn">${allVisibleSelected ? 'إلغاء تحديد الظاهر' : 'تحديد الظاهر'}</button>
          </div>

          <div class="bulk-bar ${selectedIds.size ? 'show' : ''}">
            <div><strong>${selectedIds.size}</strong><span>محدد</span></div>
            <button class="bulk-btn success" id="bulkEnableBtn">تفعيل المحدد</button>
            <button class="bulk-btn warning" id="bulkDisableBtn">إيقاف المحدد</button>
            <button class="bulk-btn danger" id="bulkDeleteBtn">حذف المحدد نهائيًا</button>
            <button class="bulk-btn ghost" id="clearSelectionBtn">إلغاء التحديد</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th class="select-cell"><input id="masterCheck" type="checkbox" ${allVisibleSelected ? 'checked' : ''}></th><th>المتدرّب</th><th>النوع</th><th>اللغة</th><th>الإنشاء</th><th>الانتهاء</th><th>الحالة</th><th>التحكم</th></tr></thead>
              <tbody>${entries.length ? entries.map(entryRow).join('') : '<tr><td colspan="8" class="empty">لا توجد نتائج مطابقة.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="danger-zone">
            <div><strong>منطقة الحذف النهائي</strong><span>الحذف النهائي يزيل السجل من access.json ولن يظهر في لوحة الإدارة مجددًا.</span></div>
            <button class="nuclear-btn" id="deleteAllBtn">حذف جميع الروابط نهائيًا</button>
          </div>
        </section>
      </main>
    </div>`;

  bindEvents();
}

function renderConnect() {
  root.innerHTML = `
    <main class="connect-shell">
      <section class="connect-card">
        <div class="connect-brand">G</div>
        <span class="kicker">GUIDEFLOW ADMIN STUDIO</span>
        <h1>لوحة تحكم GuideFlow</h1>
        <p>أدخل Fine-grained GitHub Token. التوكن يبقى داخل ذاكرة الصفحة فقط ولا يتم حفظه في Local Storage.</p>
        <label class="token-input"><span>GitHub Fine-grained Token</span><input id="tokenInput" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
        <button class="primary-btn wide" id="connectBtn">اتصال آمن بـ GitHub</button>
        <div id="statusBox" class="status-box" hidden></div>
        <div class="permission-note"><b>الصلاحيات المطلوبة</b><span>Repository access: GuideFlow و GuideFlow-Web فقط</span><span>Contents: Read and write</span><span>Metadata: Read</span></div>
      </section>
    </main>`;
  $('#connectBtn')?.addEventListener('click', connect);
  $('#tokenInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') connect(); });
}

function bindEvents() {
  $('#createBtn')?.addEventListener('click', createAccess);
  $('#refreshBtn')?.addEventListener('click', refreshAdminData);
  $('#publishTopBtn')?.addEventListener('click', publishCourseUpdate);
  $('#publishCourseBtn')?.addEventListener('click', publishCourseUpdate);
  $('#disconnectBtn')?.addEventListener('click', disconnect);
  $('#copyIssued')?.addEventListener('click', copyIssuedLink);
  $('#openIssued')?.addEventListener('click', () => window.open(lastIssued.link, '_blank', 'noopener'));

  $('#linksSearch')?.addEventListener('input', event => { searchText = event.target.value; render(); $('#linksSearch')?.focus(); });
  $('#statusFilter')?.addEventListener('change', event => { statusFilter = event.target.value; render(); });
  $('#selectVisibleBtn')?.addEventListener('click', toggleVisibleSelection);
  $('#masterCheck')?.addEventListener('change', toggleVisibleSelection);
  $('#clearSelectionBtn')?.addEventListener('click', () => { selectedIds.clear(); render(); });
  $('#bulkEnableBtn')?.addEventListener('click', () => bulkSetActive(true));
  $('#bulkDisableBtn')?.addEventListener('click', () => bulkSetActive(false));
  $('#bulkDeleteBtn')?.addEventListener('click', bulkDeleteSelected);
  $('#deleteAllBtn')?.addEventListener('click', deleteAllEntries);

  document.querySelectorAll('[data-select]').forEach(input => input.addEventListener('change', () => {
    if (input.checked) selectedIds.add(input.dataset.select); else selectedIds.delete(input.dataset.select);
    render();
  }));
  document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleAccess(button.dataset.toggle)));
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteAccessPermanent(button.dataset.delete)));
}

async function connect() {
  const token = $('#tokenInput')?.value.trim();
  if (!token) return setStatus('أدخل GitHub Token.', 'error');
  githubToken = token;
  setBusy(true);
  setStatus('جاري التحقق من المستودعات وتحميل البيانات…');
  try {
    const [access, payload] = await Promise.all([readJson(WEB_REPO, 'data/access.json'), buildPayload()]);
    accessState = access;
    coursePreview = payload;
    setBusy(false);
    render();
  } catch (error) {
    githubToken = '';
    accessState = null;
    coursePreview = null;
    setBusy(false);
    renderConnect();
    setStatus(`فشل الاتصال: ${error.message}`, 'error');
  }
}

async function refreshAdminData() {
  if (busy) return;
  setStatus('جاري جلب أحدث البيانات من GitHub…');
  try {
    await registryQueue.catch(() => {});
    const [access, payload] = await Promise.all([readJson(WEB_REPO, 'data/access.json'), buildPayload()]);
    accessState = access;
    coursePreview = payload;
    selectedIds = new Set([...selectedIds].filter(id => allEntries().some(entry => entry.id === id)));
    render();
    setStatus('تم تحديث لوحة الإدارة.', 'success');
  } catch (error) {
    setStatus(`تعذر التحديث: ${error.message}`, 'error');
  }
}

async function publishCourseUpdate() {
  if (busy) return;
  setBusy(true);
  setStatus('1/3 — جلب أحدث محتوى من GuideFlow الخاص…');
  try {
    const payload = await buildPayload();
    coursePreview = payload;
    setStatus('2/3 — تشفير نسخة الكورس…');
    await publishLivePayload(payload);
    setBusy(false);
    render();
    setStatus('تم إرسال الإصدار الجديد إلى GitHub. سيكمل GitHub Pages النشر تلقائيًا.', 'success');
  } catch (error) {
    setBusy(false);
    setStatus(`فشل نشر التحديث: ${error.message}`, 'error');
  }
}

async function createAccess() {
  if (busy) return;
  const label = $('#labelInput')?.value.trim();
  const language = $('#languageInput')?.value || 'ar';
  const expiry = $('#expiryInput')?.value || '';
  if (!label) return setStatus('اكتب اسمًا أو وصفًا للمتدرّب.', 'error');

  setBusy(true);
  try {
    await registryQueue.catch(() => {});
    setStatus('1/4 — جلب أحدث محتوى…');
    const payload = await buildPayload();
    coursePreview = payload;

    setStatus('2/4 — تجهيز مفتاح الكورس…');
    const courseKey = await getOrCreateCourseKey();

    setStatus('3/4 — إنشاء مفتاح وصول خاص…');
    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const wrappedKey = await wrapCourseKey(courseKey, token);
    const id = `trainee-${Date.now().toString(36)}-${randomToken(4).toLowerCase()}`;
    const expiresAt = expiry ? new Date(`${expiry}T23:59:59.999Z`).toISOString() : null;

    setStatus('4/4 — تسجيل الرابط…');
    const latest = await readJson(WEB_REPO, 'data/access.json');
    const entries = Array.isArray(latest.json.entries) ? [...latest.json.entries] : [];
    entries.push({ id, tokenHash, active: true, mode: 'live', liveBundle: LIVE_BUNDLE, wrappedKey, label, language, createdAt: new Date().toISOString(), expiresAt });
    const nextAccess = { ...latest.json, version: Math.max(2, Number(latest.json.version || 1)), entries };
    const response = await putFile(WEB_REPO, 'data/access.json', `${JSON.stringify(nextAccess, null, 2)}\n`, `Grant live GuideFlow access to ${id}`, latest.sha);

    const base = location.href.split('admin.html')[0];
    lastIssued = { id, label, token, link: `${base}#/access/${encodeURIComponent(token)}` };
    accessState = { sha: response?.content?.sha || latest.sha, json: nextAccess };
    setBusy(false);
    render();
    setStatus('تم إنشاء الرابط. قد يستغرق ظهوره على GitHub Pages بضع ثوانٍ.', 'success');
  } catch (error) {
    setBusy(false);
    setStatus(`فشل إنشاء الرابط: ${error.message}`, 'error');
  }
}

function toggleVisibleSelection() {
  const ids = filteredEntries().map(entry => entry.id);
  const allSelected = ids.length && ids.every(id => selectedIds.has(id));
  ids.forEach(id => allSelected ? selectedIds.delete(id) : selectedIds.add(id));
  render();
}

function queueRegistryMutation(localMutator, remoteMutator, message, replace = false) {
  localMutator(accessState.json);
  render();
  setStatus('تم تحديث الحالة في اللوحة فورًا. جاري الحفظ على GitHub…');

  registryQueue = registryQueue.then(async () => {
    const latest = await readJson(WEB_REPO, 'data/access.json');
    remoteMutator(latest.json);
    const commitMessage = `${replace ? 'ACCESS_REPLACE:' : 'ACCESS_UPDATE:'} ${message}`;
    const response = await putFile(WEB_REPO, 'data/access.json', `${JSON.stringify(latest.json, null, 2)}\n`, commitMessage, latest.sha);
    accessState.sha = response?.content?.sha || accessState.sha;
    setStatus('تم حفظ تغييرات الروابط في GitHub.', 'success');
  }).catch(async error => {
    console.error(error);
    setStatus(`تعذر حفظ أحد التغييرات: ${error.message}. سيتم تحديث البيانات من GitHub.`, 'error');
    try {
      accessState = await readJson(WEB_REPO, 'data/access.json');
      selectedIds = new Set([...selectedIds].filter(id => allEntries().some(entry => entry.id === id)));
      render();
    } catch {}
  });
  return registryQueue;
}

function toggleAccess(id) {
  const current = allEntries().find(entry => entry.id === id);
  if (!current) return;
  const nextValue = !current.active;
  const when = new Date().toISOString();
  queueRegistryMutation(
    json => {
      const target = json.entries?.find(entry => entry.id === id);
      if (target) { target.active = nextValue; if (nextValue) delete target.revokedAt; else target.revokedAt = when; }
    },
    json => {
      const target = json.entries?.find(entry => entry.id === id);
      if (target) { target.active = nextValue; if (nextValue) delete target.revokedAt; else target.revokedAt = when; }
    },
    `${nextValue ? 'Enable' : 'Disable'} ${id}`
  );
}

function bulkSetActive(active) {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const when = new Date().toISOString();
  queueRegistryMutation(
    json => json.entries?.forEach(entry => { if (ids.includes(entry.id)) { entry.active = active; if (active) delete entry.revokedAt; else entry.revokedAt = when; } }),
    json => json.entries?.forEach(entry => { if (ids.includes(entry.id)) { entry.active = active; if (active) delete entry.revokedAt; else entry.revokedAt = when; } }),
    `${active ? 'Enable' : 'Disable'} ${ids.length} access records`
  );
}

async function cleanupLegacyBundles(entries) {
  for (const entry of entries) {
    if (entry.mode === 'live' || !entry.bundle) continue;
    try {
      const bundleFile = await getFile(WEB_REPO, `data/${entry.bundle}`);
      await deleteFile(WEB_REPO, `data/${entry.bundle}`, bundleFile.sha, `Delete GuideFlow legacy bundle ${entry.id}`);
    } catch (error) {
      if (error.status !== 404) console.warn('Legacy bundle cleanup:', error);
    }
  }
}

function deleteAccessPermanent(id) {
  const entry = allEntries().find(item => item.id === id);
  if (!entry) return;
  if (!confirm(`حذف «${entry.label || id}» نهائيًا؟\n\nسيختفي السجل من لوحة الإدارة ولا يمكن التراجع عن العملية.`)) return;
  selectedIds.delete(id);
  queueRegistryMutation(
    json => { json.entries = (json.entries || []).filter(item => item.id !== id); },
    json => { json.entries = (json.entries || []).filter(item => item.id !== id); },
    `Permanently delete ${id}`,
    true
  ).then(() => cleanupLegacyBundles([entry]));
}

function bulkDeleteSelected() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const targets = allEntries().filter(entry => ids.includes(entry.id));
  if (!confirm(`حذف ${ids.length} رابط محدد نهائيًا؟\n\nلن تظهر هذه السجلات في لوحة الإدارة مجددًا.`)) return;
  selectedIds.clear();
  queueRegistryMutation(
    json => { json.entries = (json.entries || []).filter(item => !ids.includes(item.id)); },
    json => { json.entries = (json.entries || []).filter(item => !ids.includes(item.id)); },
    `Permanently delete ${ids.length} selected access records`,
    true
  ).then(() => cleanupLegacyBundles(targets));
}

function deleteAllEntries() {
  const targets = [...allEntries()];
  if (!targets.length) return;
  const phrase = prompt(`سيتم حذف جميع الروابط (${targets.length}) نهائيًا.\nاكتب DELETE ALL للتأكيد:`);
  if (phrase !== 'DELETE ALL') return setStatus('تم إلغاء الحذف الكلي.');
  selectedIds.clear();
  queueRegistryMutation(
    json => { json.entries = []; },
    json => { json.entries = []; },
    `Permanently delete all ${targets.length} access records`,
    true
  ).then(() => cleanupLegacyBundles(targets));
}

async function copyIssuedLink() {
  if (!lastIssued?.link) return;
  try {
    await navigator.clipboard.writeText(lastIssued.link);
    setStatus('تم نسخ رابط المتدرّب.', 'success');
  } catch {
    const input = $('.issued-link input');
    input?.select();
    document.execCommand('copy');
    setStatus('تم نسخ رابط المتدرّب.', 'success');
  }
}

function disconnect() {
  githubToken = '';
  accessState = null;
  coursePreview = null;
  lastIssued = null;
  selectedIds.clear();
  renderConnect();
}

renderConnect();
