// Local-only browser integration test. All GitHub/data requests use in-memory fixtures.
// Run: node tests/browser-smoke.mjs (requires Playwright and a Chromium installation).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { newIdentity } from '../agreements-core.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const files = new Map(), writes = [], errors = [];
const set = (repo, path, json) => files.set(`${repo}/${path}`, { sha: crypto.randomUUID(), json });
set('GuideFlow-Web', 'data/access.json', { version: 2, entries: [] });
set('GuideFlow', 'content/ar/courses.json', { courses: [] });
set('GuideFlow', 'content/fr/courses.json', { courses: [] });
set('GuideFlow', 'config/access-links.json', { version: 1, entries: [] });
const base64 = bytes => Buffer.from(bytes).toString('base64url');
const courseKey = newIdentity().shareKey;
set('GuideFlow', 'config/course-key.json', { key: courseKey });
const payload = { version: 2, languages: Object.fromEntries(['ar', 'fr'].map(lang => [lang, { courseTitle: lang === 'ar' ? 'كورس الاختبار' : 'Formation de test', courseSubtitle: 'Test', modules: [] }])) };
async function encrypt(value, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  return { nonce: base64(iv), ciphertext: base64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))) };
}
const courseBundle = await encrypt(JSON.stringify(payload), Buffer.from(courseKey, 'base64url'));
let failPublication = false;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/data/current.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ mode: 'versioned', version: 'fixture', bundle: 'data/course-live.json' })); }
  if (url.pathname === '/data/course-live.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(courseBundle)); }
  const saved = files.get(`GuideFlow-Web${url.pathname}`);
  if (saved) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(saved.json)); }
  const file = resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try { const content = await readFile(file); res.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(file)] || 'application/octet-stream'); res.end(content); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route('https://api.github.com/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const match = url.pathname.match(/^\/repos\/fodiltrader-blip\/(GuideFlow(?:-Web)?)\/contents\/(.+)$/);
    if (!match) return route.fulfill({ status: 404, json: { message: 'Fixture endpoint unavailable' } });
    const [, repo, path] = match, old = files.get(`${repo}/${path}`);
    if (request.method() === 'GET') return route.fulfill(old ? { json: { sha: old.sha, content: Buffer.from(JSON.stringify(old.json)).toString('base64') } } : { status: 404, json: { message: 'Not found' } });
    if (request.method() === 'PUT') {
      if (failPublication && path.startsWith('data/agreements/')) return route.fulfill({ status: 503, json: { message: 'Fixture publication unavailable' } });
      const body = request.postDataJSON();
      if ((old?.sha || null) !== (body.sha || null)) return route.fulfill({ status: 409, json: { message: 'sha does not match' } });
      const json = JSON.parse(Buffer.from(body.content, 'base64').toString());
      set(repo, path, json); writes.push(`${repo}/${path}`);
      return route.fulfill({ json: { content: { sha: files.get(`${repo}/${path}`).sha }, commit: { sha: crypto.randomUUID() } } });
    }
    return route.fulfill({ status: 405, json: { message: 'Not allowed' } });
  });
  const page = await context.newPage();
  await page.goto(`${base}/admin.html`);
  // Random noncredential input is consumed only by the local GitHub mock.
  await page.locator('#tokenInput').fill(crypto.randomUUID()); await page.locator('#connectBtn').click();
  await page.locator('#agreements [data-new]').waitFor();
  await page.locator('#agreements [data-load]').click();
  await page.locator('#agreements .empty').waitFor();
  await page.locator('#agreements [data-new]').click();
  const texts = { title: 'اتفاق الدورة العملية', description: 'تعلّم خطوة بخطوة مع مواد تدريبية منظمة.', includes: 'دروس عملية\nتمارين تطبيقية\nجلسة مراجعة', resources: 'دليل عمل PDF\nملفات التمارين\nمصادر تعليمية', refund: 'يمكن طلب الاسترجاع خلال سبعة أيام حسب الشروط المتفق عليها.', paymentMethod: 'تحويل بنكي', paymentInstructions: 'تواصل مع البائع للحصول على تعليمات التحويل.' };
  const french = { title: 'Formation pratique — accord d’achat', description: 'Une formation progressive avec des ressources structurées.', includes: 'Leçons pratiques\nExercices\nSéance de révision', resources: 'Guide PDF\nFichiers d’exercices\nSources pédagogiques', refund: 'Remboursement possible sous sept jours selon les conditions convenues.', paymentMethod: 'Virement bancaire', paymentInstructions: 'Contactez le vendeur pour obtenir les instructions de virement.' };
  for (const [lang, fields] of [['ar', texts], ['fr', french]]) for (const [key, value] of Object.entries(fields)) await page.locator(`[name="${lang}.${key}"]`).fill(value);
  const wallet = '0x' + 'abc123'.repeat(6) + 'abcd';
  await page.locator('[name="ar.description"]').fill('البائع: Seller\nالمشتري: Buyer\n' + texts.description);
  await page.locator('[name="fr.description"]').fill('Vendeur : Seller\nAcheteur : Buyer\n' + french.description);
  await page.locator('[name="ar.paymentInstructions"]').fill(`عنوان الاستلام:\n${wallet}\n${texts.paymentInstructions}`);
  await page.locator('[name="fr.paymentInstructions"]').fill(`Adresse de réception :\n${wallet}\n${french.paymentInstructions}`);
  await page.locator('[name="currency"]').selectOption('EUR');
  await page.locator('[name="total"]').fill('1500');
  await page.locator('[name="count"]').fill('3'); await page.locator('[name="count"]').blur();
  for (const [i, amount] of ['450', '500', '525'].entries()) { await page.locator('[name="amount"]').nth(i).fill(amount); await page.locator('[name="dueDate"]').nth(i).fill(`2027-0${i + 1}-01`); }
  await page.locator('[name="paymentUrl"]').fill('https://example.com/payment');
  await page.locator('#agreementForm [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#agreementStatus').textContent.includes('مجموع الدفعات'));
  assert.equal(writes.length, 0);
  await page.locator('[name="amount"]').nth(1).fill('525');
  failPublication = true;
  await page.locator('#agreementForm [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#agreementStatus').textContent.includes('النشر لم يكتمل'));
  assert.equal(files.get('GuideFlow/config/purchase-agreements.json').json.entries.length, 1);
  failPublication = false;
  await page.locator('[data-publish]').click();
  await page.waitForFunction(() => document.querySelector('#agreementStatus').textContent.includes('أُرسل للنشر'));
  await page.locator('[data-copy]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(link.includes('agreement.html?id='));
  const accessBefore = structuredClone(files.get('GuideFlow-Web/data/access.json'));
  await page.locator('#agreements').scrollIntoViewIfNeeded();
  await mkdir(resolve(root, '../artifacts'), { recursive: true });
  await page.screenshot({ path: resolve(root, '../artifacts/admin-agreements.png'), fullPage: true });
  // Other admin renders must preserve unsaved agreement edits.
  await page.locator('[name="ar.title"]').fill('اتفاق شراء كورس GuideFlow — نسخة تجريبية');
  await page.locator('#linksSearch').fill('example');
  assert.equal(await page.locator('[name="ar.title"]').inputValue(), 'اتفاق شراء كورس GuideFlow — نسخة تجريبية');
  await page.locator('#agreementLanguage').selectOption('fr');
  assert.equal(await page.locator('#agreements').getAttribute('dir'), 'ltr');
  await page.locator('#agreementForm [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#agreementStatus').textContent.includes('envoyé à la publication'));
  assert.equal(await page.locator('.agreement-card a').getAttribute('href'), link);
  assert.deepEqual(files.get('GuideFlow-Web/data/access.json'), accessBefore);
  const viewer = await context.newPage(); await viewer.goto(link);
  await viewer.locator('.agreement-hero h1').waitFor();
  assert.equal(await viewer.locator('.agreement-hero h1').textContent(), 'اتفاق شراء كورس GuideFlow — نسخة تجريبية');
  assert.equal(await viewer.locator('.agreement-milestone').count(), 3);
  await viewer.locator('#viewAgreementPayment').click();
  assert.equal(viewer.url(), link);
  await viewer.locator('[data-copy-address]').click();
  assert.equal(await viewer.evaluate(() => navigator.clipboard.readText()), wallet);
  await viewer.evaluate(() => window.scrollTo(0, 0));
  await viewer.screenshot({ path: resolve(root, '../artifacts/agreement-ar.png'), fullPage: true });
  await viewer.locator('[data-language="fr"]').click();
  assert.equal(await viewer.locator('html').getAttribute('dir'), 'ltr');
  await viewer.screenshot({ path: resolve(root, '../artifacts/agreement-fr.png'), fullPage: true });
  await viewer.setViewportSize({ width: 390, height: 844 });
  assert.ok(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await viewer.screenshot({ path: resolve(root, '../artifacts/agreement-mobile.png'), fullPage: true });
  for (const lang of ['ar', 'fr']) {
    await viewer.locator(`[data-language="${lang}"]`).click();
    for (const width of [320, 390, 768, 1440]) {
      await viewer.setViewportSize({ width, height: 900 });
      assert.ok(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} overflow at ${width}`);
    }
  }
  await viewer.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.ok(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at enlarged text');
  await viewer.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await viewer.emulateMedia({ media: 'print' });
  assert.equal(await viewer.locator('#printAgreement').isVisible(), false);
  assert.equal(await viewer.locator('#agreementAddress0').inputValue(), wallet);
  await viewer.pdf({ path: resolve(root, '../artifacts/agreement-print.pdf'), format: 'A4', printBackground: true });
  await viewer.emulateMedia({ media: 'screen' });
  await viewer.locator('[data-language="ar"]').click();
  await viewer.setViewportSize({ width: 390, height: 844 });
  await viewer.screenshot({ path: resolve(root, '../artifacts/agreement-mobile-ar.png'), fullPage: true });
  await viewer.goto(link.split('#')[0]); await viewer.locator('.agreement-error').waitFor();
  await viewer.goto(link.replace(/#key=.*/, `#key=${newIdentity().shareKey}`)); await viewer.locator('.agreement-error').waitFor();
  await viewer.goto(`${base}/agreement.html?id=invalid`); await viewer.locator('.agreement-error').waitFor();
  // Public agreement opens without a fragment and survives reconnect/reload.
  await page.locator('#agreements [data-new]').click();
  await page.locator('[name="visibility"]').selectOption('public');
  for (const [key, value] of Object.entries(french)) await page.locator(`[name="fr.${key}"]`).fill(value);
  await page.locator('[name="total"]').fill('20'); await page.locator('[name="amount"]').fill('20'); await page.locator('[name="dueDate"]').fill('2027-03-01');
  await page.locator('#agreementForm [type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.agreement-card').length === 2 && document.querySelector('#agreementStatus').textContent.includes('envoyé à la publication'));
  const publicLink = await page.locator('.agreement-card a').last().getAttribute('href'); assert.ok(!publicLink.includes('#'));
  await viewer.goto(publicLink); await viewer.locator('.agreement-hero h1').waitFor();
  await page.locator('#disconnectBtn').click(); await page.locator('#tokenInput').waitFor(); assert.equal(await page.locator('#agreements').count(), 0);
  await page.locator('#tokenInput').fill(crypto.randomUUID()); await page.locator('#connectBtn').click(); await page.locator('#agreements [data-load]').click();
  await page.waitForFunction(() => document.querySelectorAll('.agreement-card').length === 2);
  // Existing LIVE creation, modal, saved link, copy, disable/re-enable and reader still work.
  await page.locator('#linksSearch').fill('');
  await page.locator('#labelInput').fill('متدرّب اختبار'); await page.locator('#createBtn').click();
  await page.locator('.gf-modal-link input').waitFor();
  const accessLink = await page.locator('.gf-modal-link input').inputValue();
  await page.locator('.gf-modal-done').click();
  await page.locator('#links .gf-show-link').waitFor();
  await viewer.goto(accessLink); await viewer.locator('.gate-shell').waitFor({ state: 'hidden' });
  await viewer.locator('.hero').waitFor();
  await page.locator('#links [data-toggle]').click();
  await page.waitForFunction(() => document.querySelector('#links .state.off'));
  await viewer.reload(); await viewer.locator('.gate-shell').waitFor();
  await page.locator('#links [data-toggle]').click();
  await page.waitForFunction(() => document.querySelector('#links .state.on'));
  await viewer.reload(); await viewer.locator('.hero').waitFor();
  const entry = files.get('GuideFlow-Web/data/access.json').json.entries[0]; entry.expiresAt = '2000-01-01T00:00:00Z';
  await viewer.reload(); await viewer.locator('.gate-shell').waitFor();
  entry.expiresAt = null;
  // Legacy Snapshot and invalid entry points are unchanged.
  const legacySecret = newIdentity().shareKey;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(legacySecret));
  const legacyBundle = await encrypt(JSON.stringify(payload), digest);
  files.get('GuideFlow-Web/data/access.json').json.entries.push({ id: 'trainee-legacy-fixture', tokenHash: Buffer.from(digest).toString('hex'), active: true, bundle: 'legacy-fixture.json', language: 'fr' });
  set('GuideFlow-Web', 'data/legacy-fixture.json', legacyBundle);
  await viewer.goto(`${base}/#/access/${legacySecret}`); await viewer.reload(); await viewer.locator('.hero').waitFor();
  await viewer.goto(`${base}/#/access/invalid`); await viewer.reload(); await viewer.locator('.gate-shell').waitFor();
  await viewer.goto(`${base}/`); await viewer.locator('.gate-shell').waitFor();
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  console.log('PASS: bilingual create/edit/copy/open, validation, publication recovery, reconnect, private/public links, mobile layout, LIVE creation/modal/disable/enable/expiry, Snapshot and invalid access.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
