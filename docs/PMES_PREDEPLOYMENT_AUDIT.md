# PMES Pre-Deployment Audit — Phase 1 (Read-Only)

**Date:** 2026-08-20
**Baseline commit:** `66d3cca` (origin/main) + `d7db4be` (local docs/tooling)
**Scope:** Repository audit only. **No code was modified.**
**Method:** Direct inspection of the implementation. Findings below are evidence-backed;
items marked *Not verified* were not reachable by code reading alone.

---

## Remediation status

The matrix below records the audit **as found**. Fixes applied since:

| Finding | Status | Commit | Live? |
|---|---|---|---|
| **C-2 — Office Admin privilege escalation** | **Fixed** | this commit | Not until Apps Script is redeployed |
| C-1 — `docgen` IDOR | **Fixed** | `f366748` | Live (Apps Script @300) |
| H-3 — Accomplishment attribution spoofing | **Fixed** | `ff91ded` | Live (Apps Script @302) |
| **H-4 — IPCRF form created against another user** | **Fixed** | this commit | Not until Apps Script is redeployed |
| H-1 — proxy retries writes | **Fixed** | `7977f34` | Not until Vercel redeploys |
| H-2 — missing write locks | **Fixed** | this commit | Not until Apps Script is redeployed |
| M-1 — formula injection | **Fixed** | this commit | Not until Apps Script is redeployed |
| M-2 — security headers | **Fixed (CSP staged)** | this commit | Not until Vercel redeploys |

Two additional defects were found while fixing the above, and are fixed in the same commits:

- **Write failover between deployments** (with H-1): a write that was deliberately *not*
  retried was still re-sent to the next url in `GAS_WEB_APP_URL`. With two urls configured a
  single write reached Apps Script four times.
- **`UsersService.create` had no duplicate-email check at all** (with H-2): only
  `selfRegister` checked. The administrator path appended the Users row before calling
  Firebase, whose `EMAIL_EXISTS` branch reports success — so creating the same person twice
  left two Users rows for one email, which `getProfile` resolves against.

**The deployment recommendation in section F is superseded** — see the end of this document.

---

## 0. Coverage statement

This pass covered the highest-risk areas: secrets/config, authentication, authorization,
office isolation, write safety, caching/performance, concurrency, input validation,
security headers, dependency health, and build.

**Not yet covered** (deferred to a later phase): responsive QA (Phase 13), accessibility
(Phase 14), image/asset optimization (Phase 11), per-service authorization verification
across all ~40 Apps Script services (spot-checked only), and any runtime/load testing.

The backend is ~16,200 lines of Apps Script across 40 files. This is a targeted risk-based
review, **not** a line-by-line review of every file.

---

## A. Audit matrix

