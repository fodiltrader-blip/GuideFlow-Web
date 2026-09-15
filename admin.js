const root = document.getElementById('adminApp');

const OWNER = 'fodiltrader-blip';
const SOURCE_REPO = 'GuideFlow';
const WEB_REPO = 'GuideFlow-Web';
const BRANCH = 'main';

let githubToken = '';
let accessState = null;
let busy = false;
let lastIssued = null;

const $ = (selector) => document.querySelector(selector);

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

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
  const bytes = await sha256Bytes(text);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptPayload(payload, token) {
  const keyBytes = await sha256Bytes(token);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext));
  return {
    alg: 'AES-GCM-256',
    kdf: 'SHA-256(token)',
    nonce: bytesToBase64Url(nonce),
    ciphertext: bytesToBase64Url(ciphertext)
  };
}

async function api(path, options = {}) {
  if (!githubToken) throw new Error('أدخل GitHub Token أولًا.');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
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
    const message = data?.message || `GitHub API: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function getFile(repo, path) {
  const data = await api(`/repos/${OWNER}/${repo}/contents/${encodePath(path)}?ref=${BRANCH}`);
  return {
    sha: data.sha,
    text: base64ToUtf8(data.content || ''),
    raw: data
  };
}

async function putFile(repo, path, text, message, sha = null) {
  const body = {
    message,
    content: utf8ToBase64(text),
    branch: BRANCH
  };
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

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function readJson(repo, path) {
  const file = await getFile(repo, path);
  return { ...file, json: JSON.parse(file.text) };
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
    modules.push({
      id: course.id,
      number: String(index + 1).padStart(2, '0'),
      title: course.title,
      lessons
    });
  }
  return {
    courseTitle: lang === 'ar' ? 'دليل العمل' : 'Guide de travail',
    courseSubtitle: lang === 'ar' ? 'ابدأ من الأدوات، ثم انتقل إلى التنفيذ' : 'Commencez par les outils, puis passez à l’exécution',
    modules
  };
}

async function buildPayload() {
  const [ar, fr] = await Promise.all([buildLanguage('ar'), buildLanguage('fr')]);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    languages: { ar, fr }
  };
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
  document.querySelectorAll('button, input, select').forEach(el => {
    if (el.id !== 'disconnectBtn') el.disabled = value;
  });
}

function entryState(entry) {
  if (!entry.active) return { text: 'موقوف', cls: 'off' };
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return { text: 'منتهي', cls: 'expired' };
  return { text: 'نشط', cls: 'on' };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'medium' }).format(date);
}

function render() {
  if (!githubToken || !accessState) {
    renderConnect();
    return;
  }
  const entries = accessState.json.entries || [];
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <div class="admin-brand"><span>G</span><div><b>GuideFlow</b><small>Admin Studio</small></div></div>
        <nav>
          <a class="active" href="#create">إنشاء رابط</a>
          <a href="#links">الروابط</a>
          <a href="./" target="_blank" rel="noopener">فتح GuideFlow ↗</a>
        </nav>
        <div class="token-state"><i></i><div><b>GitHub متصل</b><small>التوكن في ذاكرة الصفحة فقط</small></div></div>
        <button class="ghost-btn" id="disconnectBtn">إنهاء الجلسة</button>
      </aside>
      <main class="admin-main">
        <header class="admin-top">
          <div><span>GUIDEFLOW</span><h1>إدارة الوصول</h1></div>
          <button class="secondary-btn" id="refreshBtn">تحديث</button>
        </header>

        <section class="create-panel" id="create">
          <div class="panel-head"><div><span class="kicker">رابط جديد</span><h2>إنشاء وصول لمتدرّب</h2><p>يتم جلب أحدث محتوى من المستودع الخاص، ثم تشفير نسخة مستقلة لهذا الرابط.</p></div><div class="shield">⌁</div></div>
          <div class="form-grid">
            <label><span>اسم / وصف المتدرّب</span><input id="labelInput" maxlength="80" placeholder="مثال: Ahmed — Formation 01"></label>
            <label><span>اللغة الافتراضية</span><select id="languageInput"><option value="ar">العربية</option><option value="fr">Français</option></select></label>
            <label><span>تاريخ الانتهاء <em>اختياري</em></span><input id="expiryInput" type="date"></label>
          </div>
          <button class="primary-btn" id="createBtn">إنشاء الرابط المشفّر</button>
          <div id="statusBox" class="status-box" hidden></div>
          ${lastIssued ? issuedCard(lastIssued) : ''}
        </section>

        <section class="links-panel" id="links">
          <div class="section-title"><div><span class="kicker">ACCESS</span><h2>الروابط الحالية</h2></div><span class="count">${entries.length}</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>المتدرّب</th><th>اللغة</th><th>تاريخ الإنشاء</th><th>الانتهاء</th><th>الحالة</th><th></th></tr></thead>
              <tbody>${entries.length ? entries.map(entryRow).join('') : '<tr><td colspan="6" class="empty">لا توجد روابط بعد.</td></tr>'}</tbody>
            </table>
          </div>
          <p class="privacy-note">لا يتم تخزين مفتاح الرابط داخل GitHub؛ لذلك لا يمكن استرجاع رابط قديم من هذه اللوحة بعد فقدانه. عند إيقاف رابط، يُعطّل سجله وتُحذف حزمته المشفّرة من النشر العام.</p>
        </section>
      </main>
    </div>`;

  $('#createBtn')?.addEventListener('click', createAccess);
  $('#refreshBtn')?.addEventListener('click', refreshAccess);
  $('#disconnectBtn')?.addEventListener('click', disconnect);
  document.querySelectorAll('[data-revoke]').forEach(button => button.addEventListener('click', () => revokeAccess(button.dataset.revoke)));
  $('#copyIssued')?.addEventListener('click', copyIssuedLink);
  $('#openIssued')?.addEventListener('click', () => window.open(lastIssued.link, '_blank', 'noopener'));
}

