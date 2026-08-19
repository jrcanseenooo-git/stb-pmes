# PMES — Data Dictionary and Naming Standard

**Section D of the cluster-readiness review**
**Source:** live production spreadsheet `PMES Database`, read 4 August 2026 — **20 tabs, 380 columns**. Structure and row counts are from the live file, not from `InitSheets.gs` (the two have diverged; see D-07).

## How to read this document

**Data classification**

| Code | Meaning |
|---|---|
| `ID` | Direct identifier — identifies a person on its own |
| `P1` | Personal information (RA 10173 §3(g)) |
| `P2` | **Sensitive** personal information (RA 10173 §3(l)) — higher processing bar |
| `P0` | Non-personal / reference data |

**Access classification**

| Code | Who may see it |
|---|---|
| `REF` | Reference data — any authenticated user |
| `INT` | Internal — scoped by division/office |
| `CONF` | Confidential — data subject, their supervisor, and administrators |
| `REST` | Restricted — administrators and the data owner only |

**Retention** proposals are **starting points for records-management approval**, not policy. Nothing here is binding until your records officer and DPO confirm it against the agency retention schedule.

**Renaming rule (binding).** Proposed names are for the **relational target only**. Do not rename anything in the live spreadsheet — `SpreadsheetService.updateRow` fails silently on unknown columns, so a partial rename destroys data while reporting success. See §3.

---

# 1. Entity overview

| # | Current tab | Rows | Cols | Proposed relational table | Purpose | Owner |
|---|---|---|---|---|---|---|
| 1 | `Users` | 51 | 29 | `user_account` + `personnel` | Identity, org assignment, authorisation | HR / System Admin |
| 2 | `Divisions` | 4 | 9 | `organizational_unit` | Org structure | HR |
| 3 | `MasterKRALibrary` | 64 | 16 | `kra_library_item` | Reusable KRA/indicator catalogue | Assessment owner |
| 4 | `SystemSettings` | 1 | 7 | `system_setting` | Key/value configuration | System Admin |
| 5 | `FocalAssignments` | 0 | 13 | `focal_assignment` | Review-routing focal persons | Assessment owner |
| 6 | `IPCRForms` | 0 | 48 | `performance_form` | IPCRF/CCEF header + final rating | Ratee / supervisor |
| 7 | `FormEntries` | 0 | 24 | `performance_form_entry` | One target line per row | Ratee / supervisor |
| 8 | `Accomplishments` | 0 | 33 | `accomplishment` | Standalone accomplishment module | Ratee |
| 9 | `Revisions` | 0 | 8 | `accomplishment_revision` | Status-change history | System |
| 10 | `ReviewComments` | 0 | 9 | `review_comment` | Reviewer comments per entry | Reviewer |
| 11 | `MOVFiles` | 0 | 19 | `evidence_file` | Drive evidence metadata | Uploader |
| 12 | `Notifications` | 0 | 9 | `notification` | In-app notifications | System |
| 13 | `AuditLog` | 248 | 10 | `audit_log` | Action history | System Admin |
| 14 | `IPATRecords` | 81 | 28 | `assessment_result` | Per-ratee, per-period scores | Assessment owner |
| 15 | `IPATCBCRatings` | 164 | 15 | `competency_rating` | Individual competency ratings | Rater |
| 16 | `IPATJFRatings` | 176 | 14 | `job_fitness_rating` | Individual job-fitness ratings | Rater |
| 17 | `IPATEdap` | 0 | 11 | `development_plan` + `development_plan_item` | Employee development action plan | Ratee / supervisor |
| 18 | `IPATRaterAssignments` | 164 | 15 | `rating_assignment` | Who rates whom, per period | Assessment owner |
| 19 | `AssessmentCategories` | 10 | 10 | `assessment_category` | Question grouping | Assessment owner |
| 20 | `AssessmentContent` | 30 | 21 | `assessment_criterion` | Versioned question bank | Assessment owner |

**Absent from the live database** though defined in the initialisers: `KRAs`, `SuccessIndicators`, `Evaluations`, `Deadlines`, `JRBRatings`, `PeerAssignments`, `AttendanceRecords`, `AttendanceRatings`. `Reports` was also absent and is now created on demand by `ReportsService`. See the known-issues register for the implement/remove decision on each.

