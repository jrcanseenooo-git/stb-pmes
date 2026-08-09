# PMES Multi-Office Scope Implementation Log

## 2026-08-07 - Backend Provisioning Backbone

Branch: `feature/multi-office-assessment-scope`

### Summary

Added the first local-only implementation slice for the Innovation Cluster Personnel Assessment Portal as a role-based and office-based scope inside the existing PMES application. No Vercel deployment was performed.

### Files Modified

- `apps-script/Code.gs`
- `apps-script/AuthService.gs`
- `apps-script/Router.gs`
- `apps-script/OfficeSchemaService.gs`
- `apps-script/OfficeRegistryService.gs`
- `apps-script/OfficeProvisioningService.gs`
- `vue-frontend/src/services/api.js`
- `vue-frontend/src/composables/usePermissions.js`
- `vue-frontend/src/router/index.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/UsersView.vue`
- `vue-frontend/src/views/LoginView.vue`
- `vue-frontend/src/views/OfficeRegistryView.vue`

### What Changed

- Added protected central office registry routes under `office-registry`.
- Added explicit cluster admin permission groups.
- Added automatic evaluation-only spreadsheet provisioning service.
- Added schema validation for the evaluation-only office spreadsheet.
- Added a central admin Office Registry view that does not display spreadsheet IDs.
- Added route-level frontend permission checks for Office Registry.
- Added central admin access group options to User Management.

### Existing STB Functions Preserved

- Existing STB routes remain in place.
- Existing STB sheet names are unchanged.
- Existing STB user management remains available through `/users`.
- Existing STB dashboard, KRA, IPCRF/CCEF, Accomplishments, Review, Evaluation, Profile, Audit, and Reports routes are not removed.
- Existing STB spreadsheet structure is not converted to the reduced office template.

### Affected Sheets and Fields

Central STB spreadsheet:

- New `OfficeRegistry` sheet, created lazily by backend service with fields:
  - `id`, `officeId`, `officeCode`, `officeName`, `officeShortName`
  - `primaryAdminEmail`, `officeStatus`, `portalScope`
  - `spreadsheetId`, `spreadsheetStatus`, `schemaVersion`, `templateVersion`
  - `lastValidatedAt`, `lastSyncAt`, `provisioningTransactionId`, `provisioningError`
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

Generated evaluation-only office spreadsheets:

- `OfficeConfig`
- `Personnel`
- `OrganizationalUnits`
- `Positions`
- `AssessmentPeriods`
- `AssessmentCategories`
- `AssessmentContent`
- `RaterAssignments`
- `RatingDrafts`
- `RatingResponses`
- `AssessmentResults`
- `Notifications`
- `AuditLogs`
- `SchemaVersion`

### Security Notes

- Provisioning requires explicit central permissions.
- Spreadsheet IDs are stored in the protected registry and are removed from ordinary API responses.
- Office Registry UI displays only sanitized metadata and `hasSpreadsheet`.
- Backend validation rejects activation when required sheets, headers, office identity, schema version, template version, or reference content are missing.

### Tests Performed

- `npm.cmd run deploy:check`
- Syntax parse of new Apps Script files through Node `vm.Script`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- New Apps Script service syntax parse: passed.

### Pending Verification

The repository alone cannot verify real Apps Script deployment behavior, Google Workspace permission to create spreadsheets, Drive sharing and protected range behavior, live spreadsheet provisioning under the approved central account, Vercel environment variables, or concurrent user behavior. These remain pending live-environment validation.

## 2026-08-07 - Office-Scoped Assessment Routing Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added the second local-only implementation slice: assessment routes can now resolve to either the central STB PMES spreadsheet or an active provisioned office spreadsheet. No Vercel deployment was performed.

### Files Modified

- `apps-script/SpreadsheetService.gs`
- `apps-script/OfficeSchemaService.gs`
- `apps-script/OfficeScopeService.gs`
- `apps-script/Router.gs`
- `apps-script/OfficeRegistryService.gs`
- `apps-script/UsersService.gs`
- `vue-frontend/src/stores/auth.js`
- `vue-frontend/src/composables/usePermissions.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/UsersView.vue`

### What Changed

- Added request-scoped spreadsheet routing in `SpreadsheetService`.
- Added `OfficeScopeService` to keep STB users on the main spreadsheet and route non-STB office portal users to their active registered office spreadsheet.
- Allowed authorized central administrators to explicitly target a participating office for assessment-scope routes by office id/code.
- Aligned generated office spreadsheet tabs with the existing tested IPAT compatibility names: `AssessmentRecords`, `CompetencyBehaviorRatings`, `JobFitnessRatings`, and `RaterAssignments`.
- Added office metadata defaults to backend/frontend auth profiles so existing STB rows continue to load as `STB_FULL`.
- Added office scope and office selection fields to User Management, without exposing spreadsheet IDs.
- Added office/scope details to account approval confirmation.

### Existing STB Functions Preserved

- STB users default to `officeId=STB`, `officeCode=STB`, `officeName=Social Technology Bureau`, and `systemScope=STB_FULL`.
- STB users still route to the central PMES spreadsheet.
- STB dashboard, KRA Library, IPCRF/CCEF, Accomplishments, Review, Evaluation, User Management, Audit, Profile, and database maintenance routes were not converted to office-only behavior.
- Existing STB sheet names are still accepted through compatibility fallbacks.

