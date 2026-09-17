import { TEXT_FIELDS, CURRENCIES, escapeHtml as esc, formatMoney, shareUrl } from './agreements-core.mjs';
import { createAgreementStore } from './agreements-store.mjs';
import { labels } from './agreements-i18n.mjs';

export function createAgreementAdmin(adapter) {
  let panel, language = 'ar', entries = [], loaded = false, selected = null, draft = null, working = false, epoch = 0;
  const t = () => labels[language];
  const $ = selector => panel.querySelector(selector);
  const service = () => {
    const session = epoch;
    const guard = fn => (...args) => { if (epoch !== session) throw new Error('Session ended'); return fn(...args); };
    return createAgreementStore({ readJsonOrNull: guard(adapter.readJsonOrNull), putFile: guard(adapter.putFile) });
  };
  const empty = () => ({ language: 'ar', visibility: 'private', currency: 'DZD', total: '', translations: { ar: {}, fr: {} }, installments: [{ amount: '', dueDate: '' }], paymentUrl: '' });
  function status(message, error = false) {
    const box = $('#agreementStatus');
    box.textContent = message;
    box.className = `status-box ${error ? 'error' : 'success'}`;
    box.hidden = !message;
  }
  function errorText(error) { return t().errors[error.code || ([409, 422].includes(error.status) ? 'conflict' : 'network')] || t().errors.network; }
  function collect() {
    if (!$('#agreementForm')) return;
    const form = new FormData($('#agreementForm'));
    draft = {
      language: form.get('language'), visibility: selected?.document.visibility || form.get('visibility'), currency: form.get('currency'), total: form.get('total'), paymentUrl: form.get('paymentUrl'),
      translations: Object.fromEntries(['ar', 'fr'].map(lang => [lang, Object.fromEntries(TEXT_FIELDS.map(key => [key, form.get(`${lang}.${key}`) || '']))])),
      installments: [...panel.querySelectorAll('[data-installment]')].map(row => ({ amount: row.querySelector('[name="amount"]').value, dueDate: row.querySelector('[name="dueDate"]').value }))
    };
  }
  function options(values, current) { return values.map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`).join(''); }
  function editor() {
    if (!draft) return '';
    return `<form id="agreementForm" autocomplete="off">
      <h3>${esc(selected ? t().edit : t().create)}</h3>
      <p class="agreement-note">${esc(t().safety)}</p>
      <div class="agreement-grid">
        <label>${esc(t().language)}<select name="language">${options([['ar', 'العربية'], ['fr', 'Français']], draft.language)}</select></label>
        <label>${esc(t().visibility)}<select name="visibility" ${selected ? 'disabled' : ''}>${options([['private', t().private], ['public', t().public]], draft.visibility)}</select></label>
      </div><p class="privacy-note">${esc(t().privacy)}</p>
      <h4>${esc(t().translation)}</h4><p class="privacy-note">${esc(t().translationNote)}</p>
      <div class="agreement-translations">${['ar', 'fr'].map(lang => `<fieldset dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}"><legend>${lang === 'ar' ? 'العربية' : 'Français'}</legend>${TEXT_FIELDS.map(key => `<label>${esc(labels[lang][key])}${key === 'title' ? `<input name="${lang}.${key}" maxlength="160" value="${esc(draft.translations[lang]?.[key])}">` : `<textarea name="${lang}.${key}" maxlength="6000" rows="3">${esc(draft.translations[lang]?.[key])}</textarea>`}</label>`).join('')}</fieldset>`).join('')}</div>
      <div class="agreement-grid agreement-finances">
        <label>${esc(t().total)}<input name="total" inputmode="decimal" required value="${esc(draft.total)}"></label>
        <label>${esc(t().currency)}<select name="currency">${options(CURRENCIES.map(c => [c, c]), draft.currency)}</select></label>
        <label>${esc(t().count)}<input name="count" type="number" min="1" max="36" required value="${draft.installments.length}"></label>
      </div>
      <div id="agreementInstallments">${draft.installments.map((row, i) => `<div class="agreement-installment" data-installment><b>${i + 1}</b><label>${esc(t().amount)}<input name="amount" inputmode="decimal" required value="${esc(row.amount)}"></label><label>${esc(t().date)}<input name="dueDate" type="date" required value="${esc(row.dueDate)}"></label></div>`).join('')}</div>
      <label class="agreement-payment-url">${esc(t().paymentUrl)}<input name="paymentUrl" type="url" maxlength="2048" dir="ltr" value="${esc(draft.paymentUrl)}" placeholder="https://"></label>
      <div class="agreement-actions"><button class="primary-btn" type="submit">${esc(t().save)}</button><button class="secondary-btn" type="button" data-cancel>${esc(t().cancel)}</button></div>
    </form>`;
  }
  function render() {
    panel.dir = language === 'ar' ? 'rtl' : 'ltr'; panel.lang = language;
    panel.innerHTML = `<div class="section-title"><div><span class="kicker">PURCHASE AGREEMENTS</span><h2>${esc(t().heading)}</h2><p class="section-subtitle">${esc(t().intro)}</p></div><select aria-label="Language / اللغة" id="agreementLanguage">${options([['ar', 'العربية'], ['fr', 'Français']], language)}</select></div>
      <div class="agreement-actions"><button class="secondary-btn" data-load>${esc(t().load)}</button><button class="primary-btn" data-new>${esc(t().create)}</button></div>
      <div id="agreementStatus" class="status-box" role="status" aria-live="polite" hidden></div>
      <div class="agreement-list">${entries.map(record => {
        const doc = record.document, text = doc.translations[language] || doc.translations[doc.language];
        return `<article class="agreement-card"><div><span class="lang-pill">${esc(doc.visibility === 'private' ? t().private : t().public)}</span><h3>${esc(text.title)}</h3><p>${esc(formatMoney(doc.total, doc.currency, language))} · ${esc(t().revision)} ${record.revision}</p></div><div class="agreement-actions"><button class="secondary-btn" data-edit="${record.id}">${esc(t().edit)}</button><button class="secondary-btn" data-copy="${record.id}">${esc(t().copy)}</button><a class="secondary-btn" href="${esc(shareUrl(record, location.href))}" target="_blank" rel="noopener noreferrer">${esc(t().open)} ↗</a><button class="secondary-btn" data-publish="${record.id}">${esc(t().publish)}</button></div></article>`;
      }).join('') || (loaded ? `<p class="empty">${esc(t().empty)}</p>` : '')}</div>
      <label id="agreementCopyFallback" hidden>${esc(t().copy)}<input readonly dir="ltr"></label>${editor()}`;
    $('#agreementLanguage').onchange = event => { collect(); language = event.target.value; render(); };
    $('[data-load]').onclick = load;
    $('[data-new]').onclick = () => { if (working) return; selected = null; draft = empty(); draft.language = language; render(); $('#agreementForm input')?.focus(); };
    panel.querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => { if (working) return; selected = entries.find(r => r.id === button.dataset.edit); draft = structuredClone(selected.document); render(); $('#agreementForm').scrollIntoView({ block: 'start' }); }; });
    panel.querySelectorAll('[data-copy]').forEach(button => { button.onclick = async () => {
      const url = shareUrl(entries.find(r => r.id === button.dataset.copy), location.href);
      try { await navigator.clipboard.writeText(url); status(t().copied); }
      catch { const field = $('#agreementCopyFallback'); field.hidden = false; field.querySelector('input').value = url; field.querySelector('input').select(); status(t().copyFailed, true); }
    }; });
    panel.querySelectorAll('[data-publish]').forEach(button => { button.onclick = () => run(async (store, session) => { await store.publish(entries.find(r => r.id === button.dataset.publish)); if (session === epoch) status(t().saved); }); });
    if (draft) {
      $('#agreementForm').onsubmit = save;
      $('[data-cancel]').onclick = () => { if (working) return; draft = null; selected = null; render(); };
      $('[name="count"]').onchange = event => {
        const count = Number(event.target.value);
        if (!Number.isInteger(count) || count < 1 || count > 36) { status(t().errors.count, true); return; }
        collect();
        draft.installments = Array.from({ length: count }, (_, i) => draft.installments[i] || { amount: '', dueDate: '' });
        render();
      };
    }
    lock();
  }
  function lock() { panel.querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = working || (el.name === 'visibility' && Boolean(selected)); }); }
  async function run(action) {
    if (working) return;
    working = true; lock(); const session = epoch;
    try { await action(service(), session); }
    catch (error) { if (session === epoch) status(errorText(error), true); }
    finally { if (session === epoch) { working = false; lock(); } }
  }
  async function load() {
    collect();
    await run(async (store, session) => {
      status(t().loading);
      const records = await store.list();
      if (session !== epoch) return;
      entries = records; loaded = true; render(); status('');
    });
  }
  async function save(event) {
    event.preventDefault(); collect();
    await run(async (store, session) => {
      status(t().saving);
      const record = await store.save(draft, selected);
      if (session !== epoch) return;
      entries = entries.filter(r => r.id !== record.id).concat(record);
      selected = record; draft = structuredClone(record.document); loaded = true; render();
      try { await store.publish(record); if (session === epoch) status(t().saved); }
      catch (error) { if (session === epoch) status(`${t().partial} ${errorText(error)}`, true); }
    });
  }
  return {
    detach() { panel?.remove(); },
    mount(parent) {
      if (!panel) { panel = document.createElement('section'); panel.id = 'agreements'; panel.className = 'links-panel agreement-admin'; render(); }
      parent.append(panel);
    },
    reset() { epoch++; panel?.remove(); panel = null; entries = []; loaded = false; selected = null; draft = null; working = false; }
  };
}
