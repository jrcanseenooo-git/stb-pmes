# PMES — Known Issues Register

**Version:** 1.0 · 4 August 2026
**Purpose:** the disclosure document for turnover and for the ICT orientation. Every open issue in one place, with severity, owner and the decision it waits on.

**Principle:** disclose these in the orientation rather than be asked about them. A register that says "we know, here is the plan" reads as competence. Being surprised by a finding in front of the Innovation Cluster does not.

**Status:** `OPEN` · `FIXED` (applied, pending deploy) · `DECIDE` (blocked on a management/ICT decision) · `PLANNED` (scheduled to a phase)

**Severity:** `CRIT` · `HIGH` · `MED` · `LOW`

---

## A. Blocking — resolve before the orientation

| ID | Issue | Sev | Status | Owner | Detail |
|---|---|---|---|---|---|
| **E-01** | Production database spreadsheet is shared **"Anyone with the link"** — 51 personnel records, 340 attributed ratings and 248 audit entries readable by URL without sign-in | **CRIT** | **OPEN** | System owner | [Security findings §E-01](PMES_SECURITY_PRIVACY_FINDINGS.md) |
| **D-04** | Only **2 of 42** stored assessment scores were computed from the complete instrument. 8 are the competency score alone (30% weight), 16 are the FPO alone (55%), 16 are CBC+JF (45%) — all renormalised to 100% and given a qualitative descriptor | **CRIT** | **DECIDE** | Assessment owner | [Data quality §D-04](PMES_DATA_QUALITY_FINDINGS.md) |
| **D-01** | 34 of 47 ratee/period keys have duplicate assessment records; **7 employees have two different official scores**, one pair spanning a descriptor boundary (3.51 vs 2.92) | **CRIT** | **OPEN** | Assessment owner | [Data quality §D-01](PMES_DATA_QUALITY_FINDINGS.md) |

**Do not demonstrate the system against real personnel data while D-01 and D-04 are open** — a live screen may show a score that is disputed or partial.

---

## B. Blocking — resolve before onboarding a second office

| ID | Issue | Sev | Status | Owner | Detail |
|---|---|---|---|---|---|
| **R1** | Office dimension and per-office spreadsheet routing are implemented locally on `feature/multi-office-assessment-scope`, but are not live yet and still require real office data, Apps Script deployment validation, Drive permission validation, and acceptance testing with at least two offices | **CRIT** | PARTIAL (local only) | ICT | [Readiness Appendix B](PMES_CLUSTER_READINESS_ASSESSMENT.md) |
| **R2** | Assessment rules are code literals — weights, descriptor bands, position hierarchy, the 70/30 peer split, the STB division seed, `admin-pool`, the email domain | **CRIT** | PARTIAL | ICT | Domain weights de-duplicated into `DOMAIN_WEIGHTS`; the move to per-office configuration remains |
| **D-02** | **25 of 36 ratees have no Supervisor rating** — the heaviest weight (30%). 24 of 28 Staff have none. Scores silently renormalise without it | **CRIT** | **DECIDE** | Assessment owner | Root cause: 7 Section Heads for 39 Staff, plus exact-string section matching |
| **D-03** | Section names are free text; three sections are written two or more ways; 13 of 51 users have no section. Directly causes D-02 | **HIGH** | OPEN | HR / Division Chiefs | Needs division chiefs to confirm the canonical list |
| **E-02** | Rater identity stored against every individual rating (`raterId`, `raterName` on all 340 rows) | **CRIT** | **DECIDE** | DPO / Assessment owner | Policy question: is rater identity confidential from the ratee? |
| **E-04** | Submitted ratings can no longer be silently overwritten — completed assignments now return 409 and the UI shows them as submitted/locked. A formal correction/reopening workflow is still undecided | **HIGH** | **FIXED** | ICT / Assessment owner | Policy question remains: may a submitted rating be corrected, by whom, and with what revision history? |
| **E-05** | Administrators can submit ratings stored under another employee's identity with no marker | **HIGH** | OPEN | ICT | Needs `submittedByUserId` / `submittedOnBehalf` |
| **E-03** | Application authorization is bypassable at the storage layer — anyone with Drive access reads and writes everything with no role check and no audit | **HIGH** | PLANNED | ICT | Interim: access lock-down. Permanent: Phase 2 |
| **R10** | No branching strategy, version tagging, release process, environment separation or rehearsed rollback. Deployment ID held in one person's notes | **HIGH** | OPEN | ICT | Turnover blocker |

