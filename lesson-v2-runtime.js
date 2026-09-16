(() => {
  const app = document.getElementById('app');
  if (!app) return;

  const copy = {
    ar: {
      badge: 'الدرس 02',
      title: 'البروكسي و IPRoyal',
      lead: 'في هذا الدرس سنفهم أولًا ما هو البروكسي ولماذا نستخدمه، ثم ننتقل بهدوء إلى IPRoyal ونطبّق طريقة سحب البروكسي خطوة بخطوة.',
      objectiveTitle: 'هدف الدرس',
      objective: 'أن تنهي الصفحة وأنت تفهم الفكرة، وليس فقط تحفظ أماكن الأزرار: ما هو البروكسي، لماذا نحتاجه في بيئة الحساب، وما هي الإعدادات التي نستخدمها داخل IPRoyal.',
      s1: 'ما هو البروكسي؟',
      s1p: 'البروكسي هو وسيط اتصال بين المتصفح والإنترنت. في سير العمل الخاص بنا نستخدمه كجزء من تجهيز بيئة مناسبة للحساب داخل AdsPower، بحيث يكون اتصال الـProfile مرتبطًا بالموقع الجغرافي المطلوب للحساب.',
      exampleTitle: 'مثال بسيط',
      example: 'إذا كانت بيئة الحساب المطلوبة مصرية، نستخدم بروكسي مصري. الهدف هو أن تكون بيئة الاتصال متوافقة مع البلد المطلوب في سير العمل.',
      s2: 'لماذا نستخدم البروكسي؟',
      s2p: 'نستخدمه حتى يكون لكل Profile بيئة اتصال واضحة ومناسبة. موقع البروكسي يصبح أحد عناصر بيئة الحساب التي سنستخدمها لاحقًا داخل AdsPower، لذلك لا نختار الدولة عشوائيًا.',
      s3: 'ما هو IPRoyal؟',
      s3p: 'IPRoyal هو مزود البروكسي الذي نحصل منه على بيانات Residential Proxy. هنا نضبط الدولة وطريقة ثبات الـIP، ثم ننسخ بيانات الاتصال ونستخدمها لاحقًا عند إعداد الـProfile داخل AdsPower.',
      practical: 'الجزء العملي — سحب البروكسي من IPRoyal',
      practicalLead: 'لا تحاول استيعاب كل الإعدادات دفعة واحدة. نفّذ كل خطوة، تأكد منها، ثم انتقل إلى التالية.',
      step1: 'الخطوة 1 — الدخول إلى Residential Proxies',
      step1p: 'بعد الدخول إلى IPRoyal، من القائمة الجانبية افتح Proxies ثم اختر Residential. هذه هي الصفحة التي سنعمل منها.',
      cap1: 'واجهة IPRoyal الأصلية. تم إخفاء بيانات الحساب الحساسة فقط.',
      step2: 'الخطوة 2 — ضبط إعدادات البروكسي',
      step2p: 'فعّل High-end Pool. اختر الدولة المطلوبة للحساب — في هذا المثال Egypt — واترك City/State على Random. بعد ذلك اختر Rotation = Sticky IP واضبط TTL على 7 Day.',
      settings: ['High-end Pool: مفعّل', 'Country/Region: Egypt', 'City/State: Random', 'Rotation: Sticky IP', 'TTL: 7 Day'],
      cap2: 'الإعدادات المعتمدة في المثال. اسم المستخدم وكلمة المرور مشوشان للحماية.',
      step3: 'الخطوة 3 — نسخ البروكسي',
      step3p: 'انزل إلى Formatted Proxy List. تأكد أن الصيغة هي HOST:PORT:USER:PASS، ثم انسخ سطر البروكسي المطلوب أو استخدم Copy list عند الحاجة إلى القائمة.',
      cap3: 'قائمة البروكسيات الأصلية بعد تشتيت بيانات المصادقة الحساسة.',
      resultTitle: 'في نهاية الدرس',
      result: ['تفهم ما هو البروكسي ودوره في بيئة الحساب.', 'تعرف لماذا نختار بلد البروكسي وفق البيئة المطلوبة للحساب.', 'تعرف دور IPRoyal ومكان Residential Proxies.', 'تستطيع ضبط الإعدادات المعتمدة ونسخ البروكسي بالصّيغة الصحيحة.'],
      noteTitle: 'ملاحظة مهمة',
      note: 'لا تشارك Username أو Password أو قائمة البروكسيات خارج بيئة العمل. الصور هنا مأخوذة من الواجهة الأصلية، وتم تشتيت البيانات الحساسة فقط.',
      back: 'العودة للرئيسية'
    },
    fr: {
      badge: 'Leçon 02',
      title: 'Le proxy et IPRoyal',
      lead: 'Dans cette leçon, nous allons d’abord comprendre ce qu’est un proxy et pourquoi nous l’utilisons, puis passer calmement à IPRoyal pour récupérer un proxy étape par étape.',
      objectiveTitle: 'Objectif de la leçon',
      objective: 'Terminer cette page en comprenant le principe, pas seulement l’emplacement des boutons : le rôle du proxy, son utilisation dans l’environnement du compte et les réglages utilisés dans IPRoyal.',
      s1: 'Qu’est-ce qu’un proxy ?',
      s1p: 'Un proxy est un intermédiaire de connexion entre le navigateur et Internet. Dans notre processus, il fait partie de la préparation d’un environnement adapté au compte dans AdsPower, afin que la connexion du Profile soit associée à la localisation requise.',
      exampleTitle: 'Exemple simple',
      example: 'Si l’environnement demandé pour le compte est égyptien, nous utilisons un proxy égyptien. L’objectif est de garder un environnement de connexion cohérent avec le pays demandé dans le processus de travail.',
      s2: 'Pourquoi utilisons-nous un proxy ?',
      s2p: 'Il permet de donner à chaque Profile un environnement de connexion clair et adapté. La localisation du proxy devient un élément de l’environnement du compte utilisé ensuite dans AdsPower ; le pays ne doit donc pas être choisi au hasard.',
      s3: 'Qu’est-ce qu’IPRoyal ?',
      s3p: 'IPRoyal est le fournisseur depuis lequel nous récupérons les données d’un proxy Residential. Nous y choisissons le pays et le mode de rotation, puis nous copions les données de connexion pour les utiliser ensuite dans AdsPower.',
      practical: 'Partie pratique — récupérer le proxy depuis IPRoyal',
      practicalLead: 'N’essayez pas de mémoriser tous les réglages d’un seul coup. Effectuez une étape, vérifiez-la, puis passez à la suivante.',
      step1: 'Étape 1 — accéder à Residential Proxies',
      step1p: 'Après vous être connecté à IPRoyal, ouvrez Proxies dans le menu latéral puis sélectionnez Residential. C’est la page utilisée pour cette procédure.',
      cap1: 'Interface IPRoyal originale. Seules les données sensibles du compte ont été masquées.',
      step2: 'Étape 2 — configurer le proxy',
      step2p: 'Activez High-end Pool. Choisissez le pays requis pour le compte — Egypt dans cet exemple — et laissez City/State sur Random. Choisissez ensuite Rotation = Sticky IP et TTL = 7 Day.',
      settings: ['High-end Pool : activé', 'Country/Region : Egypt', 'City/State : Random', 'Rotation : Sticky IP', 'TTL : 7 Day'],
      cap2: 'Réglages utilisés dans cet exemple. Le nom d’utilisateur et le mot de passe sont brouillés.',
      step3: 'Étape 3 — copier le proxy',
      step3p: 'Descendez jusqu’à Formatted Proxy List. Vérifiez le format HOST:PORT:USER:PASS, puis copiez la ligne nécessaire ou utilisez Copy list lorsque vous avez besoin de la liste.',
      cap3: 'Liste originale des proxys avec les données d’authentification sensibles brouillées.',
      resultTitle: 'À la fin de la leçon',
      result: ['Vous comprenez ce qu’est un proxy et son rôle dans l’environnement du compte.', 'Vous savez pourquoi le pays du proxy est choisi selon l’environnement demandé.', 'Vous connaissez le rôle d’IPRoyal et l’emplacement de Residential Proxies.', 'Vous savez appliquer les réglages utilisés et copier le proxy au bon format.'],
      noteTitle: 'Remarque importante',
      note: 'Ne partagez jamais Username, Password ou la liste des proxys en dehors de l’environnement de travail. Les captures sont issues de l’interface originale ; seules les données sensibles ont été brouillées.',
      back: 'Retour à l’accueil'
    }
  };

  function activeLessonId() {
    return document.querySelector('.lesson-link.active')?.dataset?.lesson || '';
  }

  async function assetBase() {
    if (window.GuideFlowRelease?.current?.assetBase) {
      return `./${String(window.GuideFlowRelease.current.assetBase).replace(/^\.\//, '').replace(/\/?$/, '/')}`;
    }
    try {
      const response = await fetch(`./data/current.json?v=${Date.now()}`, { cache: 'no-store' });
      const current = response.ok ? await response.json() : null;
      if (current?.assetBase) return `./${String(current.assetBase).replace(/^\.\//, '').replace(/\/?$/, '/')}`;
    } catch {}
    return './media/';
  }

  function section(title, body) {
    return `<section class="gf-reading-section"><h2>${title}</h2><p>${body}</p></section>`;
  }

  async function renderProxyLesson() {
    if (activeLessonId() !== 'proxy-iproyal') return;
    const wrap = document.querySelector('.page-wrap');
    if (!wrap || wrap.dataset.guideflowV2 === 'proxy-iproyal') return;

    const lang = document.documentElement.lang === 'fr' ? 'fr' : 'ar';
    const t = copy[lang];
    const base = await assetBase();
    if (activeLessonId() !== 'proxy-iproyal') return;

    wrap.dataset.guideflowV2 = 'proxy-iproyal';
    wrap.innerHTML = `
      <article class="gf-course-page">
        <button class="gf-back" id="gfBackBtn">← ${t.back}</button>

        <header class="gf-course-hero">
          <span class="gf-lesson-badge">${t.badge}</span>
          <h1>${t.title}</h1>
          <p>${t.lead}</p>
        </header>

        <section class="gf-objective">
          <span>◎</span>
          <div><h2>${t.objectiveTitle}</h2><p>${t.objective}</p></div>
        </section>

        ${section(t.s1, t.s1p)}
        <aside class="gf-example"><strong>${t.exampleTitle}</strong><p>${t.example}</p></aside>

        ${section(t.s2, t.s2p)}
        ${section(t.s3, t.s3p)}

        <section class="gf-practical-intro">
          <span>03</span>
          <div><h2>${t.practical}</h2><p>${t.practicalLead}</p></div>
        </section>

        <section class="gf-step">
          <div class="gf-step-copy"><span>1</span><div><h2>${t.step1}</h2><p>${t.step1p}</p></div></div>
          <figure class="gf-full-shot"><img src="${base}iproyal-overview-redacted.webp" alt="IPRoyal Residential Proxies" loading="eager"><figcaption>${t.cap1}</figcaption></figure>
        </section>

        <section class="gf-step">
          <div class="gf-step-copy"><span>2</span><div><h2>${t.step2}</h2><p>${t.step2p}</p></div></div>
          <div class="gf-settings-list">${t.settings.map(item => `<div>✓ ${item}</div>`).join('')}</div>
          <figure class="gf-full-shot"><img src="${base}iproyal-settings-redacted.webp" alt="IPRoyal proxy settings" loading="lazy"><figcaption>${t.cap2}</figcaption></figure>
        </section>

        <section class="gf-step">
          <div class="gf-step-copy"><span>3</span><div><h2>${t.step3}</h2><p>${t.step3p}</p></div></div>
          <figure class="gf-full-shot"><img src="${base}iproyal-list-redacted.webp" alt="IPRoyal formatted proxy list" loading="lazy"><figcaption>${t.cap3}</figcaption></figure>
        </section>

        <section class="gf-result">
          <h2>${t.resultTitle}</h2>
          <div>${t.result.map(item => `<p><span>✓</span>${item}</p>`).join('')}</div>
        </section>

        <section class="gf-final-note"><h2>${t.noteTitle}</h2><p>${t.note}</p></section>
      </article>`;

    document.getElementById('gfBackBtn')?.addEventListener('click', () => document.getElementById('homeBtn')?.click());
  }

  const observer = new MutationObserver(() => requestAnimationFrame(renderProxyLesson));
  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(renderProxyLesson));
  requestAnimationFrame(renderProxyLesson);
})();
