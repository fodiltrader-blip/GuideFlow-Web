(() => {
  const STORAGE_KEY = 'guideflow.admin.access-links.v1';
  const ACCESS_API = 'https://api.github.com/repos/fodiltrader-blip/GuideFlow-Web/contents/data/access.json?ref=main';

  let publicIndex = new Map();
  let publicIndexLoadedAt = 0;
  let lastHandledLink = '';
  let scheduled = false;

  function readStoredLinks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"entries":[]}');
      return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch {
      return [];
    }
  }

  function writeStoredLinks(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries }));
      return true;
    } catch {
      return false;
    }
  }

  function upsertStoredLink(record) {
    const entries = readStoredLinks();
    const index = entries.findIndex(item => item.tokenHash === record.tokenHash);
    if (index >= 0) entries[index] = { ...entries[index], ...record };
    else entries.push(record);
    return writeStoredLinks(entries);
  }

  function base64ToUtf8(value) {
    const binary = atob(String(value || '').replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
  }

  async function sha256Hex(text) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function tokenFromLink(link) {
    const marker = '#/access/';
    const index = String(link || '').indexOf(marker);
    if (index < 0) return '';
    try { return decodeURIComponent(String(link).slice(index + marker.length)); }
    catch { return String(link).slice(index + marker.length); }
  }

  async function refreshPublicIndex(force = false) {
    if (!force && publicIndex.size && Date.now() - publicIndexLoadedAt < 15000) return publicIndex;
    try {
      const response = await fetch(`${ACCESS_API}&_gf=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) return publicIndex;
      const data = await response.json();
      const json = JSON.parse(base64ToUtf8(data.content || ''));
      const next = new Map();
      (json.entries || []).forEach(entry => {
        if (entry?.id && entry?.tokenHash) next.set(entry.id, entry.tokenHash);
      });
      publicIndex = next;
      publicIndexLoadedAt = Date.now();
      return publicIndex;
    } catch {
      return publicIndex;
    }
  }

  function storedRecordForId(id) {
    const tokenHash = publicIndex.get(id);
    if (!tokenHash) return null;
    return readStoredLinks().find(item => item.tokenHash === tokenHash) || null;
  }

  function modal() {
    let element = document.getElementById('gfLinkModal');
    if (element) return element;

    element = document.createElement('div');
    element.id = 'gfLinkModal';
    element.className = 'gf-link-modal';
    element.hidden = true;
    element.innerHTML = `
      <div class="gf-link-modal-backdrop" data-gf-modal-close></div>
      <section class="gf-link-dialog" role="dialog" aria-modal="true" aria-labelledby="gfLinkModalTitle">
        <header class="gf-link-dialog-head">
          <div class="gf-link-dialog-icon">↗</div>
          <div><span id="gfLinkModalKicker">ACCESS LINK</span><h2 id="gfLinkModalTitle">رابط الوصول</h2></div>
          <button type="button" class="gf-link-dialog-close" data-gf-modal-close aria-label="إغلاق">×</button>
        </header>
        <div class="gf-link-person"><span>اسم الشخص</span><strong id="gfLinkPerson">—</strong></div>
        <label class="gf-link-value"><span>الرابط</span><input id="gfLinkValue" readonly></label>
        <div id="gfLinkLocalState" class="gf-link-local-state" hidden></div>
        <div class="gf-link-dialog-actions">
          <button type="button" class="primary-btn" id="gfCopyLinkBtn">نسخ الرابط</button>
          <button type="button" class="secondary-btn" id="gfOpenLinkBtn">فتح الرابط</button>
          <button type="button" class="secondary-btn" data-gf-modal-close>إغلاق</button>
        </div>
        <p class="gf-link-security-note">إمكانية إعادة عرض الرابط محفوظة محليًا في متصفح لوحة التحكم فقط، ولا يُضاف مفتاح الرابط الخام إلى access.json العام.</p>
      </section>`;
    document.body.appendChild(element);

    element.querySelectorAll('[data-gf-modal-close]').forEach(button => button.addEventListener('click', closeModal));
    element.querySelector('#gfCopyLinkBtn')?.addEventListener('click', copyModalLink);
    element.querySelector('#gfOpenLinkBtn')?.addEventListener('click', () => {
      const value = element.querySelector('#gfLinkValue')?.value;
      if (value) window.open(value, '_blank', 'noopener');
    });
    return element;
  }

  function setModalState(message = '', type = '') {
    const state = modal().querySelector('#gfLinkLocalState');
    if (!state) return;
    state.textContent = message;
    state.className = `gf-link-local-state ${type}`.trim();
    state.hidden = !message;
  }

  function openModal({ personName = '—', link = '', created = false, message = '', messageType = '' } = {}) {
    const element = modal();
    element.querySelector('#gfLinkModalKicker').textContent = created ? 'NEW ACCESS' : 'ACCESS LINK';
    element.querySelector('#gfLinkModalTitle').textContent = created ? 'تم إنشاء الرابط' : 'عرض رابط الوصول';
    element.querySelector('#gfLinkPerson').textContent = personName || '—';
    element.querySelector('#gfLinkValue').value = link || '';
    setModalState(message, messageType);
    element.hidden = false;
    document.body.classList.add('gf-modal-open');
    requestAnimationFrame(() => element.querySelector('#gfCopyLinkBtn')?.focus());
  }

  function closeModal() {
    const element = document.getElementById('gfLinkModal');
    if (element) element.hidden = true;
    document.body.classList.remove('gf-modal-open');
  }

  async function copyModalLink() {
    const input = modal().querySelector('#gfLinkValue');
    const value = input?.value || '';
    if (!value) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      try {
        input.focus();
        input.select();
        copied = document.execCommand('copy');
      } catch {}
    }
    const button = modal().querySelector('#gfCopyLinkBtn');
    if (!button) return;
    button.textContent = copied ? '✓ تم النسخ' : 'تعذر النسخ';
    setTimeout(() => { button.textContent = 'نسخ الرابط'; }, 1400);
  }

  function normalizeNameField() {
    const input = document.getElementById('labelInput');
    const label = input?.closest('label');
    const title = label?.querySelector('span');
    if (title) title.textContent = 'اسم الشخص';
    if (input) input.placeholder = 'مثال: Ahmed Benali';
  }

  async function processIssuedCard() {
    const card = document.querySelector('.issued-card');
    const input = card?.querySelector('.issued-link input');
    const link = input?.value?.trim() || '';
    if (!card || !link || link === lastHandledLink) return;

    lastHandledLink = link;
    card.hidden = true;
    const personName = card.querySelector('h3')?.textContent?.trim() || 'متدرّب';
    const token = tokenFromLink(link);

    openModal({
      personName,
      link,
      created: true,
      message: 'جاري حفظ إمكانية إعادة عرض الرابط على هذا المتصفح…',
      messageType: 'loading'
    });

    if (!token) {
      setModalState('تم إنشاء الرابط، لكن تعذر حفظ نسخة الاسترجاع المحلية.', 'error');
      return;
    }

    const tokenHash = await sha256Hex(token);
    const stored = upsertStoredLink({ tokenHash, personName, link, savedAt: new Date().toISOString() });
    await refreshPublicIndex(true);
    setModalState(
      stored ? 'تم حفظ الرابط محليًا ويمكن عرضه ونسخه لاحقًا من إدارة الروابط.' : 'الرابط صالح، لكن المتصفح منع حفظ نسخة الاسترجاع المحلية.',
      stored ? 'success' : 'error'
    );
    await enhanceRows();
  }

  function makeUnavailableButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-btn gf-view-link unavailable';
    button.textContent = 'رابط قديم';
    button.disabled = true;
    button.title = 'أُنشئ هذا الرابط قبل تفعيل سجل الاسترجاع المحلي، ولا يمكن عكس SHA-256 لاستعادته.';
    button.dataset.gfLinkState = 'unavailable';
    return button;
  }

  async function enhanceRows() {
    await refreshPublicIndex();
    document.querySelectorAll('.links-panel tbody tr').forEach(row => {
      const anchor = row.querySelector('[data-toggle], [data-delete]');
      const id = anchor?.dataset?.toggle || anchor?.dataset?.delete;
      const actions = row.querySelector('.row-actions');
      if (!id || !actions) return;

      const record = storedRecordForId(id);
      const expectedState = record?.link ? 'available' : 'unavailable';
      const existing = actions.querySelector('[data-gf-view-link]');
      if (existing?.dataset.gfLinkState === expectedState) {
        if (record?.personName) {
          const name = row.querySelector('td:nth-child(2) strong');
          if (name && name.textContent !== record.personName) name.textContent = record.personName;
        }
        return;
      }
      existing?.remove();

      let button;
      if (record?.link) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'mini-btn gf-view-link';
        button.textContent = 'عرض الرابط';
        button.dataset.gfLinkState = 'available';
        button.addEventListener('click', () => openModal({ personName: record.personName || id, link: record.link }));
        const name = row.querySelector('td:nth-child(2) strong');
        if (name && record.personName) name.textContent = record.personName;
      } else {
        button = makeUnavailableButton();
      }
      button.dataset.gfViewLink = id;
      actions.prepend(button);
    });
  }

  async function enhance() {
    normalizeNameField();
    await processIssuedCard();
    if (document.querySelector('.admin-shell.v2')) await enhanceRows();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await enhance();
    });
  }

  const observer = new MutationObserver(scheduleEnhance);
  const start = () => {
    modal();
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('gfLinkModal')?.hidden) closeModal();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
