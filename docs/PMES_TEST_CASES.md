# PMES — Test Case Suite

**Section K of the cluster-readiness review**
**Version:** 1.0 · 4 August 2026

## How to use this suite

Each case has a fixed ID. Record `Actual Result`, `Pass/Fail`, tester and date in your execution copy — keep this file as the master and copy it per cycle.

**Severity if failed:** `S1` blocks release · `S2` blocks cluster onboarding · `S3` fix before production sign-off · `S4` cosmetic/backlog.

**Test accounts required** (create in a non-production copy — see TD-00):

| Ref | Role | Notes |
|---|---|---|
| `TA-ADMIN` | System Administrator | full permissions |
| `TA-BUREAU` | Bureau Director | `view_bureau_monitoring` |
| `TA-DC-A` | Division Chief, Division A | `view_division_monitoring` |
| `TA-DC-B` | Division Chief, Division B | cross-division negative tests |
| `TA-SH-A` | Section Head, Division A, Section 1 | |
| `TA-STAFF-A1` … `A4` | Staff, Division A, Section 1 | peer pool |
| `TA-STAFF-B1` | Staff, Division B | cross-division negative tests |
| `TA-OFFICE2-*` | Same set in a second office | required for TC-30…TC-34 |

---

## TD-00 · Test data setup (do this first)

> **Never execute this suite against the production spreadsheet.** Take a Drive copy, point a separate Apps Script deployment's `SPREADSHEET_ID` at the copy, and run there. Several cases are destructive.

| Step | Action |
|---|---|
| 1 | Copy the production spreadsheet; rename `PMES Database — TEST <date>` |
| 2 | Create a **separate** Apps Script deployment with `SPREADSHEET_ID` set to the copy |
| 3 | Confirm the test deployment URL differs from production before any write test |
| 4 | Replace all real personnel rows with synthetic accounts, or run against an empty copy |
| 5 | Verify the test spreadsheet is **not** link-shared (see TC-02) |

---

# 1. Authentication and session

### TC-01 · Sign-in with a valid domain account
**Objective:** A `@dswd.gov.ph` account authenticates and reaches the dashboard.
**Preconditions:** `TA-STAFF-A1` exists and is active.
**Steps:** 1. Open the app. 2. Sign in with valid credentials. 3. Observe the landing route.
**Expected:** Authenticated; redirected to dashboard; profile loads; nav reflects Staff permissions.
**Severity if failed:** S1

### TC-02 · Production database is not publicly readable
**Objective:** Confirm remediation of finding E-01.
**Preconditions:** None.
**Steps:** 1. Open a private browser window signed out of all Google accounts. 2. Paste the spreadsheet URL.
**Expected:** A request-access or sign-in screen. **Not** the data.
**Severity if failed:** **S1 — halt all other testing and remediate**

### TC-03 · Non-domain account is rejected
**Objective:** Domain restriction is enforced server-side, not only in the UI.
**Steps:** 1. Obtain a Firebase token for a non-`dswd.gov.ph` account. 2. POST it directly to `/api/gas` with `route: "auth/me"`.
**Expected:** 401. The domain check must reject it at `AuthService.verifyToken` even though the UI never offered the option.
**Severity if failed:** S1

### TC-04 · Forged / tampered token is rejected
**Objective:** Signature verification is authoritative (regression guard for the historical decode-only bypass).
**Steps:** 1. Take a valid token. 2. Base64-decode the payload, change `email` to an administrator's, re-encode, leave the signature untouched. 3. Send as `token`.
**Expected:** 401. Under no circumstances should the request be processed as the substituted user.
**Severity if failed:** **S1 — critical**

### TC-05 · Expired token is rejected
**Steps:** Use a token with `exp` in the past.
**Expected:** 401, message directing the user to sign in again.
**Severity if failed:** S1