| # | Area | Requirement | Status | Evidence | Risk | Recommended action |
|---|------|-------------|--------|----------|------|--------------------|
| 1 | AuthN | Signature-verified Firebase tokens | **Compliant** | `AuthService.gs:203` calls `FirebaseAuthService.verifyIdToken`, which uses Identity Toolkit `accounts:lookup` — Google validates RS256, expiry, issuer | — | None |
| 2 | AuthN | `aud` / `iss` / `exp` / clock-skew checks | **Compliant** | `AuthService.gs:164-188` | — | None |
| 3 | AuthN | Domain allowlist enforced on *authoritative* email | **Compliant** | `AuthService.gs:207` re-checks domain against Google's email, not the claim | — | None |
| 4 | AuthN | Disabled-account handling | **Compliant** | `AuthService.gs:204` rejects `verified.disabled` | — | None |
| 5 | AuthN | Every route authenticated | **Compliant** | `Code.gs` `handleRequest` verifies before dispatch; no anonymous path | — | None |
| 6 | AuthZ | Role/permissions from backend records, not client | **Compliant** | `getEffectiveAccess` derives from the Users sheet; `api.js` sends no role/officeId | — | None |
| 7 | AuthZ | Sensitive routes guarded | **Partial** | `requireRole`/`requirePermission` used across services, but `Router.gs` itself has no guard layer — enforcement is per-service | Med | Verify remaining services individually in Phase 3 |
| 8 | **AuthZ** | **`docgen/{fileId}/print` ownership check** | **MISSING** | `DocGenService.gs:103-125` — `exportPdf` calls `SpreadsheetApp.openById(fileId)` with **no ownership or permission check**; route has no guard (`Router.gs:348`) | **Critical** | Bind export to a form record the caller may access |
| 9 | Isolation | Office cache keys include spreadsheet ID | **Compliant** | `DataCacheService.gs` `keyFor()` = `spreadsheetId + '::' + sheetName` | — | None |
| 10 | Isolation | Transactional data excluded from shared cache | **Compliant** | Tier-2 allowlist is reference tables only; ratings/assignments/users excluded by design | — | None |
| 11 | Isolation | Central config read from central DB | **Compliant** | `OfficeScopeService.gs` — `SCOPED_RESOURCES` deliberately excludes registry/users/rater-matrix; services bind via `withCentralSpreadsheet` | — | None |
| 12 | Isolation | Explicit `officeId` override gated | **Compliant** | `canUseExplicitOffice_` requires a cluster/registry permission | — | None |
| 13 | **Write safety** | **Mutations not blindly retried** | **VIOLATED** | `api/gas.js` — `RETRYABLE_WRITE = [429,500,502,503,504]`, `ATTEMPTS_PER_TARGET = 2` | **High** | Stop retrying writes, or add idempotency keys |
| 14 | Write safety | Client does not retry mutations | **Compliant** | `api.js:215-216` — GET only | — | None (gap is proxy-side) |
| 15 | **Concurrency** | **Locks on duplicate-sensitive writes** | **Partial** | `LockService` present only in `IPATRaterAssignmentService.gs:125` and `IPCRFService.gs:1147`. **Zero** in UsersService, OfficeRegistryService, IPATService, OfficePersonnelService, DatabaseMaintenanceService | **High** | Add short-scope locks to account creation, provisioning, rating saves |
| 16 | **Input** | **Spreadsheet formula-injection guard** | **MISSING** | No escaping of leading `=`/`+`/`-`/`@` anywhere before sheet writes | **Med** | Neutralize on write or on export |
| 17 | **Headers** | **Production security headers** | **MISSING** | `vercel.json` has only COOP, ACAO, Vary. No HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP, `frame-ancestors` | **Med** | Add headers; test Google sign-in popup after |
| 18 | Headers | API responses `no-store` | **Compliant** | `api/gas.js` sets `Cache-Control: no-store, max-age=0` first | — | None |
| 19 | Errors | No internals leaked to client | **Compliant** | `Code.gs` `safeClientErrorMessage`; 5xx generic, <500 curated; stack traces stay in `Logger` | — | None |
| 20 | Errors | Status codes carried in envelope | **Compliant** | `respond()` includes `status`; 401/403/409/429 distinguished | — | None |
| 21 | Rate limit | Throttling present | **Compliant** | `Code.gs` — 120 reads/min, 30 writes/min per user, `CacheService`-backed | — | None |
| 22 | Secrets | No secrets committed | **Compliant** | No `.env` tracked; Firebase private key in Script Properties; `.gitignore` covers keys/service accounts | — | None |
| 23 | Secrets | Hardcoded fallbacks | **Informational** | `SpreadsheetService.gs:9` `DEFAULT_SPREADSHEET_ID`; `api/gas.js:2` `CANONICAL_GAS_WEB_APP_URL`; `FirebaseAuthService.gs` project/web-key fallbacks | Low | Identifiers, not secrets. Keep fallbacks or fail loudly — decide deliberately |
| 24 | Perf | Read caching | **Compliant** | Two-tier `DataCacheService` with write invalidation; solves the documented repeated-full-sheet-read problem | — | None |
| 25 | Perf | Per-cell writes | **Partial** | 38 `setValue()` calls in `DocGenService.gs`; ≤2 elsewhere | Low | Batch only if doc generation is measurably slow |
| 26 | Perf | Route-level lazy loading | **Compliant** | Build emits per-view chunks | — | None |
| 27 | Perf | Bundle size | **Informational** | `ReportsView` 187 kB (65 kB gz) is the largest chunk | Low | Consider lazy-loading its heavy deps |
| 28 | Audit log | Coverage of key actions | **Compliant** | `AuditService.log` across IPCRF (23), IPAT (12), Users (9), content, maintenance, registry | — | Confirm users cannot write the log (not verified) |
| 29 | Deps | Vulnerabilities | **Compliant** | `npm audit --omit=dev` → **0 vulnerabilities** | — | None |
| 30 | Quality | Lint | **Compliant** | `eslint src --max-warnings=0` → clean | — | None |
| 31 | Build | Production build | **Compliant** | `vite build` → success, 17.79s | — | None |

