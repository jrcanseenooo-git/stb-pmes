# PMES — Live Database Data-Quality Findings

**Source:** production spreadsheet `PMES Database` (`1lCJaa2y…SRqrU`), read 4 August 2026
**Method:** full export of all 20 tabs, parsed and analysed programmatically. Counts below are exact, not sampled. No personnel records are reproduced in this document — findings are stated as counts and patterns, consistent with the data-minimisation principle this review recommends.

**Live scale:** 51 users · 4 divisions · 81 IPAT records · 164 rater assignments · 164 competency ratings · 176 job-fitness ratings · 248 audit entries · 64 master KRA rows · 30 assessment questions · 10 assessment categories.

**Bottom line:** referential integrity is clean, and rating values are all in range. The problems are not corruption — they are **duplication, missing raters, and uncontrolled vocabulary**, and three of them are currently affecting official scores.

---

## D-01 · CRITICAL · Seven employees have two different official scores for the same period

**Observed.** `IPATRecords` holds **81 rows for 47 distinct (ratee, semester, year) combinations**. 34 of those 47 keys — **72%** — have duplicate rows. Of the duplicated keys, 8 have a computed `overallScore` on more than one row, and in **7 of those 8 the two scores disagree**:

| Score on record A | Score on record B | Gap |
|---|---|---|
| 3.47 | 4.00 | 0.53 |
| 3.51 | 2.92 | 0.59 |
| 3.26 | 3.54 | 0.28 |
| 3.58 | 3.82 | 0.24 |
| 3.42 | 3.63 | 0.21 |
| 3.83 | 3.90 | 0.07 |
| 3.75 | 3.78 | 0.03 |

A 0.59 gap crosses a descriptor boundary. Under the bands actually implemented (≥4.00 *Outstanding*, ≥3.50 *Very Satisfactory*, ≥2.75 *Satisfactory*, ≥2.00 *Needs Improvement*, else *Requires Immediate Intervention*), the pair 3.51 / 2.92 means the same person is simultaneously **"Very Satisfactory"** and **"Satisfactory"** for the same semester, depending on which row is read.

> **Correction (2026-08-04).** An earlier revision of this document quoted the bands as *Excellent Alignment / Satisfactory Alignment / Needs Development* at 3.50 / 2.50 / 1.50. Those came from the stale header comment at [IPATService.gs:20](../apps-script/IPATService.gs), not from the code. `qualitativeDescriptor` ([IPATService.gs:344](../apps-script/IPATService.gs)) and the frontend `descriptorForScore` agree with each other and use the bands above. The header comment is wrong and is logged as DOC-3.

**Which one wins?** `_findCanonicalIpatRecord` ([IPATRaterAssignmentService.gs:128](../apps-script/IPATRaterAssignmentService.gs)) sorts duplicates by `_recordScore` — a heuristic combining linked-assignment count, completed count, whether a score exists, and creation time — and returns the top one. So the score an employee sees is decided by a tie-break heuristic, not by policy or by a supervisor's decision. It is deterministic, so the same row wins each time, but nothing records *why* that row is authoritative.

**Root cause — identified 2026-08-04, and it was a live defect, not history.**

`IPATService.create` *does* have a duplicate guard that throws 409:

```js
const existing = SpreadsheetService.getAllRows(sheet).find(r =>
  r.rateeId  === (body.rateeId || profile.id) &&
  r.semester === body.semester &&          // <-- no String() coercion
  String(r.year) === String(body.year)     // <-- coerced
)
```

Google Sheets returns a numeric cell as a **Number**, while the API always transmits the period as a **String**. So `1 === '1'` evaluated false, **the guard never fired**, and every create produced another row. `year` was coerced; `semester` was not.

The same uncoerced comparison existed in `IPATService.list` (making S1 records invisible in the UI once the calendar rolled to S2) and twice in `DashboardService`. `IPATRaterAssignmentService` coerces both sides in all ten of its comparisons, which is why the assignment views worked correctly throughout — the inconsistency between the two services is what made this hard to see.