### Affected Sheets and Fields

Central `Users` sheet:

- Added or used `officeId`, `officeCode`, `officeName`, `systemScope`, `officeRole`, `centralRoles`.

Generated office spreadsheets:

- `Personnel` now includes compatibility fields `role`, `divisionId`, and `divisionName`.
- `RaterAssignments` now includes `rateeDivisionId`, `ipatRecordId`, and `assessmentRecordId`.
- Replaced the earlier proposed `RatingResponses`/`AssessmentResults` operational tabs with the existing IPAT-compatible tabs:
  - `CompetencyBehaviorRatings`
  - `JobFitnessRatings`
  - `AssessmentRecords`

Protected central `OfficeRegistry`:

- Still stores spreadsheet IDs only server-side.
- API responses remain sanitized.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved by defaulting existing users to `STB_FULL`; live data load remains pending deployment validation.
- STB users still receive full PMES: locally preserved by routing `STB_FULL` users to the central spreadsheet and existing navigation; live validation pending.
- Other office personnel receive limited portal scope: implemented through `systemScope` plus existing evaluation-only route guard; live validation pending.
- Office administrators can access only their assigned office: backend office spreadsheet resolver enforces profile office id/code unless central permissions are present; live validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: backend accepts explicit office id/code only with central permissions; dedicated monitoring UI remains a later slice.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: protected provisioning routes implemented; live Drive permission validation pending.

### Pending Verification

The repository cannot validate real Apps Script web app deployment, Drive spreadsheet creation/sharing, protected ranges, active live office registry rows, Vercel environment variables, or concurrent user behavior. These remain pending live-environment validation.

## 2026-08-07 - Central Office Monitoring Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added a protected central monitoring slice inside the existing Office Registry page. No Vercel deployment was performed.

### Files Modified

- `apps-script/OfficeRegistryService.gs`
- `apps-script/Router.gs`
- `vue-frontend/src/services/api.js`
- `vue-frontend/src/router/index.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/OfficeRegistryView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added `GET office-registry/monitoring`.
- The monitoring endpoint summarizes each participating office from its own protected office spreadsheet.
- Added totals for active offices, personnel, assessment records, completed assignments, and pending assignments.
- Added health states for offices with missing, inactive, inaccessible, or active spreadsheets.
- Added a Cluster Monitoring panel to the existing Office Registry view.
- Split central permissions in the UI:
  - `view_cluster_monitoring` can view the monitoring panel.
  - registry management permissions are still required to provision, validate, or activate offices.

### Existing STB Functions Preserved

- STB full PMES navigation and routes remain unchanged.
- Existing STB data continues to use the central spreadsheet.
- The monitoring route is additive and does not replace Dashboard, Evaluation, Reports, or User Management.
- No live deployment was performed.

### Affected Sheets and Fields

Central `OfficeRegistry` sheet:

- Read-only monitoring uses sanitized registry fields.
- `spreadsheetId` remains server-side only and is never returned to the frontend.

Office spreadsheets:

- Reads `Personnel`, `AssessmentRecords`, and `RaterAssignments`.
- Does not write to office spreadsheets.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved; live validation pending.
- STB users still receive full PMES: locally preserved; live validation pending.
- Other office personnel receive limited portal scope: implemented from previous slice; live validation pending.
- Office administrators can access only their assigned office: backend resolver enforces this for assessment routes; live validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: implemented through `view_cluster_monitoring`.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through the protected central administration process: still enforced; live Drive validation pending.

### Pending Verification

The repository cannot validate live Apps Script deployment, actual Drive spreadsheet access, real office spreadsheet row counts, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Office Personnel Roster Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added protected office personnel roster management for participating office administrators. This is an office assessment roster, not central Firebase/STB account management. No Vercel deployment was performed.

### Files Modified

- `apps-script/OfficePersonnelService.gs`
- `apps-script/Router.gs`
- `vue-frontend/src/services/api.js`
- `vue-frontend/src/composables/usePermissions.js`
- `vue-frontend/src/router/index.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/OfficePersonnelView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added `office-personnel` backend routes:
  - `GET office-personnel`
  - `POST office-personnel`
  - `PUT office-personnel/:id`
  - `PATCH office-personnel/:id/deactivate`
- Added `OfficePersonnelService` for roster CRUD inside the assigned office spreadsheet.
- Added `Office Personnel` view for office admins.
- Office admins can add, edit, search, and deactivate personnel in their own office roster.
- Central registry administrators can use the same backend route with explicit office targeting.
- The route uses the already protected office spreadsheet resolver and never exposes spreadsheet IDs.

### Existing STB Functions Preserved

- STB central User Management remains separate and unchanged.
- STB users continue to receive the full PMES.
- This roster does not create Firebase users and does not modify central STB `Users`.
- Existing Evaluation assignment logic can reuse these office roster rows through the `Personnel`/`Users` sheet compatibility mapping.

### Affected Sheets and Fields

Office spreadsheet `Personnel` sheet:

- `id`, `uid`, `email`, `fullName`, `employeeNo`, `position`, `positionLevel`
- `role`, `divisionId`, `divisionName`, `organizationalUnitId`, `organizationalUnitName`
- `section`, `officeRole`, `systemScope`, `accountStatus`
- `active`, `pendingActivation`, `createdAt`, `updatedAt`, `validatedAt`, `validatedBy`

