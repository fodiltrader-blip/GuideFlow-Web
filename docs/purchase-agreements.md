# Purchase agreements

The production admin is `GuideFlow-Web/admin.html`. This feature adds a separate
purchase-agreement editor and `agreement.html`; it does not grant course access,
collect payments, capture acceptance, or change the `#/access/…` reader.

## Using the feature

1. Connect to Admin Studio with the existing GitHub session.
2. Open **اتفاقات الشراء** and load saved agreements, or choose **اتفاق جديد**.
3. Choose the default language and private/public visibility. Complete the title,
   course description, included content, resources, refund policy, payment method,
   and payment instructions. Complete the second language only if a translation
   is available. The editor and viewer support Arabic RTL and French LTR.
4. Enter the total, currency, installment count, each amount, and each due date.
   DZD/EUR/USD/MAD use two decimal places; TND uses three. Amounts must be positive,
   the sum must match exactly, and dates must be valid and chronological.
5. Optionally enter an HTTPS payment-provider link. Choose **حفظ ونشر الاتفاق**.
   GitHub Pages must finish publishing before the new version is available.
6. Copy/open the link from the agreement card. Edit and save to update the same
   link. The customer page shows its revision/date and supports printing.

Only payment descriptions, instructions, and a payment URL belong in the form.
Never enter card numbers, CVV, credentials, secret keys, or proxy credentials.
The serializer allows only defined fields and rejects recognizable credential
patterns/card numbers. Pattern detection is a best-effort guard, not a guarantee
that arbitrary free text contains no secrets. There are no card-entry controls,
payment SDKs, analytics, or external scripts on the agreement page.

## Storage and visibility

- `GuideFlow/config/purchase-agreements.json` is created on first save in the
  **private source repository**. It stores the editor records, revisions and,
  for private agreements, a randomly generated per-agreement encryption key.
  No registry, live data, real links, or keys are included in this PR.
- `GuideFlow-Web/data/agreements/<random-id>.json` contains the published document
  for a public agreement, or an AES-GCM encrypted envelope for a private one.
  Encryption uses a fresh nonce for each publication and binds the agreement ID
  as authenticated data. Course encryption keys/access secrets are never reused.
- Private links carry the decryption key **only in the URL fragment**. The browser
  decrypts locally. No private titles, terms, instructions, or keys are written to
  the public envelope. Anyone holding the complete link can read/share it; this
  is possession-based access, not buyer authentication. Historical ciphertext is
  retained in Git history and may be decrypted by holders of that same key.
- Public contents and their Git history are public. Visibility is fixed after
  saving; changing a previously public record to private would not erase its
  history. Create another agreement when a different visibility is needed.
- The page sends no referrer and loads only same-origin assets. Payment links
  require HTTPS and reject URL credentials. Its schema, URL, and text validation
  also run when reading. User text is escaped rather than interpreted as HTML.

The existing GitHub session credential stays in the existing admin session; the
new modules receive repository operations, not that credential, and do not store
it in browser storage, agreements, logs, or URLs. Agreement state is cleared on
disconnect; stale async work cannot issue another repository operation after a
session ends. Existing access-link session handling is unchanged.

## Save, publish and conflict behavior

Saving writes the private record first, then publishes its public representation.
These are two separate repository commits, **not an atomic transaction**. A failed
publication leaves a recoverable private record and an explicit retry message.
**نشر النسخة المحفوظة** republishes that record without generating a new link.
An already-published revision is a no-op. This button publishes saved contents,
not unsaved edits currently in the form. After reopening, load the list to recover
the record and retry. The viewer can continue showing the previous published
revision until a newer one reaches Pages. There is no payment-status tracking.

Private registry writes use the current file SHA and detect stale record
revisions. Publication reads the public SHA before checking the private revision.
Concurrent changes cause a conflict instead of silently overwriting newer data.
The old generic SHA-retry wrapper explicitly bypasses only the two new agreement
paths; its existing access behavior is unchanged. After a conflict, refresh the
list and reopen the latest agreement before editing again.

## Files and validation

- `agreements-core.mjs`: allowlisted schema, money/date/URL validation, encryption.
- `agreements-store.mjs`: private save, public publish, revision/SHA conflicts.
- `admin-agreements.mjs`: editor/list and session lifecycle. Its DOM is preserved
  across existing admin rerenders so access searches do not erase unsaved edits.
- `agreements-i18n.mjs`: Arabic/French interface labels and validation messages.
- `agreement-page.mjs`, `agreement.html`, `agreements.css`: customer-facing agreement.

Run `node --test tests/agreements.test.mjs` with Node 24. On environments that block
test child processes, use `node --test --test-isolation=none tests/agreements.test.mjs`.
The unit/integration suite covers amounts, dates, translations, URL/text safety,
encryption, public output, stable links, save/reload/edit, failed publication,
concurrent writes and bypassing unsafe automatic retries.

Run `node tests/browser-smoke.mjs` with Playwright/Chromium available. Optional
`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` specify local installations. All GitHub
requests are intercepted with in-memory fixtures; it never writes to live repos
or uses a real credential. The test verifies Arabic/French editing and display,
public/private links, missing/wrong keys, failed publication/retry, copy/open,
reconnect, unsaved-edit preservation, mobile overflow, LIVE creation/modal and
disable/enable/expiry, legacy Snapshot access, and invalid/missing access links.
Screenshots are written outside the repository in `../artifacts/`.

The regression checks run in a local mocked environment. Production propagation
and actual GitHub permission failures cannot be proven by these tests. Keep the PR
unmerged until review; no live access or agreement records are changed by this work.