`findCanonicalRecord` / `_recordScore` were written to pick a winner among duplicates at read time. They are a workaround for this defect, not a design choice.

**Fixed in `PMES_v187`** — all four comparisons now coerce both sides. This stops new duplicates. It does **not** clean up the 81 existing rows; the reconciliation below is still required.

One duplicate key additionally has **ratings split across both record ids**, meaning neither row holds the complete rating set.

**Remediation.** Do not delete anything yet. Reconciliation procedure:

1. Export `IPATRecords`, `IPATCBCRatings`, `IPATJFRatings`, `IPATRaterAssignments` to a dated backup copy.
2. For each duplicated key, produce a comparison sheet: both record ids, their scores, their linked assignment counts, their rating-row counts, created/updated timestamps.
3. For the one key with split ratings, **re-point the orphaned rating rows** to the surviving record id, then recompute.
4. Choose the survivor by an explicit documented rule — recommended: the record with the complete rating set; where both are complete, the later `updatedAt`. Record the choice per employee.
5. Recompute the survivor via `ipat/{id}/compute` so the score derives from ratings rather than from history.
6. Have the assessment owner confirm each of the 7 affected employees' final score **before** it is used for any personnel decision.
7. Only then archive the superseded rows to a `IPATRecords_Superseded` tab — archive, do not hard-delete.
8. Re-run the duplicate check; expect 0.

**Prevention.** In Sheets: keep the `_findCanonicalIpatRecord` guard and add a pre-write check in `create`. In the relational target: `UNIQUE (ratee_id, assessment_period_id)`.

---

## D-02 · CRITICAL · 25 of 36 ratees have no Supervisor rating — the largest single weight

**Observed.** Of 36 ratees with active (non-obsolete) assignments:

| Role | Ratees | Have a Supervisor assignment | Have a SkipSupervisor assignment |
|---|---|---|---|
| Staff | 28 | **4** | 27 |
| Section Head | 4 | 4 | 4 |
| Division Chief | 3 | 3 | 0 |
| Assistant Bureau Director | 1 | 0 | 0 |
| **Total** | **36** | **11** | **31** |

**24 of 28 Staff have no Supervisor assigned.** Supervisor carries **30%** of the competency score — the heaviest rater weight in the instrument.

**What happens to the score.** `computeCBC` renormalises: it sums only the weights actually present and divides by that sum ([IPATService.gs:630](../apps-script/IPATService.gs)). So a staff member rated by Self (15%), Peer1 (15%), Peer2 (15%) and SkipSupervisor (25%) has a total present weight of 0.70, and those four raters are scaled up to 100%. **Self-assessment rises from 15% to 21.4% of the competency score, and the immediate supervisor contributes nothing.** The resulting number looks like a complete score and is stored as one. Nothing in the record or the UI indicates which weights were actually applied.

**Root cause.** `_assignForStaff` ([IPATRaterAssignmentService.gs:170](../apps-script/IPATRaterAssignmentService.gs)) looks for a Section Head in the same division **and the same section string**:

```js
const supervisor = sec
  ? allUsers.find(u => isSectionHead(u.role) && (u.divisionId||'') === div && (u.section||'').trim() === sec)
  : allUsers.find(u => isSectionHead(u.role) && (u.divisionId||'') === div)
```

There are only **7 Section Heads for 39 Staff**, and section matching is exact-string against free-text data (see D-03). Most staff simply have no Section Head whose `section` value matches theirs.

For Division Chiefs and the ABD the cause is different: `skipSupervisor` for a Division Chief is a Bureau Director, and `supervisor` for an ABD is a Bureau Director — and **there is no user with role `Bureau Director` in the database at all** (role distribution: System Administrator 1, Staff 39, Section Head 7, Division Chief 3, Assistant Bureau Director 1). Those raters resolve to `undefined` and are silently omitted.

