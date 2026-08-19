# PMES — Cluster-Wide Readiness Assessment

> 2026-08-07 update: A local-only implementation slice has started on
> `feature/multi-office-assessment-scope`. The first slice adds protected
> office-registry/provisioning/schema-validation code and a central admin UI
> shell. No Vercel deployment has been performed, and live Google Apps Script,
> Google Drive, spreadsheet-permission, and concurrent-user verification remain
> pending.

**System:** Performance Management and Evaluation System (PMES)
**Origin:** DSWD Social Technology Bureau (STB)
**Expanded scope:** All offices under the Innovation Cluster, per the Undersecretary's directive
**Assessment date:** 4 August 2026
**Basis:** Direct read of the repository at `stb-pmes` — 27 Apps Script files (~8.9k lines), 16 Vue views (~14.9k lines), 28 spreadsheet tabs. Every claim below cites a file and line. Nothing is inferred from documentation alone.

**Status of this document:** This is the *starting output* — items 1–7 of the requested review. Sections A–M (full file-by-file, sheet-by-sheet, data dictionary, test cases, migration plan) follow from this baseline and are scoped in §7.

---

## 1. Current architecture

### 1.1 Runtime topology

```
Browser — Vue 3 SPA (Vite 8, Pinia 2, Tailwind 3) on Vercel
   │
   │  POST { route, _method, token, ...payload }   ← always POST, JSON body
   │  Token and payload never appear in the URL (deliberate hardening)
   ▼
/api/gas — Vercel serverless proxy (vue-frontend/api/gas.js)
   │  Same-origin, so Apps Script CORS never applies
   │  Origin allowlist from PMES_ALLOWED_ORIGINS; unknown origin → 403
   ▼
Google Apps Script Web App /exec
   │  doGet/doPost → handleRequest (Code.gs:66)
   │  1. parse JSON body   2. AuthService.verifyToken   3. rate limit
   │  4. strip reserved keys   5. Router.dispatch
   ▼
Google Sheets — one spreadsheet, 28 tabs, addressed by SPREADSHEET_ID
Google Drive — MOV evidence files, generated Docs/PDFs, exported reports
Firebase Auth — identity only (email/password + Google SSO)
```

### 1.2 Authentication flow

1. Browser authenticates against Firebase; obtains an ID token.
2. Token travels in the POST body to the Vercel proxy, then to Apps Script.
3. `AuthService.verifyToken` ([AuthService.gs:54](../apps-script/AuthService.gs)) performs cheap structural pre-checks — `exp`, `iat` skew, `aud`, `iss`, email domain — then the security-critical step: RS256 signature verification via `FirebaseAuthService.verifyIdToken` (Identity Toolkit `accounts:lookup`). The verified result is cached 5 minutes keyed on a SHA-256 digest of the token.
4. The domain check is re-applied against Google's authoritative email, not the token claim ([AuthService.gs:98](../apps-script/AuthService.gs)).

This is correct. The code comments record that an earlier base64-decode-only implementation was a critical auth bypass. **That must never be reverted.**

### 1.3 Authorization model

Identity comes from Firebase; **authorization comes from the `Users` sheet**, not from Firebase custom claims.

- `ROLE_GROUPS` maps 6 roles → groups ([AuthService.gs:5](../apps-script/AuthService.gs))
- `GROUP_PERMISSIONS` maps 7 groups → 9 permissions ([AuthService.gs:13](../apps-script/AuthService.gs))
- Effective access = role's group permissions ∪ per-user `permissionGroups` ∪ per-user `permissions` (delimited strings on the user row)
- Data scoping: anyone lacking `view_bureau_monitoring` is filtered to their own `divisionId` (`DashboardService.applyScope`, [DashboardService.gs:108](../apps-script/DashboardService.gs))

### 1.4 Data flow — user action to storage

Worked example, a rater submitting IPAT ratings:

| # | Layer | What happens |
|---|---|---|
| 1 | `EvaluationView.vue` | Rater fills the 1–4 Likert form |
| 2 | `services/api.js:262` | `ipatAssignmentApi.submitRatings(id, data)` → `gasWrite('POST', 'ipat-assignments/{id}/submit-ratings')`; ratings are JSON-stringified into the body |
| 3 | `api/gas.js` | Origin checked, body forwarded verbatim to the GAS `/exec` URL |
| 4 | `Code.gs:66` | Body parsed, token verified, rate limit applied, reserved keys stripped |
| 5 | `Router.gs:226` | Dispatched to `IPATRaterAssignmentService.submitAssignmentRatings` |
| 6 | `IPATRaterAssignmentService.gs:523` | Verifies caller is the assigned rater (or an admin), that the assignment is not obsolete, and that an IPAT record is linked |
| 7 | `IPATService.saveCBCRatings` / `saveJFRatings` | Upsert keyed on `ipatId\|raterId\|themeId\|indicatorIdx` — re-submission overwrites rather than duplicating |
| 8 | `completeAssignmentFromRows` | Marks the assignment `Completed`; when every assignment for the record is complete, auto-runs `computeCBC` → `computeJF` → `computeOverall` |
| 9 | Sheets | Rows written to `IPATCBCRatings` / `IPATJFRatings`; scores written to `IPATRecords`; an `AuditLog` row is appended |

### 1.5 Rating computation

**Per-indicator CBC score** ([IPATService.gs:630](../apps-script/IPATService.gs)) — weights applied per rater type, then divided by the weight actually present:

| Rater type | Weight | Notes |
|---|---|---|
| Self | 0.15 | |
| Supervisor | 0.30 | |
| SkipSupervisor | 0.25 | |
| Peer1 / Peer2 | 0.15 each | staff without subordinates |
| Peer (legacy single) | 0.30 | fallback path |
| Peer / Subordinate | 0.15 each | ratees with subordinates |