Office spreadsheet `AuditLogs` sheet:

- Roster create/update/deactivate actions are logged when the sheet is available.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved; live validation pending.
- STB users still receive the full PMES: locally preserved.
- Other office personnel receive only limited portal scope: previously implemented through `systemScope`; live validation pending.
- Office administrators can access only their assigned office: implemented through `OfficeRegistryService.getSpreadsheetForOffice`; live validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: implemented in previous slice.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through the protected central administration process: unchanged and still enforced; live validation pending.

### Pending Verification

The repository cannot validate real office spreadsheet access, actual roster writes, Apps Script deployment permissions, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Office Assessment Administration Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Enabled participating office administrators to administer evaluations inside their assigned office portal scope. No Vercel deployment was performed.

### Files Modified

- `apps-script/AuthService.gs`
- `vue-frontend/src/composables/usePermissions.js`
- `vue-frontend/src/views/EvaluationView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added an automatic backend `office-assessment-admin` permission group for users with:
  - `systemScope = OFFICE_ADMIN`, or
  - `officeRole = OFFICE_ADMIN`
- The derived office admin group grants:
  - `generate_ipat_assignments`
  - `manage_ipat_scores`
  - `view_bureau_monitoring`
  - `view_division_monitoring`
- Mirrored those derived permissions in the frontend permission composable.
- Updated the Evaluation screen so assignment generation is based on `generate_ipat_assignments`, not only the System Administrator role.
- Office admins can now use Generate Assignments and All Assessments within their office-scoped spreadsheet context.

### Existing STB Functions Preserved

- System Administrator retains existing full assignment generation behavior.
- Bureau Director and Assistant Bureau Director retain assessment monitoring/scoring behavior through existing role groups.
- STB full PMES scope is unchanged.
- The office admin permissions do not grant full STB navigation because office portal route restrictions still apply.

### Affected Sheets and Fields

Central `Users` sheet:

- Uses existing `systemScope` and `officeRole` fields to derive office assessment permissions.

Office spreadsheets:

- No new sheet fields added.
- Existing assessment routes continue to read/write office-scoped `Personnel`, `RaterAssignments`, `AssessmentRecords`, `CompetencyBehaviorRatings`, and `JobFitnessRatings` through the prior routing layer.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved; live validation pending.
- STB users still receive the full PMES: locally preserved.
- Other office personnel receive only limited portal scope: preserved through route allowlist and scope defaults.
- Office administrators can access only their assigned office: assessment routes still pass through the protected office spreadsheet resolver.
- Authorized central administrators can monitor participating offices through explicit central roles: preserved.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: unchanged.

### Pending Verification

The repository cannot validate live office assignment generation against real provisioned spreadsheets, Apps Script deployment behavior, Drive permissions, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Registration Office Onboarding Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added an office/program selector to self-registration so new accounts can be routed to either the full STB PMES scope or a participating office portal scope. No Vercel deployment was performed.

### Files Modified

- `apps-script/OfficeRegistryService.gs`
- `apps-script/AuthService.gs`
- `apps-script/UsersService.gs`
- `vue-frontend/src/views/RegisterView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- `auth/register-options` now returns safe active office options for registration.
- Office registration options include STB as the default full PMES scope.
- Participating offices are listed only when the central Office Registry marks the office and its spreadsheet as active.
- Self-registration no longer trusts browser-supplied office metadata.
- `UsersService.selfRegister` resolves the selected `officeId` through `OfficeRegistryService.resolveRegistrationOffice`.
- Non-STB self-registered users are saved as pending `CLUSTER_PORTAL` / `OFFICE_PERSONNEL` accounts until an administrator validates and approves them.
- The registration confirmation modal now includes Office / Program.

### Existing STB Functions Preserved

- STB remains the default registration office and continues to use the existing STB division and section reference tables.
- Existing pending-registration review through User Management is unchanged.
- System Administrator still validates account details before activation.
- Existing Google-authenticated self-registration flow is preserved.

### Affected Sheets and Fields

Central `OfficeRegistry` sheet:

- Read-only use of `officeId`, `officeCode`, `officeName`, `officeShortName`, `officeStatus`, `spreadsheetStatus`, and `portalScope`.
- `spreadsheetId` remains server-only and is not returned to the frontend.

Central `Users` sheet:

- Self-registration writes validated `officeId`, `officeCode`, `officeName`, `systemScope`, and `officeRole`.
- Existing fields `divisionId`, `divisionName`, `section`, `requestedRole`, `pendingActivation`, and `selfRegistered` are preserved.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved; live validation pending.
- STB users still receive the full PMES: preserved by default `STB_FULL` registration resolution.
- Other office personnel receive only the limited portal scope: preserved by `CLUSTER_PORTAL` registration resolution.
- Office administrators can access only their assigned office: unchanged from previous scope resolver.
- Authorized central administrators can monitor participating offices through explicit central roles: unchanged.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: unchanged.

### Pending Verification

The repository cannot validate real Google Apps Script deployments, spreadsheet permissions, Vercel environment variables, or live concurrent-user behavior.

## 2026-08-07 - Office Approval Personnel Sync Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added approval-time synchronization from the central `Users` sheet to the assigned office spreadsheet `Personnel` roster. No Vercel deployment was performed.