**Missing entities the cluster scope requires:** `office`, `section`, `position`, `assessment_period`, `rater_type`, `rating_weight_rule`, `role`, `permission`. All eight are currently either absent or expressed as code literals.

---

# 2. Field-level dictionary

## 2.1 `Users` → `user_account` + `personnel` (51 rows, 29 cols)

The widest-reaching table. It conflates three concerns — authentication identity, HR personnel record, and authorisation grants — which is why it should split in the relational model.

| Current field | Proposed | Type | Req | Key | Allowed / validation | Class | Access | Notes |
|---|---|---|---|---|---|---|---|---|
| `id` | `id` | varchar(20) | Y | **PK** | `USR-` + 12 hex | ID | INT | `generateId('USR-')` |
| `uid` | `firebase_uid` | varchar(64) | Y | UQ | Firebase UID | ID | REST | External identity key |
| `email` | `email` | varchar(255) | Y | UQ | must end `@dswd.gov.ph` | ID | INT | Enforced in `verifyToken` |
| `fullName` | `full_name` | varchar(150) | Y | | | ID | INT | Denormalised into 11 other tables |
| `role` | `role_id` → FK | varchar(40) | Y | **FK** | System Administrator, Bureau Director, Assistant Bureau Director, Division Chief, Section Head, Staff | P1 | INT | Currently free text; must become FK to `role` |
| `divisionId` | `organizational_unit_id` | varchar(20) | Y | **FK** | → `Divisions.id` | P1 | INT | 0 orphans verified |
| `divisionName` | *(drop — join)* | varchar(150) | N | | | P1 | INT | Denormalised copy |
| `section` | `section_id` → FK | varchar(150) | N | | free text — **26 distinct values, 3 written 2+ ways** | P1 | INT | **D-03.** Drives rater matching by exact string |
| `position` | `position_id` → FK | varchar(150) | N | | free text — 17 distinct values | P1 | INT | **D-08.** `"PDO III"` vs `"Project Development Officer III"` |
| `employeeNo` | `employee_number` | varchar(20) | N | UQ | **must be TEXT format** | ID | CONF | **D-06.** 8 formats; 1 auto-coerced to a date by Sheets |
| `type` | `employment_type` | varchar(40) | N | | Regular, Contract of Service (COS), Casual, Job Order | P1 | CONF | **Rename — `type` means four different things across four tables** |
| `positionLevel` | `position_level` | varchar(10) | N | | I…IV | P1 | INT | |
| `sgLevel` | `salary_grade` | varchar(10) | N | | | **P1** | CONF | Compensation-adjacent |
| `tempPassword` | **DELETE** | varchar(64) | N | | | **P2** | REST | **Verified 0 of 51 populated.** Drop the column — it should never exist |
| `tempPasswordHash` | `temp_password_hash` | varchar(128) | N | | SHA-256+salt | P2 | REST | 0 of 51 populated |
| `mustChangePassword` | `must_change_password` | boolean | N | | TRUE/FALSE | P0 | REST | Forces non-skippable prompt |
| `permissionGroups` | *(→ `user_role` table)* | varchar(255) | N | | comma/pipe delimited | P1 | REST | **Delimited list in one cell** — becomes a join table |
| `permissions` | *(→ `user_permission` table)* | varchar(255) | N | | comma/pipe delimited | P1 | REST | Same |
| `active` | `is_active` | boolean | Y | | TRUE/FALSE | P0 | INT | 50 TRUE, 1 other/blank |
| `createdAt` | `created_at` | timestamp | Y | | ISO 8601 | P0 | INT | |
| `updatedAt` | `updated_at` | timestamp | N | | ISO 8601 | P0 | INT | |
| `lastLoginAt` | `last_login_at` | timestamp | N | | ISO 8601 | P1 | REST | Written on **every** `getProfile` — see R9 |
| `pendingActivation` | `is_pending_activation` | boolean | N | | TRUE/FALSE | P0 | INT | **Not in `InitSheets.gs`** — D-07 |
| `requestedRole` | `requested_role` | varchar(40) | N | | as `role` | P1 | INT | **Not in `InitSheets.gs`** |
| `selfRegistered` | `is_self_registered` | boolean | N | | TRUE/FALSE | P0 | INT | **Not in `InitSheets.gs`** |
| `firstName` | `first_name` | varchar(80) | N | | | ID | INT | **Not in `InitSheets.gs`** |
| `middleName` | `middle_name` | varchar(80) | N | | | ID | INT | **Not in `InitSheets.gs`** |
| `lastName` | `last_name` | varchar(80) | N | | | ID | INT | **Not in `InitSheets.gs`** |
| `suffix` | `name_suffix` | varchar(20) | N | | Jr, Sr, III… | ID | INT | **Not in `InitSheets.gs`.** 1 row holds the magic string `"N/A"` |