function renderConnect() {
  root.innerHTML = `
    <main class="connect-shell">
      <section class="connect-card">
        <div class="connect-brand">G</div>
        <span class="kicker">GUIDEFLOW ADMIN STUDIO</span>
        <h1>إدارة الروابط من المتصفح</h1>
        <p>أدخل Fine-grained GitHub Token للوصول إلى مستودعي GuideFlow وGuideFlow-Web. التوكن لا يُحفظ في Local Storage ولا يُرفع إلى GitHub؛ يبقى في ذاكرة هذه الصفحة فقط حتى تغلقها.</p>
        <label class="token-input"><span>GitHub Fine-grained Token</span><input id="tokenInput" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
        <button class="primary-btn wide" id="connectBtn">اتصال آمن بـ GitHub</button>
        <div id="statusBox" class="status-box" hidden></div>
        <div class="permission-note"><b>صلاحيات التوكن المطلوبة</b><span>Repository access: فقط GuideFlow و GuideFlow-Web</span><span>Contents: Read and write</span><span>Metadata: Read</span></div>
      </section>
    </main>`;
  $('#connectBtn')?.addEventListener('click', connect);
  $('#tokenInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') connect(); });
}

function entryRow(entry) {
  const state = entryState(entry);
  const canRevoke = entry.active;
  return `<tr>
    <td><strong>${escapeHtml(entry.label || entry.id)}</strong><small>${escapeHtml(entry.id)}</small></td>
    <td><span class="lang-pill">${entry.language === 'fr' ? 'FR' : 'AR'}</span></td>
    <td>${formatDate(entry.createdAt)}</td>
    <td>${formatDate(entry.expiresAt)}</td>
    <td><span class="state ${state.cls}"><i></i>${state.text}</span></td>
    <td>${canRevoke ? `<button class="danger-btn" data-revoke="${escapeHtml(entry.id)}">إيقاف</button>` : '<span class="muted">—</span>'}</td>
  </tr>`;
}

function issuedCard(item) {
  return `<div class="issued-card">
    <div><span class="kicker">تم إنشاء الرابط</span><h3>${escapeHtml(item.label)}</h3><p>انسخ الرابط الآن واحتفظ به. المفتاح السري موجود في الرابط نفسه ولا يتم تخزينه في GitHub.</p></div>
    <div class="issued-link"><input value="${escapeHtml(item.link)}" readonly><button id="copyIssued">نسخ</button><button id="openIssued" class="secondary-btn">فتح</button></div>
  </div>`;
}

async function connect() {
  const token = $('#tokenInput')?.value.trim();
  if (!token) return setStatus('أدخل GitHub Token.', 'error');
  githubToken = token;
  setBusy(true);
  setStatus('جاري التحقق من المستودعات والصلاحيات…');
  try {
    const [access, source] = await Promise.all([
      readJson(WEB_REPO, 'data/access.json'),
      readJson(SOURCE_REPO, 'content/ar/courses.json')
    ]);
    if (!source.json?.courses) throw new Error('تعذر قراءة محتوى GuideFlow الخاص.');
    accessState = access;
    setBusy(false);
    render();
  } catch (error) {
    githubToken = '';
    accessState = null;
    setBusy(false);
    renderConnect();
    setStatus(`فشل الاتصال: ${error.message}`, 'error');
  }
}