### TC-06 · Forced password change cannot be skipped
**Preconditions:** A user with `mustChangePassword = TRUE`.
**Steps:** 1. Sign in. 2. Attempt to dismiss the prompt, navigate away, and deep-link to `/dashboard`.
**Expected:** Prompt is non-skippable in all three attempts; clears only after Firebase `updatePassword` succeeds and the flag is cleared via API.
**Severity if failed:** S2

---

# 2. Registration and account lifecycle

### TC-07 · Self-registration creates a pending account
**Steps:** 1. Sign in with a domain account that has no PMES record. 2. Expect the registration form. 3. Submit with division, employment type and requested role.
**Expected:** `whoami` returns `registered: true, pending: true`; user lands on the pending screen, not the dashboard; a `Users` row exists with `pendingActivation = TRUE`, `selfRegistered = TRUE`.
**Severity if failed:** S2
**Note:** this case specifically exercises the seven columns added to `InitSheets.gs` on 2026-08-04 (finding D-07).

### TC-08 · Rebuild preserves the full Users schema
**Objective:** Regression guard for D-07 — the disaster-recovery path must not produce a narrower schema.
**Steps:** 1. On an empty test spreadsheet run `initializeSheets()`. 2. Read the `Users` header row.
**Expected:** All 29 columns present, including `pendingActivation`, `requestedRole`, `selfRegistered`, `firstName`, `middleName`, `lastName`, `suffix`.
**Severity if failed:** **S1** — a silent-data-loss defect in the restore procedure

### TC-09 · Activation and deactivation
**Steps:** As `TA-ADMIN`, activate a pending user; confirm they reach the dashboard. Then deactivate; confirm they cannot.
**Expected:** State transitions take effect on the next request; both actions appear in `AuditLog`.
**Severity if failed:** S2

### TC-10 · Non-administrator cannot manage users
**Steps:** As `TA-STAFF-A1`, call `users/{otherId}` with PUT, and `users/{id}/activate`.
**Expected:** 403 on both. Verify by direct API call, not only by checking the button is hidden.
**Severity if failed:** S1

---

# 3. Authorization and data scoping

### TC-11 · Division scoping on list endpoints
**Steps:** As `TA-DC-A`, call `users`, `mov`, `ipat-assignments`, `dashboard/summary`.
**Expected:** Only Division A records. No Division B record appears in any response.
**Severity if failed:** S1

### TC-12 · Division scoping on single-record reads (IDOR)
**Objective:** Single getters enforce the same scope as their lists.
**Steps:** As `TA-DC-A`, obtain a Division B record id (from an admin session), then request `users/{id}`, `mov/{id}`, `ipat-assignments/{rateeId}/ratee-assignments` directly.
**Expected:** 403 on each. Enumerating ids must not leak cross-division data.
**Severity if failed:** S1

### TC-13 · Reports honour server-side scope, not the request
**Objective:** Regression guard for `ReportsService._resolveDivisionScope`.
**Steps:** As `TA-DC-A`, POST `reports/generate` with `divisionId` set to **Division B's id**.
**Expected:** The report returns **Division A** rows only. The requested divisionId is ignored, not honoured, and not an error.
**Severity if failed:** **S1**

### TC-14 · Bureau-only reports are refused to division users
**Steps:** As `TA-DC-A`, POST `reports/generate` with `type: "bureau-analytics"`.
**Expected:** 403 with a clear message. Also confirm the type is absent from `reports/options` for that user.
**Severity if failed:** S2

### TC-15 · Staff can read their own audit entries only
**Steps:** As `TA-STAFF-A1`, call `audit`, then `audit?userId={anotherUserId}`.
**Expected:** Own records only; 403 on the cross-user query.
**Severity if failed:** S2

---

# 4. Rater assignment

### TC-16 · Generation creates the protocol's rater set per role
**Preconditions:** Clean period; users at every role including a Bureau Director.
**Steps:** As `TA-ADMIN`, POST `ipat-assignments/generate` for semester/year.
**Expected:** Staff → Self, Peer1, Peer2, Supervisor, SkipSupervisor. Section Head → Self, Peer, Subordinate, Supervisor, SkipSupervisor. Division Chief → Self, Peer, Subordinate, Supervisor, SkipSupervisor. ABD → Self, Peer, Subordinate, Supervisor. Director → Self, Subordinate.
**Severity if failed:** S1

