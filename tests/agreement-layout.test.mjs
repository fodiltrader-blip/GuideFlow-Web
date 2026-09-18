import test from 'node:test';
import assert from 'node:assert/strict';
import { premiumAgreementHtml, bindPaymentCopy } from '../agreement-layout.mjs';

const wallet = '0x' + 'abc123'.repeat(6) + 'abcd';
function fixture() {
  const fields = { title: 'اتفاق GuideFlow — Test', description: 'البائع: Seller\nالمشتري: Buyer\nوصف الكورس كما هو.', includes: 'المحتوى الأول\nالمحتوى الثاني', resources: 'الملفات', refund: 'الاسترجاع مع خصم 30 يورو.', paymentMethod: 'USDT / BEP20', paymentInstructions: `عنوان الاستلام:\n${wallet}\nتعليمات الدفع كما هي.` };
  return { id: 'a'.repeat(32), revision: 1, updatedAt: '2026-09-17T09:00:00Z', visibility: 'private', currency: 'EUR', total: 1500, installments: [{ amount: 450, dueDate: '2026-09-18' }, { amount: 525, dueDate: '2026-10-18' }, { amount: 525, dueDate: '2026-11-18' }], translations: { ar: fields, fr: { ...fields, description: 'Vendeur : Seller\nAcheteur : Buyer\nFormation.' } } };
}

test('design preserves terms, parties, schedule and exact address without mutating the document', () => {
  const doc = fixture(), before = JSON.stringify(doc), html = premiumAgreementHtml(doc, 'ar');
  assert.equal(JSON.stringify(doc), before);
  for (const value of ['Seller', 'Buyer', 'وصف الكورس كما هو.', 'الاسترجاع مع خصم 30 يورو.', 'تعليمات الدفع كما هي.', wallet, '30%', '35%', '2026-09-18', '2026-10-18', '2026-11-18']) assert.ok(html.includes(value), value);
  assert.equal((html.match(/class="agreement-milestone"/g) || []).length, 3);
  assert.ok(html.includes('readonly dir="ltr"'));
  assert.ok(!html.includes('href="#'));
  assert.ok(premiumAgreementHtml(doc, 'fr').includes('Récapitulatif'));
});

test('unrecognized text, duplicate party labels and unsafe links remain visible and escaped', () => {
  const doc = fixture();
  doc.translations.ar.description = 'البائع: <script>bad()</script>\nالبائع: Second seller\nUnlabeled details';
  doc.translations.ar.paymentInstructions = '<img src=x onerror=alert(1)>\nSource du cours indicatif : javascript:alert(1)\nSource du cours indicatif : https://example.com/rate';
  const html = premiumAgreementHtml(doc, 'ar');
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Second'));
  assert.ok(html.includes('Unlabeled')); assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('href="https://example.com/rate"'));
});

test('payment navigation focuses the section without changing the private URL fragment', () => {
  const button = {}, events = [], section = { scrollIntoView: () => events.push('scroll'), focus: () => events.push('focus') };
  const root = { querySelector: name => name === '#viewAgreementPayment' ? button : section, querySelectorAll: () => [] };
  bindPaymentCopy(root, 'ar'); button.onclick(); assert.deepEqual(events, ['scroll', 'focus']);
});

test('clipboard success and denial copy or select the exact address', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const status = {}, events = [], field = { value: wallet, focus: () => events.push('focus'), select: () => events.push('select') };
  const button = { dataset: { copyAddress: 'agreementAddress0' }, closest: () => ({ querySelector: () => status }) };
  const root = { querySelector: name => name === '#viewAgreementPayment' ? {} : field, querySelectorAll: () => [button] };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => events.push(value) } } });
    bindPaymentCopy(root, 'ar'); await button.onclick(); assert.equal(events[0], wallet); assert.equal(status.textContent, 'تم نسخ العنوان');
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    await button.onclick(); assert.deepEqual(events.slice(1), ['focus', 'select']); assert.ok(status.textContent.includes('تعذّر'));
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});
