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
| C-1 — `docgen` IDOR | **Fixed** | `f366748` | Not until Apps Script is redeployed |
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
