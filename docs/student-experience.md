# Student Experience — Hybrid Premium Academy

Implemented 2026-09-18, based on `main` at `28c0bd362f0e35abfc5599c1f81db7c16bc260af`.

## Presentation and integration

`index.html` loads the shared `design-tokens.css`, the original three student stylesheets, then `student-premium-theme.css`. This final layer provides the light academy appearance, optional dark palette, responsive course cards, gate, readable lesson typography, uncropped figures and keyboard focus styles. It is not loaded by Admin Studio or agreement pages.

`app.js` still owns language, theme, dashboard/lesson state and course loading. The dashboard uses the decrypted course title and real module/lesson counts. Start selects the first available lesson even when preceding modules are empty. No completion or persisted progress is implied by the lesson position indicator.

Previous/next buttons follow the flattened order of the current language's modules and lessons. They live **outside `.page-wrap`**, because `lesson-v2-runtime.js` and `adspower-runtime.js` replace that container asynchronously. They use the existing `openLesson` flow and preserve the access URL fragment. At the boundaries only the available neighbor is shown; Home remains available. Navigation respects reduced motion and moves keyboard focus to the main region.

Below 821px the course outline is collapsed, with an explicit toggle and `aria-expanded`. Choosing a lesson closes it through the normal render. Desktop retains the existing sidebar layout.

`student-experience.js` progressively wraps specialized lesson images in labeled buttons and opens a native modal dialog. The viewer supports fit/original size, Escape, a close button, modal focus handling and focus restoration. It uses the already resolved image URL; it does not fetch course content or modify the hash. Existing generic lesson image links retain their original-size behavior. Without dialog support, the full inline images remain available.

## Architecture boundaries

- No framework, package/build system or external design dependency was introduced.
- Access policy, decryption, release selection, media resolution, content JSON, Admin Studio and agreement logic are unchanged.
- Specialized lesson copy remains in the existing runtimes. Moving it to content data is a separate future change.
- The UI does not add accounts, track completion, store credentials or change course access.

## Validation

- JavaScript syntax checks passed for every `.js` / `.mjs` file.
- All 14 existing Node tests passed.
- Existing `tests/browser-smoke.mjs` passed, including agreement operations and LIVE/Snapshot/access regressions with fixtures.
- New `tests/student-experience.mjs` passed: encrypted versioned LIVE and legacy Snapshot, gate/disabled links, both specialized renderers and generic lessons, cross-module navigation and boundaries, empty first module, image dialog keyboard/focus/hash, Arabic/French, light/dark, widths 320/390/768/1440, 200% root text size, mobile outline, refresh and reduced motion.
- Desktop, mobile and dark-theme screenshots were visually reviewed. Images and course records in browser tests are synthetic; production image availability and real private links were not exercised.

Run from this repository:

```sh
node --test tests/*.test.mjs
node tests/browser-smoke.mjs
node tests/student-experience.mjs
```

Browser scripts require Playwright and Chromium. Optional `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` select installed runtimes. They create temporary local servers and close them; screenshots go to `../artifacts/`. The existing CI runs syntax and Node tests; the browser scripts are local checks unless separately configured in CI.

## Delivery

This change is prepared on `design/student-experience-premium` for review. Merging and live deployment are separate from the verified local implementation. See the matching project-log entry in the private source repository for review links and status.