---

## B. Security findings

### CRITICAL — 1

**C-1. IDOR: arbitrary Google Sheet export via `docgen/{fileId}/print`**
`DocGenService.exportPdf` (`DocGenService.gs:103`) opens **any** spreadsheet ID supplied by
the caller using the script's own OAuth token, with no check that the caller may access it:

```js
function exportPdf(fileId, tabName, user) {
  const ss = SpreadsheetApp.openById(fileId)   // no ownership check
  ...
  headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
```

The `docgen` route (`Router.gs:348`) carries no role or permission guard.

**Impact:** any authenticated PMES user — including an ordinary rank-and-file account in a
single office — can export **any Google Sheet the script owner can read**, as a PDF. That
includes the central PMES database and every per-office workbook, i.e. a full cross-office
personal-data disclosure. The central spreadsheet ID is not secret (it is hardcoded in
`SpreadsheetService.gs:9` and in `tools/seed-dashboard-test-data.js`).

**Note:** this is also a Phase 20 (PIA) concern — it is a plausible personal-data breach path.

**Fix direction:** resolve the file ID from a form/record the caller is authorized to read
(as the `ipcrf/:id/generate-*` routes already do) rather than accepting a raw Drive ID; and
add a permission guard on the route.

**C-2. Office Administrator could escalate to cluster-wide read** *(found during Phase 8, 2026-08-20)*

`UsersService.update` guards the office-admin path with `stripOfficeAdminForbiddenFields_`,
a **denylist of 19 fields that did not include `role`**. It blocked only the literal string
`'System Administrator'`.

An office admin editing their own row lands in that branch rather than the self-edit branch,
because `sameOffice_` trivially matches their own record — the code's own comment at
`UsersService.gs:330` documents this. And `RoleLabelService.canonicalRole` is a passthrough
that returns unknown input verbatim: **no role allowlist exists anywhere in the backend**.

Chain:

1. `officeRole === 'OFFICE_ADMIN'` alone satisfies `hasOfficeUserAdministration_`
2. `PUT users/{ownId}` with `{ "role": "Undersecretary" }`
3. `ROLE_GROUPS['Undersecretary']` → `cluster-monitoring-admin` → `view_cluster_monitoring`
4. `OfficeScopeService.canUseExplicitOffice_` accepts that permission as authority to pass an
   explicit `officeId`, redirecting any scoped resource into **any office's workbook**

**Impact:** an office-scoped administrator reaching every participating office's assessment
data — the same isolation break as C-1, reached through authorization rather than file access.

**Fixed by:** refusing `Undersecretary` alongside `System Administrator` on this path, and
stripping `role`/`requestedRole` entirely on a self-edit (changing your own role has no
legitimate use — a real promotion is done by someone holding `manage_users`, who never reaches
this branch). Verified: the escalation returns 403, while an office admin can still set an
ordinary role on another user and the original 19-field denylist still applies.

**Left open deliberately:** an office admin can still assign `Bureau Director` /
`Assistant Bureau Director` to *another* user in their office, which grants
`view_bureau_monitoring`. Those labels appear in the office personnel role lists, so blocking
them could break legitimate use. **This is a policy question for the system owner:** should an
office administrator be able to grant bureau-level monitoring at all?

### HIGH — 2