**Remediation.**
1. **Decide the policy first.** Is a score valid when the supervisor component is absent? The protocol presumably says no. If so, `computeOverall` should refuse to finalise, or mark the record `Provisional`, when a mandatory rater type is missing.
2. Populate the missing `Bureau Director` account, or configure the hierarchy so the top role present in an office is handled explicitly rather than by silent omission.
3. Fix section data (D-03), then re-run `ipat-assignments/generate` — it backfills missing rater roles without disturbing completed ones ([IPATRaterAssignmentService.gs:371](../apps-script/IPATRaterAssignmentService.gs)).
4. Add `appliedWeights` and `missingRaterTypes` columns to `IPATRecords` so every score carries the composition it was computed from. **Renormalisation is a legitimate design choice, but it must be visible.**
5. Re-verify the 42 records that already carry an `overallScore`.

**Blocks cluster-wide use:** Yes. This will reproduce in every office that has more staff than section heads — which is every office.

---

## D-03 · HIGH · Section names are free text, and three sections are written more than one way

**Observed.** 26 distinct `section` strings across 51 users. Three groups are the same section written differently:

| Variant A | Variant B |
|---|---|
| `"Other Marginalized Group"` (2 users) | `"Other Marginalized Group Section"` (2 users) |
| `"Children and Youth Section"` (6 users) | `"Children and Youth"` (1 user) |
| `"Other Marginalized Groups"` (1 user) | `"Other Marginalized Groups Section"` (2 users) |

Note also `"Other Marginalized Group"` vs `"Other Marginalized Groups"` — singular and plural are separate values again, so that one section is plausibly written **four** ways.

Additionally, **13 of 51 users have an empty `section`**. For those, `_assignForStaff` falls back to treating the whole division as the section, so their "peers" are drawn from a much wider pool than the protocol intends.

**Impact.** Peer selection matches on `(u.section||'').trim() === sec`. The single user in `"Children and Youth"` can never be selected as a peer for the six in `"Children and Youth Section"`, nor they for them — they are, to the system, in different sections. This is the direct mechanical cause of much of D-02.

**Remediation.**
1. Create a `Sections` reference table with `id`, `divisionId`, `name`, `active` — sections are currently the only level of the org hierarchy with no table of their own.
2. Add `sectionId` to `Users`; keep `section` as the display name during transition.
3. Map the 26 strings to canonical sections with the division chiefs' confirmation — **this is theirs to confirm, not a mechanical de-duplication**; "Other Marginalized Group" and "Other Marginalized Groups" may genuinely be one section or two.
4. Fill the 13 empty sections.
5. Change matching to `sectionId`.
6. Re-run assignment generation.

---

## D-04 · CRITICAL · Only 2 of 42 official scores were computed from the complete instrument

**Observed.** 42 `IPATRecords` carry an `overallScore`. Recomputing every one of them from its stored components (0 discrepancies against the stored values — the arithmetic is sound) gives this composition:

| Components actually present | Records | Weight present before renormalisation | What the "overall score" really is |
|---|---|---|---|
| FPO only | **16** | 55% | the IPCRF rating, relabelled |
| CBC + JF | **16** | 45% | competency + job fitness, no functional output |
| CBC only | **8** | 30% | **the competency score, relabelled** |
| CBC + FPO + JF | **2** | 100% | a genuine IPAT overall score |

**40 of 42 stored scores are partial.** Eight employees have an "IPAT Overall Score" and a qualitative descriptor that are, arithmetically, nothing more than their competency score. Sixteen have one that is nothing more than their FPO.

The renormalisation is working exactly as designed — `calculateOverall` sums only the weights present and divides by that sum, so a single-component record produces `component ÷ 1.0` and looks like a complete result. Nothing in the record, the API response, or the UI distinguished a 100%-weight score from a 30%-weight score. **The design intent (tolerate missing components) and the operational reality (almost everything is missing) have diverged.**

Combined with D-02, the eight CBC-only records are competency scores that themselves omitted the supervisor's 30%.

