(() => {
  const OWNER = 'fodiltrader-blip';
  const SOURCE_REPO = 'GuideFlow';
  const WEB_REPO = 'GuideFlow-Web';
  const BRANCH = 'main';
  const PRIVATE_LINKS_PATH = 'config/access-links.json';
  const ACCESS_RE = new RegExp(`/repos/${OWNER}/${WEB_REPO}/contents/data/access\\.json(?:\\?|$)`);
  const originalFetch = window.fetch.bind(window);

  let authorization = '';
  let registrySha = null;
  let registry = { version: 1, entries: [] };
  let registryLoaded = false;
  let registryLoading = null;
  let pendingCreatedEntry = null;
  let lastModalLink = '';
  let saveQueue = Promise.resolve();

  function requestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function requestMethod(input, init = {}) {
    return String(init.method || input?.method || 'GET').toUpperCase();
  }

  function captureAuthorization(input, init = {}) {
    try {
      const headers = new Headers(init.headers || input?.headers || {});
      const value = headers.get('Authorization');
      if (value) authorization = value;
    } catch {}
  }

  function decodeBase64(value = '') {
    const binary = atob(String(value).replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
  }

  function encodeBase64(text = '') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function encodePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  async function gh(path, init = {}) {
    if (!authorization) throw new Error('GitHub authorization is not available yet.');
    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('Authorization', authorization);
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await originalFetch(`https://api.github.com${path}`, { ...init, headers, cache: 'no-store' });
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

  async function loadRegistry(force = false) {
    if (!authorization) return null;
    if (registryLoaded && !force) return registry;
    if (registryLoading && !force) return registryLoading;

    registryLoading = (async () => {
      try {
        const data = await gh(`/repos/${OWNER}/${SOURCE_REPO}/contents/${encodePath(PRIVATE_LINKS_PATH)}?ref=${BRANCH}`);
        registrySha = data.sha || null;
        registry = JSON.parse(decodeBase64(data.content || ''));
        if (!Array.isArray(registry.entries)) registry.entries = [];
      } catch (error) {
        if (error.status !== 404) throw error;
        registrySha = null;
        registry = { version: 1, entries: [] };
      }
      registryLoaded = true;
      enhanceAdmin();
      return registry;
    })().catch(error => {
      console.warn('GuideFlow private link registry:', error);
      return null;
    }).finally(() => {
      registryLoading = null;
    });
    return registryLoading;
  }

  async function persistRecord(record) {
    if (!record?.id || !record?.link || !authorization) return;
    saveQueue = saveQueue.then(async () => {
      await loadRegistry(true);
      const entries = Array.isArray(registry.entries) ? [...registry.entries] : [];
      const index = entries.findIndex(item => item.id === record.id);
      const nextRecord = {
        id: record.id,
        name: record.name || record.label || record.id,
        link: record.link,
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (index >= 0) entries[index] = { ...entries[index], ...nextRecord };
      else entries.push(nextRecord);
      const next = { version: 1, entries };
      const body = { message: `Store private GuideFlow access link ${record.id}`, content: encodeBase64(`${JSON.stringify(next, null, 2)}\n`), branch: BRANCH };
      if (registrySha) body.sha = registrySha;
      const response = await gh(`/repos/${OWNER}/${SOURCE_REPO}/contents/${encodePath(PRIVATE_LINKS_PATH)}`, {
        method: 'PUT', body: JSON.stringify(body)
      });
      registrySha = response?.content?.sha || registrySha;
      registry = next;
      registryLoaded = true;
      enhanceAdmin();
    }).catch(error => console.warn('GuideFlow private link save:', error));
    return saveQueue;
  }

  function parseAccessUpdate(init = {}) {
    if (!init.body) return null;
    try {
      const outer = JSON.parse(init.body);
      if (!String(outer.message || '').startsWith('Grant live GuideFlow access to ')) return null;
      const json = JSON.parse(decodeBase64(outer.content || ''));
      const entries = Array.isArray(json.entries) ? json.entries : [];
      if (!entries.length) return null;
      return entries.reduce((latest, entry) => {
        if (!latest) return entry;
        return new Date(entry.createdAt || 0) > new Date(latest.createdAt || 0) ? entry : latest;
      }, null);
    } catch {
      return null;
    }
  }

  window.fetch = async function guideFlowLinkManagerFetch(input, init = {}) {
    captureAuthorization(input, init);
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    const accessUpdate = method === 'PUT' && ACCESS_RE.test(url) ? parseAccessUpdate(init) : null;
    const response = await originalFetch(input, init);
    if (response.ok && accessUpdate?.id) pendingCreatedEntry = accessUpdate;
    if (authorization && !registryLoaded) queueMicrotask(() => loadRegistry());
    return response;
  };

  function registryEntry(id) {
    return (registry.entries || []).find(item => item.id === id) || null;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  function removeModal() {
    document.querySelector('.gf-link-modal-backdrop')?.remove();
  }

  function showLinkModal({ name, link, title = 'رابط الوصول جاهز', note = 'يمكنك نسخ الرابط الآن أو فتحه في نافذة جديدة.' }) {
    if (!link) return;
    removeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'gf-link-modal-backdrop';
    backdrop.innerHTML = `
      <section class="gf-link-modal" role="dialog" aria-modal="true" aria-labelledby="gfLinkModalTitle">
        <button class="gf-modal-close" type="button" aria-label="إغلاق">×</button>
        <div class="gf-modal-icon">↗</div>
        <span class="kicker">ACCESS LINK</span>
        <h2 id="gfLinkModalTitle">${escapeHtml(title)}</h2>
        <p>${escapeHtml(note)}</p>
        <label><span>اسم الشخص</span><strong>${escapeHtml(name || '—')}</strong></label>
        <div class="gf-modal-link"><input value="${escapeHtml(link)}" readonly><button class="primary-btn gf-modal-copy" type="button">نسخ الرابط</button></div>
        <div class="gf-modal-actions"><button class="secondary-btn gf-modal-open" type="button">فتح الرابط</button><button class="secondary-btn gf-modal-done" type="button">تم</button></div>
      </section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.gf-modal-close')?.addEventListener('click', removeModal);
    backdrop.querySelector('.gf-modal-done')?.addEventListener('click', removeModal);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) removeModal(); });
    backdrop.querySelector('.gf-modal-open')?.addEventListener('click', () => window.open(link, '_blank', 'noopener'));
    backdrop.querySelector('.gf-modal-copy')?.addEventListener('click', async event => {
      if (await copyText(link)) {
        const button = event.currentTarget;
        const old = button.textContent;
        button.textContent = 'تم النسخ ✓';
        setTimeout(() => { button.textContent = old; }, 1400);
      }
    });
    requestAnimationFrame(() => backdrop.classList.add('show'));
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function captureIssuedLink() {
    const input = document.querySelector('.issued-card .issued-link input');
    if (!input?.value) return;
    const link = input.value;
    const card = input.closest('.issued-card');
    const name = card?.querySelector('h3')?.textContent?.trim() || pendingCreatedEntry?.label || 'مستخدم جديد';
    card?.classList.add('gf-issued-managed');

    if (pendingCreatedEntry?.id) {
      persistRecord({
        id: pendingCreatedEntry.id,
        name,
        link,
        createdAt: pendingCreatedEntry.createdAt
      });
      pendingCreatedEntry = null;
    }

    if (lastModalLink !== link) {
      lastModalLink = link;
      showLinkModal({ name, link });
    }
  }

  function renamePersonField() {
    const input = document.getElementById('labelInput');
    const label = input?.closest('label');
    const span = label?.querySelector(':scope > span');
    if (span) span.textContent = 'اسم الشخص';
    if (input) input.placeholder = 'مثال: Ahmed Benali';
  }

  function rowId(row) {
    const smalls = [...row.querySelectorAll('td small')];
    const candidate = smalls.map(node => node.textContent.trim()).find(text => text.startsWith('trainee-'));
    return candidate || '';
  }

  function enhanceRows() {
    document.querySelectorAll('.links-panel tbody tr').forEach(row => {
      const id = rowId(row);
      const actions = row.querySelector('.row-actions');
      if (!id || !actions || actions.querySelector('[data-gf-link-actions]')) return;
      const holder = document.createElement('span');
      holder.dataset.gfLinkActions = '1';
      holder.className = 'gf-row-link-actions';
      const saved = registryEntry(id);
      if (saved?.link) {
        holder.innerHTML = `<button class="mini-btn gf-show-link" type="button">عرض الرابط</button><button class="mini-btn gf-copy-link" type="button">نسخ الرابط</button>`;
        holder.querySelector('.gf-show-link')?.addEventListener('click', () => showLinkModal({ name: saved.name, link: saved.link, title: 'رابط الوصول', note: 'هذا الرابط محفوظ في سجل خاص داخل مستودع GuideFlow الخاص.' }));
        holder.querySelector('.gf-copy-link')?.addEventListener('click', async event => {
          if (await copyText(saved.link)) {
            const button = event.currentTarget;
            const old = button.textContent;
            button.textContent = 'تم النسخ ✓';
            setTimeout(() => { button.textContent = old; }, 1200);
          }
        });
      } else {
        holder.innerHTML = `<button class="mini-btn gf-link-unavailable" type="button" disabled title="هذا الرابط أُنشئ قبل تفعيل الحفظ الخاص ولا يمكن استعادته من الـHash">الرابط غير محفوظ</button>`;
      }
      actions.prepend(holder);
    });
  }

  function enhanceAdmin() {
    renamePersonField();
    captureIssuedLink();
    enhanceRows();
  }

  const observer = new MutationObserver(() => requestAnimationFrame(enhanceAdmin));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') removeModal(); });
  requestAnimationFrame(enhanceAdmin);
})();