**Overall** ([IPATService.gs:973](../apps-script/IPATService.gs)): `(CBC × 0.30) + (FPO × 0.55) + (JF × 0.15)`, divided by the sum of weights actually present. Missing components are excluded and the remainder renormalized, so a record with only CBC and FPO still yields a valid score. FPO is pulled from the linked IPCRF's `finalNumericalRating` (`sync-fpo`) or encoded manually (`set-fpo`).

**Every one of these weights is a numeric literal in code.** See risk R2.

### 1.6 API surface

`Router.gs` is the complete contract — 16 resources, split on `/` into `resource/id/sub/subId` where `id` may be a record id *or* an action word (`me`, `read-all`, `generate`, `review-queue`).

`auth`, `dashboard`, `users`, `system-settings`, `focal-assignments`, `kra-library`, `assessment-categories`, `assessment-content`, `accomplishments`, `mov`, `reports`, `notifications`, `audit`, `maintenance`, `ipcrf`, `ipat`, `ipat-assignments`, `docgen`.

Every response is HTTP 200; the real status rides inside `{success, data, message}` ([Code.gs:130](../apps-script/Code.gs)). Codes ≥500 are scrubbed to a generic message; codes <500 pass through verbatim and are written for end users.

---

## 2. Original scope versus the expanded direction

### 2.1 What was built, and whether it was the right call

The confirmed scope at design time was **one bureau, one organizational structure, one spreadsheet**. The chosen stack — Vercel + Apps Script + Sheets — delivered:

- No infrastructure procurement, no server provisioning, no DBA
- Google Workspace identity the personnel already had
- A spreadsheet the protocol owners could read and audit directly
- Fast iteration against a protocol still being validated

**This was an appropriate engineering decision for the stated scope, and it was vindicated in practice** — the system was piloted, operationally used, and validated within STB, and it produced the organizational structure, rating relationships and assessment criteria the protocol now relies on. PMES should be treated as an STB-validated reference implementation. Nothing in this assessment should be read as a criticism of that choice.

### 2.2 What changed

The directive to adopt PMES across the Innovation Cluster introduces four requirements the original scope never had to satisfy:

| New requirement | Consequence |
|---|---|
| **Multiple offices** | Every operational record needs an office identifier. There is currently **no office dimension anywhere in the system** (verified: zero occurrences of `officeId`/`office_id`/`agencyId` across all `.gs`, `.js` and `.vue` files). `divisionId` is the widest scoping key and it is bureau-internal. |
| **Multiple organizational structures** | The rater-assignment engine hard-codes STB's hierarchy: Bureau Director → ABD → Division Chief → Section Head → Staff ([IPATRaterAssignmentService.gs:38](../apps-script/IPATRaterAssignmentService.gs)). Offices with different position ladders cannot be represented. |
| **Maintenance by other ICT personnel** | Some are PHP/MySQL practitioners. Apps Script and Sheets-as-database are unfamiliar, have no local development story, no schema migrations, and no test harness. |
| **Cluster-level consolidated reporting** | Requires aggregation across offices, which requires office-level segregation to exist first. |

### 2.3 The distinction that matters

Most of what follows is **not defects**. Sorting the findings honestly:

- **Defects in the existing implementation** — R6, R7, R9, plus the two fixed today
- **Technical debt** — R8, R10
- **Limitations of the original STB-specific scope** — R1, R2, R3 (correct decisions then, blocking now)
- **Requirements introduced by cluster-wide adoption** — R1, R2, R4
- **Security and privacy requirements** — R4, R5

---

## 3. Ten highest-priority technical risks

Ranked by the product of likelihood and consequence for cluster-wide operation. "Blocks cluster use" means the risk must be closed before a second office is onboarded, not merely before final production approval.

### R1 — No office dimension in the data model
**Severity: Critical · Blocks cluster use: Yes · Class: Scope limitation**

No sheet carries an office identifier. `divisionId` is the widest available scope and it is bureau-internal — `dfd`, `pid`, `staed`, `admin-pool`. The moment a second office's personnel are entered into the `Users` sheet:

- Rater pools mix across offices. `_assignForABD` selects the supervisor as `allUsers.find(u => isDirector(u.role))` ([IPATRaterAssignmentService.gs:248](../apps-script/IPATRaterAssignmentService.gs)) — the *first* Bureau Director in the entire user list, with no office filter. Another office's ABD would be assigned STB's Director as their supervisor.
- Division-level scoping (`r.divisionId === profile.divisionId`) silently becomes cross-office data exposure if two offices ever use the same division code.
- Cluster-level consolidated reporting is impossible because there is nothing to group by.

**Remediation:** Introduce an `Offices` entity and add `officeId` to `Users`, `Divisions`, `IPCRForms`, `Accomplishments`, `MOVFiles`, `IPATRecords`, `IPATRaterAssignments`, `AuditLog`, `Reports`. Add an office filter to every rater-pool query and every scoping helper. **Test:** create two offices with identical division codes, generate assignments in both, assert zero cross-office rater assignments and zero cross-office rows in each office's report.

### R2 — Assessment rules are code literals, not configuration
**Severity: Critical · Blocks cluster use: Yes · Class: Scope limitation**

Hard-coded across the backend:

| Rule | Location |
|---|---|
| Domain weights 0.30 / 0.55 / 0.15 | [IPATService.gs:211](../apps-script/IPATService.gs), [:973](../apps-script/IPATService.gs) — duplicated in two places |
| Rater weights 0.15 / 0.30 / 0.25 | [IPATService.gs:632](../apps-script/IPATService.gs) |
| Descriptor bands | `qualitativeDescriptor`, [IPATService.gs:322](../apps-script/IPATService.gs) |
| Position hierarchy and rater applicability | [IPATRaterAssignmentService.gs:38](../apps-script/IPATRaterAssignmentService.gs) |
| Peer2 70/30 section-vs-division split | [IPATRaterAssignmentService.gs:161](../apps-script/IPATRaterAssignmentService.gs) |
| Division seed list | [InitSheets.gs:209](../apps-script/InitSheets.gs) |
| `admin-pool` division id in approval scoping | [AccomplishmentsService.gs:244](../apps-script/AccomplishmentsService.gs), [:263](../apps-script/AccomplishmentsService.gs) |
| `dswd.gov.ph` domain default | [AuthService.gs:4](../apps-script/AuthService.gs) |

