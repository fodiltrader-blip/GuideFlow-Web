(() => {
  const app = document.getElementById('app');
  if (!app) return;

  const copy = {
    ar: {
      badge: 'الدرس 01',
      title: 'ما هو AdsPower؟ ولماذا نستخدمه؟',
      lead: 'AdsPower يسمح لنا بإنشاء Profile مستقل لكل حساب. كل Profile يحتفظ بجلسته وبياناته المحلية وإعدادات Browser Fingerprint الخاصة به، لذلك نتعامل معه عمليًا كأنه جهاز أو متصفح مستقل لذلك الحساب، مع العلم أنه ليس Virtual Machine كاملة.',
      objectiveTitle: 'هدف الدرس',
      objective: 'فهم فكرة الـProfile المستقل، ثم أخذ البروكسي الذي جهزناه في IPRoyal وإضافته إلى AdsPower وربطه ببروفايل واحد فقط.',
      s1: 'الفكرة الأساسية في AdsPower',
      s1p: 'كل Profile يملك بيئة متصفح منفصلة: Cookies وLocal Storage وإعدادات البصمة تبقى خاصة به. عند الرجوع إلى الحساب لاحقًا نفتح نفس الـProfile بدل إنشاء بيئة جديدة.',
      s2: 'الأقسام التي نحتاجها',
      s2p: 'New Profile لإنشاء بروفايل جديد، Proxies لإضافة البروكسيات المحفوظة وإدارتها، وTrash لمراجعة البروفايلات المحذوفة.',
      practical: 'الجزء العملي — إضافة البروكسي وربطه بالـProfile',
      practicalLead: 'نأخذ بروكسيًا واحدًا من IPRoyal، نحفظه في AdsPower، ثم نربطه ببروفايل واحد فقط.',
      steps: [
        ['نسخ البروكسي من IPRoyal', 'حدد سطر بروكسي واحدًا فقط ثم انسخه. بيانات المصادقة الحساسة في الصور التعليمية تبقى مخفية.', 'copyProxy', 'ننسخ بروكسيًا واحدًا من القائمة.'],
        ['فتح Proxies ثم Add Proxy', 'من القائمة اليسرى افتح Proxies ثم اضغط Add Proxy لإضافة البروكسي الذي نسخته.', 'openProxies', 'قسم إدارة البروكسيات داخل AdsPower.'],
        ['لصق البروكسي وحفظه', 'اختر نوع البروكسي المناسب — غالبًا HTTPS — ثم الصق السطر في المكان المخصص واضغط OK.', 'pasteProxy', 'يتم لصق البروكسي ثم حفظه في AdsPower.'],
        ['التأكد من نجاح الاستيراد', 'بعد الحفظ تأكد أن البروكسي ظهر داخل قائمة Proxies وأصبح جاهزًا للاستخدام.', 'importedProxy', 'ظهور البروكسي في القائمة يؤكد أنه تم استيراده.'],
        ['إنشاء Profile وفتح إعدادات Proxy', 'اضغط New Profile ثم افتح تبويب Proxy. إذا كان البروكسي محفوظًا مسبقًا استخدم Saved Proxies.', 'linkProfile', 'نربط البروكسي من داخل إعدادات الـProfile.'],
        ['اختيار بروكسي غير مستخدم', 'اختر Saved Proxies ثم بروكسيًا غير مستخدم. في هذا السير نعتمد Profile count = 0 قبل تخصيصه للبروفايل.', 'chooseSaved', 'اختر بروكسيًا غير مرتبط ببروفايل آخر.'],
        ['فحص الربط والاتصال', 'بعد اختيار البروكسي تأكد أنه ظهر في Select proxy. يمكنك استخدام Check proxy لفحص الاتصال، ثم اضغط OK لإكمال إنشاء البروفايل.', 'verifyProxy', 'التحقق النهائي قبل إنشاء الـProfile.']
      ],
      rule: 'قاعدة العمل: كل Proxy نربطه بـ Profile واحد فقط، ولا نعيد استخدام نفس البروكسي مع Profile آخر.',
      resultTitle: 'في نهاية الدرس',
      result: ['تفهم أن كل Profile له بيئة وبصمة مستقلة.', 'تستطيع إضافة البروكسي إلى AdsPower.', 'تستطيع اختيار بروكسي محفوظ وغير مستخدم وربطه بالـProfile.', 'تعرف كيف تفحص الاتصال قبل المتابعة.'],
      noteTitle: 'ملاحظة مهمة',
      note: 'لا تشارك Username أو Password أو Session الخاصة بالبروكسي. الصور المنشورة في الدرس يجب أن تبقى مخفية البيانات الحساسة.',
      back: 'العودة للرئيسية'
    },
    fr: {
      badge: 'Leçon 01',
      title: 'Qu’est-ce qu’AdsPower et pourquoi l’utilisons-nous ?',
      lead: 'AdsPower permet de créer un Profile séparé pour chaque compte. Chaque Profile conserve sa propre session, ses données locales et ses paramètres de Browser Fingerprint ; en pratique, nous le traitons comme un navigateur ou un appareil séparé pour ce compte, sans le confondre avec une machine virtuelle complète.',
      objectiveTitle: 'Objectif de la leçon',
      objective: 'Comprendre le principe du Profile indépendant, puis prendre le proxy préparé dans IPRoyal, l’ajouter à AdsPower et l’associer à un seul Profile.',
      s1: 'Le principe d’AdsPower',
      s1p: 'Chaque Profile possède un environnement de navigateur séparé : Cookies, Local Storage et paramètres d’empreinte restent propres au Profile. Lorsque nous revenons sur le compte, nous ouvrons le même Profile.',
      s2: 'Les sections utiles',
      s2p: 'New Profile sert à créer un nouveau profil, Proxies à ajouter et gérer les proxys enregistrés, et Trash à consulter les profils supprimés.',
      practical: 'Partie pratique — ajouter le proxy et l’associer au Profile',
      practicalLead: 'Nous prenons un seul proxy dans IPRoyal, nous l’enregistrons dans AdsPower, puis nous l’associons à un seul Profile.',
      steps: [
        ['Copier le proxy depuis IPRoyal', 'Sélectionnez une seule ligne de proxy puis copiez-la. Les données d’authentification sensibles restent masquées dans les captures pédagogiques.', 'copyProxy', 'Copie d’un seul proxy depuis IPRoyal.'],
        ['Ouvrir Proxies puis Add Proxy', 'Dans le menu de gauche, ouvrez Proxies puis cliquez sur Add Proxy afin d’ajouter le proxy copié.', 'openProxies', 'Section de gestion des proxys dans AdsPower.'],
        ['Coller le proxy et l’enregistrer', 'Choisissez le type adapté — généralement HTTPS — puis collez la ligne dans la zone prévue et cliquez sur OK.', 'pasteProxy', 'Le proxy est collé puis enregistré dans AdsPower.'],
        ['Vérifier l’importation', 'Après l’enregistrement, vérifiez que le proxy apparaît dans la liste Proxies et qu’il est prêt à être utilisé.', 'importedProxy', 'Le proxy importé apparaît dans la liste.'],
        ['Créer un Profile et ouvrir Proxy', 'Cliquez sur New Profile puis ouvrez l’onglet Proxy. Si le proxy est déjà enregistré, utilisez Saved Proxies.', 'linkProfile', 'Association du proxy depuis les paramètres du Profile.'],
        ['Choisir un proxy non utilisé', 'Ouvrez Saved Proxies puis choisissez un proxy non utilisé. Dans ce processus, nous vérifions Profile count = 0 avant de l’attribuer au Profile.', 'chooseSaved', 'Choisissez un proxy qui n’est pas déjà lié à un autre Profile.'],
        ['Vérifier l’association et la connexion', 'Après le choix, vérifiez que le proxy apparaît dans Select proxy. Vous pouvez utiliser Check proxy pour tester la connexion, puis cliquer sur OK.', 'verifyProxy', 'Vérification finale avant la création du Profile.']
      ],
      rule: 'Règle de travail : chaque proxy est associé à un seul Profile et le même proxy n’est pas réutilisé sur un autre Profile.',
      resultTitle: 'À la fin de la leçon',
      result: ['Vous comprenez que chaque Profile possède son propre environnement et sa propre empreinte.', 'Vous savez ajouter un proxy dans AdsPower.', 'Vous savez choisir un proxy enregistré et non utilisé puis l’associer au Profile.', 'Vous savez tester la connexion avant de continuer.'],
      noteTitle: 'Remarque importante',
      note: 'Ne partagez jamais le Username, le Password ou la Session du proxy. Les captures publiées doivent conserver ces données sensibles masquées.',
      back: 'Retour à l’accueil'
    }
  };

  function activeLessonId() {
    return document.querySelector('.lesson-link.active')?.dataset?.lesson || '';
  }

  function mediaFor(lang) {
    const media = window.GuideFlowMedia || {};
    const baseUrl = String(media.baseUrl || '').replace(/\/$/, '');
    const selected = media.assets?.[lang] || media.assets?.ar || {};
    const defaults = {
      copyProxy: `/images/adspower/${lang}/01-iproyal-copier-proxy.png`,
      openProxies: `/images/adspower/${lang}/02-section-proxies.png`,
      pasteProxy: `/images/adspower/${lang}/03-coller-proxy.png`,
      importedProxy: `/images/adspower/${lang}/04-proxy-importe.png`,
      linkProfile: `/images/adspower/${lang}/05-lier-proxy-profil.png`,
      chooseSaved: `/images/adspower/${lang}/06-choisir-saved-proxy.png`,
      verifyProxy: `/images/adspower/${lang}/07-verification-proxy.png`
    };
    const keys = {
      copyProxy: 'adspowerCopyProxy',
      openProxies: 'adspowerOpenProxies',
      pasteProxy: 'adspowerPasteProxy',
      importedProxy: 'adspowerImportedProxy',
      linkProfile: 'adspowerLinkProfile',
      chooseSaved: 'adspowerChooseSaved',
      verifyProxy: 'adspowerVerifyProxy'
    };
    const resolve = path => {
      if (/^(?:https?:)?\/\//i.test(path || '')) return path;
      if (!baseUrl) return path;
      return `${baseUrl}/${String(path).replace(/^\/+/, '')}`;
    };
    return Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, resolve(selected[key] || defaults[name])]));
  }

  function reading(title, body) {
    return `<section class="gf-reading-section"><h2>${title}</h2><p>${body}</p></section>`;
  }

  function render() {
    if (activeLessonId() !== 'adspower-interface') return;
    const wrap = document.querySelector('.page-wrap');
    if (!wrap) return;
    const lang = document.documentElement.lang === 'fr' ? 'fr' : 'ar';
    const renderKey = `adspower-interface:${lang}`;
    if (wrap.dataset.guideflowV2 === renderKey) return;

    const t = copy[lang];
    const media = mediaFor(lang);
    wrap.dataset.guideflowV2 = renderKey;
    wrap.innerHTML = `
      <article class="gf-course-page">
        <button class="gf-back" id="gfAdsBackBtn">← ${t.back}</button>
        <header class="gf-course-hero">
          <span class="gf-lesson-badge">${t.badge}</span>
          <h1>${t.title}</h1>
          <p>${t.lead}</p>
        </header>
        <section class="gf-objective"><span>◎</span><div><h2>${t.objectiveTitle}</h2><p>${t.objective}</p></div></section>
        ${reading(t.s1, t.s1p)}
        ${reading(t.s2, t.s2p)}
        <section class="gf-practical-intro"><span>01</span><div><h2>${t.practical}</h2><p>${t.practicalLead}</p></div></section>
        ${t.steps.map((step, index) => `
          <section class="gf-step">
            <div class="gf-step-copy"><span>${index + 1}</span><div><h2>${step[0]}</h2><p>${step[1]}</p></div></div>
            <figure class="gf-full-shot"><img src="${media[step[2]]}" alt="${step[0]}" loading="${index < 2 ? 'eager' : 'lazy'}"><figcaption>${step[3]}</figcaption></figure>
          </section>`).join('')}
        <section class="gf-final-note"><h2>${lang === 'ar' ? 'قاعدة أساسية' : 'Règle essentielle'}</h2><p>${t.rule}</p></section>
        <section class="gf-result"><h2>${t.resultTitle}</h2><div>${t.result.map(item => `<p><span>✓</span>${item}</p>`).join('')}</div></section>
        <section class="gf-final-note"><h2>${t.noteTitle}</h2><p>${t.note}</p></section>
      </article>`;

    document.getElementById('gfAdsBackBtn')?.addEventListener('click', () => document.getElementById('homeBtn')?.click());
  }

  const observer = new MutationObserver(() => queueMicrotask(render));
  observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  render();
})();
