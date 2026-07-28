# PMES — System Brief (agent handoff)

Paste or upload this whole file to give any AI agent working context on this codebase.
Everything below was read from the repo, not assumed. Verify file:line claims before relying on them — the code moves.

---

## 1. What this is

**PMES — Performance Monitoring and Evaluation System** for the **DSWD Social Technology Bureau (STB)**.
Internal government tool. Personnel submit performance targets, log accomplishments with evidence files, get rated by supervisors/peers, and receive a final numerical + adjectival rating per semester.

Two evaluation instruments coexist:

| Instrument | What it measures | Sheet family |
|---|---|---|
| **IPCRF / CCEF** | Individual targets & accomplishments (Core + Support functions), rated E/Q/T | `IPCRForms`, `FormEntries` |
| **IPAT** (Innovations Performance Assessment Tool) | Competency (CBC) + Job Function (JF) multi-rater assessment | `IPATRecords`, `IPATCBCRatings`, `IPATJFRatings`, `IPATEdap`, `IPATRaterAssignments` |

IPAT's **FPO** component score is pulled from the linked IPCRF's `finalNumericalRating`.

---

## 2. Architecture in one picture

```
Browser (Vue 3 SPA on Vercel)
   │  fetch POST  {route, _method, token, ...payload}   ← JSON body, never query string
   ▼
/api/gas   (Vercel serverless proxy — vue-frontend/api/gas.js)
   │  same-origin so GAS CORS never applies; origin-allowlisted
   ▼
Google Apps Script Web App  /exec   (doGet/doPost → Code.gs handleRequest)
   │  verify Firebase token → rate limit → Router.dispatch
   ▼
Google Sheets  (the database, one spreadsheet, ~25 tabs)
   +  Google Drive (MOV evidence files, generated Docs/PDFs)
```

- **Identity:** Firebase Auth (email/password + Google SSO). Sign-in restricted to `dswd.gov.ph` (`VITE_ALLOWED_EMAIL_DOMAIN` / GAS script property `ALLOWED_EMAIL_DOMAIN`).
- **Authorization + user records:** the `Users` sheet, not Firebase claims.
- **No SQL, no ORM.** Every read is "load the sheet, map rows to objects by header name."

Local dev uses a Vite proxy at `/gas` instead of `/api/gas` (see `vue-frontend/vite.config.js`).

---

## 3. Repo layout

```
stb-pmes/
├─ package.json                  ← only script: deploy:check
├─ docs/                         ← all project markdown lives here
│   ├─ PMES_OPERATING_RULES.md   binding rules: fonts, deploy, secrets, CORS
│   ├─ PMES_SYSTEM_BRIEF.md      this file — full system handoff
│   ├─ EVALUATION_TOOL_BUILD_SPEC.md   spec for the standalone STB-PET eval tool
│   └─ IPAT_ONLY_MIGRATION_NOTES.md    migration policy for the eval tool
├─ apps-script/                  ← the backend (~7.8k lines of .gs)
│   ├─ Code.gs                   entry point, SHEET name constants, rate limiter, respond()
│   ├─ Router.gs                 the whole API surface — read this first
│   ├─ AuthService.gs            token verification, ROLE_GROUPS, GROUP_PERMISSIONS
│   ├─ FirebaseAuthService.gs    RS256 verification via Identity Toolkit accounts:lookup
│   ├─ SpreadsheetService.gs     generic row CRUD, paginate, filter, generateId
│   ├─ UsersService.gs           user CRUD, self-register, activate/decline, reset-password
│   ├─ IPCRFService.gs           largest file (1.2k) — form lifecycle, entries, review routing
│   ├─ IPATService.gs            CBC/JF/FPO scoring, EDAP
│   ├─ IPATRaterAssignmentService.gs   auto-generates who rates whom per period
│   ├─ FocalAssignmentService.gs bureau/division focal persons (review routing)
│   ├─ AssessmentCategoryService.gs / AssessmentContentService.gs   question bank + versioning
│   ├─ KraLibraryService.gs      MasterKRALibrary CRUD
│   ├─ AccomplishmentsService.gs / MovService.gs / DashboardService.gs
│   ├─ AuditNotificationsService.gs    AuditService + NotificationsService live here together
│   ├─ DocGenService.gs          exposed as global `PmesDocGenService` — Docs/PDF generation
│   ├─ DatabaseMaintenanceService.gs   destructive: reset, normalize columns, fresh rebuild
│   ├─ InitSheets.gs / InitIPATSheets.gs / InitMasterKRAs.gs   one-time schema creators
│   └─ appsscript.json
└─ vue-frontend/
    ├─ api/gas.js                Vercel serverless proxy (the only server-side JS)
    ├─ vite.config.js            @ alias + /gas dev proxy
    ├─ vercel.json               SPA rewrite
    └─ src/
        ├─ services/api.js       ALL backend calls live here, grouped per resource
        ├─ stores/               Pinia: auth, users, kra, accomplishments, mov, dashboard, notifications
        ├─ router/index.js       routes + auth guard + open-redirect strip
        ├─ composables/usePermissions.js   role/permission computeds used by every view
        ├─ layouts/              AppLayout (nav, notification bell), AuthLayout
        ├─ views/                16 views — one per module
        ├─ components/           accomplishments/, common/, dashboard/ populated; others empty
        └─ assets/fonts.css      the ONLY global stylesheet (main.css is deliberately NOT imported)
```