**Required additions:** `office_id` (R1), `section_id`, `position_id`, `role_id`, `retention_until`.
**Retention proposal:** personnel record for service tenure + agency schedule; `lastLoginAt` and auth artefacts 1 year.

## 2.2 `Divisions` → `organizational_unit` (4 rows)

| Current | Proposed | Type | Req | Key | Class | Notes |
|---|---|---|---|---|---|---|
| `id` | `id` | varchar(20) | Y | **PK** | P0 | Human-readable slugs: `dfd`, `pid`, `staed`, `admin-pool` |
| `name` | `name` | varchar(150) | Y | UQ | P0 | |
| `code` | `code` | varchar(20) | Y | UQ | P0 | DFD, PID, STAED, AP |
| `chiefId` | `head_user_id` | varchar(20) | N | **FK** → `Users.id` | P1 | Empty in all 4 live rows |
| `chiefName` | *(drop — join)* | varchar(150) | N | | P1 | Denormalised |
| `parentId` | `parent_unit_id` | varchar(20) | N | **FK** self | P0 | Self-reference exists but is unused — the hook for a hierarchy |
| `color` | `display_color` | varchar(20) | N | | P0 | UI only |
| `active` | `is_active` | boolean | Y | | P0 | |
| `createdAt` | `created_at` | timestamp | Y | | P0 | |

**Required additions:** `office_id` (R1), `unit_type` (division / section / unit) so one table can express the whole hierarchy.
**Note:** the four rows are seeded STB divisions hard-coded in [InitSheets.gs:209](../apps-script/InitSheets.gs). This becomes per-office configuration.

## 2.3 `IPATRecords` → `assessment_result` (81 rows, 28 cols)

The official result record. **34 of 47 logical keys are duplicated — see D-01.**