Any office needing a different weighting, position ladder, or descriptor band requires a code change and redeployment by whoever holds the Apps Script project. That is not sustainable across a cluster.

Note the duplication in particular: the domain weights appear in `calculateOverall` **and** in `computeOverall`. Changing one and not the other produces two different overall scores depending on the code path taken.

**Remediation:** Move to configuration entities — `RatingWeightRules`, `RaterTypes`, `PositionHierarchy`, `AssessmentPeriods` — keyed by `officeId` with a cluster-level default. Read weights once from a single resolver. **Test:** configure two offices with different weights, submit identical ratings, assert different and independently correct overall scores.

### R3 — Google Sheets is a ceiling, not a database
**Severity: High · Blocks cluster use: Interim acceptable, permanent no · Class: Scope limitation**

Concretely, at cluster scale:

- **No transactions.** `updateRow` writes cell-by-cell in a loop ([SpreadsheetService.gs:76](../apps-script/SpreadsheetService.gs)). An execution timeout mid-loop leaves a partially-updated row with no rollback.
- **No concurrency control.** `LockService` appears exactly once in the entire backend (in `IPCRFService.gs`). Every IPAT rating write, score computation and assignment update is unguarded. Two raters submitting simultaneously for the same ratee can interleave read-modify-write on `IPATRecords`.
- **No constraints.** Duplicate IPAT records for the same ratee/semester/year are possible — and demonstrably occur, which is why `_findCanonicalIpatRecord` and `_recordScore` exist ([IPATRaterAssignmentService.gs:72](../apps-script/IPATRaterAssignmentService.gs)) to pick a "winner" among duplicates at read time. That is a workaround for a missing unique constraint.
- **Full-scan reads.** `getAllRows` loads the entire sheet into memory for every query. Cost grows linearly with total historical records, and Apps Script has a 6-minute execution limit and a 10M-cell spreadsheet limit.
- **Silent write failures.** `updateRow` logs a warning and continues when a column is missing ([SpreadsheetService.gs:64](../apps-script/SpreadsheetService.gs)) — the API response reports success while the value never reaches the sheet.

**Acceptable** for the current controlled STB implementation and for an interim transition period with a known user count. **Unsuitable** for permanent cluster-wide production.

### R4 — Personal data has no retention, disposal, or minimization controls
**Severity: High · Blocks cluster use: Yes · Class: Privacy requirement**

The system processes personal and sensitive personnel information: names, positions, employee numbers, salary grades, division assignments, performance ratings from five rater perspectives, free-text feedback, uploaded evidence files, and complete activity logs.

Against the Data Privacy Act principles:

| Principle | Status |
|---|---|
| Transparency | **Absent** — no privacy notice anywhere in the application |
| Legitimate purpose | Documented in the protocol, not in the system |
| Proportionality / minimization | **Gap** — `tempPassword` is a column on the `Users` sheet ([InitSheets.gs:10](../apps-script/InitSheets.gs)) alongside `tempPasswordHash`; a plaintext temporary password should not persist |
| Retention and disposal | **Absent** — no retention field, no disposal procedure, no archival policy on any sheet |
| Data-subject rights | **Absent** — no access, correction, or erasure mechanism |
| Breach management | **Absent** — no incident-response procedure |
| Accountability | Partial — audit log exists; `ipAddress` is always empty because Apps Script cannot read client IP ([AuditNotificationsService.gs:20](../apps-script/AuditNotificationsService.gs)) |

A Privacy Impact Assessment is required before cluster-wide processing. Rater confidentiality deserves specific attention: `IPATCBCRatings` stores `raterId` and `raterName` against every individual rating, so anyone with spreadsheet access can attribute any rating to any rater.

### R5 — Spreadsheet and Drive access is outside application control
**Severity: High · Blocks cluster use: Yes · Class: Security requirement**

Application-layer authorization is sound. It is also bypassable: anyone with Google Drive access to the underlying spreadsheet reads and writes every record — all ratings, all personnel data, all audit entries — with no application logging and no role check. As offices are onboarded, the number of people holding Workspace access to that file grows.

**Remediation before onboarding:** enumerate and document every account with Drive access to the spreadsheet and the MOV folder; remove all direct human access except a named data owner and a break-glass account; restrict download/copy/print via Workspace policy; schedule quarterly access review. **Test:** a non-owner account must not be able to open the spreadsheet by URL.

### R6 — Submitted ratings could be silently overwritten
**Severity: High · Blocks cluster use: Fixed pending deploy · Class: Defect**

Earlier review found that `submitAssignmentRatings` checked that the assignment existed, was not obsolete, belonged to the caller, and had a linked IPAT record, but did not check whether the assignment was already `Completed`. Because `saveCBCRatings` upserts on `ipatId|raterId|themeId|indicatorIdx`, a rater or administrator could resubmit after completion and overwrite finalized ratings.

**Fix applied:** `submitAssignmentRatings` now rejects completed assignments with 409, rating writes run under a script lock, and the frontend shows completed assignments as `Submitted` with the button disabled. This prevents silent overwrite.

**Remaining policy gap:** the system still has no formal correction or reopening workflow. If corrections are allowed, add a permissioned reopen action plus a `RatingRevisions` record capturing prior values, actor, reason and approval.

### R7 — Administrative period reset is unreachable
**Severity: Medium · Blocks cluster use: No · Class: Defect**

`IPATRaterAssignmentService.deleteForPeriod` is fully implemented, permission-guarded to System Administrator, audited — and **has no route in `Router.gs`**. It cannot be invoked from the application at all. An administrator who needs to regenerate a period's assignments after a structural correction has no supported path and must edit the spreadsheet by hand. Hand-editing is exactly what the audit log cannot capture.