### Files Modified

- `apps-script/OfficeRegistryService.gs`
- `apps-script/OfficePersonnelService.gs`
- `apps-script/UsersService.gs`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added a protected office spreadsheet resolver for central approval processes.
- Added `OfficePersonnelService.syncFromCentralUser`.
- When a non-STB pending user is approved, the system creates or updates that person in the assigned office `Personnel` sheet before activating the central user.
- Approval sync writes active roster status, role, assignment fields, and validation metadata.
- If the assigned office spreadsheet is not active or cannot be opened, approval fails instead of creating an unusable active account.

### Existing STB Functions Preserved

- STB user approval remains central-only and does not write to any office spreadsheet.
- Existing central `Users` approval, Firebase enable, and audit behavior are preserved.
- Existing Office Personnel manual roster management is preserved.
- Office spreadsheet access is still resolved only on the server.

### Affected Sheets and Fields

Central `Users` sheet:

- Approval still updates `active`, `pendingActivation`, and `updatedAt`.
- Non-STB approval reads `officeId`, `officeCode`, `officeName`, `systemScope`, `officeRole`, `role`, `divisionId`, `divisionName`, `section`, `position`, `employeeNo`, `uid`, `email`, and `fullName`.

Office spreadsheet `Personnel` sheet:

- Creates or updates `id`, `uid`, `email`, `fullName`, `employeeNo`, `position`, `positionLevel`, `role`, `divisionId`, `divisionName`, `organizationalUnitId`, `organizationalUnitName`, `section`, `officeRole`, `systemScope`, `accountStatus`, `active`, `pendingActivation`, `createdAt`, `updatedAt`, `validatedAt`, and `validatedBy`.

Office spreadsheet `AuditLogs` sheet:

- Writes `SYNC_PERSONNEL_APPROVAL` when audit logging is available.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: locally preserved; live validation pending.
- STB users still receive the full PMES: STB approval path is unchanged.
- Other office personnel receive only the limited portal scope: office roster sync preserves non-STB scope metadata.
- Office administrators can access only their assigned office: unchanged from previous office resolver.
- Authorized central administrators can monitor participating offices through explicit central roles: unchanged.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: unchanged.

### Pending Verification

The repository cannot validate real Apps Script deployment behavior, live spreadsheet permissions, actual Drive access to provisioned office spreadsheets, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Readiness Documentation Alignment Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Updated readiness, known-issues, and test-case documentation so they reflect the current local multi-office implementation checkpoint instead of the pre-implementation risk state. No Vercel deployment was performed.

### Files Modified

- `docs/PMES_CLUSTER_READINESS_ASSESSMENT.md`
- `docs/PMES_KNOWN_ISSUES.md`
- `docs/PMES_TEST_CASES.md`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Changed R1 from "no office dimension anywhere" to "partial local implementation, pending live validation."
- Updated multi-office acceptance test notes for TC-30 through TC-34.
- Marked TC-30 through TC-33 as live two-office validation pending instead of universally blocked.
- Left TC-34 blocked by the remaining per-office assessment-rule configuration work.
- Expanded the readiness appendix with office registry, provisioning, office personnel, onboarding, approval sync, and cluster monitoring checkpoint details.

### Existing STB Functions Preserved

- Documentation-only change; no runtime behavior changed.
- Existing STB PMES code paths are untouched by this slice.

### Affected Sheets and Fields

- None. Documentation-only change.

### Tests Performed

- Source scan for stale multi-office risk phrases in the updated readiness documents.

### Test Results

- Stale phrase scan passed with no matches for the replaced blocker wording.

### Current Confirmation Matrix

- Existing STB data still loads: runtime unchanged.
- STB users still receive the full PMES: runtime unchanged.
- Other office personnel receive only the limited portal scope: runtime unchanged from previous slices.
- Office administrators can access only their assigned office: runtime unchanged from previous slices.
- Authorized central administrators can monitor participating offices through explicit central roles: runtime unchanged from previous slices.
- Spreadsheet IDs are never exposed to the frontend: runtime unchanged; previous source scans passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: runtime unchanged.

### Pending Verification

The repository still cannot validate real Apps Script deployment behavior, live spreadsheet permissions, actual office spreadsheets, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Per-Office Assessment Rules Foundation Slice

Branch: `feature/multi-office-assessment-scope`

### Summary

Added the first configurable assessment-rules layer for overall component weights and CBC rater weights. Defaults preserve the current STB scoring protocol. No Vercel deployment was performed.

### Files Modified

- `apps-script/AssessmentRulesService.gs`
- `apps-script/IPATService.gs`
- `apps-script/OfficeSchemaService.gs`
- `apps-script/OfficeScopeService.gs`
- `apps-script/Router.gs`
- `apps-script/InitSheets.gs`
- `vue-frontend/src/services/api.js`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added `AssessmentRulesService` with default STB PMES weights.
- Added `AssessmentRules` sheet support to central initialization and office spreadsheet schema.
- Office spreadsheet provisioning now seeds default assessment rules.
- Added protected `assessment-rules` API routes:
  - `GET assessment-rules`
  - `PUT assessment-rules`
  - `POST assessment-rules/seed-defaults`