---

## C. Fixed in this review — pending push and deploy

> **None of these are live yet.** The Apps Script changes require `clasp push` and a deploy to the **existing** deployment ID. Creating a new deployment changes the web app URL and breaks production.

| ID | Fix | Files |
|---|---|---|
| **R-REP** | **Reports module implemented.** `ReportsView.vue` was live in the navigation calling a 501-guarded backend — every control failed. Six report types, three formats, server-side division scoping, audited | `ReportsService.gs` (new), `Router.gs`, `api.js`, `ReportsView.vue` |
| **D-REP** | `Reports` tab is **absent from the live database** — the new service would have thrown on first use. Now created on demand with the correct 11 columns | `ReportsService.gs` |
| **E-VAL** | IPAT rating range enforced. Ratings were stored as `Number(x) \|\| 1` on a documented 1–4 scale — `99` was accepted into the weighted score, `0`/empty silently became `1`. Verified: **no existing row** would be rejected | `IPATService.gs` |
| **E-04** | Completed rating assignments are locked. Backend rejects resubmission with 409, rating writes are serialized with `LockService`, and the frontend disables the submit action once an assignment is completed | `IPATRaterAssignmentService.gs`, `EvaluationView.vue` |
| **D-07** | Seven production columns (`pendingActivation`, `requestedRole`, `selfRegistered`, `firstName`, `middleName`, `lastName`, `suffix`) were missing from `InitSheets.gs`. A rebuild — the documented disaster-recovery path — would have produced a schema that silently discarded registration data | `InitSheets.gs` |
| **R7** | `deleteForPeriod` was fully implemented, permission-guarded and audited but **had no route**. Now reachable with GET-preview then POST-confirm requiring an exact phrase | `IPATRaterAssignmentService.gs`, `Router.gs` |
| **R2a** | Domain weights existed as literals in **two** functions that could diverge. Single `DOMAIN_WEIGHTS` constant; `computeOverall` now delegates to `calculateOverall`. **Verified against all 42 live scored records: 0 discrepancies** | `IPATService.gs` |
| **D-DISC** | Renormalised scores now report `appliedComponents`, `missingComponents` and `totalWeightPresent` in the API response and the audit entry — a partial score can no longer be produced without a trace | `IPATService.gs` |
| **R8a** | `evaluations/*`, `attendance/*`, `peer-assignments/*` returned "Route not found", indistinguishable from a routing bug. Now explicit 501s naming the live alternative | `Router.gs` |

**Verification performed:** frontend lint, smoke check and production build pass; all five modified `.gs` files syntax-check clean; the scoring refactor reproduces all 42 live scores exactly.
**Verification NOT performed:** no backend change has been executed against Apps Script. Nothing in this section is proven in the runtime until pushed and deployed.

---

## D. Open — resolve before full production approval

