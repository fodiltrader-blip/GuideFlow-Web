(() => {
  const previousFetch = window.fetch.bind(window);
  const OWNER = 'fodiltrader-blip';
  const SOURCE = 'GuideFlow';
  const WEB = 'GuideFlow-Web';
  const BRANCH = 'main';
  const COURSE_LIVE_RE = /\/repos\/fodiltrader-blip\/GuideFlow-Web\/contents\/data\/course-live\.json(?:\?|$)/;
  const CURRENT_PATH = 'data/current.json';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function requestUrl(input) { return typeof input === 'string' ? input : input?.url || ''; }
  function requestMethod(input, init = {}) { return String(init.method || input?.method || 'GET').toUpperCase(); }
  function cleanBase64(value = '') { return String(value).replace(/\n/g, ''); }
  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text); let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  function base64ToUtf8(value) {
    const binary = atob(cleanBase64(value));
    return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
  }
  function normalizeAsset(value = '') { return String(value).replace(/^\.\//, '').replace(/^content\/media\//, '').replace(/^media\//, ''); }
  function isExternalAsset(value = '') { return /^(?:https?:)?\/\//i.test(String(value)); }
  function primaryLessonVisual(lesson = {}) {
    if (lesson.image) return lesson.image;
    const images = Array.isArray(lesson.images) ? lesson.images : [];
    return images.find(image => image?.src)?.src || '';
  }
  function releaseId() {
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 6);
    return `v${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${rnd}`;
  }

  async function gh(path, init, authHeaders) {
    const headers = new Headers(authHeaders || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (init?.body) headers.set('Content-Type', 'application/json');
    const response = await previousFetch(`https://api.github.com${path}`, { ...init, headers });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const error = new Error(data?.message || `GitHub API: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function ghJson(path, authHeaders) { return gh(path, { method: 'GET', cache: 'no-store' }, authHeaders); }

  async function sourceVisualMap(authHeaders) {
    const map = {};
    for (const lang of ['ar', 'fr']) {
      const coursesRaw = await ghJson(`/repos/${OWNER}/${SOURCE}/contents/content/${lang}/courses.json?ref=${BRANCH}`, authHeaders);
      const courses = JSON.parse(base64ToUtf8(coursesRaw.content || ''));
      for (const course of courses.courses || []) {
        for (const ref of course.lessons || []) {
          const lessonRaw = await ghJson(`/repos/${OWNER}/${SOURCE}/contents/content/${lang}/lessons/${encodeURIComponent(ref.id)}.json?ref=${BRANCH}`, authHeaders);
          const lesson = JSON.parse(base64ToUtf8(lessonRaw.content || ''));
          const visual = primaryLessonVisual(lesson);
          if (!visual) continue;
          if (!map[lesson.id]) map[lesson.id] = {};
          map[lesson.id][lang] = normalizeAsset(visual);
        }
      }
    }
    return map;
  }

  async function sourceMedia(authHeaders) {
    const listing = await ghJson(`/repos/${OWNER}/${SOURCE}/contents/content/media?ref=${BRANCH}`, authHeaders);
    const files = [];
    for (const item of Array.isArray(listing) ? listing : []) {
      if (item.type !== 'file') continue;
      const raw = await ghJson(`/repos/${OWNER}/${SOURCE}/contents/${item.path.split('/').map(encodeURIComponent).join('/')}?ref=${BRANCH}`, authHeaders);
      if (!raw.content) continue;
      files.push({ name: item.name, content: cleanBase64(raw.content) });
    }
    return files;
  }

  async function blob(content, encoding, authHeaders) {
    return gh(`/repos/${OWNER}/${WEB}/git/blobs`, {
      method: 'POST', body: JSON.stringify({ content, encoding })
    }, authHeaders);
  }

  async function atomicCommit(files, message, authHeaders) {
    const treeEntries = await Promise.all(files.map(async file => {
      const created = await blob(file.content, file.encoding || 'utf-8', authHeaders);
      return { path: file.path, mode: '100644', type: 'blob', sha: created.sha };
    }));

    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const ref = await ghJson(`/repos/${OWNER}/${WEB}/git/ref/heads/${BRANCH}`, authHeaders);
        const parent = await ghJson(`/repos/${OWNER}/${WEB}/git/commits/${ref.object.sha}`, authHeaders);
        const tree = await gh(`/repos/${OWNER}/${WEB}/git/trees`, {
          method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeEntries })
        }, authHeaders);
        const commit = await gh(`/repos/${OWNER}/${WEB}/git/commits`, {
          method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] })
        }, authHeaders);
        await gh(`/repos/${OWNER}/${WEB}/git/refs/heads/${BRANCH}`, {
          method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false })
        }, authHeaders);
        return commit;
      } catch (error) {
        lastError = error;
        if (![409, 422].includes(error.status) || attempt === 3) throw error;
        await sleep(350 * (attempt + 1));
      }
    }
    throw lastError;
  }

  async function publicCurrent() {
    try {
      const response = await previousFetch(`./data/current.json?v=${Date.now()}`, { cache: 'no-store' });
      return response.ok ? response.json() : null;
    } catch { return null; }
  }

  async function waitForVersion(version, timeout = 90000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const current = await publicCurrent();
      if (current?.version === version) return current;
      await sleep(1600);
    }
    throw new Error('تم إنشاء الإصدار في GitHub، لكن GitHub Pages لم ينشره بعد. أعد المحاولة بعد قليل.');
  }

  async function publishRelease(body, authHeaders) {
    const encryptedText = base64ToUtf8(body.content || '');
    const encrypted = JSON.parse(encryptedText);
    const version = releaseId();
    const publishedAt = new Date().toISOString();
    const root = `releases/${version}`;
    const [media, visualMap] = await Promise.all([sourceMedia(authHeaders), sourceVisualMap(authHeaders)]);
    const assets = [...new Set(Object.values(visualMap).flatMap(entry => Object.values(entry)))]
      .filter(asset => asset && !isExternalAsset(asset));
    const manifest = {
      schemaVersion: 1, version, generatedAt: encrypted.generatedAt || null, publishedAt,
      bundle: 'course.json', assetBase: 'assets/', assets, visualMap: 'assets/visual-map.json'
    };
    const current = {
      schemaVersion: 1, mode: 'versioned', version,
      bundle: `${root}/course.json`, assetBase: `${root}/assets/`,
      manifest: `${root}/manifest.json`, generatedAt: encrypted.generatedAt || null, publishedAt
    };
    const files = [
      { path: `${root}/course.json`, content: cleanBase64(body.content), encoding: 'base64' },
      { path: `${root}/manifest.json`, content: `${JSON.stringify(manifest, null, 2)}\n`, encoding: 'utf-8' },
      { path: `${root}/assets/visual-map.json`, content: `${JSON.stringify(visualMap, null, 2)}\n`, encoding: 'utf-8' },
      ...media.map(file => ({ path: `${root}/assets/${file.name}`, content: file.content, encoding: 'base64' })),
      { path: CURRENT_PATH, content: `${JSON.stringify(current, null, 2)}\n`, encoding: 'utf-8' }
    ];
    const commit = await atomicCommit(files, `Publish GuideFlow release ${version}`, authHeaders);
    await waitForVersion(version);
    return { version, commitSha: commit.sha, current };
  }

  function syntheticSuccess(result) {
    return new Response(JSON.stringify({
      content: { path: `releases/${result.version}/course.json`, sha: null },
      commit: { sha: result.commitSha || null },
      guideflowRelease: result.version
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  window.fetch = async function guideFlowAtomicPublisher(input, init = {}) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    if (method !== 'PUT' || !COURSE_LIVE_RE.test(url) || !init?.body) return previousFetch(input, init);

    let body;
    try { body = JSON.parse(init.body); }
    catch { return previousFetch(input, init); }

    const statusText = document.querySelector('#statusBox')?.textContent || '';
    const createAccessFlow = /2\/4|تحديث النسخة الحية/.test(statusText);
    if (createAccessFlow) {
      const current = await publicCurrent();
      if (current?.mode === 'versioned' && current?.version) {
        return syntheticSuccess({ version: current.version, commitSha: null });
      }
    }

    try {
      const result = await publishRelease(body, init.headers || {});
      decorateAdmin(result.current);
      return syntheticSuccess(result);
    } catch (error) {
      console.error('GuideFlow atomic publish failed:', error);
      return new Response(JSON.stringify({ message: error.message || 'GuideFlow atomic publish failed' }), {
        status: error.status || 500, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  };

  let decorateTimer = 0;
  async function decorateAdmin(knownCurrent = null) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(async () => {
      const current = knownCurrent || await publicCurrent();
      document.querySelectorAll('#publishTopBtn,#publishCourseBtn').forEach(button => { button.textContent = 'نشر إصدار جديد'; });
      const top = document.querySelector('.admin-top > div:first-child');
      if (!top) return;
      let badge = document.getElementById('guideflowReleaseStatus');
      if (!badge) {
        badge = document.createElement('small');
        badge.id = 'guideflowReleaseStatus';
        badge.style.cssText = 'display:block;margin-top:7px;color:#7f8da0;font-weight:700';
        top.appendChild(badge);
      }
      badge.textContent = current?.version ? `الإصدار المنشور: ${current.version}` : 'لم يُنشر إصدار ثابت بعد';
    }, 50);
  }

  const observer = new MutationObserver(() => decorateAdmin());
  const start = () => {
    const adminRoot = document.getElementById('adminApp');
    if (adminRoot) observer.observe(adminRoot, { childList: true, subtree: true });
    decorateAdmin();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();