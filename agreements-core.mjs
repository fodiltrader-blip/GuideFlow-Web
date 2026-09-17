export const TEXT_FIELDS = ['title', 'description', 'includes', 'resources', 'refund', 'paymentMethod', 'paymentInstructions'];
export const CURRENCIES = ['DZD', 'EUR', 'USD', 'MAD', 'TND'];
export class AgreementError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new AgreementError(code); };
export const validId = id => /^[a-f0-9]{32}$/.test(id || '');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const digits = value => String(value).replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace('٫', '.').replace(',', '.');
export function moneyMinor(value, currency) {
  const precision = currency === 'TND' ? 3 : 2;
  const text = digits(value).trim();
  if (!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${precision}})?$`).test(text)) fail('money');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 10 ** precision + Number(fraction.padEnd(precision, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('money');
  return amount;
}
export function formatMoney(value, currency, language) {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'ar-DZ', { style: 'currency', currency }).format(value);
}
export function safePaymentUrl(value) {
  if (!value) return '';
  let url;
  try { url = new URL(String(value).trim()); } catch { fail('url'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) fail('url');
  return url.href;
}
function hasSensitiveData(value) {
  // Reject recognizable credentials and card numbers; never log rejected input.
  if (/(?:github_pat_|gh[pousr]_|sk_live_|sk_test_|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+\S+|(?:password|passwd|api[_ -]?key|secret|token|cvv|cvc)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s/]+@|\b\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}:\S+:\S+)/i.test(value)) return true;
  return (value.match(/(?:\d[ -]?){13,19}/g) || []).some(candidate => {
    const number = candidate.replace(/\D/g, '');
    if (!/^\d{13,19}$/.test(number)) return false;
    let sum = 0;
    [...number].reverse().forEach((ch, i) => { let n = Number(ch); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; });
    return sum % 10 === 0;
  });
}
export function normalizeAgreement(input) {
  if (!input || !['ar', 'fr'].includes(input.language) || !['public', 'private'].includes(input.visibility) || !CURRENCIES.includes(input.currency)) fail('invalid');
  const translations = {};
  for (const language of ['ar', 'fr']) {
    const source = input.translations?.[language] || {};
    const target = Object.fromEntries(TEXT_FIELDS.map(field => [field, String(source[field] || '').trim()]));
    const present = Object.values(target).some(Boolean);
    if (language === input.language || present) {
      if (TEXT_FIELDS.some(field => !target[field] || target[field].length > (field === 'title' ? 160 : 6000))) fail('required');
      if (hasSensitiveData(digits(Object.values(target).join('\n')))) fail('sensitive');
      translations[language] = target;
    }
  }
  const totalMinor = moneyMinor(input.total, input.currency);
  if (!Array.isArray(input.installments) || input.installments.length < 1 || input.installments.length > 36) fail('count');
  let previous = '';
  let sum = 0;
  const installments = input.installments.map(item => {
    const dueDate = String(item.dueDate || '');
    const date = new Date(`${dueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== dueDate || dueDate < previous) fail('date');
    previous = dueDate;
    const minor = moneyMinor(item.amount, input.currency);
    sum += minor;
    return { amount: minor / (input.currency === 'TND' ? 1000 : 100), dueDate };
  });
  if (sum !== totalMinor) fail('sum');
  const paymentUrl = safePaymentUrl(String(input.paymentUrl || '').trim());
  let decodedUrl;
  try { decodedUrl = decodeURIComponent(paymentUrl); } catch { fail('url'); }
  if (hasSensitiveData(decodedUrl)) fail('sensitive');
  // Explicit allowlist: unrelated properties never enter storage or the public document.
  return { language: input.language, visibility: input.visibility, currency: input.currency, total: totalMinor / (input.currency === 'TND' ? 1000 : 100), translations, installments, paymentUrl };
}
function encode(bytes) { return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function decode(text) { return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0)); }
export function newIdentity() {
  return { id: Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join(''), shareKey: encode(crypto.getRandomValues(new Uint8Array(32))) };
}
export function shareUrl(record, base) {
  if (!validId(record.id)) fail('invalid');
  const url = new URL('./agreement.html', base);
  url.searchParams.set('id', record.id);
  url.searchParams.set('lang', record.document.language);
  if (record.document.visibility === 'private') url.hash = `key=${record.shareKey}`;
  return url.href;
}
export async function publication(record) {
  const document = { ...normalizeAgreement(record.document), id: record.id, revision: record.revision, updatedAt: record.updatedAt };
  if (!validId(record.id)) fail('invalid');
  const header = { version: 1, id: record.id, revision: record.revision, visibility: document.visibility };
  if (document.visibility === 'public') return { ...header, document };
  const key = await crypto.subtle.importKey('raw', decode(record.shareKey), 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(record.id) }, key, new TextEncoder().encode(JSON.stringify(document)));
  return { ...header, nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) };
}
export async function openPublication(envelope, id, shareKey = '') {
  if (!validId(id) || envelope?.id !== id || envelope.version !== 1) fail('invalid');
  let document;
  if (envelope.visibility === 'public') document = envelope.document;
  else if (envelope.visibility === 'private') {
    if (!/^[\w-]{43}$/.test(shareKey)) fail('unavailable');
    try {
      const key = await crypto.subtle.importKey('raw', decode(shareKey), 'AES-GCM', false, ['decrypt']);
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.nonce), additionalData: new TextEncoder().encode(id) }, key, decode(envelope.ciphertext));
      document = JSON.parse(new TextDecoder().decode(plaintext));
    } catch { fail('unavailable'); }
  } else fail('invalid');
  if (document?.id !== id || document.revision !== envelope.revision || document.visibility !== envelope.visibility || !Number.isInteger(document.revision) || document.revision < 1 || !Number.isFinite(Date.parse(document.updatedAt))) fail('invalid');
  return { ...normalizeAgreement(document), id, revision: document.revision, updatedAt: document.updatedAt };
}