- Added frontend API helpers for future admin UI work.
- `IPATService.calculateOverall` now resolves CBC/FPO/JF domain weights from `AssessmentRules` when available.
- `IPATService.computeCBC` now resolves CBC rater weights from `AssessmentRules` when available.
- If the rules sheet is missing or invalid, scoring falls back to the existing STB defaults.

### Existing STB Functions Preserved

- Existing STB domain weights remain CBC `0.30`, FPO `0.55`, JF `0.15`.
- Existing CBC rater weights remain unchanged:
  - Self `0.15`
  - Supervisor `0.30`
  - SkipSupervisor `0.25`
  - Staff Peer1 `0.15`
  - Staff Peer2 `0.15`
  - Legacy single Peer `0.30`
  - Peer with subordinate `0.15`
  - Subordinate `0.15`
- Existing score renormalization behavior is preserved.
- Existing STB scoring works even without an `AssessmentRules` sheet because defaults are hard-fallbacks.

### Affected Sheets and Fields

Central and office `AssessmentRules` sheet:

- `id`, `officeId`, `ruleType`, `ruleKey`, `label`, `value`, `active`, `description`, `createdAt`, `updatedAt`, `updatedBy`

Office spreadsheet schema:

- Adds required `AssessmentRules` tab.

Scoring outputs:

- Existing score fields are preserved.
- Overall computation internally records the resolved `domainWeights` in the computation object.

### Tests Performed

- `npm.cmd run deploy:check`
- Node `vm.Script` syntax parse for changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.
- Source scan for `AssessmentRules` wiring.

### Test Results

- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Apps Script syntax parse: passed.
- Frontend spreadsheet ID scan: passed with no matches.
- `AssessmentRules` wiring scan confirms service, route, schema, office scope, IPAT scoring, and frontend API references.

### Current Confirmation Matrix

- Existing STB data still loads: local fallback behavior implemented; live validation pending.
- STB users still receive the full PMES: routing unchanged.
- Other office personnel receive only the limited portal scope: routing unchanged from previous slices.
- Office administrators can access only their assigned office: routing unchanged from previous slices.
- Authorized central administrators can monitor participating offices through explicit central roles: unchanged.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: unchanged.

### Pending Verification

The repository cannot validate live Apps Script deployment, actual office-specific scoring rules in real spreadsheets, Drive permissions, Vercel environment variables, or concurrent-user behavior.

## 2026-08-07 - Live Office Spreadsheet Provisioning

Branch: `feature/multi-office-assessment-scope`

### Summary

Provisioned and activated the six approved Innovation Cluster office spreadsheets through the existing PMES Apps Script deployment. The existing web app deployment URL was reused; no new Apps Script deployment URL was created. No Vercel/frontend deployment was performed.

### Offices Provisioned

- `EPAHP` - Enhanced Partnership Against Hunger and Poverty
- `BANGUN` - Bangsamoro Umpungan sa Nutrisyon
- `PAG-ABOT` - Pag-Abot Program
- `TARA-BASA` - Tara, Basa! Tutoring Program
- `WALANG-GUTOM` - Walang Gutom Program
- `OUSI` - Office of the Undersecretary for Innovations

### What Changed

- Deployed backend Apps Script changes to the existing web app deployment.
- Created or confirmed one active office spreadsheet per approved office.
- Registered each office spreadsheet in the central `OfficeRegistry`.
- Activated each office registry entry after schema validation.
- Repaired a partial `WALANG-GUTOM` provisioning state caused by the initial all-office call timing out.
- Removed temporary provisioning routes and helper files after the one-time operation.

### Existing STB Functions Preserved

- Existing STB PMES spreadsheet remains the full PMES source for STB users.
- Existing web app URL was preserved.
- Existing frontend/Vercel deployment was not changed.
- STB users continue to resolve to `STB_FULL`.

### Affected Sheets and Fields

Central `OfficeRegistry` sheet:

- Added/updated office rows with `officeId`, `officeCode`, `officeName`, `officeShortName`, `primaryAdminEmail`, `officeStatus`, `portalScope`, `spreadsheetId`, `spreadsheetStatus`, `schemaVersion`, `templateVersion`, validation timestamps, provisioning transaction metadata, and audit metadata.

Each office spreadsheet:

- Created the required office portal tabs, including `OfficeConfig`, `Personnel`, `OrganizationalUnits`, `Positions`, `AssessmentPeriods`, `AssessmentRules`, `AssessmentCategories`, `AssessmentContent`, `RaterAssignments`, `RatingDrafts`, `CompetencyBehaviorRatings`, `JobFitnessRatings`, `AssessmentRecords`, `Notifications`, `AuditLogs`, and `SchemaVersion`.

### Tests Performed

- Existing Apps Script deployment reused and confirmed at version `214`.
- Temporary provisioning routes tested after cleanup and confirmed to return `401 Unauthorized`.
- `npm.cmd run deploy:check`
- Local Apps Script syntax parse for cleanup-critical backend files.
- Source scan for temporary provisioning keys/routes/helpers.

### Test Results

- Apps Script deployed to existing deployment: `PMES_v214_clean_office_spreadsheets_provisioned`.
- Temporary routes are no longer callable.
- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.
- Cleanup syntax parse: passed.
- Temporary key/route/helper source scan: passed with no matches.

### Current Confirmation Matrix

