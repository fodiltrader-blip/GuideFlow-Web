import { escapeHtml as esc, formatMoney } from './agreements-core.mjs';
import { labels } from './agreements-i18n.mjs';

const copy = {
  ar: { studio: 'اتفاقات التدريب', overview: 'تفاصيل الاتفاق', seller: 'البائع', buyer: 'المشتري', summary: 'ملخص الاتفاق', first: 'الدفعة الأولى', due: 'تستحق في', installments: 'دفعات', private: 'نسخة خاصة', public: 'نسخة عامة', reference: 'مرجع الاتفاق', percent: 'من السعر الإجمالي', payment: 'بيانات الدفع', paymentHint: 'راجع طريقة الدفع وتعليماته أدناه.', viewPayment: 'عرض بيانات الدفع', address: 'عنوان الاستلام', copyAddress: 'نسخ العنوان', copied: 'تم نسخ العنوان', copyFailed: 'تعذّر النسخ. حدّد العنوان وانسخه يدويًا.', source: 'مصدر سعر الصرف' },
  fr: { studio: 'Accords de formation', overview: 'Détails de l’accord', seller: 'Vendeur', buyer: 'Acheteur', summary: 'Récapitulatif', first: 'Premier versement', due: 'À régler le', installments: 'échéances', private: 'Copie privée', public: 'Copie publique', reference: 'Référence', percent: 'du prix total', payment: 'Coordonnées de paiement', paymentHint: 'Consultez le moyen de paiement et les instructions ci-dessous.', viewPayment: 'Voir les instructions', address: 'Adresse de réception', copyAddress: 'Copier l’adresse', copied: 'Adresse copiée', copyFailed: 'Copie impossible. Sélectionnez et copiez l’adresse manuellement.', source: 'Source du taux de change' }
};

function icon(name) {
  const paths = {
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    book: '<path d="M12 7v14M3 3h4a5 5 0 0 1 5 4 5 5 0 0 1 5-4h4v17h-4a5 5 0 0 0-5 2 5 5 0 0 0-5-2H3Z"/>',
    folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    wallet: '<path d="M20 8V5a2 2 0 0 0-2-2L4 6a2 2 0 0 0-1 2v11a2 2 0 0 0 2 2h15V8H5"/><path d="M20 12h-5v5h5"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3"/><path d="M6 14h12v7H6Z"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  return `<svg class="agreement-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`;
}

function bidiText(value) {
  if (/[<>&]/.test(value)) return esc(value);
  return value.split(/([A-Za-z][A-Za-z0-9._/-]*)/g).map((part, i) => i % 2 ? `<bdi dir="ltr">${esc(part)}</bdi>` : esc(part)).join('');
}

function titleHtml(value) {
  const split = value.indexOf(' — ');
  if (split < 0) return bidiText(value);
  return `<span>${bidiText(value.slice(0, split))}</span><span class="agreement-title-subline">${bidiText(value.slice(split))}</span>`;
}

// Recognize only explicit labels; retain every other line as written.
function descriptionParts(value) {
  const parties = [], paragraphs = [], roles = new Set();
  for (const line of value.split('\n').filter(line => line.trim())) {
    const match = line.match(/^\s*(البائع|المشتري|Vendeur|Acheteur)\s*[:：]\s*(.+)$/i);
    const role = match && (/البائع|vendeur/i.test(match[1]) ? 'seller' : 'buyer');
    if (match && !roles.has(role)) {
      parties.push({ role, name: match[2].trim() }); roles.add(role);
    } else paragraphs.push(line);
  }
  return { parties, paragraphs };
}

function paymentContent(value, language) {
  const c = copy[language], lines = value.split('\n'), parts = [];
  let addressIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(عنوان الاستلام|Adresse de réception)\s*[:：]\s*$/i.test(line) && /^0x[a-fA-F0-9]{40}$/.test(lines[i + 1]?.trim() || '')) continue;
    if (/^0x[a-fA-F0-9]{40}$/.test(line)) {
      const id = `agreementAddress${addressIndex++}`;
      parts.push(`<div class="agreement-address"><div class="agreement-address-top"><label for="${id}">${esc(c.address)}</label><button class="agreement-copy" type="button" data-copy-address="${id}">${icon('copy')}<span>${esc(c.copyAddress)}</span></button></div><textarea id="${id}" readonly dir="ltr" spellcheck="false" rows="2">${esc(line)}</textarea><span class="agreement-copy-status" role="status" aria-live="polite"></span></div>`);
    } else {
      const source = line.match(/^(مصدر السعر الاسترشادي|Source du cours indicatif)\s*:\s*(https:\/\/\S+)$/);
      let url;
      try { url = source && new URL(source[2]); } catch { /* Keep unrecognized source text. */ }
      if (url?.protocol === 'https:' && !url.username && !url.password) parts.push(`<p class="agreement-source"><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(source[1])}: <bdi>${esc(source[2])}</bdi>${icon('arrow')}</a></p>`);
      else parts.push(`<p>${bidiText(line)}</p>`);
    }
  }
  return parts.join('');
}