**Remediation:** add `if (id === 'reset-period' && method === 'POST')` to the `ipat-assignments` case, with the same GET-preview-then-POST-confirm pattern `DatabaseMaintenanceService` already uses for destructive operations.

### R8 — Six frontend API clients call endpoints that do not exist
**Severity: Medium · Blocks cluster use: No · Class: Technical debt**

| Client | Route | Result | Reached by UI? |
|---|---|---|---|
| `reportsApi` | `reports/*` | **Fixed today** | Yes — `ReportsView.vue` |
| `kraApi` | `kras/*` | 501 | Via `stores/kra.js` |
| `evaluationApi` | `evaluations/*` | **404** — no router case | No |
| `attendanceApi` | `attendance/*` | **404** | No |
| `peerAssignmentApi` | `peer-assignments/*` | **404** | No |
| `deadlineApi` | `deadlines/*` | 501 | No |
| `ipcrfApi.listJrbRatings` | `ipcrf/{id}/jrb` | **404** | No |

Correspondingly, four sheets are created and maintained by `initializeSheets()` but wired to nothing: `JRBRatings`, `PeerAssignments`, `AttendanceRecords`, `AttendanceRatings` — plus `Evaluations` and `Deadlines`. A developer inheriting this codebase cannot distinguish "planned" from "abandoned" from "broken" without tracing each one, as this review had to.

**Remediation:** for each, decide *implement / remove / document as reserved* and record the decision in the known-issues register. Do not leave them ambiguous at turnover.

### R9 — Reads perform writes
**Severity: Medium · Blocks cluster use: No · Class: Defect**

`getMyResults` is a GET that computes and persists scores as a side effect ([IPATRaterAssignmentService.gs:588](../apps-script/IPATRaterAssignmentService.gs)); `getProfile` writes `lastLoginAt` and may persist a resolved `divisionId` on every single authenticated call ([AuthService.gs:151](../apps-script/AuthService.gs)) — and `getProfile` is called by nearly every service method. This multiplies write volume against Sheets quotas, makes GET requests non-idempotent, and means a ratee refreshing their results page triggers score recomputation.

**Remediation:** move computation to an explicit compute endpoint or a scheduled trigger; make `lastLoginAt` update on `auth/me` only.

### R10 — Deployment governance depends on one person's knowledge
**Severity: Medium · Blocks cluster use: Yes (for turnover) · Class: Technical debt**

The Apps Script deployment ID is deliberately not in the repository — it lives only in a personal memory file. Creating a new deployment changes the web app URL and breaks the live system. There is no branching strategy, no version tagging, no release process, no environment separation between development and production, and no rollback procedure. `npm run deploy:check` covers only the frontend.

There is also a personal email address hard-coded in a diagnostic function ([FirebaseAuthService.gs:278](../apps-script/FirebaseAuthService.gs)) — harmless in operation, but it is real personal data in source and it will be read as the system owner by whoever inherits the code.

---

## 4. Immediate orientation and turnover checklist

### 4.1 Must complete before the orientation and demonstration

- [ ] **Full backup** of the production spreadsheet, with the backup file id recorded (`clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS` already makes one — take a manual copy too)
- [ ] **Verify the Reports module end to end** in the live deployment — this was broken until today's fix and is a visible menu item a demo audience will click
- [ ] **Sanitized demonstration data** — do not demonstrate against real personnel ratings. Real names and real performance scores in front of a cluster audience is a privacy incident.
- [ ] **Confirm no secrets in the repository** — `.gitignore` covers `.env*`, `*service-account*.json`, `*firebase-adminsdk*.json`, `credentials*.json`; confirm none were committed before those rules existed (`git log --all --full-history -- '*.json'`)
- [ ] **Version tag** the current state (`git tag -a pmes-stb-v1.0`) so the demonstrated build is identifiable forever
- [ ] **Architecture diagram** — §1.1 of this document, rendered
- [ ] **Known-issues register** — R1–R10 with owner and target date; disclose them in the orientation rather than being asked
- [ ] **One-page technical summary** for non-technical attendees

### 4.2 Must complete immediately after turnover