### TC-17 · Every ratee receives a Supervisor
**Objective:** Regression guard for D-02 (live: 25 of 36 ratees had none; 24 of 28 Staff had none).
**Steps:** After TC-16, list all assignments and group by ratee.
**Expected:** Every Staff, Section Head and Division Chief ratee has exactly one `Supervisor` assignment. Any ratee without one is reported by the generator rather than silently omitted.
**Severity if failed:** **S1**

### TC-18 · Section matching survives naming variation
**Objective:** Regression guard for D-03.
**Preconditions:** Two users in the same real section recorded as `"Children and Youth"` and `"Children and Youth Section"`.
**Steps:** Generate assignments.
**Expected:** After the section reference table is implemented, both are treated as the same section and are eligible as peers for each other. **Today this fails by design** — record it as a known failure until D-03 is remediated.
**Severity if failed:** S2

### TC-19 · Re-running generation does not disturb completed work
**Steps:** Generate; complete several assignments; generate again for the same period.
**Expected:** Completed assignments unchanged (rater, status, timestamps). Only missing rater roles are backfilled. `replaced` counts only pending reassignments.
**Severity if failed:** S1

### TC-20 · No duplicate assignments
**Steps:** Run generation three times consecutively.
**Expected:** At most one assignment per `(ratee, raterType, semester, year)`. Second and third runs report `generated: 0`.
**Severity if failed:** S1

### TC-21 · No duplicate assessment records
**Objective:** Regression guard for D-01 (live: 34 of 47 keys duplicated).
**Steps:** Run generation three times; count `IPATRecords` rows per `(rateeId, semester, year)`.
**Expected:** Exactly 1. **Historical duplicates must be reconciled separately** — this case guards against new ones.
**Severity if failed:** **S1**

### TC-22 · A rater is not assigned to rate themselves as a peer
**Steps:** Inspect generated assignments.
**Expected:** For each ratee, `raterId !== rateeId` for every type except `Self`. Peer1 ≠ Peer2.
**Severity if failed:** S2

### TC-23 · Anti-repeat across cycles
**Steps:** Generate for semester 1, then semester 2 with the same population.
**Expected:** Where an alternative candidate exists, Peer and Subordinate differ from the previous cycle's selection.
**Severity if failed:** S3

---

# 5. Rating submission

### TC-24 · Submit and complete
**Steps:** As an assigned rater, submit a full CBC set via `ipat-assignments/{id}/submit-ratings`.
**Expected:** Ratings stored; assignment `Completed`; `SAVE_CBC` audit entry written.
**Severity if failed:** S1

### TC-25 · Rating range is enforced
**Objective:** Regression guard for the validation added 2026-08-04.
**Steps:** Submit ratings of 1, 2, 2.5, 4 (accept); then 0, 5, -1, `"abc"`, `""`, `null` (reject).
**Expected:** First set stored. Second set each rejected with 400 naming the 1–4 range. **No value is silently coerced to 1.**
**Severity if failed:** **S1**

### TC-26 · Resubmission does not duplicate rows
**Steps:** In a test setup where the assignment is still pending, save the same rater's CBC rows through the lower-level rating service twice.
**Expected:** Row count unchanged — upsert on `(ipatId, raterId, themeId, indicatorIdx)`; values updated only before assignment completion.
**Severity if failed:** S2

### TC-27 · Submitted ratings are locked
**Objective:** Regression guard for finding E-04 / R6.
**Steps:** Submit and complete an assignment; submit different ratings for the same assignment.
**Expected:** Rejected with 409. No CBC/JF rating rows change. The frontend shows the assignment as submitted/locked and does not offer an update action.
**Severity if failed:** **S2**

