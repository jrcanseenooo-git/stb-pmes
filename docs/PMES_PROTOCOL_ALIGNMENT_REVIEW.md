# PMES ↔ Innovations Unified Performance Assessment Tool — Alignment Review

Source document: *Innovations Unified Performance Assessment Tool* (33 pp.), approved by
Undersecretary Eduardo M. Punay, Undersecretary for Innovations and Program Development.

Reviewed against: `feature/multi-office-assessment-scope` @ commit `6bcf1f4`,
Apps Script deployment `@224`.

Scope note per instruction: **OUSI, BangUn (Bangsamoro Umpungan sa Nutrisyon), and
EPAHP do not appear in the protocol.** They keep the STB structure for now and are
explicitly out of scope for FPO-specific work below.

---

## 1. Confirmed aligned — no change required

These were verified line-by-line against the protocol, not assumed.

| # | Protocol requirement | System | Location |
|---|---|---|---|
| A1 | Domain weights CBC 30% / FPO 55% / JF 15% | Matches | `IPATService.gs:207` |
| A2 | Overall = (CBCI×0.30)+(FPOI×0.55)+(JFI×0.15) | Matches | `IPATService.gs:19,1014` |
| A3 | Rater weights: Self 15, Peer 15, Subordinate 15, Immediate Supervisor 30, Skip 25 | Matches | `IPATService.gs:208–217` |
| A4 | No subordinate → 2nd peer, each peer 15% (combined 30%) | Matches (`peerStaffPrimary`/`peerStaffSecondary` both 0.15) | `IPATService.gs:212–213` |
| A5 | Descriptors: 4.00 Outstanding / 3.50–3.99 VS / 2.75–3.49 S / 2.00–2.74 NI / 1.00–1.99 RII | Matches | `IPATService.gs:371–375` |
| A6 | JF Indicator Score = (Self + Immediate Supervisor) ÷ 2 | Matches | `IPATService.gs:884–891` |
| A7 | JF rated only by ratee + immediate supervisor | Matches; filters to `['Self','Supervisor']` | `IPATService.gs` `computeJF` |
| A8 | JF variance between self and supervisor escalates to skip supervisor | Implemented as `jfVarianceFlagged` at gap ≥ 1.0 | `IPATService.gs` `computeJF` |
| A9 | 5 Heartwork themes (Makatao, Mapagpalaya, Marangal, Marunong, Mapagpabago) | Matches | `AssessmentCategoryService.gs:101–105` |
| A10 | CBC 4-point Likert (1 Never – 4 Always) | Matches | `IPATService.gs:380–383` |
| A11 | STB FPO = IPCR/DPCR at 55% | Matches (`syncFPO` from IPCRF) | `IPATService.gs` |
| A12 | Offices may adopt adjusted weights | Supported per-office via `AssessmentRules` `domainWeight` | `AssessmentRulesService.gs` |

---

## 2. Gaps, issues and required changes

### G1 — CRITICAL: rater assignment hierarchy is hardcoded to STB role names

`IPATRaterAssignmentService.gs:38–42`:

```js
const isStaff         = (r) => ['Staff', 'Technical Staff', 'Administrative Staff'].includes(r)
const isSectionHead   = (r) => r === 'Section Head'
const isDivisionChief = (r) => r === 'Division Chief'
const isABD           = (r) => r === 'Assistant Bureau Director'
const isDirector      = (r) => r === 'Bureau Director'
```

Assignment generation then branches on exactly these five predicates
(`IPATRaterAssignmentService.gs:~317`):

```js
if (isStaff(role))              raterList = _assignForStaff(...)
else if (isSectionHead(role))   raterList = _assignForSectionHead(...)
else if (isDivisionChief(role)) raterList = _assignForDivisionChief(...)
else if (isABD(role))           raterList = _assignForABD(...)
else if (isDirector(role))      raterList = _assignForDirector(...)

if (!raterList.length) return          // ← silent skip
```

**Failure mode.** The Office Registry's *Configure Registration Options* lets every
office define its own role list. The moment a participating office uses a role name
outside those five literals — "Program Manager", "Regional Coordinator", "Project
Development Officer III", "Focal Person" — every predicate returns false, `raterList`
stays empty, and the `return` skips that person **silently**: no assignment row, no
error, no log entry, no warning in the UI. That person is never rated and never
appears in anyone's rating tasks, and nothing in the system reports it.