| Current | Proposed | Type | Req | Key | Allowed / validation | Class | Access |
|---|---|---|---|---|---|---|---|
| `id` | `id` | varchar(20) | Y | **PK** | `IPAT-`+12 hex | P0 | INT |
| `rateeId` | `ratee_id` | varchar(20) | Y | **FK** → `personnel` | | ID | CONF |
| `rateeName` | *(drop — join)* | varchar(150) | N | | | ID | CONF |
| `divisionId` | `organizational_unit_id` | varchar(20) | Y | **FK** | | P1 | INT |
| `divisionName` | *(drop — join)* | varchar(150) | N | | | P1 | INT |
| `position` | *(drop — join)* | varchar(150) | N | | | P1 | INT |
| `positionLevel` | `position_level` | varchar(40) | N | | role at time of assessment | P1 | INT |
| `semester` | `assessment_period_id` | varchar(20) | Y | **FK** | 1, 2 | P0 | INT |
| `year` | *(folded into period)* | integer | Y | | | P0 | INT |
| `hasSubordinate` | `has_subordinate` | boolean | Y | | TRUE/FALSE | P0 | INT |
| `status` | `status` | varchar(20) | Y | | Draft, …, Finalized | P0 | INT |
| `cbcBaseScore` | `competency_base_score` | decimal(3,2) | N | | 1.00–4.00 | **P2** | CONF |
| `cbcScore` | `competency_score` | decimal(3,2) | N | | 1.00–4.00 | **P2** | CONF |
| `cbcNteLevel` | `nte_level` | varchar(20) | N | | none, … | **P2** | REST |
| `cbcNteDeductionPct` | `nte_deduction_pct` | decimal(5,2) | N | | 0–100 | **P2** | REST |
| `cbcOffenseLevel` | `offense_level` | varchar(20) | N | | none, … | **P2** | REST |
| `cbcOffenseDeduction` | `offense_deduction` | decimal(5,2) | N | | | **P2** | REST |
| `cbcDeductionNote` | `deduction_note` | text | N | | | **P2** | REST |
| `cbcDeductionBy` | `deduction_by_user_id` | varchar(20) | N | **FK** | | P1 | REST |
| `cbcDeductionByName` | *(drop — join)* | varchar(150) | N | | | P1 | REST |
| `cbcDeductionAt` | `deduction_at` | timestamp | N | | | P0 | REST |
| `fpoScore` | `functional_output_score` | decimal(3,2) | N | | 1.00–4.00 | **P2** | CONF |
| `jfScore` | `job_fitness_score` | decimal(3,2) | N | | 1.00–4.00 | **P2** | CONF |
| `overallScore` | `overall_score` | decimal(3,2) | N | | 1.00–4.00 | **P2** | CONF |
| `descriptor` | `qualitative_descriptor` | varchar(60) | N | | Outstanding (≥4.00) / Very Satisfactory (≥3.50) / Satisfactory (≥2.75) / Needs Improvement (≥2.00) / Requires Immediate Intervention | **P2** | CONF |
| `ipcrfFormId` | `performance_form_id` | varchar(20) | N | **FK** | | P0 | INT | **0 of 81 populated** |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | timestamp | Y/N | | | P0 | INT |

**The NTE and offence fields are sensitive personal information** — administrative-offence status. They warrant `REST` access and a specific lawful basis.

**Required additions:** `office_id`; **`applied_weights`** and **`missing_rater_types`** (D-02/D-04 — a renormalised score must record what it was renormalised from); `UNIQUE (ratee_id, assessment_period_id)`.

## 2.4 `IPATCBCRatings` → `competency_rating` (164 rows)

| Current | Proposed | Type | Req | Key | Validation | Class | Access |
|---|---|---|---|---|---|---|---|
| `id` | `id` | varchar(20) | Y | **PK** | `CBC-`+12 hex | P0 | REST |
| `ipatId` | `assessment_result_id` | varchar(20) | Y | **FK** | | P0 | REST |
| `rateeId` | `ratee_id` | varchar(20) | Y | **FK** | | ID | REST |
| `raterId` | `rater_id` | varchar(20) | Y | **FK** | | ID | **REST** — see E-02 |
| `raterName` | **drop** | varchar(150) | N | | | ID | REST | Confidentiality risk |
| `raterType` | `rater_type_id` | varchar(20) | Y | **FK** | Self, Peer, Peer1, Peer2, Subordinate, Supervisor, SkipSupervisor | P0 | REST |
| `themeId` | `competency_theme_id` | varchar(20) | Y | **FK** | HEARTWORK theme | P0 | REF |
| `themeName` | *(drop — join)* | varchar(80) | N | | | P0 | REF |
| `indicator` | *(drop — join)* | text | N | | | P0 | REF |
| `indicatorIdx` | **`indicator_sequence`** | smallint | Y | | 0–4 | P0 | REF | **Rename — it is an ordinal, not an id** |
| `rating` | `rating_value` | smallint | Y | | **1–4** — now enforced | **P2** | REST | Live: min 2, max 4, 0 out of range |
| `semester` / `year` | `assessment_period_id` | | Y | **FK** | | P0 | INT |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | timestamp | | | | P0 | INT |

**Unique key:** `(assessment_result_id, rater_id, competency_theme_id, indicator_sequence)` — already the upsert key in code; 0 violations live.
**Required additions:** `office_id`; `submitted_by_user_id` + `submitted_on_behalf` (E-05); `protocol_version`.

## 2.5 `IPATJFRatings` → `job_fitness_rating` (176 rows)

Same shape as 2.4 minus theme, plus `evidence`.