---

## 4. The request contract — read this before touching any API code

**Frontend** (`vue-frontend/src/services/api.js`): there is exactly one transport.

```js
async function gasSend(method, route, data = {}) {
  const token = await getToken()                       // Firebase ID token
  const res = await fetch(BASE_URL, {
    method: 'POST',                                    // always POST
    body: JSON.stringify({ route, _method: method, token: token || '', ...data })
  })
  return parseApiResponse(res)                         // unwraps {success, data, message}
}
const gasGet   = (route, params) => gasSend('GET', route, params)
const gasWrite = (method, route, body) => gasSend(method, route, body)
```

`_method` carries the *logical* verb (GET/POST/PUT/PATCH/DELETE). The wire method is always POST.
Token and payload **never** go in the URL — that was a deliberate hardening change.

**Backend** (`apps-script/Code.gs`):

1. Parse JSON body (query params still honored as legacy fallback).
2. `AuthService.verifyToken(token)` → `null` means `401`.
3. `checkRateLimit(user.uid)` — 60 req/min/user via `CacheService` (GAS can't see client IP).
4. Merge query + body minus `['route','_method','token']` → passed as **both** `params` and `body` to the router.
5. `Router.dispatch(route, httpMethod, params, params, user)`.
6. Always HTTP 200 with `{success, data, message}`; the real status rides in the JSON. 5xx messages are scrubbed to a generic string.

**Errors:** `throw HttpError('message', 404)`. Codes ≥500 are replaced with a generic message client-side; <500 messages pass through verbatim, so write them for end users.

> ⚠️ **curl cannot test this.** POST → 302 → GET redirect drops the body. Test from a browser context.

### Route shape

`Router.gs` splits on `/`: `resource/id/sub/subId`. `id` may be a real record id *or* an action word (`me`, `read-all`, `export`, `seed`, `review-queue`).

Resources: `auth`, `dashboard`, `users`, `focal-assignments`, `kra-library`, `assessment-categories`, `assessment-content`, `accomplishments`, `mov`, `notifications`, `audit`, `maintenance`, `ipcrf`, `ipat`, `ipat-assignments`, `docgen`.

Deliberately **501-guarded, not implemented**: `kras` (use `kra-library`), `reports`, `deadlines`.
Note `api.js` still exports a `kraApi` hitting `kras/*` — those calls will 501.

---

## 5. Roles & permissions

Defined in `apps-script/AuthService.gs`, mirrored in `vue-frontend/src/composables/usePermissions.js`.

**Roles → groups:**

| Role | Groups |
|---|---|
| System Administrator | `system-admin` |
| Bureau Director | `bureau-monitor`, `library-manager`, `evaluation-manager` |
| Assistant Bureau Director | same as Bureau Director |
| Division Chief | `division-monitor` |
| Section Head | — |
| Staff | — |

**Groups → permissions:** `manage_users`, `manage_focal_assignments`, `manage_libraries`, `manage_assessment_content`, `generate_ipat_assignments`, `view_bureau_monitoring`, `view_division_monitoring`, `view_audit`, `manage_database`.

Effective permissions = role's group permissions ∪ per-user `permissionGroups` ∪ per-user `permissions` (both stored as delimited strings on the `Users` row). Unassigned groups (`user-manager`, `database-manager`) exist for direct per-user grants.

**Division scoping:** anyone without `view_bureau_monitoring` is scoped to their own `divisionId`. Single-record getters (`UsersService.get`, `MovService.get`) enforce the same scope as their `list()` — keep it that way when adding new ones.

---

## 6. Data model — Google Sheets

One spreadsheet, id in GAS script property `SPREADSHEET_ID`. Tab names are constants in `Code.gs` → `SHEET`.

`SpreadsheetService` conventions that apply to **every** sheet:

- Row 1 is headers; object keys map 1:1 to header text.
- Every row needs an `id` — `getAllRows()` silently drops rows without one.
- `generateId(prefix)` = prefix + 12 hex chars from a UUID.
- `'TRUE'`/`'FALSE'` strings are normalized to booleans on read.
- `updateRow()` writes cell-by-cell and **logs but does not fail** on unknown columns — a field can look saved in the response yet never hit the sheet. If a write "doesn't stick," check the header exists.
- `softDelete()` sets `deleted`/`deletedAt`; `hardDeleteRow()` physically removes the row.

**Key tabs and their columns** (abridged — full lists in `InitSheets.gs` / `InitIPATSheets.gs`):

- **Users** — `id, uid, email, fullName, role, divisionId, divisionName, section, position, employeeNo, type, positionLevel, sgLevel, tempPassword, tempPasswordHash, mustChangePassword, permissionGroups, permissions, active, createdAt, updatedAt, lastLoginAt`
- **Divisions** — seeded with `admin-pool`, `dfd` (Design Formulation), `pid` (Pilot Implementation), and others.
- **IPCRForms** — identity + `semester, year, status`, function weights, `finalNumericalRating`, `adjectivalRating`, signatories/dates, feedback fields, dual review-routing blocks (`targetReviewStage/targetRoutedToUserId/...` and `ratingReviewStage/...`), doc-gen timestamps (`docFileId, targetsGeneratedAt, s1RatingsGeneratedAt, s2RatingsGeneratedAt`).
- **FormEntries** — one row per target line: `masterKRAId, functionType, kraName, successIndicator, weight, classification`, E/Q/T guides, `meansOfVerification`, `accomplishment`, `ratingEfficiency/Quality/Timeliness/Average`, `movReferences`, `isCustom`, `order`.
- **Accomplishments** — mirrors form entries for the standalone accomplishments module; links back via `formId`/`entryId`.
- **MOVFiles** — Drive evidence: `driveFileId, driveUrl, fileName, mimeType, sizeBytes`, links to accomplishment/kra/si/division, `verified`.
- **IPATRecords** — `rateeId, semester, year, hasSubordinate, status, cbcScore, fpoScore, jfScore, overallScore, descriptor, ipcrfFormId`.
- **IPATRaterAssignments** — `rateeId/raterId/raterType`, `status`, per semester+year.
- **AssessmentContent** — versioned question bank: `domain, category, questionText, guidanceText, sequence, scaleType, applicableRaters, applicableLevels, status, period, version, hasBeenUsed, changeNotes`.
- **AuditLog**, **Notifications**, **ReviewComments**, **FocalAssignments**, **Revisions**, **Evaluations**.
- Present in `InitSheets.gs` but not wired to live routes: `JRBRatings`, `PeerAssignments`, `AttendanceRecords`, `AttendanceRatings`, `Reports`, `Deadlines`.

`initializeSheets()` is **additive** — it creates missing tabs and appends missing columns without touching data. Safe to re-run.

---

## 7. Business logic worth knowing

### IPCRF status flow (`IPCRFService.gs`)

```
Draft ──► Submitted ──► Approved ──► Rated ──► Finalized
  ▲           │             │
  └─ Returned ┘◄────────────┘
```

`_assertTransition` enforces `STATUS_FLOW`. Edits to entries are only allowed in `Draft` or `Returned`.
Two independent review passes over the same form: **targets** review (while `Submitted`) and **ratings** review (once `Approved`/`Rated`), each with its own routing columns.

**Review routing chain:** `Division Focal → Bureau Focal → Division Chief → Completed`.
Who qualifies is resolved through `FocalAssignmentService.isDivisionFocal/isBureauFocal`, plus a Division Chief matched on `divisionId`. `ipcrf/review-queue` filters by `reviewType`.

### IPAT scoring (`IPATService.gs`)

```
overall = (CBC×0.30 + FPO×0.55 + JF×0.15) / (sum of weights actually present)
```

Missing components are excluded and the remaining weights are **renormalized** — a record with only CBC and FPO still produces a valid score. `qualitativeDescriptor(overall)` maps the number to its adjectival label. FPO comes from the linked IPCRF (`sync-fpo`) or is manually encoded (`set-fpo`).

### Ratings input

Efficiency / Quality / Timeliness are **1–5, decimals allowed**, clamped on both frontend and backend. Invalid input flashes red and auto-clears in the UI.

### Document generation

`DocGenService.gs` is exposed globally as **`PmesDocGenService`** (not `DocGenService`). Generates Targets and Ratings docs into Drive, records `docFileId`, and regenerates automatically when a reviewer edits an entry. Ratings docs are semester-filtered. `docgen/{fileId}/print` exports PDF.

---

## 8. Frontend conventions

- **Pinia stores** hold state; **views** call stores; only `services/api.js` calls the network. Don't `fetch` from a component.
- **`usePermissions()`** is the single source of UI gating — `isAdmin`, `canApprove`, `canManageUsers`, `canManageLibraries`, `canViewAllDivisions`, `divisionScope`, etc. Add new capabilities there, not inline in views.
- **Router guard** (`router/index.js`): strips non-relative `?redirect` values (open-redirect defense), then `login → register → pending → dashboard` based on `auth.needsRegistration` / `auth.needsActivation`.
- **`mustChangePassword`**: backend issues a SHA-256+salt hashed temp password; `PasswordChangePrompt.vue` is non-skippable (`force` prop) until Firebase `updatePassword` succeeds and the flag is cleared via API.
- **Toasts** via `vue-toastification`; charts via `vue-chartjs`; dates via `dayjs`.
- Stack: Vue 3 + Vite 8 + Pinia 2 + Tailwind 3.

### 🚫 The font rule (non-negotiable)

`vue-frontend/src/assets/fonts.css` sets the stack once on `html, body, #app` and then forces `*:not(html):not(body):not(svg):not(svg *) { font-family: inherit }`.

- **Never write `font-family` in any new CSS.** Not in wrappers, modals, buttons, or inputs.
- Exceptions: monospace for passwords/code/formulas; `LoginView.vue` (own design); SVG `<text>` inline attributes.
- If you type `-apple-system` or `BlinkMacSystemFont` outside `fonts.css` — delete it.
- `src/assets/main.css` is **not imported** and must not be imported wholesale (carries Tailwind preflight the UI was never built against).

---

## 9. Deployment

### Backend — Google Apps Script via clasp

**Always reuse the existing deployment ID. Creating a new one changes the web app URL and breaks the live system.**

```bash
npx.cmd @google/clasp deployments
```

```bash
npx.cmd @google/clasp push --force
```

```bash
npx.cmd @google/clasp deploy --deploymentId "<EXISTING_DEPLOYMENT_ID>" --description "PMES_v{N}"
```

`{N}` must match the clasp version number assigned by that deploy. Check `deployments` before *and* after — clasp's counter can skip ahead; fix the description to match reality. Deployment id is stored in the project memory, not in this file.

**Every Apps Script change is incomplete until pushed and deployed.**

### Frontend — Vercel

```bash
npm run deploy:check
```

Runs `npm audit --prefix vue-frontend --audit-level=high` then `npm run build --prefix vue-frontend`. Patch high-severity issues first. **Build or smoke-test fails → do not deploy.** Project: `stb-pmes` → `stb-pmes.vercel.app`.

### Environment

| Where | Variables |
|---|---|
| Vite (client) | `VITE_FIREBASE_*`, `VITE_ALLOWED_EMAIL_DOMAIN`, `VITE_API_BASE_URL`, `VITE_API_PROXY_URL`, `VITE_APP_NAME`, `VITE_APP_BUREAU` |
| Vercel (server) | `GAS_WEB_APP_URL` (validated against `^https://script\.google\.com/macros/s/[^/]+/exec$`), `PMES_ALLOWED_ORIGINS` |
| GAS script properties | `SPREADSHEET_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `ALLOWED_EMAIL_DOMAIN` |

---

## 10. Security rules — these are hard constraints

1. **Token verification is authoritative.** `AuthService.verifyToken` does cheap structural pre-checks (exp/aud/iss/domain) then confirms the RS256 signature via `FirebaseAuthService.verifyIdToken` → Identity Toolkit `accounts:lookup`, cached 5 min. **Never revert to base64-decode-only** — that was a critical auth bypass that accepted forged admin tokens.
2. **No secrets client-side.** All secrets live in GAS Script Properties or Vercel server env. Never in `public/`, frontend JS, HTML, or CSS. `.env.example` holds names only. (Firebase web API keys are not secrets — those are fine.)
3. **No wildcard CORS.** `api/gas.js` allowlists origins from `PMES_ALLOWED_ORIGINS` + own origin + `VERCEL_URL`; unknown origin → 403.
4. **Errors:** log detail server-side (`Logger.log`) only. Never surface stack traces, raw exceptions, secrets, tokens, spreadsheet ids, or deployment URLs to the browser. User-facing messages say what to do next.
5. **Redirects:** relative paths only, allowlisted. Never accept a user-controlled redirect target.
6. **Auth failures must not reveal whether an email exists.** Log failed attempts privately.
7. **Drive sharing:** MOV uploads use `DOMAIN_WITH_LINK` (fall back to link-off outside Workspace), never `ANYONE_WITH_LINK`.
8. **Rate limiting** is per authenticated user (60/min). Auth-adjacent routes target ≤5 attempts/min.

---

## 11. Gotchas that will cost you an hour

| Symptom | Cause |
|---|---|
| Field "saves" but is empty in the sheet | Column missing from row 1 — `updateRow` logs a warning and moves on. Run `initializeSheets()`. |
| `curl` gets an empty/odd response | POST→302→GET redirect drops the body. Test from a browser. |
| `kras/*` or `reports/*` returns 501 | Intentional guards. Use `kra-library`; reports/deadlines aren't built. |
| `DocGenService.foo is not a function` | The global is `PmesDocGenService`. |
| Row vanishes from a list | No `id` value → `getAllRows()` filters it out. |
| Frontend change works locally, breaks on Vercel | Dev proxies `/gas` via Vite; prod goes through `/api/gas`. Check `GAS_WEB_APP_URL` and `PMES_ALLOWED_ORIGINS`. |
| Backend fix "didn't apply" | You pushed but didn't deploy — or deployed to a new id. |
| Font looks wrong in a new component | Someone added `font-family`. Remove it. |

---

## 12. Module status

**Complete:** Firebase auth (email + Google SSO), mustChangePassword flow, notifications (backend + bell UI + mark-read), users management incl. reset-password, KRA library, focal assignments, assessment categories/content with versioning, IPAT (CBC/JF/FPO/EDAP + rater assignment generation), doc generation (targets + semester-filtered ratings, PDF export), audit log, database maintenance.

**Largely built:** IPCRF/CCEF — create, entries, submit, route, approve, return, rate, finalize, review comments, compute score.

**Views present:** Dashboard, IPCRF, Review, KRA, Accomplishments, MOV, Reports, Evaluation, Audit, Users, Profile, Login, Register, Pending, Unauthorized, NotFound.

**Not implemented:** `reports/*` and `deadlines/*` backend routes (501-guarded). `components/audit|evaluation|kra|mov|reports|users` directories are empty — those views are self-contained.

**Planned:** a standalone IPAT-only assessment app on a separate spreadsheet, schema-compatible for later migration into full PMES (`docs/IPAT_ONLY_MIGRATION_NOTES.md`). Rule: a populated `fpoScore` with blank `ipcrfFormId` = manually encoded or legacy migrated, and is valid.

---

## 13. Working agreement for agents

1. Read `Router.gs` before adding any endpoint — it is the complete API contract.
2. Add a new backend call in **three** places: `Router.gs` case → service function → `services/api.js` export.
3. Adding a column? Add it to `InitSheets.gs` **and** re-run `initializeSheets()`, or writes silently no-op.
4. New sheet reads go through `SpreadsheetService`, never raw `SpreadsheetApp`.
5. New permission checks go in `AuthService` groups + `usePermissions.js` — never hardcode a role string in a view.
6. Never add `font-family`.
7. Never create a new GAS deployment.
8. Run `npm run deploy:check` before any frontend deploy; push **and** deploy after any `.gs` change.
9. `DatabaseMaintenanceService` routes are destructive — always call the GET preview first and require explicit confirmation.