**H-1. Vercel proxy retries non-idempotent writes**
`api/gas.js` retries POST/PUT/PATCH/DELETE on `429/500/502/503/504`, twice per target, and
across multiple targets if several GAS URLs are configured.

The in-code rationale is that these codes mean Apps Script "refused or failed to execute the
request at all." That holds for 429 and cold-start 503, but **not** for 500 (a script that
threw *after* an `appendRow`), nor for 502/504 (gateway-level — the execution may have
completed and only the response was lost). The client layer deliberately avoids this
(`api.js:215-216`); the proxy reintroduces it beneath.

**Impact:** duplicate assessment submissions, duplicate user creation, duplicate rater
assignments — silent data-integrity damage, not a visible error.

**Fix direction:** Option A — drop writes to `[429]` only, or no retry at all. Option B —
client-generated request ID + short-lived server-side dedupe.

**H-2. Missing locks on duplicate-sensitive mutations**
`LockService` appears in only 2 of 40 files. Absent from account creation (`UsersService`),
office provisioning (`OfficeRegistryService`), IPAT rating saves (`IPATService`), personnel
creation, and database maintenance.

**Impact:** compounds H-1. Two concurrent requests (double-click, or a proxy retry racing the
original) can both pass a "does this already exist?" read and both write.

**H-3. Accomplishment identity and division were taken from the request** *(found during Phase 8)*

`AccomplishmentsService.create` restricted only `Staff`/`Technical Staff` from filing against
another `userId`. Every other role could pass any id — and since **no role string is validated
anywhere**, an unrecognised role skipped the check rather than being refused. The guard failed
open.

`employeeName`, `divisionId` and `division` were also written straight from the request, so the
attribution stored on the row was whatever the caller claimed. The division-scoped reports and
monitoring views read exactly those fields.

**Fixed by** resolving identity from the Users sheet instead of the request, and deciding
authority with the existing `guardAccess` — the same rule that governs editing those records —
rather than a second, weaker list.

Verified with 7 cases run against both versions. Before: an unrecognised role could file
against another user, a spoofed `divisionId` crossed divisions, request-supplied attribution
was written verbatim, and an unknown target produced a row with empty attribution. After: all
refused. The two "unchanged behaviour" cases — staff filing for themselves, and a division
chief filing within their own division — pass in both versions.

**Note:** accomplishment ratings do *not* feed IPCRF scoring. `computeScore` reads FormEntries,
and the sync runs entry → accomplishment only. So this is an attribution and reporting-integrity
issue, not score manipulation.

**H-4. IPCRF/CCEF forms could be created against another user** *(found during Phase 8)*

`IPCRFService.create` accepted `body.userId` with no check on whether the caller may file a
form for that person, while every derived field was computed from the **caller's** profile.

A form filed against someone else therefore carried:

- the wrong **employment type** — an IPCRF where a Contract of Service employee needs a CCEF,
  i.e. the wrong assessment instrument entirely
- the wrong **position level**, which selects the KRA entry weights the final score is computed
  from
- the wrong **division and section**, which decide whose review queue the form appears in

It also denied the real owner their own form, since the duplicate check would then find one and
return 409.

The function already carried the comment "Never trust frontend input for these - always compute
server-side" above the weight derivation. That was true of the weights and false of the identity
they were derived for.

**Fixed by** deriving type, level, position, division and section from the person the form is
FOR, and gating with the existing `_guardAccess`.

Verified with 6 cases against both versions. Before: a staff member could file a form against
anyone; the form carried the caller's position level and name; a COS employee in another
division received an IPCRF in the caller's division; an unknown target was accepted. After: all
refused. Creating your own form, and a division chief creating within their own division, pass
in both versions.

**Note:** `PositionHelper.resolveWeights` currently returns a constant 70/30, so the core/support
weight impact was latent rather than active. `positionLevel` and form type were not.

### MEDIUM — 2

**M-1. No spreadsheet formula-injection protection**
No guard neutralizes leading `=`, `+`, `-`, `@` in user-supplied text before it is written to
Sheets. Free-text fields (accomplishments, review comments, MOV references) reach cells
directly. In Google Sheets a string beginning `=` becomes a live formula; exported CSV/XLSX
can execute in Excel.