**Related:** `IPCRForms` contains **0 rows** and `FormEntries` contains **0 rows** — the IPCRF/CCEF module has no data at all. Consequently **0 of 81** IPAT records have an `ipcrfFormId`; all 18 FPO values were manually encoded via `set-fpo` rather than synced. Per the documented rule, populated `fpoScore` + blank `ipcrfFormId` = manual encoding and is valid.

**Partially remediated in code.** `calculateOverall` and `computeOverall` now return `appliedComponents`, `missingComponents` and `totalWeightPresent`, and the `COMPUTE_OVERALL` audit entry records them. A renormalised score can no longer be produced without leaving a trace of what it was built from. **This is diagnosis, not a fix** — the policy question below still has to be answered.

**Additionally:** `IPCRForms` contains **0 rows** and `FormEntries` contains **0 rows**. The entire IPCRF/CCEF module — the source of FPO via `sync-fpo` — has no data. Consequently **0 of 81** IPAT records have an `ipcrfFormId`; all 18 FPO values were manually encoded via `set-fpo`.

Per the documented rule, a populated `fpoScore` with a blank `ipcrfFormId` is valid and means manual encoding. So the 18 are legitimate. The question is the 24 with no FPO at all.

**Remediation.** Policy decision required: may an IPAT overall score be finalised without FPO? If not, block finalisation and mark those 24 `Provisional` pending FPO encoding. If yes, record on each affected row that FPO was absent and weights were renormalised (same `appliedWeights` column as D-02).

---

## D-05 · MEDIUM · 30 obsolete `JFPeer` assignment rows remain, 12 marked Completed

**Observed.** 30 of 164 assignment rows (18%) have `raterType` `JFPeer` — a rater type the current protocol has retired. `isObsoleteAssignment` filters them out of every read path ([IPATRaterAssignmentService.gs:44](../apps-script/IPATRaterAssignmentService.gs)), so they do not affect scores. 12 of them are marked `Completed`, meaning raters did real work against a protocol version that no longer counts.

Separately, `IPATJFRatings` contains **65 rows with `raterType: 'Peer'`** alongside 81 `Self` and 30 `Supervisor`. `computeJF` correctly filters to Self and Supervisor only ([IPATService.gs:820](../apps-script/IPATService.gs)), so these 65 rows are inert — but they are 37% of the job-fitness table and they mislead anyone reading the data directly.

**Remediation.** Archive both sets to a dated `_Superseded` tab with a note recording the protocol change that retired them. Do not silently delete — 12 people completed those assignments and the record of their participation has value. Add a `protocolVersion` column to assignments so future retirements are self-documenting.

---

## D-06 · MEDIUM · `employeeNo` holds eight different formats, one auto-converted to a date

**Observed.** 41 of 51 users have an `employeeNo`. Format distribution (digits masked as `9`):

| Pattern | Count | Note |
|---|---|---|
| `99-9999` | 33 | the apparent intended format |
| `999999` | 2 | separator dropped |
| `9999-99-99T99:99:99.999Z` | **1** | **Google Sheets coerced the entry into a date** |
| `ID No. 99-9999` | 1 | label typed into the value |
| `99-99999`, `99-999`, `9999`, `999` | 1 each | inconsistent |

The date coercion is the classic Sheets typing failure: an entry resembling a date is silently converted, and the original employee number is unrecoverable from the cell. That row's `employeeNo` is now a 1965 timestamp.

**Remediation.** Recover the correct number from HR records for the affected user. Set the `employeeNo` column format to plain text. Add format validation on write. In the relational target, `VARCHAR` with a `CHECK` constraint — never a date or numeric type.

---

## D-07 · MEDIUM · Schema drift between the live database and the initialisers

**Observed.** The live `Users` tab has **29 columns**; `InitSheets.gs` defines **22**. Seven columns exist in production that the code does not know about:

`pendingActivation`, `requestedRole`, `selfRegistered`, `firstName`, `middleName`, `lastName`, `suffix`