export function premiumAgreementHtml(document, language) {
  const t = labels[language], c = copy[language], text = document.translations[language];
  const money = amount => `<bdi>${esc(formatMoney(amount, document.currency, language))}</bdi>`;
  const date = value => esc(new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'ar-DZ', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value)));
  const list = value => `<ul class="agreement-benefits">${value.split('\n').map(line => line.trim()).filter(Boolean).map(line => `<li><span class="agreement-check">${icon('check')}</span><span>${bidiText(line)}</span></li>`).join('')}</ul>`;
  const heading = (number, symbol, title) => `<div class="agreement-section-heading"><span class="agreement-section-icon">${icon(symbol)}</span><h2>${esc(title)}</h2><span class="agreement-section-number" aria-hidden="true">${number}</span></div>`;
  const { parties, paragraphs } = descriptionParts(text.description);
  const first = document.installments[0];
  return `<header class="agreement-header">
    <div class="agreement-brand"><span class="agreement-brand-mark" aria-hidden="true">G<span></span></span><span><b>GuideFlow</b><small>${esc(c.studio)}</small></span></div>
    <div class="agreement-actions"><div class="agreement-language-switch" role="group" aria-label="Language / اللغة">${Object.keys(document.translations).map(lang => `<button type="button" data-language="${lang}" aria-pressed="${lang === language}">${lang === 'ar' ? 'العربية' : 'Français'}</button>`).join('')}</div><button class="agreement-print" id="printAgreement" type="button" aria-label="${esc(t.print)}">${icon('print')}<span>${esc(t.print)}</span></button></div>
  </header>
  <article><section class="agreement-hero">
    <div class="agreement-hero-top"><span class="agreement-eyebrow">${esc(t.agreement)}</span><span class="agreement-visibility">${icon('document')}${esc(c[document.visibility])}</span></div>
    <div class="agreement-hero-title"><h1>${titleHtml(text.title)}</h1><span class="agreement-hero-emblem" aria-hidden="true">${icon('document')}</span></div>
    <div class="agreement-hero-bottom"><div class="agreement-parties">${parties.map(p => `<div class="agreement-party"><span class="agreement-avatar" aria-hidden="true">${esc([...p.name][0].toUpperCase())}</span><span><small>${esc(c[p.role])}</small><strong dir="auto">${esc(p.name)}</strong></span></div>`).join('')}</div><div class="agreement-reference"><small>${esc(c.reference)}</small><span dir="ltr">GF · ${esc(document.id.slice(0, 8).toUpperCase())}</span></div></div>
  </section>
  <div class="agreement-layout">
    <aside class="agreement-summary" aria-label="${esc(c.summary)}"><div class="agreement-summary-label">${esc(c.summary)}</div><span class="agreement-price-label">${esc(t.total)}</span><strong class="agreement-price">${money(document.total)}</strong>
      <div class="agreement-summary-count">${icon('calendar')}<span>${document.installments.length} ${esc(c.installments)}</span><span class="agreement-currency">${esc(document.currency)}</span></div>
      <div class="agreement-first-payment"><div><span>${esc(c.first)}</span><strong>${money(first.amount)}</strong></div><small>${esc(c.due)} <time datetime="${esc(first.dueDate)}">${date(`${first.dueDate}T00:00:00Z`)}</time></small></div>
      <button class="agreement-primary-link" type="button" id="viewAgreementPayment">${esc(c.viewPayment)}${icon('arrow')}</button><p class="agreement-summary-hint">${esc(c.paymentHint)}</p>
      <div class="agreement-summary-meta"><span>${esc(t.revision)} <b>${document.revision}</b></span><span>${esc(t.updated)} <b>${date(document.updatedAt)}</b></span></div>
    </aside>
    <div class="agreement-body">
      ${paragraphs.length ? `<section class="agreement-section agreement-overview">${heading('01', 'document', c.overview)}<div class="agreement-prose">${paragraphs.map(p => `<p>${bidiText(p)}</p>`).join('')}</div></section>` : ''}
      <div class="agreement-sections"><section class="agreement-section">${heading('02', 'book', t.includes)}${list(text.includes)}</section><section class="agreement-section">${heading('03', 'folder', t.resources)}${list(text.resources)}</section></div>
      <section class="agreement-section agreement-schedule">${heading('04', 'calendar', t.schedule)}<ol class="agreement-installment-cards">${document.installments.map((row, i) => {
        const percentage = Math.round(row.amount / document.total * 10000) / 100;
        return `<li class="agreement-milestone"><div class="agreement-milestone-top"><span class="agreement-step" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${esc(t.installment)} ${i + 1}</span></div><strong>${money(row.amount)}</strong><span class="agreement-percentage"><bdi>${percentage}%</bdi> ${esc(c.percent)}</span><div class="agreement-milestone-date">${icon('calendar')}<time datetime="${esc(row.dueDate)}">${date(`${row.dueDate}T00:00:00Z`)}</time></div></li>`;
      }).join('')}</ol></section>
      <section class="agreement-section agreement-refund">${heading('05', 'shield', t.refund)}<div class="agreement-prose">${text.refund.split('\n').filter(Boolean).map(p => `<p>${bidiText(p)}</p>`).join('')}</div></section>
      <section class="agreement-section agreement-payment" id="agreementPayment" tabindex="-1">${heading('06', 'wallet', c.payment)}<div class="agreement-payment-method"><span>${esc(t.paymentMethod)}</span><strong>${bidiText(text.paymentMethod)}</strong></div><div class="agreement-payment-content">${paymentContent(text.paymentInstructions, language)}</div>${document.paymentUrl ? `<a class="agreement-primary-link agreement-pay" href="${esc(document.paymentUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.pay)}${icon('arrow')}</a>` : ''}</section>
    </div>
  </div>
  <footer class="agreement-footer"><div class="agreement-footer-brand">GuideFlow<span>${esc(c.studio)}</span></div><p>${esc(t.notice)}</p></footer></article>`;
}

export function bindPaymentCopy(root, language) {
  // Never use a #section link: it would replace the private decryption fragment.
  root.querySelector('#viewAgreementPayment').onclick = () => {
    const section = root.querySelector('#agreementPayment');
    section.scrollIntoView({ block: 'start' }); section.focus({ preventScroll: true });
  };
  root.querySelectorAll('[data-copy-address]').forEach(button => {
    button.onclick = async () => {
      const field = root.querySelector(`#${button.dataset.copyAddress}`);
      const status = button.closest('.agreement-address').querySelector('.agreement-copy-status');
      try { await navigator.clipboard.writeText(field.value); status.textContent = copy[language].copied; }
      catch { field.focus(); field.select(); status.textContent = copy[language].copyFailed; }
    };
  });
}