| Current | Proposed | Notes |
|---|---|---|
| `indicator` / `indicatorIdx` | *(join)* / **`indicator_sequence`** | 0–4 — **5 indicators**, though the file header comment claims 7 |
| `rating` | `rating_value` | 1–4; live min 2 max 4 |
| `evidence` | `evidence_text` | Free text — may contain third-party personal data; `P1`, `CONF` |
| `raterType` | `rater_type_id` | **Live data holds 65 `Peer` rows** that `computeJF` correctly ignores — D-05 |

**Unique key:** `(assessment_result_id, rater_id, indicator_sequence)`.

## 2.6 `IPATRaterAssignments` → `rating_assignment` (164 rows)

| Current | Proposed | Type | Req | Key | Validation | Class |
|---|---|---|---|---|---|---|
| `id` | `id` | varchar(20) | Y | **PK** | `RASN-`+12 hex | P0 |
| `semester` / `year` | `assessment_period_id` | | Y | **FK** | | P0 |
| `rateeId` | `ratee_id` | varchar(20) | Y | **FK** | | ID |
| `rateeName` | *(drop — join)* | | N | | | ID |
| `rateeDivisionId` | `ratee_unit_id` | varchar(20) | Y | **FK** | | P1 |
| `rateeRole` | `ratee_role_id` | varchar(40) | N | **FK** | snapshot at assignment time | P1 |
| `rateeSection` | `ratee_section_id` | varchar(150) | N | **FK** | free text today — D-03 | P1 |
| `raterId` | `rater_id` | varchar(20) | Y | **FK** | | ID |
| `raterName` | *(drop — join)* | | N | | | ID |
| `raterType` | `rater_type_id` | varchar(20) | Y | **FK** | **live also holds retired `JFPeer` — 30 rows, D-05** | P0 |
| `ipatRecordId` | `assessment_result_id` | varchar(20) | Y | **FK** | | P0 |
| `status` | `status` | varchar(20) | Y | | Pending, Completed | P0 |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | timestamp | | | | P0 |

**Unique key:** `(assessment_result_id, rater_type_id)` — one rater per type per ratee per period.
**Required additions:** `office_id`; `completed_at`; `protocol_version`; `is_superseded`.

## 2.7 `AuditLog` → `audit_log` (248 rows)

| Current | Proposed | Notes |
|---|---|---|
| `id` | `id` | `AUD-`+12 hex |
| `timestamp` | `occurred_at` | ISO 8601 |
| `userId` / `userEmail` / `userName` / `role` | `actor_user_id` + join | Four denormalised copies of the actor; keep the id, drop the rest |
| `action` | `action` | Uncontrolled vocabulary — should be an enum |
| `module` | `module` | Same |
| `details` | `details` | Free text; **may contain personal data** — `P1`, `REST` |
| `ipAddress` | `ip_address` | **Empty in all 248 rows** — Apps Script cannot read client IP. Populate at the Vercel proxy instead |

**Required additions:** `office_id`; `entity_type` + `entity_id` (so an audit row is traceable to a record); append-only enforcement.
**Retention:** per COA/ICT policy — typically longer than the operational data.

## 2.8 `AssessmentContent` → `assessment_criterion` (30 rows)

The best-designed table in the system — it already has versioning, status, period, and change notes.

| Current | Proposed | Notes |
|---|---|---|
| `id` | `id` | |
| `domain` / `category` | `domain_id` / `category_id` | FK to `AssessmentCategories` |
| `questionText` / `guidanceText` | `question_text` / `guidance_text` | |
| `sequence` | `sequence` | Ordering |
| `scaleType` | `scale_type` | **Should define the 1–4 bound now hard-coded in `IPATService`** |
| `required` / `evidenceRequired` | `is_required` / `is_evidence_required` | |
| `applicableRaters` / `applicableLevels` | *(→ join tables)* | Delimited lists in single cells |
| `status` / `period` / `version` / `hasBeenUsed` / `changeNotes` | as-is (snake_case) | Version control — retain this pattern |
| `createdBy` / `createdByName` / `createdAt` / `updatedAt` / `archivedAt` | `created_by_user_id` + join | |

## 2.9 Remaining tables — summary