| ID | Issue | Sev | Status | Detail |
|---|---|---|---|---|
| **R3** | Sheets has no transactions, no concurrency control (`LockService` used in 1 of 27 files), no constraints, full-scan reads, silent write failures on unknown columns | HIGH | PLANNED (Ph.2) | Acceptable interim; unsuitable permanently |
| **R4** | No privacy notice, no retention schedule, no disposal procedure, no data-subject-rights mechanism, no breach procedure. PIA not started | HIGH | OPEN | [Privacy findings §F](PMES_SECURITY_PRIVACY_FINDINGS.md) |
| **R9** | Reads perform writes — `getMyResults` computes and persists scores on GET; `getProfile` writes `lastLoginAt` on nearly every request | MED | OPEN | Non-idempotent GETs; multiplies write volume |
| **E-06** | Flat 60 req/min on all routes; auth-adjacent routes should be ≤5/min. Limiter runs after token verification so unauthenticated floods are unlimited | MED | OPEN | Add per-route limits; IP limit at the Vercel proxy |
| **E-07** | All responses return HTTP 200 with the real status in the JSON body — no infrastructure-level error monitoring is possible | MED | OPEN | Fix at the proxy, not in Apps Script |
| **E-08** | A named individual's government email hard-coded in `FirebaseAuthService.testSetup()` | LOW | OPEN | One-line fix; do before repository handover |
| **E-09** | `AuditService.export_` assumes string values; a Date or number in any cell throws a 500 | LOW | OPEN | Use the `ReportsService._csvCell` pattern |
| **D-05** | 30 retired `JFPeer` assignment rows remain (18%), 12 marked Completed; 65 legacy `Peer` rows in job-fitness ratings (inert but misleading) | MED | OPEN | Archive, do not delete — 12 people completed that work |
| **D-06** | `employeeNo` has 8 formats; one value was auto-converted to a 1965 date by Sheets and the original is unrecoverable from the cell | MED | OPEN | Recover from HR records; set column to plain text |
| **D-08** | 17 free-text `position` values with no controlled vocabulary (`"PDO III"` vs `"Project Development Officer III"`); one `suffix` holds the magic string `"N/A"` | LOW | OPEN | Reference tables in Phase 2 |
| **DOC-1** | `IPATService.gs` header claims Job Fitness has **7 indicators**; `JOB_FITNESS_INDICATORS` has **5**, and the computation divides by 5 | LOW | OPEN | Correct the comment |
| **DOC-3** | `IPATService.gs` header claims descriptor bands *Excellent Alignment / Satisfactory Alignment / Needs Development* at 3.50 / 2.50 / 1.50. The implemented bands (both layers) are **Outstanding ≥4.00 / Very Satisfactory ≥3.50 / Satisfactory ≥2.75 / Needs Improvement ≥2.00 / Requires Immediate Intervention**. The header misled this review until corrected on 2026-08-04 | MED | OPEN | Correct the header. A wrong descriptor band in the reference comment is how a wrong band ends up in the next rewrite |
| **DUP-1** | The descriptor band table exists **twice** — `qualitativeDescriptor` (backend) and `descriptorForScore` (frontend). They agree today; nothing enforces it. `displayDescriptor()` prefers the frontend value over the stored one, so a divergence would silently show users a different descriptor than the database holds | MED | OPEN | Fold into the R2 configuration work |
| **DOC-2** | `PMES_SYSTEM_BRIEF.md` references two documents that do not exist and omits `SystemSettingsService`, which is live and routed | LOW | OPEN | Refresh the brief |

---

## E. Reserved features — decide implement / remove / document

Each has a client in `services/api.js` and, in most cases, a sheet definition — but no backend and no data. A developer inheriting this cannot tell "planned" from "abandoned" without tracing each one, as this review had to.

| Resource | API client | Router | Sheet in live DB | Recommendation |
|---|---|---|---|---|
| `kras/*` | `kraApi` (+ `stores/kra.js`) | 501 | `KRAs`, `SuccessIndicators` absent | **Remove** — superseded by `kra-library`, which is live and working |
| `evaluations/*` | `evaluationApi` | 501 (new) | `Evaluations` absent | **Remove** — superseded by `ipat/*` |
| `peer-assignments/*` | `peerAssignmentApi` | 501 (new) | `PeerAssignments` absent | **Remove** — superseded by `ipat-assignments/*` |
| `attendance/*` | `attendanceApi` | 501 (new) | `AttendanceRecords`, `AttendanceRatings` absent | **Decide** — the protocol references attendance in job-fitness indicator 5 ("Scored based on DTR records using the threshold table"), so this may be genuinely required |
| `deadlines/*` | `deadlineApi` | 501 | `Deadlines` absent | **Decide** — assessment-period configuration is a cluster requirement (R2); this may be its home |
| `ipcrf/{id}/jrb` | `ipcrfApi.listJrbRatings` | 404 | `JRBRatings` absent | **Remove** or implement — currently neither |

Removing a client is a one-line deletion in `api.js` plus the `stores/kra.js` file. **Record the decision either way** — that is the deliverable, not the deletion.