**M-2. Missing production security headers**
`vercel.json` lacks HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, and CSP (including `frame-ancestors` — the app is currently framable,
so clickjacking is unmitigated). COOP is already set to `same-origin-allow-popups`, which is
correct for the Google sign-in popup and **must be preserved**.

### LOW / INFORMATIONAL — 3

**L-1.** Hardcoded fallbacks: `DEFAULT_SPREADSHEET_ID`, `CANONICAL_GAS_WEB_APP_URL`, Firebase
project ID and web API key. None are secrets (the web API key is public by design and already
ships in the bundle). The real question is failure mode: today a missing Script Property
silently falls back to production. **Decision needed** — that is convenient, but it means a
misconfigured staging deploy would write to live data.

**L-2.** `tools/seed-dashboard-test-data.js` hardcodes the **production** central spreadsheet
ID and can seed/clean it. It is prefix-scoped (`TESTPMES-`), but it points at live data by
default.

**L-3.** `Router.gs` has no central authorization layer; every service must remember its own
guard. This is why C-1 exists. Consider a route→permission table as defense in depth.

---

## C. Performance findings

| Bottleneck | Status | Effect |
|---|---|---|
| Repeated full-sheet reads (`getDataRange().getValues()` ~90 call sites) | **Already fixed** by `DataCacheService` tier-1 memo | Largest historical win; already realized |
| Reference-table re-reads across users | **Already fixed** by tier-2 `CacheService`, 300s TTL | Realized |
| Dashboard multi-call boot | **Already fixed** — `dashboard/all` collapses 4 calls into 1 (commit `3914651`) | Realized |
| 38 per-cell `setValue()` in `DocGenService` | Open | Only matters if doc generation is slow in practice — measure first |
| `ReportsView` 187 kB chunk | Open | Minor; affects first load of Reports only |

No new optimization is recommended before the correctness issues above are resolved.

---

## D. Privacy (Phase 20) — flagged for human decision

Technical control gaps are covered above (C-1 especially). The following are
**organizational decisions that code review cannot settle** and require DPO/management input:

- Retention and deletion periods for assessment records and audit logs
- Lawful basis for processing personnel performance data
- Incident-reporting procedure (C-1 is a plausible breach scenario — assess whether it was
  ever exploited before it is closed)
- Whether Vercel function logs may contain personal data (`console.warn` logs route names
  only — no payloads — which is good practice and should be kept)

**This audit does not and cannot mark the PIA or a formal VA as complete.**

---

## E. Recommended fix order

1. **C-1** — `docgen` IDOR. Smallest diff, largest risk reduction.
2. **H-1** — proxy write retries. One-line change for Option A.
3. **H-2** — locks on account creation and rating saves.
4. **M-2** — security headers (test Google sign-in immediately after).
5. **M-1** — formula-injection guard.

Items 1–3 are correctness/security and should land before deployment.
Items 4–5 are hardening and may follow.

---

## F. Deployment recommendation (interim)

**NO-GO** pending remediation of **C-1** alone.

C-1 permits any authenticated user to exfiltrate the entire central database and every office
workbook as a PDF. That is a cross-office personal-data disclosure in a system whose primary
security requirement is office isolation.

H-1 and H-2 are data-integrity risks that should also be closed, but they degrade correctness
rather than confidentiality.

This verdict is **interim** — it reflects Phase 1 only. It is not a substitute for a formal VA
or PIA, and Phases 10–14 and 18 have not been performed.

---

## G2. Phases 10–16 sweep results

Measured, not assumed. Where a check disproved a suspicion, that is recorded too.

### Phase 16 — audit log integrity

**Fixed.** The `auth/log` route let any signed-in caller append an audit row with an arbitrary
action, module and details — so the log could be padded with plausible entries to bury a real
one. Identity columns were always server-derived, so this was never impersonation. **Nothing
called it**: `authApi.logAction` was defined in `services/api.js` and never invoked. Route and
client method both removed.