They are read by `AuthService.whoami` (`pendingActivation`) and written by the self-registration flow, so they are load-bearing — they were added directly to the sheet without being added to the initialiser.

**Why this is dangerous.** `DatabaseMaintenanceService.rebuildFreshDatabase` and `initializeSheets()` build from `InitSheets.gs`. A rebuild — the documented disaster-recovery path — would produce a `Users` tab **missing those seven columns**. And `SpreadsheetService.updateRow` logs a warning but does not fail on unknown columns ([SpreadsheetService.gs:64](../apps-script/SpreadsheetService.gs)), so registration would appear to succeed while `pendingActivation` silently went nowhere, and `whoami` would treat every registrant as active.

**Your restore procedure would produce a subtly broken system that reports success.**

**Remediation — do this before any rebuild is ever run:** add the seven columns to the `Users` definition in `InitSheets.gs`. Then audit every other tab the same way. Then add a startup schema-drift check that compares live headers against the definitions and logs divergence.

**Also missing:** nine tabs defined in the initialisers do not exist in the live database at all — `KRAs`, `SuccessIndicators`, `Evaluations`, `Reports`, `Deadlines`, `JRBRatings`, `PeerAssignments`, `AttendanceRecords`, `AttendanceRatings`. `Reports` was required by the reporting module added in this review; that module now creates the tab on demand rather than failing.

---

## D-08 · LOW · Uncontrolled vocabulary in `position`; magic strings

**Observed.** 17 distinct free-text `position` values across 51 users, including both `"PDO III"` and `"Project Development Officer III"` for what is evidently the same position. One `suffix` field contains the literal string `"N/A"` rather than being empty — a magic value that any "has a suffix?" check will treat as true. One user has `active` neither `TRUE` nor blank.

**Remediation.** `Positions` reference table with `positionId` on `Users`; `position` retained as display text during transition. Normalise `"N/A"` to empty. These matter more than they look: position drives `positionLevel`, which drives rater assignment.

---

## D-09 · What is correct

| Check | Result |
|---|---|
| Referential integrity — `IPATRecords.rateeId` → `Users.id` | **0 orphans / 81** |
| `IPATRaterAssignments.rateeId`, `.raterId`, `.ipatRecordId` | **0 orphans / 164** |
| `IPATCBCRatings.ipatId`, `.raterId` | **0 orphans / 164** |
| `IPATJFRatings.ipatId`, `.raterId` | **0 orphans / 176** |
| `Users.divisionId` → `Divisions.id` | **0 orphans / 51** |
| Rating values within the 1–4 scale | **0 out of range** (CBC min 2 max 4; JF min 2 max 4) |
| Rows typed `Self` where `raterId ≠ rateeId` | **0** |
| Duplicate rating rows on the upsert key | **0** |
| Plaintext `tempPassword` stored | **0 of 51** |

Referential integrity being perfect across 636 foreign-key references in a database with no foreign-key enforcement is genuinely impressive, and it says the application write paths are disciplined. The validation added in this review (rejecting ratings outside 1–4) is confirmed safe: **no existing row would be rejected by it.**

---

## Remediation order

| # | Finding | Before |
|---|---|---|
| 1 | **D-07** add the 7 missing columns to `InitSheets.gs` — **done** | any rebuild is ever attempted |
| 2 | **D-04** decide whether a partial-weight score may carry a descriptor | **any of the 42 scores is used or shown** |
| 3 | **D-01** reconcile the 7 divergent scores | any personnel decision uses them |
| 4 | **D-03** section reference table and data clean-up | re-running assignment generation |
| 5 | D-02 re-run generation, add `appliedWeights` | the next assessment cycle |
| 6 | D-06 recover the coerced employee number | turnover |
| 7 | D-05 archive obsolete rows | turnover |
| 8 | D-08 reference tables | Phase 2 migration |

Items 2, 3 and 4 need the assessment owner's decisions, not just engineering. They are listed in the open-questions section of the readiness assessment.