### TC-28 · Proxy submission is marked
**Objective:** Finding E-05 — **currently expected to FAIL.**
**Steps:** As `TA-ADMIN`, submit ratings for an assignment belonging to another rater.
**Expected (target):** Stored row records both the nominal rater and the actual submitter (`submittedByUserId`, `submittedOnBehalf`).
**Expected (today):** Stored under the other person's identity with no marker.
**Severity if failed:** S2

### TC-29 · A non-assigned user cannot submit
**Steps:** As `TA-STAFF-A2`, submit against an assignment belonging to `TA-STAFF-A3`.
**Expected:** 403.
**Severity if failed:** S1

---

# 6. Multi-office (required before onboarding office #2)

> These cases are the acceptance criteria for the local multi-office work on
> `feature/multi-office-assessment-scope`. The repository now contains the
> office registry, provisioning, office-scoped assessment routing, onboarding,
> and approval-to-personnel sync pieces needed for TC-30 through TC-33, but the
> cases still require live Apps Script/spreadsheet validation with real or test
> office spreadsheets. TC-34 remains dependent on the separate per-office
> assessment-rule configuration work.

### TC-30 · Rater pools do not cross offices
**Preconditions:** Two offices, each with a full role set.
**Steps:** Generate assignments for both.
**Expected:** No assignment pairs a ratee in Office 1 with a rater in Office 2, for any rater type. Specifically verify the ABD case using two office-scoped spreadsheets.
**Severity if failed:** **S1**

### TC-31 · Identical division codes in different offices do not merge
**Preconditions:** Both offices have a division coded `DFD`.
**Steps:** As Office 1's Division Chief, list users, assignments and reports.
**Expected:** Zero Office 2 records. Scoping keys on office **and** division, never division alone.
**Severity if failed:** **S1**

### TC-32 · Office administrator is confined to their office
**Steps:** As an office-level administrator, attempt to read and modify another office's users and assessment records.
**Expected:** 403 on all cross-office operations.
**Severity if failed:** S1

### TC-33 · Cluster administrator sees all offices
**Steps:** As a cluster administrator, run the consolidated report.
**Expected:** All offices, correctly grouped and attributed by office.
**Severity if failed:** S2

### TC-34 · Per-office configuration is honoured
**Preconditions:** Two offices configured with different domain weights.
**Steps:** Submit identical ratings for equivalent ratees in each; compute.
**Expected:** Different overall scores, each correct for its own office's configured weights.
**Severity if failed:** S2

---

# 7. Score computation

### TC-35 · Full-instrument computation
**Steps:** Complete all raters, set FPO, compute.
**Expected:** `overall = (CBC×0.30 + FPO×0.55 + JF×0.15)`, `totalWeightPresent = 1.0`, `missingComponents` empty, descriptor matches the band.
**Severity if failed:** S1

### TC-36 · Renormalisation is correct **and disclosed**
**Objective:** Findings D-02 / D-04. Live data: only 2 of 42 records had all three components.
**Steps:** Compute a record with CBC only; then CBC+JF; then FPO only.
**Expected:** Score equals the renormalised value, **and** the response and audit entry report `appliedComponents`, `missingComponents` and `totalWeightPresent` (0.30, 0.45, 0.55 respectively).
**Severity if failed:** **S1**

### TC-37 · Partial scores cannot be finalised without a decision
**Objective:** Depends on the open policy question.
**Steps:** Attempt to finalise a record with `totalWeightPresent < 1.0`.
**Expected:** Per the approved policy — either blocked, or marked `Provisional` with the missing components recorded. **Do not execute until the policy is decided.**
**Severity if failed:** S2

### TC-38 · Both computation paths agree
**Objective:** Regression guard for the R2 de-duplication.
**Steps:** Compute the same record via `ipat/{id}/compute` and via the auto-compute path triggered by the final rater completing.
**Expected:** Identical `overallScore` to two decimals. Verified against 42 live records on 2026-08-04 with 0 discrepancies — that must remain true.
**Severity if failed:** S1

