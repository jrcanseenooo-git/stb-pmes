# PMES — Security and Data Privacy Findings

**Sections E and F of the cluster-readiness review**
**Assessed:** 4 August 2026
**Scope:** Apps Script backend, Vercel proxy, Vue frontend, and the live production spreadsheet `PMES Database` (`1lCJaa2y…SRqrU`, 20 tabs, owner `jrbcancino@dswd.gov.ph`)
**Legal frame:** Republic Act No. 10173 (Data Privacy Act of 2012), its IRR, and NPC issuances applicable to government agencies as personal information controllers.

Severity: **Critical** = active exposure or integrity loss now · **High** = must close before another office is onboarded · **Medium** = close before full production · **Low** = hygiene.

---

## E-01 · CRITICAL · The production database is readable by anyone with the link

**Component:** Google Drive permissions on the `PMES Database` spreadsheet.

**Finding.** The file's permission set is:

```
{ "role": "reader", "type": "anyone" }
{ "role": "owner",  "type": "user",  "emailAddress": "jrbcancino@dswd.gov.ph" }
```

`type: "anyone"` means **link-shared publicly**. Anyone who obtains the URL — no DSWD account required, no sign-in, no domain restriction — can read every tab.

**What is exposed.** Verified against the live file: 51 personnel records including full names, government email addresses, employee numbers, positions, salary-grade levels, employment type (Regular / COS / Casual / Job Order), and division and section assignments; 164 individual competency ratings and 176 job-fitness ratings **each carrying `raterId` and `raterName`**, so every rating is attributable to the specific colleague who gave it; 81 assessment records with computed scores and descriptors; and 248 audit-log entries showing who did what and when.

**Why this is the top finding.** Every other access control in this system — the Firebase token verification, the role/permission model, the division scoping, the rate limiter — protects the *application* path. This exposure bypasses all of it. The application-layer controls are well built and, on this vector, irrelevant.

**Under the Data Privacy Act** this is a personal data breach exposure involving employee performance information. It engages the security-safeguards obligation (§20) and, if access by an unauthorised party is confirmed or reasonably believed, the breach-notification duty to the National Privacy Commission and affected data subjects within 72 hours.

**Remediation — this is yours to do, not mine.** I will not change permissions on your production database; that is an irreversible action on live government personnel data and it belongs in your hands.

1. Open the spreadsheet → **Share** → under *General access* change **"Anyone with the link"** to **"Restricted"**.
2. Remove every individual account that does not require direct file access. The Apps Script service account reaches the file through `SPREADSHEET_ID` and does not need human sharing.
3. Check the **PMES Drive folder** holding MOV evidence files and generated documents for the same setting.
4. Open Drive **Activity** on the file and review access history. If any non-DSWD access appears, escalate to your Data Protection Officer immediately — the 72-hour clock is a legal deadline, not an internal target.
5. Rotate anything that a reader could have used for onward access.

**Blocks cluster-wide use:** Yes — and it blocks the orientation demonstration too.

**Test:** from a browser signed out of all Google accounts (or a private window), open the spreadsheet URL. Expected result after remediation: a request-access screen, not the data.

---

## E-02 · CRITICAL · Rater identity is stored against every individual rating

**Component:** `IPATCBCRatings`, `IPATJFRatings` (`raterId`, `raterName` columns).

**Finding.** Every one of the 340 stored rating rows names the rater. Multi-rater instruments of this kind normally depend on raters believing their individual scores are not attributable — that belief is what makes subordinate and peer ratings honest. Anyone with spreadsheet access (see E-01) can reconstruct exactly what any employee scored their supervisor, their peers, and their subordinates.

The application does not currently expose rater-attributed ratings to ratees — `getMyResults` returns aggregates and a `pendingRaters` list of *rater types*, not names. So the application behaviour is correct; the **storage model** is what creates the risk, and E-01 makes it reachable.

**Remediation:** decide the policy first (see open question in §7 of the readiness assessment). If rater identity is confidential from the ratee, then: keep `raterId` for integrity and de-duplication, remove the denormalised `raterName`, restrict raw rating tables to a database-manager role, and expose only aggregates through the API. If it is *not* confidential, document that decision and tell raters plainly before they rate — under the transparency principle they are entitled to know.

**Blocks cluster-wide use:** Yes — the policy decision does, at minimum.

**Test:** confirm no API response returns `raterName` alongside an individual `rating` value for a non-administrative caller.

---

## E-03 · HIGH · Application authorization is bypassable at the storage layer

**Component:** Google Sheets as datastore.