**Current blast radius.** The provisioning default seeds the STB role list
(`Technical Staff / Section Head / Division Chief / Assistant Bureau Director /
Bureau Director`), so offices that have not customised their roles are currently
unaffected. The defect is latent, not yet firing — but it fires the first time any
office configures a role name of its own, which is the entire point of the
Configure Registration Options screen.

**Severity: Critical.** Silent data loss in the core assessment path, and a direct
blocker to cluster-wide rollout.

**Fix: the Dynamic Rater Tagging module — see Section 3.**

---

### G2 — Protocol internally contradicts itself on Job Fitness raters

- **Section IV.C** (narrative): *"For the Job Fitness domain, the assessment shall be
  undertaken only by the ratee and the immediate supervisor…"*
- **Section IV.E.1.c** (formula): `Job Fitness Indicator Score = (Ratee Self-Rating +
  Immediate Supervisor Rating) ÷ 2`
- **Section V.C** (the operational rating table): column headers read
  **Self-Rating | Peer | Supervisor** — a peer column the narrative and formula
  both exclude.

The system implements ratee + immediate supervisor only, consistent with the
narrative and the formula. It even carries an explicit cleanup:

```js
const isObsoleteAssignment = (r) => ['JFPeer', 'JobFitnessPeer'].includes(...)
```

— meaning a JF peer rater existed at some point and was deliberately retired.

**This needs a ruling from the protocol owners, not a developer decision.** If the
Peer column in the V.C table is authoritative, the JF formula, the JF rater
assignment, and every JF score computed to date all change.

**Recommendation:** keep the current behaviour (it follows two of the three
statements, including the explicit formula) and raise the V.C table as an erratum.

---

### G3 — Job Fitness parameter count: 7 in Section IV vs 5 in Section V.C

Section IV.A.1.c enumerates **seven** JF parameters:

1. Educational Qualification Fit
2. Relevant Work Experience Alignment
3. Training and Skills Applicability
4. **Workplace Conduct Suitability**
5. Attendance and Punctuality Compliance
6. Commitment to Organizational Objectives
7. **Work Readiness and Sustained Performance**

Section V.C — the actual operational rating table — carries only **five**, dropping
*Workplace Conduct Suitability* and *Work Readiness and Sustained Performance*.

The system implements the five from V.C (`IPATService.gs:360–366`), and divides by
5 to get the JF score.

**Impact if the seven are authoritative:** the JF divisor changes 5 → 7, two new
indicators must be added to the form, and **every existing JF and overall score is
invalidated and must be recomputed.** This is not a cosmetic difference.

**Needs a ruling.** Recommendation: confirm V.C (5 indicators) is the operational
list, since it is the one with an actual rating table.

---

### G4 — FPO instruments exist per office in the protocol; the system has only STB's

Protocol Section V.B defines **office-specific** Functional Performance Output
instruments for four offices:

| Office | Protocol FPO basis | System support |
|---|---|---|
| Social Technology Bureau | DSPMS via IPCR/DPCR | Implemented (`syncFPO` from IPCRF forms) |
| Pag-abot Program | Functional Competency Assessment (own indicators) | Manual entry only (`setFPO`) |
| Walang Gutom Program | Own indicators | Manual entry only (`setFPO`) |
| Tara, Basa! Tutoring Program | Own indicators **and its own 4-point qualitative scale** (Never / Sometimes / Most of the Time / Always) | Manual entry only (`setFPO`) |

`setFPO` accepts a number and stores it, so these three offices are *operable* but
have no structured instrument — the office admin computes the FPO score outside the
system and types in a figure. That is a real gap against the protocol, though not a
blocker: the protocol itself permits office-specific tools.

**Out of scope per instruction:** OUSI, BangUn, EPAHP — not in the protocol, keep STB
structure.

---

### G5 — Attendance & Punctuality has a defined threshold table but is rated by hand

Protocol Section V.C specifies exact bands:

| Rating | Threshold |
|---|---|
| 4 (Very Satisfactory) | 0–2 tardiness/month; 100% attendance (excl. filed VL/PL/SL) |
| 3 (Satisfactory) | 3–5 tardiness **or** 1–2 days unplanned absence/month |
| 2 (Unsatisfactory) | 6–9 tardiness **or** 3–5 days unplanned absence/month |
| 1 (Poor) | 10+ tardiness **or** frequent "Emergency Leaves"/month |

The system's JF indicator #5 label even says *"Scored based on DTR records using the
threshold table"* — but no DTR/attendance ingestion exists. It is rated manually 1–4
like every other JF indicator, so the threshold table is documentation only.