### TC-39 · Descriptor bands
**Steps:** Compute records scoring 4.00, 3.99, 3.50, 3.49, 2.75, 2.74, 2.00, 1.99, 1.00.
**Expected:** Outstanding ≥4.00; Very Satisfactory ≥3.50; Satisfactory ≥2.75; Needs Improvement ≥2.00; Requires Immediate Intervention below 2.00. **Check the boundaries specifically** — a 0.59 divergence in live data crossed a band.
**Also assert:** the backend `qualitativeDescriptor` and the frontend `descriptorForScore` return the **same** label for every one of those values. They are two independent copies of the same band table and nothing enforces that they agree — see R2.
**Severity if failed:** S1

### TC-40 · Job fitness uses Self and Supervisor only
**Steps:** Insert a JF rating with `raterType: "Peer"`; compute.
**Expected:** Excluded. Live data holds 65 such legacy rows and they must remain inert.
**Severity if failed:** S2

### TC-41 · Deductions apply in the right order
**Steps:** Set an NTE percentage and an offence deduction; compute.
**Expected:** NTE reduces the CBC base before weighting; offence deduction applies to the overall after renormalisation; score floors at 0.
**Severity if failed:** S2

---

# 8. Reporting and export

### TC-42 · All six report types generate
**Steps:** As `TA-BUREAU`, generate each of the six types in each of the three formats.
**Expected:** 18 successes. CSV downloads; Excel/PDF open from Drive. `rowCount` matches the visible rows.
**Severity if failed:** S2

### TC-43 · Reports tab is created on demand
**Objective:** The tab is absent from the live database.
**Steps:** On a test copy with no `Reports` tab, generate a report.
**Expected:** Tab created with all 11 columns; metadata row appended; no error.
**Severity if failed:** S1

### TC-44 · Empty result is reported clearly
**Steps:** Generate for a division/period with no data.
**Expected:** `rowCount: 0` and a clear message — not an empty file download and not a generic error.
**Severity if failed:** S3

### TC-45 · Exported files are not link-shared
**Steps:** Generate an Excel and a PDF report; inspect each file's Drive permissions.
**Expected:** No `type: anyone` permission on either.
**Severity if failed:** **S1**

### TC-46 · CSV escaping handles embedded commas and quotes
**Steps:** Generate a report covering records whose section contains commas (live data has several, e.g. `"Women, Older Persons, and Persons with Disabilities"`).
**Expected:** Column alignment preserved when reopened; embedded quotes doubled.
**Severity if failed:** S2

### TC-47 · Every export is audited
**Steps:** Generate several reports; read `AuditLog`.
**Expected:** One `GENERATE_REPORT` entry each, recording type, scope, period and row count.
**Severity if failed:** S2

---

# 9. Destructive operations

### TC-48 · Period reset previews before deleting
**Objective:** The route added 2026-08-04.
**Steps:** As `TA-ADMIN`, GET `ipat-assignments/reset-period?semester=1&year=2026`.
**Expected:** Per-sheet counts and a total; **nothing deleted**; response carries the confirmation phrase and warning.
**Severity if failed:** S1

### TC-49 · Period reset requires the exact confirmation phrase
**Steps:** POST the reset with a wrong phrase, an empty phrase, then the exact phrase.
**Expected:** 400 on the first two; deletion only on the third; `RESET_PERIOD` audit entry with per-sheet counts.
**Severity if failed:** S1

### TC-50 · Only a System Administrator may reset
**Steps:** Attempt preview and reset as `TA-BUREAU` and `TA-DC-A`.
**Expected:** 403 on both, for both verbs.
**Severity if failed:** S1

### TC-51 · Database maintenance requires preview then confirm
**Steps:** For `maintenance/database-reset`, `normalize-columns`, `fresh-schema`: GET the preview, then POST without confirmation.
**Expected:** Preview is non-destructive; unconfirmed POST refused.
**Severity if failed:** S1

---

# 10. Resilience and concurrency

