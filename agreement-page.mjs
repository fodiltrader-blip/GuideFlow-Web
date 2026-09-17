import { openPublication, validId, escapeHtml as esc, formatMoney } from './agreements-core.mjs';
import { labels } from './agreements-i18n.mjs';

export function agreementHtml(document, language) {
  const t = labels[language], text = document.translations[language];
  const money = amount => esc(formatMoney(amount, document.currency, language));
  const date = value => esc(new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'ar-DZ', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value)));
  const list = value => `<ul>${value.split('\n').map(line => line.trim()).filter(Boolean).map(line => `<li>${esc(line)}</li>`).join('')}</ul>`;
  return `<header class="agreement-header"><div class="agreement-brand"><span>G</span><b>GuideFlow</b></div><div class="agreement-actions">${Object.keys(document.translations).map(lang => `<button class="secondary-btn" data-language="${lang}" aria-pressed="${lang === language}">${lang === 'ar' ? 'العربية' : 'Français'}</button>`).join('')}<button class="secondary-btn" id="printAgreement">${esc(t.print)}</button></div></header>
    <article><section class="agreement-hero"><div><span class="kicker">${esc(t.agreement)}</span><h1>${esc(text.title)}</h1><p>${esc(text.description)}</p></div><div class="agreement-total"><span>${esc(t.total)}</span><strong>${money(document.total)}</strong><small>${document.installments.length} · ${esc(t.count)}</small></div></section>
    <div class="agreement-meta"><span>${esc(t.revision)} ${document.revision}</span><span>${esc(t.updated)}: ${date(document.updatedAt)}</span></div>
    <div class="agreement-sections"><section><span class="kicker">01</span><h2>${esc(t.includes)}</h2>${list(text.includes)}</section><section><span class="kicker">02</span><h2>${esc(t.resources)}</h2>${list(text.resources)}</section></div>
    <section class="agreement-section"><span class="kicker">03</span><h2>${esc(t.schedule)}</h2><div class="table-wrap"><table><thead><tr><th scope="col">${esc(t.installment)}</th><th scope="col">${esc(t.date)}</th><th scope="col">${esc(t.amount)}</th></tr></thead><tbody>${document.installments.map((row, i) => `<tr><td>${i + 1}</td><td>${date(`${row.dueDate}T00:00:00Z`)}</td><td>${money(row.amount)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row" colspan="2">${esc(t.total)}</th><td><strong>${money(document.total)}</strong></td></tr></tfoot></table></div></section>
    <div class="agreement-sections"><section><span class="kicker">04</span><h2>${esc(t.refund)}</h2><p>${esc(text.refund)}</p></section><section><span class="kicker">05</span><h2>${esc(t.paymentMethod)}</h2><h3>${esc(text.paymentMethod)}</h3><p>${esc(text.paymentInstructions)}</p>${document.paymentUrl ? `<a class="primary-btn agreement-pay" href="${esc(document.paymentUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.pay)} ↗</a>` : ''}</section></div>
    <footer class="agreement-footer"><p>${esc(t.notice)}</p><small>GuideFlow · ${esc(t.agreement)}</small></footer></article>`;
}

if (typeof window !== 'undefined' && document.getElementById('agreementApp')) {
  const root = document.getElementById('agreementApp');
  const params = new URLSearchParams(location.search);
  let language = params.get('lang') === 'fr' ? 'fr' : 'ar';
  function direction() { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; }
  function render(agreement) {
    if (!agreement.translations[language]) language = agreement.language;
    direction(); document.title = `${agreement.translations[language].title} — GuideFlow`;
    root.innerHTML = agreementHtml(agreement, language);
    root.querySelectorAll('[data-language]').forEach(button => { button.onclick = () => { language = button.dataset.language; render(agreement); }; });
    document.getElementById('printAgreement').onclick = () => window.print();
  }
  async function load() {
    direction();
    try {
      const id = params.get('id');
      if (!validId(id)) throw new Error('invalid');
      const response = await fetch(`./data/agreements/${id}.json`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('unavailable');
      const agreement = await openPublication(await response.json(), id, new URLSearchParams(location.hash.slice(1)).get('key') || '');
      render(agreement);
    } catch {
      root.innerHTML = `<div class="agreement-error"><b>GuideFlow</b><p>${esc(labels[language].unavailable)}</p><button class="primary-btn" id="retryAgreement">${esc(labels[language].retry)}</button></div>`;
      document.getElementById('retryAgreement').onclick = load;
    }
  }
  load();
}