**Severity: Medium.** The score is still produced; it just isn't evidence-derived the
way the protocol prescribes.

---

### G6 — No Internal Performance Review and Appeal mechanism (Protocol Section VII)

The protocol mandates a **two-tier appeal process**:

- **Tier 1 — Informal reconciliation:** staff ↔ immediate supervisor / division chief,
  resolution window 3–5 working days (blank in the source document).
- **Tier 2 — Written appeal:** escalation to the IPDG Performance Review Committee /
  designated focal / TWG, 7–10 working days, must state the contested indicator,
  grounds, and attached evidence.
- **Final decision** by the Undersecretary for IPDG; then external recourse to the
  DSWD PMT via HRMDS.

The system today has reopening of a submitted rating (audit-logged), which is the
*outcome* of a successful appeal but not the process. Missing: appeal records,
committee role/permission, the two tiers, timers, evidence attachment, decision
trail, non-retaliation safeguards.

**Severity: High** for protocol compliance; **not** a blocker for a first assessment
cycle, since appeals only arise after results are released.

---

### G7 — Staff Development and Action Plan (SDAP/EDAP) not implemented (Protocol Section VI)

The protocol requires:
- Targeted capability interventions triggered at Level 1 (Basic) / Level 2
  (Intermediate) proficiency;
- Strengths-Based Mobility recommendations on job-fitness mismatch;
- Aggregation of individual EDAP data to design cluster-wide capacity building;
- The **70-20-10** learning framework as the preferred EDAP approach.

**Verified absent.** A grep for `Edap|EDAP|SDAP` across all 33 `apps-script/*.gs` files
and the entire `vue-frontend/src` tree returns zero matches. An `IPATEdap` sheet name
appears in the project data dictionary, but no code reads or writes it — if the tab
exists in the live spreadsheet it is orphaned.

**Severity: Medium.** Developmental follow-through, not assessment mechanics.

---

### G8 — STB position/salary-grade weight differentials not implemented

Protocol V.B.1 (STB) specifies FPO weight differentials by position classification and
salary grade:
- **22%** differential between SG II and III positions;
- **34%** differential between SG III and IV positions;
- ITO I categorised under the **Position III** weight category;
- Applies to SWO, PDO, IO positions II/III/IV.

The system stores `positionLevel` but applies no salary-grade weighting to FPO.

**Severity: Medium**, STB-only. Note this governs FPO target *weighting*, which today
enters the system as an already-computed IPCR figure — so it may legitimately live in
the IPCR process rather than in PMES. **Needs confirmation of where this belongs.**

---

### G9 — No documented basis for per-office weight adjustment

Protocol IV.D: *"Offices with existing approved assessment frameworks may adopt
adjusted weight allocations, **provided that** the three domains remain represented
and **the basis for adjustment is clearly documented**."*

`AssessmentRules` supports per-office `domainWeight` overrides (good), but has no
field capturing the approval/justification, and no validation that all three domains
remain represented and sum to 100%.

**Severity: Low–Medium.** Easy hardening: add a `basis`/`approvedBy` field and a
sum-to-1.0 + all-three-domains-present check on save.

---

## 3. Proposed module — Dynamic Rater Tagging

This is the fix for **G1** and matches the design described by the project owner.

### 3.1 Concept

Replace the five hardcoded `_assignForX()` functions with a **per-office, per-role
rater matrix** stored as data. The automated assignment engine keeps running exactly
as it does now — it just reads its rules from the matrix instead of from `if/else`
branches on STB role strings.

The administrator gains a screen that answers, for any role:
*"Who rates a Technical Staff, and at what weight?"*

### 3.2 Proposed data shape

New `RaterMatrix` tab in each office spreadsheet (and the central STB spreadsheet):

| Field | Purpose |
|---|---|
| `id` | Row id |
| `officeId` | Owning office |
| `rateeRole` | The role being rated, e.g. `Technical Staff` |
| `raterType` | `Self` / `Peer1` / `Peer2` / `Peer` / `Subordinate` / `Supervisor` / `SkipSupervisor` |
| `sourceRole` | Role the rater is drawn from, e.g. `Section Head` (blank for `Self`) |
| `sourceScope` | `self` / `same-section` / `same-division` / `office-wide` |
| `fallbackScope` | Used when the primary scope yields nobody, e.g. `same-division` |
| `weight` | Rater weight, e.g. `0.30` |
| `required` | If true, a missing rater is reported as an exception instead of skipped |
| `active`, `sequence`, `updatedAt`, `updatedBy` | Housekeeping |