- Existing STB data still loads: backend deployment preserved existing web app URL; live user flow still needs manual browser validation.
- STB users still receive the full PMES: backend defaults preserved.
- Other office personnel receive only the limited portal scope: office spreadsheets are now active in the registry; user-specific live validation pending.
- Office administrators can access only their assigned office: backend resolver unchanged; live role validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: backend deployed; live UI validation pending.
- Spreadsheet IDs are never exposed to the frontend: unchanged; IDs are stored in central registry/backend only.
- Designated office spreadsheets are provisioned or registered only through protected central administration: completed through central backend process; temporary trigger removed.

### Pending Verification

Still pending: manual login/browser validation, real office user acceptance testing, Drive sharing/access review, Vercel environment review, and concurrent-user behavior testing.

## 2026-08-07 - Live Office Provisioning Validation

Branch: `feature/multi-office-assessment-scope`

### Summary

Validated the live office provisioning state through the existing Apps Script backend, then removed the temporary validation route and redeployed clean. No Vercel/frontend deployment was performed.

### Files Modified

- `apps-script/Code.gs`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

Temporary validation helper `apps-script/AdminLiveValidation.gs` was added, deployed, executed once, then removed before the final clean deployment.

### What Changed

- Added a temporary keyed live validation route.
- Verified the six approved office registry rows and their provisioned spreadsheets.
- Removed the temporary validation route/helper.
- Redeployed the clean backend to the existing deployment URL.

### Live Validation Result

- Offices checked: `6`
- Active registry rows: `6`
- Active spreadsheets: `6`
- Registry rows with spreadsheets: `6`
- Valid office spreadsheet schemas: `6`
- Validation errors: `0`

Per-office result:

- `EPAHP`: active registry, active spreadsheet, valid schema.
- `BANGUN`: active registry, active spreadsheet, valid schema.
- `PAG-ABOT`: active registry, active spreadsheet, valid schema.
- `TARA-BASA`: active registry, active spreadsheet, valid schema.
- `WALANG-GUTOM`: active registry, active spreadsheet, valid schema.
- `OUSI`: active registry, active spreadsheet, valid schema.

Each office spreadsheet has:

- `11` assessment rule rows.
- `10` assessment category rows.
- `30` assessment content rows.
- Required structural tabs present.

### Existing STB Functions Preserved

- Existing Apps Script web app deployment URL was reused.
- Final clean deployment is `PMES_v216_clean_after_live_office_validation`.
- Temporary admin validation route now returns `401 Unauthorized`.
- No frontend/Vercel deployment was performed.

### Affected Sheets and Fields

Central `OfficeRegistry` sheet:

- Read-only validation of active office rows and server-only spreadsheet IDs.

Office spreadsheets:

- Read-only schema validation of the office portal tabs.

### Tests Performed

- Live backend validation through temporary route.
- Temporary route cleanup confirmation.
- Existing deployment confirmation via `clasp deployments`.
- `npm.cmd run deploy:check`.

### Test Results

- Live backend office validation: passed.
- Temporary validation route after cleanup: returned `401 Unauthorized`.
- Existing deployment reused: `AKfycbxz1GwhQ2x6UzIbkQ8mVVCn3Mb-NhsVWy2YKgD9Kpx32Esn9B_mmnpVmF6IntBAexwqfQ @216`.
- Frontend audit: passed.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed.

### Current Confirmation Matrix

- Existing STB data still loads: backend URL preserved; manual browser validation still recommended.
- STB users still receive the full PMES: backend defaults preserved.
- Other office personnel receive only the limited portal scope: office spreadsheets active and schema-valid; real user validation pending.
- Office administrators can access only their assigned office: backend resolver unchanged; real office-admin login validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: backend data is available; UI validation pending.
- Spreadsheet IDs are never exposed to the frontend: validation response omitted spreadsheet IDs; prior source scans passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: completed and temporary route removed.

### Pending Verification

Still pending: real office user login validation, office-admin role validation, Drive sharing/access review, Vercel environment review, and concurrent-user behavior testing.

## 2026-08-08 - Office-Scoped User Administration and Clean Office Labels

Branch: `feature/multi-office-assessment-scope`

### Summary

Implemented office-level user administration inside the existing PMES application. Office administrators can enter User Management, view only users from their assigned non-STB office, approve/activate/decline/deactivate those users, and sync approved users into the assigned office Personnel sheet. The registration and central user forms now show office/program names without short-code prefixes in dropdown option text.

### Files Modified