**Finding.** `AuthService` role checks, division scoping and audit logging apply only to requests arriving through the web app. Anyone with Drive access to the spreadsheet reads *and writes* every record with no role check and no audit entry. A rating can be altered, a score overwritten, or an audit row deleted, and the system has no way to detect it — the audit log is itself a tab in the same file.

This is inherent to the architecture, not a coding error. It was an acceptable trade at single-bureau scale with one or two trusted holders. It does not survive cluster scale, where the number of people with Workspace access grows with every office onboarded.

**Remediation (interim):** E-01 step 2; enable Workspace controls to restrict download/copy/print; schedule quarterly documented access reviews; keep an off-file backup so tampering with the audit tab is detectable by comparison.
**Remediation (permanent):** migrate to a relational backend where the application is the only write path (Phase 2 of the transition plan).

**Blocks cluster-wide use:** Yes for the interim controls; the permanent fix is Phase 2.

---

## E-04 · HIGH · Submitted-rating lock fixed; correction workflow still needed

**Component:** `IPATRaterAssignmentService.submitAssignmentRatings` ([IPATRaterAssignmentService.gs:523](../apps-script/IPATRaterAssignmentService.gs)).

**Finding.** Earlier review found that the function verified the assignment existed, was not obsolete, belonged to the caller, and had a linked record, but did not check `status === 'Completed'`. Because `saveCBCRatings` upserts on `(ipatId, raterId, themeId, indicatorIdx)`, a rater or administrator could resubmit after completion and silently overwrite finalised ratings.

**Fix applied.** Completed assignments now return 409 before any rating write. Rating writes are serialized with `LockService`, and the frontend disables the submit action for completed assignments. This closes the silent-overwrite defect once deployed.

**Remaining remediation:** if corrections are operationally required, implement an explicit, permissioned, audited reopen process; add a `RatingRevisions` record capturing prior values, actor, reason and approving authority.

**Blocks cluster-wide use:** The overwrite defect is fixed pending deploy. The correction/reopening policy must be decided before full cluster production.

**Test:** submit ratings, confirm `Completed`, submit different ratings for the same assignment — expect 409 and no row changes. When a reopen path exists, test that the change is permitted only through that path and that previous values are retained.

---

## E-05 · HIGH · Administrators can submit ratings on another person's behalf

**Component:** [IPATRaterAssignmentService.gs:530](../apps-script/IPATRaterAssignmentService.gs) and `markCompleted` at `:515`.

**Finding.** When `row.raterId !== profile.id`, the check falls through to an administrator permission test and then proceeds. An administrator can therefore submit ratings that are stored under **another employee's** `raterId` and `raterName`. The audit log records the acting administrator, but the rating row itself attributes the score to the person who did not give it.

This is presumably deliberate — an operational backstop for a rater who cannot access the system. But as written, the stored record is indistinguishable from a genuine submission.

**Remediation:** keep the capability if operationally required, but stamp it: add `submittedByUserId` and `submittedOnBehalf` to the rating tables, populate them whenever `raterId !== caller`, and surface the flag in monitoring views.

**Blocks cluster-wide use:** Yes — proxy submission without a marker is not defensible in a personnel process spanning multiple offices.

**Test:** as an administrator, submit for another rater; confirm the row records both the nominal rater and the actual submitter.

---

## E-06 · MEDIUM · Rate limiting is too permissive on authentication-adjacent routes

**Component:** `checkRateLimit` ([Code.gs:48](../apps-script/Code.gs)).

**Finding.** A flat 60 requests/minute applies to every route, keyed on the authenticated user id. Two consequences: the limiter runs *after* `verifyToken`, so unauthenticated request floods are never limited at all, only rejected; and 60/min is generous for `auth/*` and for `users/{id}/reset-password`. The system brief's own security rules call for ≤5 attempts/minute on auth-adjacent routes — the code does not implement that.

Apps Script cannot see client IP, so per-IP limiting is not available at this layer. The Vercel proxy can see it.

**Remediation:** add per-route limits with a low ceiling for `auth/*`, `users/*/reset-password` and `auth/register`; add an IP-based limit in `api/gas.js` where the IP is visible.

**Test:** issue 10 rapid `reset-password` calls; expect 429 well before the tenth.

---

## E-07 · MEDIUM · Errors always return HTTP 200

**Component:** `respond` ([Code.gs:130](../apps-script/Code.gs)).

**Finding.** Every response — including 401, 403 and 500 — is delivered with HTTP status 200, with the real status inside the JSON body. This is a deliberate and well-known Apps Script workaround, and the frontend handles it. The cost is that infrastructure that reasons about HTTP status cannot: the Vercel proxy logs every upstream call as successful, and no monitoring or alerting can key on error rates without parsing bodies.