---

## F. Decisions required from management or ICT

Everything in `DECIDE` status above traces to one of these. They are listed in priority order; the first four block work that is otherwise ready to start.

1. **May an assessment score be finalised, shown, or used when components are missing?** Blocks D-02 and D-04 — which together affect 40 of 42 existing scores. *Owner: assessment owner.*
2. **May a submitted rating be corrected, and by whom, and is the prior value retained?** Submission locking is fixed; this blocks only the correction/reopening workflow. *Owner: assessment owner.*
3. **Is rater identity confidential from the ratee?** Blocks E-02 and shapes the target schema. *Owner: DPO with the assessment owner.*
4. **Is the IPAT protocol identical across all Innovation Cluster offices,** or may offices vary weights, rater types and hierarchy? Determines whether R2's configuration needs per-office overrides. *Owner: Innovation Cluster / Undersecretary's office.*
5. **Who owns PMES after turnover** — one ICT unit centrally, or one instance per office? Determines whether office segregation is rows-in-one-database or separate deployments. *Owner: ICT.*
6. **What is the retention period** for ratings, evidence files and audit logs? Blocks R4. *Owner: records officer with the DPO.*
7. **Which backend technology will the receiving ICT unit commit to maintaining?** Determines the Phase 2 implementation language. *Owner: ICT.*
8. **Is there an approved cluster-wide organizational reference** — office codes, unit structures, position ladders — or must PMES become the system of record for it? *Owner: HR / Innovation Cluster.*

---

## Summary

| Category | Count |
|---|---|
| Critical, open or awaiting decision | 5 |
| High | 7 |
| Medium | 8 |
| Low | 6 |
| **Fixed this review, pending deploy** | **8** |
| Reserved features awaiting a decision | 6 |
| Decisions required | 8 |

Three of the five criticals (E-01, D-01, D-04) concern data that already exists rather than code that must be written. They are therefore fixable **this week**, and none of them requires the migration.

## G. Portal UI slice — 2026-08-09

### Fixed in this slice — pending push and deploy

- **Office Personnel `Deactivate` fired with no confirmation.** A single click
  deactivated a roster row. Now routed through the existing global confirmation
  dialog. Severity: High (data integrity / operator error).
- **`Add Personnel` was visible without management rights.** The route was
  guarded but the control was not. Now gated on `canManageOfficePersonnel`.
  Severity: Low (the backend already rejected the write).
- **Deactivated roster rows had no reactivation path.** Undoing a deactivation
  required a direct spreadsheet edit, which is precisely what office
  administrators are meant to be kept out of. Added
  `PATCH office-personnel/:id/activate`. Severity: Medium.
- **Restricted-scope users were dropped into the STB rating form on login.**
  They now land on the Simplified Dashboard. Severity: Medium (usability).
- **Modals had no Esc, focus trap, or dialog ARIA.** Replaced by the shared
  `AppModal`. Severity: Medium (accessibility).
- **Ordinary portal personnel could reach the editable Profile & Settings
  screen.** Now redirected to read-only Personal Information at the route level.
  Severity: Medium. Note the backend profile-write routes are the actual control;
  this closes the UI path.

### Open — carried forward from this slice

- **`PortalService` draft-state derivation is unpaginated.** Deriving which
  tasks are drafts reads both rating sheets in full per request. Correct, but
  unmeasured against a full office dataset. Resolve before cluster-wide use.
- **`portal/office-summary` reads three sheets in full per request.** Same
  concern; acceptable at an office's scale, not yet measured.
- **`PortalService.myTasks` assumes `rateePosition` and `rateeDivisionName`
  exist on the assignment row.** Absent columns degrade to an em dash rather
  than failing. Confirm against a live provisioned office spreadsheet.
- **Cluster Overview has no per-office drill-down page.** The office monitoring
  table is read-only; selecting an office does not open an office detail view.
- **Report Center still uses its own visual language** and has not been moved
  onto the shared component set.
- **No automated test coverage for the new routes.** All verification to date is
  lint, build, smoke check, and Apps Script syntax parse.