- [ ] **Repository access** granted to the receiving ICT unit; confirm they can clone and build
- [ ] **Deployment ID, script id, spreadsheet id, Drive folder id** transferred through a documented channel — not chat, not email
- [ ] **Apps Script project ownership** transferred or co-owned; **Firebase project ownership** likewise
- [ ] **Configuration inventory** — every script property (`SPREADSHEET_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `ALLOWED_EMAIL_DOMAIN`, `DRIVE_ROOT_FOLDER_ID`) and every Vercel variable (`GAS_WEB_APP_URL`, `PMES_ALLOWED_ORIGINS`, `VITE_*`)
- [ ] **Developer handover guide** — the request contract, the three-places rule for adding an endpoint, the `initializeSheets()` requirement when adding a column, the font rule, the never-create-a-new-deployment rule
- [ ] **Rollback procedure**, written and rehearsed once
- [ ] **Access-permission review** — everyone with Drive access to the spreadsheet (R5)
- [ ] **Remove the hard-coded personal email** at [FirebaseAuthService.gs:278](../apps-script/FirebaseAuthService.gs)

### 4.3 Must complete before onboarding additional offices

- [ ] **R1 — office dimension** implemented and tested with two offices
- [ ] **R2 — weights, hierarchy and rater rules** moved to configuration
- [ ] **R6 — correction/reopening workflow** decided; submission locking is fixed pending deploy
- [ ] **R5 — spreadsheet access** locked down and reviewed
- [ ] **Office-level administrator role** added to `ROLE_GROUPS` / `GROUP_PERMISSIONS`
- [ ] **Revised data dictionary** (§D of the full review)
- [ ] **Migration plan** for existing STB data into the office-aware schema
- [ ] **User acceptance testing** by at least one non-STB office

### 4.4 Must complete before cluster-wide operational use

- [ ] **Privacy Impact Assessment** completed and approved
- [ ] **Privacy notice** presented in-application at registration
- [ ] **Retention and disposal schedule** approved and implemented
- [ ] **Backup and recovery** automated and restore-tested — not merely configured
- [ ] **Security review** by the ICT security function, findings closed
- [ ] **Concurrency controls** on all rating and score writes (R3)
- [ ] **Full test suite** executed and passing (§K of the full review)

### 4.5 Must complete before final production approval

- [ ] **Migration to a centralized relational backend** (§7, Phase 3)
- [ ] **Performance monitoring** and alerting
- [ ] **Disaster recovery** procedure tested
- [ ] **Long-term ICT ownership** formally assigned with a named system owner
- [ ] **Complete documentation set** — deployment, administrator, user, developer guides

---

## 5. Preliminary database inventory

28 tabs in one spreadsheet. Created by `initializeSheets()` ([InitSheets.gs](../apps-script/InitSheets.gs)), `initIPATSheets()` ([InitIPATSheets.gs](../apps-script/InitIPATSheets.gs)) and `initMasterKRALibrary()` ([InitMasterKRAs.gs](../apps-script/InitMasterKRAs.gs)). All three are additive — they create missing tabs and append missing columns without touching data, and are safe to re-run.

### 5.1 Core reference and identity

| Sheet | Cols | Purpose | Notes |
|---|---|---|---|
| `Users` | 22 | Personnel, roles, permissions | Authorization source of truth. Contains `tempPassword` **and** `tempPasswordHash` — see R4. No `officeId`. |
| `Divisions` | 9 | Organizational units | Seeded with four STB divisions ([InitSheets.gs:209](../apps-script/InitSheets.gs)). No office parent. |
| `SystemSettings` | 7 | Key/value configuration | Currently used only for access mode. The natural home for R2's configuration. |
| `MasterKRALibrary` | — | Reusable KRA definitions | Created by `InitMasterKRAs.gs` |

### 5.2 IPCRF / CCEF instrument

| Sheet | Cols | Purpose | Notes |
|---|---|---|---|
| `IPCRForms` | 48 | Form header, status, final rating | Widest sheet. Carries two independent review-routing blocks (`targetReview*`, `ratingReview*`) plus four doc-generation timestamps. |
| `FormEntries` | 24 | One row per target line | E/Q/T ratings and guides |
| `ReviewComments` | 9 | Reviewer comments per entry | |
| `Accomplishments` | 32 | Standalone accomplishments module | Mirrors `FormEntries`; links back via `formId`/`entryId` — see the duplication note in §6 |
| `Revisions` | 8 | Accomplishment status history | |
| `MOVFiles` | 19 | Drive evidence metadata | `DOMAIN_WITH_LINK` sharing, never `ANYONE_WITH_LINK` |
| `FocalAssignments` | 13 | Bureau/division focal persons | Drives review routing |

### 5.3 IPAT instrument

| Sheet | Cols | Purpose | Notes |
|---|---|---|---|
| `IPATRecords` | 28 | Per-ratee, per-period scores | No uniqueness guarantee — duplicates are resolved at read time (R3) |
| `IPATCBCRatings` | 15 | Individual competency ratings | `raterId`/`raterName` on every row — rater confidentiality concern (R4) |
| `IPATJFRatings` | 14 | Job fitness ratings | Self and Supervisor only |
| `IPATEdap` | 11 | Employee development action plan | `rows` column holds serialized JSON — a structured entity flattened into one cell |
| `IPATRaterAssignments` | 15 | Who rates whom, per period | |
| `AssessmentContent` | 21 | Versioned question bank | Has `status`, `version`, `hasBeenUsed`, `changeNotes` — the best-designed sheet in the system |
| `AssessmentCategories` | — | Question grouping | |

### 5.4 Operational

| Sheet | Purpose | Notes |
|---|---|---|
| `Notifications` | In-app notifications | Wired and working |
| `AuditLog` | Action history | `ipAddress` always empty (platform limitation) |
| `Reports` | Generated report metadata | **Newly wired today** |

### 5.5 Created but not wired to any route

`KRAs`, `SuccessIndicators`, `Evaluations`, `Deadlines`, `JRBRatings`, `PeerAssignments`, `AttendanceRecords`, `AttendanceRatings` — eight tabs, maintained by the initializer, reachable by no endpoint. See R8.

---

## 6. Preliminary naming-convention assessment

Naming is **internally consistent within each module and inconsistent across the system** — the signature of software grown feature-by-feature under time pressure. Nothing here is broken; all of it costs a new maintainer time.

### 6.1 Observed conventions

| Layer | Convention | Consistent? |
|---|---|---|
| Sheet tabs | PascalCase, mostly plural | Mostly — `MasterKRALibrary` and `SystemSettings` break the pattern |
| Fields | camelCase | Yes — genuinely consistent, and worth preserving |
| Services | PascalCase + `Service` | Yes, with one exception: `DocGenService` is exposed globally as **`PmesDocGenService`** |
| Routes | kebab-case | Yes |
| JS constants | SCREAMING_SNAKE | Yes |
| Status values | Title Case strings | Yes |

### 6.2 Specific problems

**Unexplained abbreviations.** `CBC`, `JF`, `FPO`, `EDAP`, `NTE`, `MOV`, `KRA`, `SI`, `IPCRF`, `CCEF`, `IPAT`, `DPCR`, `sgLevel`. These are protocol vocabulary and are correct in context — but nothing in the codebase defines them. A glossary is the cheapest documentation win available.

**`indicatorIdx`** — the abbreviation obscures that this is a *position within the indicator list*, not an identifier. `indicatorSequence` states the meaning.

**`type` is overloaded across four entities** with four different meanings:

| Sheet | `type` means |
|---|---|
| `Users` | employment type (Regular, COS, Casual, Job Order) |
| `Accomplishments` | instrument (IPCR / CCEF) |
| `Reports` | report kind |
| `Notifications` | notification kind |
| `MOVFiles` | *(via `mimeType`)* file format |

Any cross-entity query or generic export routine is a trap. Rename to `employmentType`, `instrumentType`, `reportType`, `notificationType`.

**Division reference is inconsistent.** `Accomplishments` uses `division` for the display name ([InitSheets.gs:33](../apps-script/InitSheets.gs)) while `IPCRForms`, `Users`, `IPATRecords` and `FocalAssignments` all use `divisionName`. `MOVFiles` carries only `divisionId`. Standardize on `divisionId` + `divisionName`.

**Denormalized names everywhere.** `rateeName`, `raterName`, `employeeName`, `divisionName`, `chiefName`, `userName`, `assignedByName`, `updatedByName`, `createdByName`, `uploadedByName`, `reviewerName`. This is a reasonable adaptation to a database with no joins — but every one is a copy that goes stale when the source record changes, and there is no reconciliation process. In a relational target these become joins.

**Overlapping entities.** `Accomplishments` and `FormEntries` model substantially the same thing — a target line with E/Q/T ratings and MOV references — and `Accomplishments` links back via `formId`/`entryId`. Whether these should be one entity is a data-modelling decision to settle *before* migration, not after.

**Mixed data types in a cell.** `IPATEdap.rows` holds serialized JSON. In a relational model this becomes a child table.

### 6.3 Recommended standard

For the **current** Sheets/Apps Script system, and for the **future** relational system:

| Artifact | Standard | Rationale |
|---|---|---|
| JS variables, JSON fields, API properties | `camelCase` | Already consistent — do not churn it |
| Sheet tabs (current) | `PascalCase`, plural | Already dominant |
| Relational tables (future) | `snake_case`, **singular** — `user`, `office`, `rating_response` | Standard SQL practice; matches PHP/MySQL familiarity |
| Relational columns (future) | `snake_case` | ORMs map `ratee_id` ↔ `rateeId` automatically |
| Primary keys | `id` | Already universal |
| Foreign keys | `<entity>_id` — `user_id`, `office_id`, `assessment_period_id` | |
| Classes / Vue components | `PascalCase` | Already consistent |
| API routes | `kebab-case`, plural resources | Already consistent |
| Status values | `Title Case` | Already consistent |
| Configuration keys | `SCREAMING_SNAKE` | Already consistent |

**Recommendation: camelCase in the API layer, snake_case in the relational layer, mapped at the boundary.** This preserves the existing frontend and API contract unchanged during migration while giving the database conventional SQL naming. It is the choice that costs the least and surprises PHP/MySQL maintainers the least.

### 6.4 Renaming policy — the important part

**Do not rename anything in the current system before migration.** Field names are the coupling between Sheets column headers, `SpreadsheetService` object mapping, every service, the API contract, and the Vue frontend — with no compiler and no type system to catch a missed reference. `updateRow` fails *silently* on unknown columns ([SpreadsheetService.gs:64](../apps-script/SpreadsheetService.gs)), so a partial rename produces data loss that looks like success.

The safe sequence is: **maintain current physical names, introduce documented logical/display names in the data dictionary now, and apply the physical rename only as part of the migration to the relational schema**, where the mapping is explicit, the transformation is scripted, and record counts can be reconciled.

Illustrative mapping — the full table belongs in the data dictionary:

| Current | Proposed (relational) | Type | Reason | Dependencies |
|---|---|---|---|---|
| `IPATJFRatings` | `job_fitness_rating` | Table | Expands the abbreviation | Apps Script, api.js, reports |
| `IPATCBCRatings` | `competency_rating` | Table | Expands the abbreviation | Apps Script, api.js, reports |
| `IPATRaterAssignments` | `rating_assignment` | Table | Drops instrument prefix; the entity is generic | Assignment engine, EvaluationView |
| `rateeId` | `ratee_id` | Column | SQL convention | Submission and result modules |
| `indicatorIdx` | `indicator_sequence` | Column | Ordering, not identity | Rating form, computation, reports |
| `Users.type` | `employment_type` | Column | Disambiguates four different `type` fields | Users module, registration |
| `Accomplishments.division` | `division_name` | Column | Aligns with every other sheet | Accomplishments, dashboard |
| `IPATEdap.rows` | `development_action_plan_item` | Table | JSON-in-a-cell becomes a child table | EDAP module |

---

## 7. Recommended three-phase transition plan

### Recommendation in one sentence

**Do not rewrite from scratch. Retain the validated Vue frontend and the validated business rules; replace Google Sheets and Apps Script with a centralized relational backend — implemented in PHP/MySQL if that is what the receiving ICT unit maintains.**

This is Option 2 in your migration-options list, with Option 3's technology choice applied to the backend only. The reasoning:

- The frontend is ~14.9k lines of working, operationally-validated Vue. It contains the assessment forms, the rating UI, and the workflow screens that STB personnel have actually used. Discarding it discards validated work and reintroduces UI risk that has already been retired.
- The API contract is a clean boundary. Every call is `POST {route, _method, token, ...payload}` returning `{success, data, message}`. A PHP backend can implement that contract exactly, and the frontend changes by **one environment variable**.
- The business rules — scoring formulas, weight renormalization, rater assignment, status transitions — are validated and portable. They are ~600 lines of arithmetic and selection logic, not an architecture.
- Sheets is the actual constraint (R3). Replacing it addresses scalability, transactions, concurrency, constraints, backup and query performance simultaneously.
- A full rewrite re-litigates settled decisions, re-tests validated workflows, and delays cluster adoption by quarters, for no benefit the backend replacement does not already deliver.

### Phase 1 — Stabilize and de-STB-ify in place (0–8 weeks)

Keep the current stack running. Target: safe to demonstrate, safe to hand over, safe to onboard a *pilot* second office.

| Work | Addresses |
|---|---|
| Complete the turnover checklist §4.1 and §4.2 | R10 |
| Add `officeId` to `Users`, `Divisions` and all operational sheets; backfill every existing row with the STB office id | R1 |
| Add office filtering to every rater-pool query and scoping helper | R1 |
| Move weights, descriptor bands and position hierarchy into `SystemSettings`; **de-duplicate the two copies of the domain weights** | R2 |
| Route `deleteForPeriod` with preview-then-confirm | R7 |
| Resolve the eight unwired sheets and six dead API clients — implement, remove, or document | R8 |
| Decide and implement correction/reopening workflow | R6 |
| Lock down spreadsheet and Drive access; complete the access review | R5 |
| Privacy notice, retention schedule, PIA initiation | R4 |
| Write the data dictionary with logical names — **no physical renames** | §6.4 |

Deliverable: an STB-validated system that is office-aware, configurable, documented, and owned by ICT.

### Phase 2 — Backend replacement behind the same contract (2–6 months, overlapping Phase 1)

| Step | Detail |
|---|---|
| 1 | Design the relational schema from the §5 inventory + the R1 office dimension. Entities: `office`, `organizational_unit`, `position`, `personnel`, `user`, `role`, `permission`, `assessment_period`, `assessment_template`, `assessment_category`, `assessment_criterion`, `rater_type`, `rating_weight_rule`, `rating_assignment`, `rating_response`, `assessment_result`, `evidence_file`, `notification`, `audit_log`, `system_setting`. Every operational table carries `office_id`. |
| 2 | Implement the **identical** JSON contract — same routes, same request shape, same `{success, data, message}` envelope. |
| 3 | Port the business rules with their tests. Scoring output must match the current system on the same inputs, to the decimal. |
| 4 | Build the ETL: Sheets → relational, with the §6.4 name mapping, record-count reconciliation and duplicate detection (expect duplicate `IPATRecords` — R3). |
| 5 | **Run both systems in parallel for one full assessment period.** Compare every computed score. This is the single most important risk control in the entire migration. |
| 6 | Cut over by changing `GAS_WEB_APP_URL` / `VITE_API_BASE_URL`. Keep the Apps Script deployment intact and reversible for one period. |

Authentication decision required: retain Firebase (zero frontend change, external dependency) or move to backend-issued sessions (fuller ICT ownership, frontend auth rework). Recommend **retaining Firebase through cutover** and revisiting separately — do not change two things at once.

### Phase 3 — Cluster production platform (6–18 months)

Managed MySQL with automated backup and point-in-time recovery; separated dev/staging/production; CI with the test suite gating deploys; monitoring and alerting; office-level and cluster-level dashboards on real aggregate queries; formal ICT ownership with a named system owner and a documented release process.

### What must not happen

- **Do not onboard a second office before R1 and R2 are closed.** Without an office dimension, a second office's data mixes into STB's rater pools and scoping the day it is entered. This is the single highest-consequence sequencing error available.
- **Do not rename sheet columns in the live system.** §6.4.
- **Do not create a new Apps Script deployment.** It changes the web app URL and breaks production.
- **Do not migrate without a parallel run.** Scores are personnel records with career consequences.

### Open questions requiring management or ICT decision

1. **Is the IPAT protocol identical across all Innovation Cluster offices**, or may offices vary weights, rater types, or position hierarchy? This determines whether R2's configuration model needs per-office overrides or a single cluster standard. *Everything in Phase 1's configuration work depends on this answer.*
2. **Who owns PMES after turnover** — one ICT unit centrally, or each office running its own instance? Determines whether office segregation is rows-in-one-database or separate deployments.
3. **May a submitted rating be corrected, and by whom?** Submission locking is fixed; this decision blocks the correction/reopening workflow.
4. **What is the retention period** for ratings, evidence files, and audit logs? Blocks R4.
5. **Is rater identity confidential from the ratee?** Currently every rating row stores `raterId` and `raterName`. Determines schema and access rules.
6. **Which backend technology** will the receiving ICT unit commit to maintaining? Determines Phase 2's implementation language.
7. **Is there an approved cluster-wide organizational reference** — office codes, unit structures, position ladders — or must PMES become the system of record for it?

---

## Appendix A — Changes applied during this assessment

Two verified defects were fixed. Both were confirmed against the code before changing anything, and the frontend lint, smoke check and production build all pass afterward.

### A.1 Reports module implemented — the incomplete feature

**Current behavior before the fix:** `ReportsView.vue` is a complete, styled, routed page reachable from the navigation at `/reports`. On mount it called `reportsApi.list()`; the Generate button called `reportsApi.generate()`. Both hit `case 'reports'` in `Router.gs`, which unconditionally threw `HttpError('Reports endpoint is not available yet.', 501)`. Every control on the page failed. The `list()` failure was swallowed silently; Generate showed a generic error toast. The division dropdown was hard-coded to STB's four divisions.

**Expected behavior:** the six offered report types generate, respecting the caller's data scope.

**Why it matters now:** it is a visible menu item that fails on click, and it is the feature that "cluster-level consolidated reporting" and "data export" depend on.

**Changes:**

| File | Change |
|---|---|
| `apps-script/ReportsService.gs` | **New.** Implements all six report types, three output formats, permission checks and server-side division scoping. |
| `apps-script/Router.gs:127` | 501 guard replaced with routes for `list`, `options`, `generate`, `download`. |
| `vue-frontend/src/services/api.js:273` | Added `reportsApi.options()`. |
| `vue-frontend/src/views/ReportsView.vue` | Division dropdown and report-type list now load from the backend; hard-coded STB divisions removed; CSV filename from the report name; backend error messages surfaced; empty-result case handled. |

Security notes, deliberate:
- A caller without `view_bureau_monitoring` is forced to their own `divisionId` regardless of what the request asks for (`_resolveDivisionScope`). Scope is never trusted from the client.
- `bureau-analytics` requires bureau-level permission.
- CSV is built in memory and never persisted — no Drive file, no sharing surface.
- Excel/PDF exports inherit the Reports folder's permissions with no link sharing applied, consistent with the MOV evidence rule.
- Every generation writes an audit entry with type, scope, period and row count.

`ReportsService` reads `divisionId` only. **When R1 lands, `_resolveDivisionScope` and `_scopeRows` are the two functions that need an office dimension** — they are deliberately isolated for that reason.

**Testing requirement:** as a bureau-level user, generate each of the six types in each of the three formats; as a division-level user, confirm the division selector offers only their own division, that `bureau-analytics` is absent, and that a forged `divisionId` in the request body returns only their own division's rows.

### A.2 IPAT rating range validation

**Current behavior before the fix:** `saveCBCRatings` ([IPATService.gs:531](../apps-script/IPATService.gs)) and `saveJFRatings` ([:748](../apps-script/IPATService.gs)) stored `Number(r.rating) || 1`. Both instruments are documented 1–4 Likert scales ([IPATService.gs:9](../apps-script/IPATService.gs), `:16`). A value of `99` or `-5` was accepted and written to the sheet, then carried into the weighted score and the ratee's official overall rating. `0`, `NaN` and empty silently became `1` — a valid-looking rating the rater never gave.

**Expected behavior:** ratings outside 1–4 are rejected.

**Change:** added `normalizeRating()` next to `round2()` in `IPATService.gs` and applied it at both write points. Values 1–4 are unchanged, so no legitimate submission is affected — the rating UI can only emit 1–4, meaning out-of-range input indicates a client fault or deliberate manipulation. Rejection is preferred over clamping because silently altering a submitted rating is worse than refusing it.

**Testing requirement:** submit ratings of 1, 2.5 and 4 — all accepted. Submit 0, 5, -1, `"abc"` and empty — all rejected with a 400 naming the valid range. Confirm a previously-computed score is unchanged after the fix.

### A.3 Not changed — flagged for decision

R6 (submitted-record locking) has now been fixed by rejecting completed assignments. The remaining workflow question is whether submitted ratings may ever be reopened, who may approve that, and how prior values are retained.

## Appendix B - Multi-office local implementation checkpoint

On branch `feature/multi-office-assessment-scope`, the repository now contains a local-only implementation checkpoint for automatic office spreadsheet provisioning and assessment-route scoping inside the same PMES application.

What is improved:

- Existing STB user rows default to `STB_FULL` and remain on the central PMES spreadsheet.
- Non-STB office portal users can be routed to an active provisioned office spreadsheet for assessment routes.
- Central cluster roles can explicitly target a participating office through protected backend routing.
- User Management can store office scope metadata without exposing spreadsheet IDs to the frontend.
- The office spreadsheet template is aligned to the existing tested IPAT tab compatibility names.
- The central Office Registry includes protected automatic provisioning, schema validation and activation workflows.
- Participating office administrators can manage their assigned office `Personnel` roster without receiving full STB User Management access.
- Self-registration can now route users to STB or to an active participating office through server-resolved office metadata.
- Approving a non-STB pending account now creates or updates the assigned office spreadsheet `Personnel` row before central activation.
- Central cluster monitoring has a protected office-by-office rollup UI and backend summary route.

What is still pending:

- Live Apps Script deployment validation.
- Real Google Drive spreadsheet creation/sharing validation.
- Real office registry data and permission validation.
- Vercel environment validation.
- Two-office acceptance testing for rater assignment isolation, identical division codes, and office-admin confinement.
- Per-office assessment-rule configuration for weights, rater types, descriptor bands and hierarchy.
- Policy decisions for correction/reopening, rater confidentiality, partial-score use, privacy notices and retention.
- Live concurrent-user behavior testing.

This checkpoint does not change the recommendation to avoid live rollout until office scoping, office spreadsheet permissions, and configuration behavior are tested with real or controlled test office data.

## Appendix C — Portal UI checkpoint (2026-08-09)

This checkpoint covers the user-facing layer built on top of the multi-office
backend backbone recorded in Appendix B.

### What now exists

- A shared presentation component set (`vue-frontend/src/components/ui/`) used by
  every new module, aligned to the existing `main.css` component layer.
- Dynamic portal branding resolved from the authenticated scope, including the
  participating office's name as the subtitle, applied to the shell, page header
  and browser tab.
- The restricted personnel experience: Simplified Dashboard, My Rating Tasks,
  My Results, read-only Assessment Library, Assessment Status, Rating Guide, and
  read-only Personal Information.
- The office administrator experience: Office Assessment Dashboard with
  completion by organizational unit and by rater relationship, neutral attention
  indicators, and Personnel Validation.
- The central experience: Cluster Assessment Overview split out of the Office
  Registry, and an Office Registry focused on provisioning with a stated resume
  path for interrupted provisioning.
- Backend summary routes (`portal/*`) that aggregate server-side and return
  counters rather than rating datasets.

### Confidentiality controls applied

- `portal/my-results` omits rater identities and reduces outstanding rater types
  to a count, because naming an outstanding relationship identifies one person in
  most units.
- `portal/my-tasks` projects a field subset and does not carry the score fields
  that the underlying STB assignment route returns.
- Cluster analytics are aggregate only; no individual rating content is included.

### Readiness classification

**DEVELOPMENT_TESTING_READY.**

This is unchanged from the previous checkpoint and is deliberate. The new
interface is verified only by lint, production build, smoke check, and Apps
Script syntax parse. It has not been exercised by a real signed-in user of any
scope, and none of it is deployed.

It cannot advance to USER_ACCEPTANCE_TESTING_READY until at least:

- One participating-office personnel account signs in and completes the full
  path: dashboard, task list, rating form, draft save, draft reload, final
  submission, and results.
- One office administrator account confirms office confinement in Personnel
  Validation and the Office Assessment Dashboard.
- One central administrator confirms Cluster Overview totals reconcile against
  the office spreadsheets.
- The performance concerns recorded in the Known Issues Register section G are
  measured against a full office dataset.