- `apps-script/AuthService.gs`
- `apps-script/UsersService.gs`
- `apps-script/OfficePersonnelService.gs`
- `vue-frontend/src/composables/usePermissions.js`
- `vue-frontend/src/router/index.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/RegisterView.vue`
- `vue-frontend/src/views/UsersView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

- Added narrow `manage_office_users` permission to the derived `office-assessment-admin` permission set.
- Scoped central `Users` list/get/update/approve/decline/deactivate operations so office admins can act only on rows matching their assigned `officeId` or `officeCode`.
- Preserved central-only `manage_users` behavior for system administrators and user managers.
- Blocked office admins from assigning `System Administrator` or changing central access fields such as `permissionGroups`, `permissions`, `systemScope`, `officeRole`, `centralRoles`, and office assignment fields.
- Allowed office-user approval to sync the approved user into the matching office spreadsheet `Personnel` sheet without requiring central `manage_users`.
- Added office-admin access to the User Management route and sidebar while keeping Add User, System Access Mode, Focal Assignments, Database Maintenance, central office selection, and access groups central-only.
- Updated office/program dropdown labels to display only full office names, without `STB`, `BangUn`, `EPAHP`, or other short-code prefixes.

### Existing STB Functions Preserved

- STB users still default to `STB_FULL` scope and retain full PMES behavior through existing central roles and permissions.
- Central System Administrator and central user managers still manage all users through `manage_users`.
- Central registry, spreadsheet provisioning, database maintenance, focal assignment, system access mode, and audit features remain central-only.
- Existing registration, pending approval, section dropdown, role normalization, pagination, search, and Firebase activation/deactivation flows were preserved.

### Affected Sheets and Fields

Central `Users` sheet:

- `officeId`
- `officeCode`
- `officeName`
- `systemScope`
- `officeRole`
- `centralRoles`
- `permissionGroups`
- `permissions`
- `pendingActivation`
- `active`
- `role`
- `divisionId`
- `divisionName`
- `section`
- `updatedAt`

Office spreadsheet `Personnel` sheet:

- `uid`
- `email`
- `fullName`
- `employeeNo`
- `position`
- `positionLevel`
- `role`
- `divisionId`
- `divisionName`
- `organizationalUnitId`
- `organizationalUnitName`
- `section`
- `officeRole`
- `systemScope`
- `accountStatus`
- `active`
- `pendingActivation`
- `validatedAt`
- `validatedBy`

### Tests Performed

- `npm.cmd run deploy:check`
- `npm.cmd run lint:check --prefix vue-frontend`
- `npm.cmd run smoke:check --prefix vue-frontend`
- `npm.cmd run build --prefix vue-frontend`
- Frontend source scan for spreadsheet ID exposure.

### Test Results

- `deploy:check`: failed at `npm audit --audit-level=high` because of the existing `nanoid/postcss/vue` advisory chain with no automatic fix available.
- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed locally and on Vercel.
- Spreadsheet ID exposure scan: no frontend source matches.

### Current Confirmation Matrix

- Existing STB data still loads: code path preserved; live browser validation pending.
- STB users still receive the full PMES: STB default scope and central permission behavior preserved.
- Other office personnel receive only the limited portal scope: office route and backend scoping preserved; real account validation pending.
- Office administrators can access only their assigned office: backend user-management scoping implemented; real office-admin login validation pending.
- Authorized central administrators can monitor participating offices through explicit central roles: central permissions preserved.
- Spreadsheet IDs are never exposed to the frontend: source scan passed.
- Designated office spreadsheets are provisioned or registered only through protected central administration: provisioning flow unchanged.

### Pending Verification

Apps Script deployment: existing deployment updated to `AKfycbxz1GwhQ2x6UzIbkQ8mVVCn3Mb-NhsVWy2YKgD9Kpx32Esn9B_mmnpVmF6IntBAexwqfQ @217`.

Vercel deployment: production deployment completed and aliased to `https://stb-pmes.vercel.app`; live `/auth/register` returned HTTP `200`.

Still pending: real Google account login validation for one office admin and one office personnel account, visual browser confirmation of the dropdown labels after cache refresh, Drive sharing/access review, Vercel environment review, and concurrent-user behavior testing.

## 2026-08-09 - Portal UI Foundation and Personnel Assessment Entry Point

Branch: `feature/multi-office-assessment-scope`

### Summary

Added the shared UI foundation for the new multi-office modules, dynamic portal
branding, and the first two Innovation Cluster personnel screens: the Simplified
Dashboard and My Rating Tasks. Restricted-scope users now land on an orientation
screen instead of being dropped directly into the STB evaluation form. No Vercel
or Apps Script deployment was performed.

### Files Added

- `vue-frontend/src/components/ui/PageHeader.vue`
- `vue-frontend/src/components/ui/DataPanel.vue`
- `vue-frontend/src/components/ui/StatTile.vue`
- `vue-frontend/src/components/ui/StatusPill.vue`
- `vue-frontend/src/components/ui/AppModal.vue`
- `vue-frontend/src/components/ui/EmptyState.vue`
- `vue-frontend/src/components/ui/SkeletonRows.vue`
- `vue-frontend/src/components/ui/ProgressBar.vue`
- `vue-frontend/src/composables/useBranding.js`
- `vue-frontend/src/views/PortalDashboardView.vue`
- `vue-frontend/src/views/MyTasksView.vue`
- `apps-script/PortalService.gs`

### Files Modified

- `apps-script/Router.gs`
- `apps-script/OfficeScopeService.gs`
- `apps-script/OfficePersonnelService.gs`
- `vue-frontend/src/services/api.js`
- `vue-frontend/src/router/index.js`
- `vue-frontend/src/layouts/AppLayout.vue`
- `vue-frontend/src/views/OfficePersonnelView.vue`
- `vue-frontend/src/views/EvaluationView.vue`
- `docs/PMES_MULTI_OFFICE_IMPLEMENTATION_LOG.md`

### What Changed

Shared UI foundation:

