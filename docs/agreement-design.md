# Agreement presentation

The customer page uses a dedicated navy/gold document theme. It preserves the
existing agreement schema, encrypted URLs, repository storage and admin editor.

## Files

- `agreement-layout.mjs`: escaped Arabic/French markup, explicit seller/buyer
  labels, installment cards, clipboard actions and payment-section navigation.
- `agreement-theme.css`: customer-only styling, RTL/LTR, mobile, reduced motion,
  enlarged text and print rules. No remote fonts or services are loaded.
- `agreement-page.mjs`: existing load/decrypt/error handling plus layout binding.
- `agreement.html`: theme and versioned entry point; CSP and no-referrer retained.

Payment navigation deliberately uses scrolling and focus, never `href="#..."`,
because private agreement keys live in the URL fragment. Copy acts only on the
address displayed in the current agreement, with a selection fallback if denied.
Party labels and standalone Ethereum-format addresses are recognized only for
presentation. Unrecognized lines are retained. No payment instruction, currency,
amount, refund term, wallet, buyer name or encryption key is hardcoded in the UI.
Installment percentages describe shares of the total, not payment completion.

## Verification

Run `node --test tests/*.test.mjs`. If process spawning is restricted, add
`--test-isolation=none`. Run `node tests/browser-smoke.mjs` with Playwright and
Chromium (`PLAYWRIGHT_MODULE` / `BROWSER_EXECUTABLE` may specify installed paths).
The browser suite intercepts GitHub calls and uses generated fixtures only.
It checks create/edit/publish/copy, exact wallet copy, unchanged private URL after
payment navigation, RTL/LTR, 320/390/768/1440px layouts, 200% text, print output,
and existing LIVE/Snapshot access creation, expiration and disable/re-enable.
Screenshots and the print PDF go to `../artifacts/`, outside the checkout.

Never add real agreements, share keys or session credentials to fixtures, public
documentation or PR bodies. Retrieve an existing private link through Admin
Studio's purchase-agreement list when needed. Design changes do not require
republishing the agreement record. The original link uses the updated renderer.
