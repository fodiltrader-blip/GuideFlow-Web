import { openPublication, validId, escapeHtml as esc } from './agreements-core.mjs';
import { labels } from './agreements-i18n.mjs';

import { premiumAgreementHtml, bindPaymentCopy } from './agreement-layout.mjs?v=20260918-1';
export const agreementHtml = premiumAgreementHtml;

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
    bindPaymentCopy(root, language);
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