- Added eight reusable presentation components aligned to the existing
  `main.css` component layer. The two new office modules previously shipped
  private, prefixed CSS that duplicated the shared primitives with different
  radii, borders and brand colors, so they read as a separate application.
- `AppModal` adds Esc dismissal, a focus trap, focus restore, and dialog ARIA
  roles, none of which the hand-rolled overlays had.
- `DataPanel` centralizes the search, filter, loading-skeleton, error, empty and
  footer states so each list screen stops reimplementing them.

Dynamic branding:

- Added `useBranding` as the single source of portal naming.
- STB users now see `Performance Management and Evaluation System` /
  `Social Technology Bureau` rather than the previous `PERFORMANCE MONITORING` /
  `EVALUATION SYSTEM` wordmark.
- Cluster users see `Innovation Cluster Personnel Assessment Portal` with the
  authenticated user's office name as the subtitle. The office name previously
  appeared nowhere in the interface.
- The browser tab title now follows the resolved portal and page.
- Cluster users no longer see STB instrument names in the page header; the
  Evaluation subtitle reads `Assessment Form` rather than
  `Innovations Performance Assessment Tool`.

Personnel portal:

- Added `PortalService` with server-aggregated `summary` and `my-tasks`.
  Both return counters and a projected task list; no rating rows and no score
  fields for other personnel are sent to the frontend.
- Registered `portal` as an office-scoped resource so every read resolves to the
  caller's designated office spreadsheet.
- Added `/my-dashboard` and `/my-tasks` and made `/my-dashboard` the landing
  route for restricted-scope users, replacing the previous forced redirect to
  `/evaluation`.
- `My Rating Tasks` deep-links into the existing rating form through
  `/evaluation?assignment=<id>`, reusing the validated assessment logic.

Defect fixes found during the review:

- Office Personnel `Deactivate` fired immediately with no confirmation. It now
  uses the existing global confirmation dialog.
- Office Personnel `Add Personnel` was visible to users without management
  rights; the route was guarded but the control was not. It is now gated on
  `canManageOfficePersonnel`.
- Deactivated roster rows had no reactivation path, so undoing required a direct
  spreadsheet edit. Added `PATCH office-personnel/:id/activate`.

### Affected Routes and APIs

New backend routes:

- `GET portal/summary`
- `GET portal/my-tasks`
- `PATCH office-personnel/:id/activate`

New frontend routes:

- `/my-dashboard`
- `/my-tasks`

No existing route was renamed or removed.

### Affected Sheets and Fields

- `IPATRaterAssignments`: read-only, filtered to the caller's `raterId`.
- `IPATRecords`, `IPATCBCRatings`, `IPATJFRatings`: read-only; reduced to a set
  of record ids to derive draft state. No rating values leave the backend.
- Office `Personnel`: `active`, `pendingActivation`, `accountStatus`,
  `validatedAt`, `validatedBy`, `updatedAt` written by the new activate action.
- Office `AuditLogs`: new `ACTIVATE_PERSONNEL` action.

### Existing STB Functions Preserved

- No STB view, route, or service was removed or renamed.
- `DashboardService` is untouched; STB users keep the existing Bureau dashboard.
- The new portal routes are additive and are not shown to STB full-scope users.
- STB scoring, KRA, IPCRF/CCEF, Accomplishments, Review, User Management, Audit
  and Reports paths are unchanged.
- The `EvaluationView` change is additive: the deep-link branch only applies when
  `?assignment=` is present, otherwise the existing auto-open behavior runs.

### Tests Performed

- `npm run lint:check`
- `npm run smoke:check`
- `npm run build`
- Node `vm.Script` syntax parse of the changed Apps Script files.
- Frontend source scan for `spreadsheetId` / `spreadsheet_id`.
- Build artifact check confirming the new route chunks are emitted.

### Test Results

- Frontend lint: passed.
- Frontend smoke check: passed.
- Frontend production build: passed; `PortalDashboardView` and `MyTasksView`
  chunks emitted.
- Apps Script syntax parse: passed for `PortalService.gs`, `Router.gs`,
  `OfficeScopeService.gs`, `OfficePersonnelService.gs`.
- Spreadsheet ID exposure scan: no matches in frontend source.

### Security and Privacy Impact

- `portal/*` accepts no office, spreadsheet, rater or ratee identifier from the
  client. The office is resolved from the authenticated profile through the
  existing `OfficeScopeService` resolver.
- `PortalService.myTasks` deliberately projects a field subset. The existing
  `ipat-assignments/my-ratees` response includes `overallScore` and record
  status for the person being rated; those fields are not exposed here.
- The new activate action is restricted by the same `canManageOffice_` check as
  deactivate and is written to the office audit log.

### Remaining Risks and Pending Verification

- Not deployed. Apps Script remains at `@217`; Vercel is unchanged.
- The draft-state derivation reads both rating sheets per request. This is
  correct but not paginated; it needs measurement against a full office dataset
  before cluster-wide use.
- `PortalService.myTasks` reads `rateePosition` and `rateeDivisionName` from the
  assignment row. If those columns are absent in a provisioned office
  spreadsheet the fields render as `—`; confirm against a live office roster.
- Office Registry still uses its original private CSS and has not yet been moved
  onto the shared components.
- Live verification still pending: real office personnel login, office admin
  login, the deep link into the rating form against a live assignment, and
  browser confirmation of the office-name subtitle.