async function refreshAccess() {
  if (busy) return;
  setBusy(true);
  try {
    accessState = await readJson(WEB_REPO, 'data/access.json');
    setBusy(false);
    render();
  } catch (error) {
    setBusy(false);
    setStatus(`تعذر التحديث: ${error.message}`, 'error');
  }
}

async function createAccess() {
  if (busy) return;
  const label = $('#labelInput')?.value.trim();
  const language = $('#languageInput')?.value || 'ar';
  const expiry = $('#expiryInput')?.value || '';
  if (!label) return setStatus('اكتب اسمًا أو وصفًا للمتدرّب.', 'error');

  setBusy(true);
  setStatus('1/4 — جلب أحدث محتوى من GuideFlow الخاص…');
  let bundlePath = null;
  try {
    const payload = await buildPayload();
    setStatus('2/4 — إنشاء مفتاح وتشفير نسخة المتدرّب…');
    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const id = `trainee-${Date.now().toString(36)}-${randomToken(4).toLowerCase()}`;
    const bundleName = `bundle-${id}.json`;
    bundlePath = `data/${bundleName}`;
    const encrypted = await encryptPayload(payload, token);

    setStatus('3/4 — رفع الحزمة المشفّرة…');
    await putFile(WEB_REPO, bundlePath, `${JSON.stringify(encrypted, null, 2)}\n`, `Create encrypted access bundle for ${id}`);

    setStatus('4/4 — تحديث سجل الوصول…');
    const latest = await readJson(WEB_REPO, 'data/access.json');
    const entries = Array.isArray(latest.json.entries) ? latest.json.entries : [];
    const expiresAt = expiry ? new Date(`${expiry}T23:59:59.999Z`).toISOString() : null;
    entries.push({
      id,
      tokenHash,
      active: true,
      bundle: bundleName,
      label,
      language,
      createdAt: new Date().toISOString(),
      expiresAt
    });
    const nextAccess = { ...latest.json, version: Math.max(1, Number(latest.json.version || 1)), entries };
    await putFile(WEB_REPO, 'data/access.json', `${JSON.stringify(nextAccess, null, 2)}\n`, `Grant GuideFlow access to ${id}`, latest.sha);

    const base = location.href.split('admin.html')[0];
    lastIssued = { id, label, token, link: `${base}#/access/${encodeURIComponent(token)}` };
    accessState = { ...latest, json: nextAccess };
    setBusy(false);
    render();
    setStatus('تم إنشاء الرابط ونشر الحزمة المشفّرة بنجاح.', 'success');
  } catch (error) {
    if (bundlePath) {
      try {
        const orphan = await getFile(WEB_REPO, bundlePath);
        await deleteFile(WEB_REPO, bundlePath, orphan.sha, 'Remove incomplete access bundle');
      } catch { /* best-effort cleanup */ }
    }
    setBusy(false);
    setStatus(`فشل إنشاء الرابط: ${error.message}`, 'error');
  }
}

async function revokeAccess(id) {
  if (busy) return;
  const entry = accessState?.json?.entries?.find(item => item.id === id);
  if (!entry) return;
  if (!confirm(`إيقاف وصول «${entry.label || id}»؟ لن يمكن إعادة استخدام هذا الرابط من GuideFlow.`)) return;

  setBusy(true);
  setStatus('جاري إيقاف الرابط…');
  try {
    const latest = await readJson(WEB_REPO, 'data/access.json');
    const target = latest.json.entries?.find(item => item.id === id);
    if (!target) throw new Error('لم يعد سجل الرابط موجودًا.');
    target.active = false;
    target.revokedAt = new Date().toISOString();
    await putFile(WEB_REPO, 'data/access.json', `${JSON.stringify(latest.json, null, 2)}\n`, `Revoke GuideFlow access ${id}`, latest.sha);

    try {
      const bundleFile = await getFile(WEB_REPO, `data/${target.bundle}`);
      await deleteFile(WEB_REPO, `data/${target.bundle}`, bundleFile.sha, `Delete revoked GuideFlow bundle ${id}`);
    } catch (error) {
      console.warn('Bundle cleanup:', error);
    }

    accessState = await readJson(WEB_REPO, 'data/access.json');
    setBusy(false);
    render();
    setStatus('تم إيقاف الرابط وحذف الحزمة المنشورة الخاصة به.', 'success');
  } catch (error) {
    setBusy(false);
    setStatus(`تعذر إيقاف الرابط: ${error.message}`, 'error');
  }
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
  lastIssued = null;
  renderConnect();
}

renderConnect();
