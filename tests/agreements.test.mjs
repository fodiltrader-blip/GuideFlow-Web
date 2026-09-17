import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgreement, newIdentity, publication, openPublication, shareUrl, moneyMinor, safePaymentUrl } from '../agreements-core.mjs';
import { createAgreementStore, REGISTRY_PATH } from '../agreements-store.mjs';
import { agreementHtml } from '../agreement-page.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function fixture() {
  const text = { title: 'عرض تجريبي', description: 'Formation pratique', includes: 'دروس\nتمارين', resources: 'ملفات وموارد', refund: 'استرجاع خلال المدة المحددة في العرض', paymentMethod: 'تحويل بنكي', paymentInstructions: 'تواصل مع البائع للحصول على تعليمات التحويل.' };
  return { language: 'ar', visibility: 'private', currency: 'DZD', total: '100.30', translations: { ar: text, fr: { ...text, title: 'Formation pratique' } }, installments: [{ amount: '50.10', dueDate: '2027-01-01' }, { amount: '50.20', dueDate: '2027-02-01' }], paymentUrl: 'https://example.com/payment' };
}
function memoryStore() {
  const files = new Map(), writes = [];
  let failPublic = false;
  const adapter = {
    async readJsonOrNull(repo, path) { return structuredClone(files.get(`${repo}/${path}`) || null); },
    async putFile(repo, path, text, message, sha) {
      if (failPublic && repo === 'GuideFlow-Web') throw new Error('simulated failure');
      const key = `${repo}/${path}`, old = files.get(key);
      if ((old?.sha || null) !== sha) throw Object.assign(new Error('conflict'), { status: 409 });
      const file = { sha: crypto.randomUUID(), json: JSON.parse(text) }; files.set(key, file); writes.push({ repo, path, text, message });
    }
  };
  return { store: createAgreementStore(adapter), adapter, files, writes, failPublic: value => { failPublic = value; } };
}
test('amounts use minor units, accept Arabic decimal digits and support TND precision', () => {
  assert.equal(moneyMinor('٠٫٣٠', 'DZD'), 30);
  assert.equal(moneyMinor('0,301', 'TND'), 301);
  for (const value of ['-1', '0', 'NaN', '1e3', '1.001', '10000000000']) assert.throws(() => moneyMinor(value, 'DZD'));
  assert.equal(normalizeAgreement(fixture()).total, 100.3);
});
test('reject totals, invalid/calendar/unordered dates, count and incomplete translations', () => {
  for (const mutate of [d => { d.total = '100'; }, d => { d.installments[0].dueDate = '2027-02-30'; }, d => { d.installments[0].dueDate = '2027-03-01'; }, d => { d.installments = []; }, d => { d.translations.fr.refund = ''; }]) {
    const d = fixture(); mutate(d); assert.throws(() => normalizeAgreement(d));
  }
  const d = fixture(); delete d.translations.fr; assert.ok(normalizeAgreement(d));
});
test('only safe HTTPS payment URLs and allowlisted properties reach storage', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', '//example.com']) assert.throws(() => safePaymentUrl(url));
  const d = fixture(); d.cardNumber = 'discard this'; d.translations.ar.unknown = 'discard this';
  assert.ok(!JSON.stringify(normalizeAgreement(d)).includes('discard this'));
  d.paymentUrl = 'https://example.com/%ZZ'; assert.throws(() => normalizeAgreement(d), { code: 'url' });
});
test('recognizable card numbers and credential patterns are rejected without echoing the input', () => {
  for (const sample of ['4' + '1'.repeat(15), ['api', 'key'].join('_') + '=example', ['gh', 'p_'].join('') + 'example', 'https://someone:example@proxy.example']) {
    const d = fixture(); d.translations.ar.paymentInstructions = sample;
    assert.throws(() => normalizeAgreement(d), { code: 'sensitive' });
  }
});
test('private publication decrypts only with correct key; envelopes contain no plaintext/key', async () => {
  const record = { ...newIdentity(), revision: 1, updatedAt: new Date().toISOString(), document: fixture() };
  const envelope = await publication(record);
  assert.ok(!JSON.stringify(envelope).includes(record.shareKey));
  assert.ok(!JSON.stringify(envelope).includes(record.document.translations.ar.title));
  const result = await openPublication(envelope, record.id, record.shareKey);
  assert.equal(result.total, 100.3);
  await assert.rejects(openPublication(envelope, record.id));
  await assert.rejects(openPublication(envelope, record.id, newIdentity().shareKey));
  await assert.rejects(openPublication({ ...envelope, revision: 2 }, record.id, record.shareKey));
  await assert.rejects(openPublication({ ...envelope, id: newIdentity().id }, record.id, record.shareKey));
  const link = new URL(shareUrl(record, 'https://example.com/GuideFlow-Web/admin.html'));
  assert.equal(link.pathname, '/GuideFlow-Web/agreement.html'); assert.ok(!link.search.includes(record.shareKey)); assert.ok(link.hash.includes(record.shareKey));
});
test('public publication and bilingual agreement escape HTML and show all financial terms', async () => {
  const d = fixture(); d.visibility = 'public'; d.translations.ar.title = '<img src=x onerror=alert(1)>';
  const record = { ...newIdentity(), revision: 1, updatedAt: new Date().toISOString(), document: d };
  const envelope = await publication(record), opened = await openPublication(envelope, record.id);
  assert.ok(!shareUrl(record, 'https://example.com/admin.html').includes('#'));
  assert.ok(!JSON.stringify(envelope).includes(record.shareKey));
  const ar = agreementHtml(opened, 'ar'), fr = agreementHtml(opened, 'fr');
  assert.ok(ar.includes('&lt;img')); assert.ok(!ar.includes('<img')); assert.ok(ar.includes('2027')); assert.ok(ar.includes('شروط استرجاع'));
  assert.ok(fr.includes('Conditions de remboursement')); assert.ok(fr.includes('Échéancier'));
});
test('create, reload, edit and republish preserve the link without touching access files', async () => {
  const m = memoryStore(); let record = await m.store.save(fixture()); await m.store.publish(record);
  const link = shareUrl(record, 'https://example.com/admin.html');
  assert.equal((await m.store.list()).length, 1);
  const d = fixture(); d.translations.ar.title = 'عنوان جديد';
  record = await m.store.save(d, record); await m.store.publish(record);
  assert.equal(shareUrl(record, 'https://example.com/admin.html'), link);
  assert.equal(record.revision, 2);
  assert.ok(m.writes.every(w => w.path === REGISTRY_PATH || w.path.startsWith('data/agreements/')));
});
test('failed publication is recoverable from private record; stale edits and visibility changes fail', async () => {
  const m = memoryStore(), record = await m.store.save(fixture());
  m.failPublic(true); await assert.rejects(m.store.publish(record)); assert.equal((await m.store.list()).length, 1);
  m.failPublic(false); await m.store.publish((await m.store.list())[0]);
  const d = fixture(); await m.store.save(d, record);
  await assert.rejects(m.store.save(d, record), { code: 'conflict' });
  await assert.rejects(m.store.publish(record), { code: 'conflict' });
  const latest = (await m.store.list())[0]; d.visibility = 'public'; await assert.rejects(m.store.save(d, latest), { code: 'visibility' });
});
test('concurrent registry creation does not silently lose an agreement', async () => {
  const m = memoryStore();
  const results = await Promise.allSettled([m.store.save(fixture()), m.store.save(fixture())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await m.store.list()).length, 1);
});
test('agreement conflicts bypass legacy automatic SHA retry', async () => {
  let count = 0;
  const window = { fetch: async () => { count++; return new Response(JSON.stringify({ message: 'sha does not match' }), { status: 409 }); } };
  vm.runInNewContext(readFileSync(new URL('../admin-conflict-retry.js', import.meta.url), 'utf8'), { window, Headers, Response, TextEncoder, TextDecoder, atob, btoa, setTimeout });
  await window.fetch('https://api.github.com/repos/fodiltrader-blip/GuideFlow/contents/config/purchase-agreements.json', { method: 'PUT', body: JSON.stringify({ sha: 'stale', content: '' }) });
  assert.equal(count, 1);
});