### 3.3 STB seed (reproduces today's behaviour exactly)

| Ratee role | Rater type | Source role | Scope | Weight |
|---|---|---|---|---|
| Technical Staff | Self | — | self | 0.15 |
| Technical Staff | Peer1 | Technical Staff | same-section | 0.15 |
| Technical Staff | Peer2 | Technical Staff | same-section → same-division | 0.15 |
| Technical Staff | Supervisor | Section Head | same-section → same-division | 0.30 |
| Technical Staff | SkipSupervisor | Division Chief | same-division | 0.25 |
| Section Head | Self | — | self | 0.15 |
| Section Head | Peer | Section Head | same-division | 0.15 |
| Section Head | Subordinate | Technical Staff | same-section → same-division | 0.15 |
| Section Head | Supervisor | Division Chief | same-division | 0.30 |
| Section Head | SkipSupervisor | Assistant Bureau Director | office-wide | 0.25 |

…and equivalently for Division Chief, ABD, Director. Seeding this table from the
existing hardcoded rules is what makes the change **behaviour-preserving for STB** —
the critical safety property.

### 3.4 Admin screen

Route `/rater-matrix` (central + office admin, office-scoped):

- One card/section per ratee role;
- Each shows its rater rows: rater type, source role, scope, weight;
- A live **weight total** per role with a warning when it ≠ 100%;
- **Coverage check**: for the current roster, how many people in each role would
  actually receive a full rater set — surfacing the G1 silent-skip *before*
  assignments are generated, not after;
- Edit inline; changes are audit-logged;
- "Reset to STB default" for offices adopting the STB structure wholesale.

### 3.5 Engine change

`generateAssignments()` replaces the `if/else` chain with a matrix lookup:

```
for each evaluatable ratee:
    rows = raterMatrix(office, ratee.role)
    if rows is empty:
        record an EXCEPTION (not a silent return)   ← fixes G1
        continue
    for each row: resolve the rater by sourceRole + scope (+ fallback),
                  keep the existing anti-repeat rule,
                  emit the assignment
```

Anti-repeat, duplicate prevention, the "preserve existing/submitted" logic, and the
`LockService` write lock all stay as they are.

### 3.6 Scoring interaction

`computeCBC` already resolves rater weights from `AssessmentRules.cbcRaterWeight`.
The matrix's `weight` column should be **the same source of truth** — either the
matrix writes through to those rules, or `computeCBC` reads the matrix. Two
independent weight tables would drift and silently produce wrong scores; this must be
decided before implementation.

---

## 4. Recommended sequence

| Priority | Item | Rationale |
|---|---|---|
| 1 | **G1** Dynamic Rater Tagging | Critical, silent, blocks cluster rollout |
| 2 | **G2/G3** protocol rulings on JF raters + JF indicator count | Cheap to change now; invalidates historical scores if changed later |
| 3 | **G9** weight-rule validation + documented basis | Small, protects scoring integrity |
| 4 | **G4** FPO instruments for Pag-abot / Walang Gutom / Tara-Basa | Operable today via manual entry |
| 5 | **G6** Appeal mechanism | Needed before results are formally released |
| 6 | **G7** SDAP/EDAP | Post-assessment developmental follow-through |
| 7 | **G5** DTR-driven attendance scoring | Quality improvement |
| 8 | **G8** SG weight differentials | Confirm whether this belongs in PMES or IPCR |

---

## 5. Questions requiring a ruling before implementation

1. **JF raters (G2):** the V.C table shows a Peer column; the narrative and formula say
   ratee + immediate supervisor only. Which governs?
2. **JF indicator count (G3):** 5 (Section V.C) or 7 (Section IV.A.1.c)? Changing this
   later invalidates every JF and overall score already computed.
3. **Rater matrix vs. `cbcRaterWeight` (3.6):** single source of truth — should the
   matrix own the weights, or continue reading `AssessmentRules`?
4. **SG weight differentials (G8):** does this belong in PMES, or is it applied upstream
   in the IPCR before the figure reaches the system?
5. **Appeal windows (G6):** the protocol leaves the working-day counts blank
   ("suggests 3–5" and "7–10"). What values should be configured?
6. **OUSI / BangUn / EPAHP:** confirmed staying on STB structure — should they be
   flagged in the UI as "provisional / pending own FPO instrument"?