Otherwise sound: no update or delete path to `AuditLog` outside admin-guarded database
maintenance, and `list` refuses non-admins reading other users' entries.

### Phase 11 — static assets

**Fixed:** `public/stb-seal.png` (169.6 KB) was shipped in every deploy and referenced
**nowhere** in the repo. Removed.

**Open — needs a decision.** `dswd-logo.png` is **2048×740, 293.8 KB**, and it is the largest
file served. It renders in the boot splash on *every* page load, at `min(320px, 82vw)` — so at
most 320 CSS px wide. Even allowing 3× for high-density screens, 960px would suffice; 2048px is
roughly 6× the pixels needed.

Not resized here for two reasons: no image tooling is installed (no `sharp`), and it is official
branding, which the audit brief says not to degrade. Resizing to 960px wide would be visually
identical at every realistic display density and would cut ~250 KB from first paint. **Worth
doing — but with your sign-off on touching a branding asset.**

### Phase 12 — caching

**Fixed.** Content-hashed assets were served `public, max-age=0, must-revalidate` — verified on
the live site. Every one of the 68 files in `/assets/` revalidated on every page load despite
having a content hash in its filename, which makes them immutable by construction.

Now `public, max-age=31536000, immutable`, scoped to `/assets/` only. Verified first that every
file there carries a hash and that unhashed files (`index.html`, favicons, the logo) live at the
root and are unaffected — `index.html` keeps `must-revalidate`, which is correct.

### Phase 13 — responsive

Checked at 320, 360 and 768 px on the login route.

**No defect found.** A 1 px `scrollWidth` excess appears at 320 and 360, but the page **cannot
actually be scrolled horizontally** — `window.scrollTo(50, 0)` leaves `scrollX` at 0, and no
element extends past the right edge. It is a sub-pixel rounding artifact, not a user-visible
problem. Recorded rather than "fixed" so nobody chases it later.

### Phase 14 — accessibility

**Fixed:** two targets under the 24×24 minimum (WCAG 2.5.8, AA) — the "Forgot password?" link
(103×15) and the show-password toggle (23×23). Both now 24 px, and the fix uses padding with a
cancelling negative margin so the label row is unchanged: measured before and after, the label
stays 16 px with the same 6 px gap to the input.

**Verified clean:** every input has a label, no icon-only button lacks an accessible name, all
images carry `alt`, `lang` and `title` are set, and heading order is sane (H1 → H2).

**A false positive, corrected:** an initial probe reported four focusable elements with no
visible focus indicator. That was wrong — programmatic `.focus()` does not trigger
`:focus-visible`, and the probe showed the element was not focused at all. Inspecting the
stylesheets directly: inputs suppress the outline but replace it with a `box-shadow` focus ring,
and buttons and links have no outline-suppressing rule, so the browser default survives. **Focus
visibility is fine.**

### Coverage limit on 13 and 14

Both were tested on the **login route only**. Every authenticated view — dashboards, tables, the
assessment rating interface, modals, the monitoring screens — requires a Google sign-in this
environment cannot perform. The breakpoints the brief lists (390, 412, tablet landscape, 1366,
1920) are only meaningful against those views. **This is the largest remaining gap in the audit
and needs a human with a test account.**

---

## G1. Formula injection — one assumption to confirm on a live sheet

The guard prefixes a dangerous string with an apostrophe, which is Sheets' own
"treat this as text" marker. The escaping itself is unit-tested (26 cases: injection
forms neutralised, ordinary text, signed numbers, dates, non-strings and Dates passed
through by identity, idempotent on repeat writes).

**What could not be verified here:** that `getValue()` returns the string *without* the
apostrophe, so a value round-trips unchanged. That is the documented and long-standing
Apps Script behaviour, and the guard is written to be idempotent so apostrophes cannot
accumulate even if the assumption is wrong — but it is an assumption, and it is easy to
settle in one minute on the live system:

