// Local browser regression test: synthetic encrypted courses and images only.
// Run with PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE if not on the default paths.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, '../artifacts/student');
const b64 = value => Buffer.from(value).toString('base64url');
const token = 'student-local-fixture';
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
const tokenHash = Buffer.from(digest).toString('hex');
const courseKey = crypto.getRandomValues(new Uint8Array(32));
async function encrypt(value, bytes) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  return { nonce: b64(nonce), ciphertext: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(value))) };
}
const payload = { languages: Object.fromEntries(['ar', 'fr'].map(lang => [lang, {
  courseTitle: lang === 'ar' ? 'أكاديمية GuideFlow' : 'GuideFlow Academy',
  courseSubtitle: lang === 'ar' ? 'مسارك من الفهم إلى التطبيق' : 'Comprendre, préparer, pratiquer',
  modules: [
    { number: '00', title: lang === 'ar' ? 'قريبًا' : 'À venir', lessons: [] },
    { number: '01', title: lang === 'ar' ? 'تجهيز بيئة العمل' : 'Préparer son environnement', lessons: [
      { id: 'adspower-interface', title: lang === 'ar' ? 'فهم AdsPower وتجهيز البروفايل' : 'Comprendre AdsPower et préparer un profil', tool: 'AdsPower' },
      { id: 'proxy-iproyal', title: lang === 'ar' ? 'البروكسي و IPRoyal' : 'Le proxy et IPRoyal', tool: 'IPRoyal' }
    ] },
    { number: '02', title: lang === 'ar' ? 'المراجعة والتطبيق' : 'Révision et pratique', lessons: [
      { id: 'review', lessonNumber: '03', title: lang === 'ar' ? 'مراجعة ما تعلمته' : 'Réviser les acquis', tool: 'GuideFlow', summary: 'Synthetic course fixture', objective: 'Review your learning', zones: [], expected: ['Ready to practice'], checklist: [], stopWhen: [] }
    ] }
  ]
}])) };
const live = await encrypt(JSON.stringify(payload), courseKey);
const legacy = await encrypt(JSON.stringify(payload), digest);
const wrappedKey = await encrypt(b64(courseKey), digest);
let mode = 'live';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', 'application/json');
  if (path === '/data/access.json') return res.end(JSON.stringify({ entries: [{ tokenHash, active: mode !== 'disabled', mode, wrappedKey: mode === 'live' ? wrappedKey : undefined, bundle: 'snapshot.json' }] }));
  if (path === '/data/current.json') return res.end(JSON.stringify({ mode: 'versioned', version: 'fixture', bundle: 'releases/fixture/course.json' }));
  if (path === '/releases/fixture/course.json') return res.end(JSON.stringify(live));
  if (path === '/data/snapshot.json') return res.end(JSON.stringify(legacy));
  const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    const content = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#15243a"/><rect x="40" y="40" width="280" height="820" rx="20" fill="#243f62"/><rect x="360" y="40" width="1200" height="90" rx="16" fill="#355a83"/><rect x="360" y="180" width="1200" height="680" rx="16" fill="#edf2f8"/><text x="420" y="290" fill="#243f62" font-family="sans-serif" font-size="48">GuideFlow — demonstration image</text></svg>' });
    return route.abort();
  });
  await page.goto(base);
  await page.locator('.gate-card').waitFor();
  await page.screenshot({ animations: 'disabled', path: resolve(artifacts, 'gate.png') });
  await page.goto(`${base}/#/access/${token}`);
  await page.reload(); // Access URLs are opened as a document, not an in-page route.
  await page.locator('.hero').waitFor();
  await page.screenshot({ animations: 'disabled', path: resolve(artifacts, 'home-ar.png'), fullPage: true });
  await page.locator('.primary-btn').click();
  await page.locator('[data-guideflow-v2="adspower-interface:ar"]').waitFor();
  assert.equal(await page.locator('.student-lesson-nav [data-lesson]').count(), 1);
  assert.equal(await page.locator('.student-lesson-nav [data-lesson]').getAttribute('data-lesson'), 'proxy-iproyal');
  await page.locator('.student-image-button').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('dialog[open]').waitFor();
  assert.equal(await page.locator('[data-close]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-size]').click();
  assert.equal(await page.locator('[data-size]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.student-image-button').first().evaluate(el => el === document.activeElement), true);
  assert.equal(new URL(page.url()).hash, `#/access/${token}`);
  await page.screenshot({ animations: 'disabled', path: resolve(artifacts, 'lesson-ar.png') });
  await page.locator('.student-lesson-nav [data-lesson="proxy-iproyal"]').click();
  await page.locator('[data-guideflow-v2="proxy-iproyal:ar"]').waitFor();
  assert.equal(await page.locator('.student-lesson-nav [data-lesson]').count(), 2);
  await page.locator('.student-lesson-nav [data-lesson="review"]').click();
  await page.locator('.lesson-intro').waitFor();
  assert.equal(await page.locator('.student-lesson-nav [data-lesson]').count(), 1);
  await page.locator('.student-lesson-nav [data-lesson="proxy-iproyal"]').click();
  await page.locator('[data-guideflow-v2="proxy-iproyal:ar"]').waitFor();
  for (const language of ['ar', 'fr']) {
    if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#langBtn').click();
    await page.locator(`[data-guideflow-v2="proxy-iproyal:${language}"]`).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: lesson overflow at ${width}`);
    }
    await page.locator('#themeBtn').click();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'dark');
    await page.screenshot({ animations: 'disabled', path: resolve(artifacts, `lesson-${language}-dark.png`) });
    await page.locator('#themeBtn').click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Enlarged text overflow');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ animations: 'disabled', path: resolve(artifacts, `lesson-${language}-mobile.png`) });
    await page.locator('#lessonHomeBtn').click();
    await page.locator('.hero').waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: home overflow at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    await page.locator('#outlineBtn').click();
    assert.equal(await page.locator('.sidebar').isVisible(), true);
    await page.locator('.lesson-link[data-lesson="proxy-iproyal"]').click();
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    await page.locator(`[data-guideflow-v2="proxy-iproyal:${language}"]`).waitFor();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
  await page.locator('#refreshCourseBtn').click();
  await page.locator('.refresh-state').waitFor({ state: 'attached' });
  await page.locator('[data-guideflow-v2="proxy-iproyal:fr"]').waitFor();
  mode = 'snapshot';
  await page.reload();
  await page.locator('.hero').waitFor();
  await page.locator('.primary-btn').click();
  await page.locator('[data-guideflow-v2="adspower-interface:ar"]').waitFor();
  mode = 'disabled';
  await page.reload();
  await page.locator('.gate-card .danger-note').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: encrypted LIVE/Snapshot, gate, both lesson renderers, cross-module previous/next, images/keyboard/focus/hash, Arabic/French, light/dark, 320–1440px, 200% text, mobile outline, refresh and reduced motion.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