**Remediation:** have the proxy in `api/gas.js` parse `success` and `message`, map to a real HTTP status for its own response and its logs, and emit a metric on failures. Do not change the Apps Script side.

---

## E-08 · MEDIUM · Diagnostic function contains a real person's account

**Component:** [FirebaseAuthService.gs:278](../apps-script/FirebaseAuthService.gs) — `getUserByEmail('jrbcancino@dswd.gov.ph')` inside `testSetup()`.

**Finding.** A named individual's government email is hard-coded in source. It is a diagnostic path that never runs in production, so the operational risk is nil — but it is personal data committed to a repository that is about to be handed to other offices, and whoever inherits the code will read it as the system owner's account.

**Remediation:** replace with a script property or a parameter. One-line change.

---

## E-09 · LOW · CSV export assumes string values

**Component:** `AuditService.export_` ([AuditNotificationsService.gs:60](../apps-script/AuditNotificationsService.gs)) — `(r[h] || '').replace(/"/g, '""')`.

**Finding.** If any exported cell holds a Date or number, `.replace` is not a function and the export throws a 500. `timestamp` is written as an ISO string so the common path is safe, but `details` is free-text that Sheets may coerce. `ReportsService._csvCell` handles this correctly and can be used as the pattern.

**Remediation:** coerce before escaping, as `ReportsService` does.

---

## E-10 · Controls that are correctly implemented

Stated plainly, because a review that lists only faults misrepresents the system:

| Control | Assessment |
|---|---|
| Token verification | **Correct.** Structural pre-checks then authoritative RS256 verification via Identity Toolkit, with the domain re-checked against Google's authoritative email rather than the token claim ([AuthService.gs:98](../apps-script/AuthService.gs)). The comments record that a prior decode-only implementation was a critical bypass — that history is documented in code, which is good practice. |
| CORS | **Correct.** Explicit origin allowlist, no wildcard, unknown origin → 403 ([api/gas.js:24](../vue-frontend/api/gas.js)). |
| Secrets | **Correct.** All in GAS Script Properties or Vercel server env. `.gitignore` covers service-account and credential patterns. No secrets in client code. |
| Token in transit | **Correct.** Body, never URL — keeps tokens out of logs, history and `Referer`. |
| Error messages | **Correct.** ≥500 scrubbed to a generic string; no stack traces, spreadsheet ids or deployment URLs reach the browser ([Code.gs:104](../apps-script/Code.gs)). |
| Open redirect | **Correct.** Router guard strips non-relative `?redirect` values. |
| MOV sharing | **Correct.** `DOMAIN_WITH_LINK`, never `ANYONE_WITH_LINK` — the evidence files are handled more carefully than the database itself (E-01). |
| Temp passwords | **Correct in practice.** SHA-256+salt hashing, non-skippable change prompt. Verified live: **0 of 51** users have a plaintext `tempPassword` value stored. |
| IDOR on evidence | **Correct.** `MovService._guardMovAccess` applies the same scope to single-record reads as to lists, preventing enumeration of other users' Drive URLs. |

---

# Section F — Data Privacy Findings

## F-01 · Inventory of personal data processed

| Category | Where | Classification under RA 10173 |
|---|---|---|
| Name, email, employee number | `Users` | Personal information |
| Position, salary grade, employment type | `Users` | Personal information |
| Division, section assignment | `Users`, most operational tables | Personal information |
| Performance ratings (competency, job fitness, overall) | `IPATRecords`, `IPATCBCRatings`, `IPATJFRatings` | **Personal information; sensitive in effect** — employment assessment bearing on career progression |
| Rater-attributed scores | `IPATCBCRatings`, `IPATJFRatings` | Personal information **of the rater as well as the ratee** |
| Disciplinary indicators (`cbcNteLevel`, `cbcOffenseLevel`, `cbcOffenseDeduction`) | `IPATRecords` | **Sensitive personal information** — proceedings for an offence (RA 10173 §3(l)(4)) |
| Free-text feedback and review comments | `IPCRForms`, `ReviewComments` | Personal information |
| Development plans | `IPATEdap` | Personal information |
| Evidence files | Drive + `MOVFiles` | Varies — may contain third-party personal data |
| Activity logs | `AuditLog` (248 rows) | Personal information |

The disciplinary fields deserve emphasis. `cbcNteLevel` (Notice to Explain) and `cbcOffenseLevel` record administrative-offence status. That is **sensitive personal information**, which carries a higher bar: processing requires a specific lawful basis and stronger safeguards, and it is currently sitting in a link-shared file.

## F-02 · Assessment against DPA principles