1. Save an accomplishment or review comment whose text begins with `=SUM(1,1)`.
2. In the sheet, the cell must show the literal text, not a computed value.
3. Reopen the record in the app. The field must read back exactly `=SUM(1,1)`,
   with no leading apostrophe.

If step 3 shows a leading apostrophe, the display path needs a matching strip;
nothing else about the fix changes.

Existing rows written before this change are untouched. If any already contain a
leading `=`, `+` or `@`, they are still live formulas and should be found and rewritten
separately — the guard only protects new writes.

---

## G0. Content Security Policy — how to finish the job

The headers in `vercel.json` are split deliberately:

**Enforcing now** (cannot break Google sign-in):
`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `X-Frame-Options: DENY`, and a minimal CSP of
`frame-ancestors 'none'; base-uri 'self'; object-src 'none'`.
That closes the clickjacking gap immediately — it is the part of M-2 with real
security value and no compatibility risk.

**Report-Only** (`Content-Security-Policy-Report-Only`): the full resource policy —
`script-src`, `style-src`, `font-src`, `img-src`, `connect-src`, `frame-src`, `form-action`.
It is *not* enforced. Violations are logged to the browser console and nothing is blocked.

### Why it is not enforced yet

A resource CSP can break Google sign-in, and sign-in cannot be exercised from a local
static build — it needs the real deployed origin and Firebase's authorised domains.
Enforcing an unvalidated policy risks locking every user out of a system whose only
entry point is Google sign-in.

That caution was justified: the first version of this policy carried a **wrong**
`script-src` hash. The HTML parser normalises CRLF to LF before hashing an inline
script, and this repo's checkout has CRLF, so a hash of the file's bytes did not match
what the browser computed. Report-Only surfaced it as a console warning; enforcing
would have blocked the boot splash script in production.

### What was verified locally

The production build was served with these exact headers and loaded in a browser:
the login page rendered completely, and after the hash correction there were **zero**
CSP violations. That covers the app shell and login route only.

### To promote Report-Only to enforcing

1. Deploy with the headers as they are.
2. Exercise the real app in a browser with the console open — **especially Google
   sign-in (popup and the redirect fallback)**, plus reports, document generation and
   PDF download, and any view using the `@import` Google Fonts (`ConfirmModal`,
   `LogoutConfirmModal`, `PasswordChangePrompt`). The login page alone does not
   exercise `font-src`, `connect-src`, or `frame-src`.
3. Collect every `Content-Security-Policy-Report-Only` violation and widen the policy
   to cover the legitimate ones. Expect at least the Firebase `authDomain` under
   `frame-src` — it is env-driven, and the policy currently allows
   `https://*.firebaseapp.com`, which will not match a custom auth domain.
4. Only when a full session produces no violations, rename the header
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy` and merge it with
   the minimal enforcing policy.

### Maintenance trap

`script-src` pins a sha256 of the inline boot script in `vue-frontend/index.html`.
**Any edit to that script changes the hash.** After changing it, run:

```bash
node tools/csp-hash.mjs
```

It rebuilds the hash the way the browser computes it (CRLF normalised) and fails if
`vercel.json` is stale. While the policy is Report-Only a stale hash only logs a
warning; once enforced it blocks the script.

---

## G. Revised recommendation (after C-1, H-1, H-2)

**CONDITIONAL GO**, conditional on all of the following:

1. Apps Script redeployed and Vercel redeployed — **none of the fixes are live until then.**
2. Manual confirmation on the deployed build of:
   - Print still works for a form's owner, and `docgen/{centralSpreadsheetId}/print` returns 404
   - Rater submission still saves both CBC and JF ratings (this path now runs the rating
     upsert through a nested-lock-safe route — it is the most-used write in the system)
   - Creating a user with an existing email now returns 409 rather than a second row
3. The live Users sheet is checked for duplicate-email rows created before the fix, since
   `getProfile` resolves a signed-in account by email.
4. M-1 and M-2 accepted as known, tracked residual risk, or fixed first.

Still outside this verdict: Phases 11, 13, 14 and 18 (assets, responsive, accessibility, QA
regression), formal VA, and formal PIA. None of those are satisfied by code review.