Full column lists are in §1; these are currently empty in production (0 rows) except `MasterKRALibrary` and `AssessmentCategories`.

| Table | Key observations |
|---|---|
| `MasterKRALibrary` (64) | `weightII`/`weightIII`/`weightIV` — weights per position level in **three separate columns**; should be a `kra_weight` child table keyed on position level. `applicableTo`, `functionType` are free text. |
| `AssessmentCategories` (10) | Has both `domainId`/`domainName` and `categoryId`/`categoryName` — two levels in one table; split into `assessment_domain` and `assessment_category`. |
| `IPCRForms` (0) | 48 columns — the widest table. Contains **two parallel review-routing blocks** (`targetReview*`, `ratingReview*`) with identical shape; in the relational model this becomes one `form_review_routing` table with a `review_type` discriminator, removing 10 columns. Four doc-generation timestamps likewise become a `generated_document` child table. |
| `FormEntries` (0) | Substantially overlaps `Accomplishments` — settle whether these are one entity **before** migration. |
| `Accomplishments` (0) | Uses `division` for the display name where every other table uses `divisionName`. Has `deleted`/`deletedAt` soft-delete — note soft delete is **not** disposal under the DPA. |
| `MOVFiles` (0) | `driveFileId`/`driveUrl` — evidence may contain third-party personal data; `P1`, `CONF`. Only table with `divisionId` but no `divisionName`. |
| `IPATEdap` (0) | **`rows` column holds serialized JSON** — a child entity flattened into one cell. Becomes `development_plan_item`. |
| `FocalAssignments` (0) | `assignmentType` + `focalRole` (Primary/Alternate) — clean design. |
| `Notifications` / `Revisions` / `ReviewComments` | Straightforward; `type`/`module` need controlled vocabularies. |
| `SystemSettings` (1) | Key/value. **This is where the hard-coded weights, descriptor bands and hierarchy should move (R2)** — one row today. |

---

# 3. Naming standard and migration rule

## 3.1 Recommended standard

| Artifact | Standard | Example | Status |
|---|---|---|---|
| JS variables, JSON fields, API request/response properties | `camelCase` | `rateeId` | **Already consistent — do not churn** |
| Vue components, JS classes | `PascalCase` | `ReportsView` | Already consistent |
| Google Sheets tabs (current system) | `PascalCase`, plural | `IPATRecords` | Already dominant |
| **Relational tables (target)** | **`snake_case`, singular** | `rating_assignment` | New |
| **Relational columns (target)** | **`snake_case`** | `ratee_id` | New |
| Primary key | `id` | | Already universal |
| Foreign key | `<entity>_id` | `office_id`, `assessment_period_id` | New |
| API routes | `kebab-case`, plural resources | `ipat-assignments` | Already consistent |
| Status values | `Title Case` | `Completed` | Already consistent |
| Config keys | `SCREAMING_SNAKE` | `SPREADSHEET_ID` | Already consistent |
| Boolean fields | `is_` / `has_` prefix | `is_active` | New — current mix of `active`, `verified`, `deleted` |
| Timestamps | `<verb>_at` | `created_at` | Already consistent |

**Decision: `camelCase` at the API boundary, `snake_case` in the database, mapped in the data-access layer.** This keeps the existing frontend and API contract completely unchanged through migration while giving the database conventional SQL naming that a PHP/MySQL maintainer expects. It is the option that costs least and surprises fewest people.

## 3.2 Current-to-proposed naming map (priority renames)