### TC-52 · Concurrent submissions for the same ratee
**Steps:** Two raters submit for the same ratee simultaneously (two browsers, submit together).
**Expected:** Both rating sets persist; no lost update; the record's scores reflect both. **Note:** `LockService` is currently used in one file only, so this is a genuine risk — record the actual result carefully.
**Severity if failed:** S2

### TC-53 · Duplicate request (double-click)
**Steps:** Double-click Submit; or replay the same request twice.
**Expected:** One logical effect. No duplicate rows, no double-counting.
**Severity if failed:** S2

### TC-54 · Interrupted submission
**Steps:** Begin a submission and kill the network mid-request.
**Expected:** Either fully applied or not applied. Partial rating sets must not persist. If they can, document it — Sheets has no transactions.
**Severity if failed:** S2

### TC-55 · Rate limiting
**Steps:** Issue 70 requests within one minute as one user; separately, 10 rapid `reset-password` calls.
**Expected:** 429 after 60 general requests. Auth-adjacent routes should limit far sooner — **currently they do not** (finding E-06); record as a known failure.
**Severity if failed:** S3

### TC-56 · Session expiry mid-workflow
**Steps:** Begin a rating; let the token expire; submit.
**Expected:** Clear "session expired" message and a path back to sign-in. **No silent data loss** of entered ratings.
**Severity if failed:** S2

---

# 11. Migration acceptance (Phase 2)

### TC-57 · Record-count reconciliation
**Expected:** Every target table's row count equals the source count minus documented exclusions. Exclusions itemised and approved in advance.
**Severity if failed:** S1

### TC-58 · Score parity
**Expected:** **Every** migrated assessment result matches its pre-migration `overallScore` to two decimals. Zero tolerance — these are personnel records.
**Severity if failed:** **S1**

### TC-59 · Referential integrity after load
**Expected:** 0 foreign-key orphans. The source has 0 across 636 references today; that must hold.
**Severity if failed:** S1

### TC-60 · Unique constraints hold
**Expected:** `(ratee_id, assessment_period_id)` and the rating unique keys accept the migrated data with 0 violations — after D-01 reconciliation.
**Severity if failed:** S1

### TC-61 · Name mapping is complete
**Expected:** Every source column maps to a target column or an approved exclusion. No column silently dropped.
**Severity if failed:** S1

### TC-62 · API contract unchanged
**Steps:** Point the unmodified frontend at the new backend by environment variable alone.
**Expected:** Every screen functions with no frontend code change. This is the core premise of the recommended migration path — if it fails, the approach needs revisiting before cutover.
**Severity if failed:** **S1**

### TC-63 · Rollback
**Steps:** After cutover, revert the environment variable to the Apps Script deployment.
**Expected:** Full function restored within minutes. Rollback is a configuration change, not a restore.
**Severity if failed:** S1

---

## Coverage summary

| Area | Cases | Currently expected to fail |
|---|---|---|
| Authentication and session | TC-01…06 | TC-02 until E-01 is remediated |
| Registration and lifecycle | TC-07…10 | — |
| Authorization and scoping | TC-11…15 | — |
| Rater assignment | TC-16…23 | TC-17, TC-18, TC-21 (D-01/D-02/D-03) |
| Rating submission | TC-24…29 | TC-27, TC-28 (E-04/E-05) |
| Multi-office | TC-30…34 | TC-30…33 pending live two-office validation; TC-34 pending R2 per-office configuration |
| Score computation | TC-35…41 | TC-36 partially, TC-37 pending policy |
| Reporting and export | TC-42…47 | — |
| Destructive operations | TC-48…51 | — |
| Resilience and concurrency | TC-52…56 | TC-55 (E-06); TC-52/54 unverified |
| Migration acceptance | TC-57…63 | Phase 2 |
| **Total** | **63** | **12 known open or live-pending** |

A suite where 13 cases are expected to fail on day one is not a broken suite — it is an honest one. Each expected failure is traced to a numbered finding with an owner. Re-run the full suite after each remediation and move cases out of the "expected to fail" column as they close.