| Principle | Status | Required action |
|---|---|---|
| **Transparency** | ✗ Absent | No privacy notice anywhere in the application. Data subjects are not told what is collected, why, who sees it, or how long it is kept. Add a notice at registration and a standing link in the profile view. |
| **Legitimate purpose** | ~ Partial | The purpose (operationalising the IPAT protocol) is legitimate and documented in the protocol, but not declared in the system. State the lawful basis explicitly — for a government HR process this will normally rest on the agency's mandate and the necessity of processing for performance management, not on consent. **Do not rely on employee consent**: consent from an employee to their employer is rarely freely given and is a fragile basis. |
| **Proportionality** | ~ Partial | `tempPassword` exists as a column even though it is unused in practice — remove the column. Denormalised name copies (`raterName`, `rateeName`, `employeeName`, `uploadedByName`, and eight others) multiply copies of identity data across tables. |
| **Data minimisation** | ✗ Gap | Reports and exports currently return full personnel detail with no field-level restriction. Aggregate reporting should not carry names. |
| **Access limitation** | ✗ Failing | E-01 and E-03. The application model is sound; the storage layer defeats it. |
| **Retention and disposal** | ✗ Absent | No retention field on any table, no schedule, no disposal procedure, no archival policy. Ratings from 2026 will still be present indefinitely. |
| **Data-subject rights** | ✗ Absent | No mechanism for access, correction, objection, erasure or data portability. A ratee cannot obtain a copy of their own record except by viewing a screen. |
| **Security safeguards** | ~ Mixed | Application layer good (E-10); storage layer failing (E-01, E-03). |
| **Breach management** | ✗ Absent | No incident-response procedure, no breach register, no notification workflow, no named responder. |
| **Accountability** | ~ Partial | Audit log exists but `ipAddress` is empty in **all 248 rows** (platform limitation, not an oversight). No designated Data Protection Officer named in system documentation. |

## F-03 · Required privacy deliverables before cluster-wide processing

1. **Privacy Impact Assessment.** Required — this is a new processing system, handling sensitive personal information, being materially expanded in scope across multiple offices. The scope change alone triggers it.
2. **Privacy notice**, displayed at registration and permanently accessible. Must state: identity of the controller, categories of data, purpose, lawful basis, recipients (including who within each office can see what), retention period, data-subject rights, and DPO contact.
3. **Retention schedule.** Proposed starting point for the National Archives / agency records schedule to confirm: ratings and computed results retained for the employee's service tenure plus a defined period; raw individual rating rows retained for a shorter window (one to two assessment cycles) since only the aggregate has continuing purpose; audit logs retained per COA/ICT policy; evidence files retained with the assessment cycle. **These figures require records-management approval — do not implement my numbers as policy.**
4. **Data-sharing agreement** covering cluster-level consolidated reporting. Once one office's data is visible to a cluster administrator sitting in another office, that is disclosure between personal information controllers and needs a documented basis.
5. **Access-review procedure**, quarterly, documented, covering both application roles and Drive permissions.
6. **Breach-response procedure** with named roles and the 72-hour NPC notification path.
7. **Confidentiality undertaking** for raters and for anyone with administrative access.
8. **Disposal procedure** — secure deletion covering the spreadsheet, Drive evidence, generated exports, and backups. Note that `softDelete` sets a flag and retains the row; that is not disposal.

## F-04 · Export and download controls

Generated reports and CSV exports leave the system's access controls behind the moment they are downloaded. The `ReportsService` added in this review deliberately builds CSV in memory without persisting a file, and writes Excel/PDF into a Drive folder without applying link sharing. That is the right default, but it does not control what happens after download.

**Recommended:** watermark generated PDFs with the requesting user and timestamp; log every export in the audit trail (implemented — `GENERATE_REPORT`); restrict the aggregate cluster reports to named cluster administrators; and state in the privacy notice that exports are logged.

---

## Prioritised remediation sequence

| # | Finding | Do it by |
|---|---|---|
| 1 | **E-01** link sharing | **Today, before anything else** |
| 2 | E-08 hard-coded email | Before repository handover |
| 3 | E-01 step 4 access-history review | Within 72 hours of closing E-01 |
| 4 | E-03 interim controls, E-04 locking, E-05 proxy-submission marker | Before the next assessment cycle |
| 5 | E-02 rater confidentiality policy decision | Before onboarding office #2 |
| 6 | F-01…F-04 privacy programme, PIA, notice, retention | Before cluster-wide processing |
| 7 | E-06, E-07, E-09 | Before final production approval |
| 8 | E-03 permanent fix | Phase 2 migration |