| Current | Proposed | Type | Reason | Dependencies |
|---|---|---|---|---|
| `IPATCBCRatings` | `competency_rating` | Table | Expands unexplained abbreviation | `IPATService`, `Router`, `api.js`, EvaluationView |
| `IPATJFRatings` | `job_fitness_rating` | Table | Expands unexplained abbreviation | as above |
| `IPATRaterAssignments` | `rating_assignment` | Table | Entity is generic, not instrument-specific | assignment engine, EvaluationView |
| `IPATRecords` | `assessment_result` | Table | Describes what it holds | most of the IPAT module |
| `IPATEdap` | `development_plan` (+ `_item`) | Table | Expands abbreviation; splits JSON cell | EDAP module |
| `MOVFiles` | `evidence_file` | Table | Business meaning over acronym | MOV module |
| `MasterKRALibrary` | `kra_library_item` | Table | Singular, consistent | KRA library module |
| `IPCRForms` | `performance_form` | Table | Covers both IPCRF and CCEF | IPCRF module, DocGen |
| `rateeId` / `raterId` | `ratee_id` / `rater_id` | Column | SQL convention | submission, results, reports |
| **`indicatorIdx`** | **`indicator_sequence`** | Column | **It is an ordinal, not an identifier** | rating form, computation, reports |
| **`Users.type`** | **`employment_type`** | Column | **`type` means 4 different things in 4 tables** | Users module, registration |
| `Accomplishments.type` | `instrument_type` | Column | same | Accomplishments, dashboard |
| `Reports.type` | `report_type` | Column | same | Reports module |
| `Notifications.type` | `notification_type` | Column | same | Notifications |
| `Accomplishments.division` | `division_name` → then FK | Column | Every other table uses `divisionName` | Accomplishments, dashboard |
| `cbcNteLevel` etc. | `nte_level` etc. | Column | Drop instrument prefix | IPAT module |
| `sgLevel` | `salary_grade` | Column | `sg` is unexplained | Users |
| `IPATEdap.rows` | → `development_plan_item` table | Structure | JSON-in-a-cell | EDAP module |
| `Users.permissionGroups` / `.permissions` | → `user_role` / `user_permission` | Structure | Delimited list in one cell | AuthService, usePermissions |

## 3.3 Glossary — approved abbreviations

Retain these; they are protocol vocabulary. **Document them; do not invent new ones.**

| Abbrev | Expansion |
|---|---|
| IPAT | Innovations Performance Assessment Tool |
| IPCRF | Individual Performance Commitment and Review Form |
| CCEF | Competency and Core Effectiveness Form |
| CBC | Core Behavioral Competencies |
| JF | Job Fitness |
| FPO | Functional Performance Output |
| EDAP | Employee Development Action Plan |
| MOV | Means of Verification |
| KRA | Key Result Area |
| SI | Success Indicator |
| NTE | Notice to Explain |
| DPCR | Division Performance Commitment and Review |
| SG | Salary Grade |
| STB | Social Technology Bureau |

## 3.4 Safe migration procedure (binding)

Renames happen **once**, as part of the move to the relational schema. Never incrementally in the live spreadsheet.

1. **Full backup** — Drive copy of the spreadsheet, dated, stored outside the working folder. Record the file id.
2. **Version tag** the repository at the pre-migration commit.
3. **Freeze writes** — announced maintenance window; no rating submissions in flight.
4. **Field mapping table** — every source column to every target column, reviewed and signed off. §3.2 is the starting point, not the finished artefact.
5. **Dependency trace per rename** — for each, grep the full repo for the string across `.gs`, `.js` and `.vue`; list every API contract, report and formula touched. `indicatorIdx` alone appears in the sheet, `IPATService` (write + compute), `IPATRaterAssignmentService`, and the rating form.
6. **Transform and load** into the relational schema. Resolve D-01 duplicates and D-03 section variants **before** load, not during.
7. **Reconciliation:** row counts per table must match source minus documented exclusions; **every computed score must match the pre-migration value to two decimals**; foreign-key orphans must be 0 (they are 0 today — that must hold).
8. **Duplicate check** on every new unique constraint; expect 0.
9. **Parallel run** for one complete assessment period, comparing outputs daily.
10. **UAT** by at least one non-STB office.
11. **Cutover** by environment variable.
12. **Rollback:** the Apps Script deployment and the spreadsheet remain untouched and functional for one full period. Rollback is a config change, not a restore.

## 3.5 Interim rule — logical names now, physical names later

Where a name is confusing but renaming is unsafe today, the physical name stays and this dictionary supplies the **logical/display name**. Use the logical name in UI labels, reports, and all documentation. This is why `indicatorIdx` should already read as "Indicator Sequence" on any screen and in every report column header, while the sheet column keeps its current name until migration.
