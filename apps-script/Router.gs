const Router = (() => {

  function dispatch(route, method, params, body, user) {
    const parts = route.split('/')
    const resource = parts[0]
    const id = parts[1] || null   // could be an action word OR a real id
    const sub = parts[2] || null   // could be an action word on top of a real id
    const subId = parts[3] || null

    if (
      typeof OfficeScopeService !== 'undefined' &&
      OfficeScopeService.isAssessmentScopedResource(resource) &&
      !params.__officeScopeApplied
    ) {
      const scopedParams = { ...params, __officeScopeApplied: true }
      const scopedBody = body === params ? scopedParams : { ...body, __officeScopeApplied: true }
      return OfficeScopeService.run(resource, params, user, () =>
        dispatch(route, method, scopedParams, scopedBody, user)
      )
    }

    switch (resource) {

      // ─────────────────────────────────────────
      // Auth — routes: auth/me, auth/log
      // id='me' or id='log' (no real object id)
      // ─────────────────────────────────────────
      case 'auth':
        // touchLogin: this is the sign-in path, the one place lastLoginAt should
        // be written. Every other caller reads the profile without writing.
        if (id === 'me') return AuthService.getProfile(user, { touchLogin: true })
        if (id === 'whoami') return AuthService.whoami(user)
        if (id === 'backend-info') return AuthService.backendInfo(user)
        if (id === 'register-options') return AuthService.registrationOptions()
        if (id === 'register' && method === 'POST') return UsersService.selfRegister(body, user)
        if (id === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ─────────────────────────────────────────
      // Dashboard — routes: dashboard/summary, /divisions, /status, /activity
      // id = action name
      // ─────────────────────────────────────────
      // ─────────────────────────────────────────
      // Portal — the assessment-only experience for participating offices.
      // Office-scoped by OfficeScopeService; every caller sees only their own
      // assignments in their own office spreadsheet.
      // ─────────────────────────────────────────
      case 'portal':
        if (id === 'summary' && method === 'GET') return PortalService.summary(params, user)
        if (id === 'my-tasks' && method === 'GET') return PortalService.myTasks(params, user)
        if (id === 'my-results' && method === 'GET') return PortalService.myResults(params, user)
        if (id === 'library' && method === 'GET') return PortalService.library(params, user)
        if (id === 'office-summary' && method === 'GET') return PortalService.officeSummary(params, user)
        break

      case 'dashboard':
        if (id === 'all') return DashboardService.all(params, user)
        if (id === 'summary') return DashboardService.summary(params, user)
        if (id === 'divisions') return DashboardService.divisions(params, user)
        if (id === 'status') return DashboardService.statusBreakdown(params, user)
        if (id === 'activity') return DashboardService.monthlyActivity(params, user)
        break

      // ─────────────────────────────────────────
      // Users — routes: users, users/:id, users/:id/activate, etc.
      // ─────────────────────────────────────────
      case 'users':
        if (!id && method === 'GET') return UsersService.list(params, user)
        if (!id && method === 'POST') return UsersService.create(body, user)
        if (id && !sub && method === 'GET') return UsersService.get(id, user)
        if (id && !sub && method === 'PUT') return UsersService.update(id, body, user)
        if (id && !sub && method === 'DELETE') return UsersService.remove(id, user)
        if (id && sub === 'deactivate') return UsersService.deactivate(id, user)
        if (id && sub === 'activate') return UsersService.activate(id, user)
        if (id && sub === 'decline') return UsersService.decline(id, user)
        if (id && sub === 'reset-password') return UsersService.resetPassword(id, body, user)
        break

      // Read-only multi-office boundary report. Deliberately NOT in
      // OfficeScopeService.SCOPED_RESOURCES — it must describe the central
      // database, not be redirected into an office workbook.
      case 'diagnostics':
        if (id === 'office-boundary' && method === 'GET') return DiagnosticsService.officeBoundary(params, user)
        break

      case 'system-settings':
        if (!id && method === 'GET') return SystemSettingsService.list(user)
        if (!id && method === 'PUT') return SystemSettingsService.update(body, user)
        break

      case 'office-registry':
        if (!id && method === 'GET') return OfficeRegistryService.list(params, user)
        if (!id && method === 'POST') return OfficeRegistryService.provision(body, user)
        if (id === 'picker' && method === 'GET') return OfficeRegistryService.picker(params, user)
        if (id === 'spec' && method === 'GET') return OfficeSchemaService.getSpec()
        if (id === 'monitoring' && method === 'GET') return OfficeRegistryService.monitoring(params, user)
        if (id && !sub && method === 'GET') return OfficeRegistryService.get(id, user)
        if (id && sub === 'org-options' && method === 'GET') return OfficeRegistryService.orgOptions(id, user)
        if (id && sub === 'org-options' && method === 'PUT') return OfficeRegistryService.saveOrgOptions(id, body, user)
        if (id && sub === 'validate' && method === 'POST') return OfficeRegistryService.validate(id, user)
        if (id && sub === 'repair' && method === 'POST') return OfficeRegistryService.repair(id, user)
        if (id && sub === 'activate' && method === 'POST') return OfficeRegistryService.activate(id, user)
        break

      case 'office-personnel':
        if (!id && method === 'GET') return OfficePersonnelService.list(params, user)
        if (!id && method === 'POST') return OfficePersonnelService.create(body, user)
        if (id && !sub && method === 'PUT') return OfficePersonnelService.update(id, body, user)
        if (id && sub === 'deactivate') return OfficePersonnelService.deactivate(id, user)
        if (id && sub === 'activate') return OfficePersonnelService.activate(id, user)
        break

      // ─────────────────────────────────────────
      // KRAs & Success Indicators
      // ─────────────────────────────────────────
      case 'focal-assignments':
        if (!id && method === 'GET') return FocalAssignmentService.list(params, user)
        if (!id && method === 'POST') return FocalAssignmentService.save(body, user)
        break

      case 'kras':
        // Not implemented — the live KRA feature uses the 'kra-library' routes.
        // Guarded so a stray call returns a clean 501 instead of a 500 crash.
        throw HttpError('KRA endpoint is not available. Use kra-library.', 501)

      // ─────────────────────────────────────────
      // KRA Library (MasterKRALibrary sheet)
      // ─────────────────────────────────────────
      case 'kra-library':
        if (!id && method === 'GET') return KraLibraryService.list(params, user)
        if (!id && method === 'POST') return KraLibraryService.create(body, user)
        if (id && method === 'GET') return KraLibraryService.get(id, user)
        if (id && method === 'PUT') return KraLibraryService.update(id, body, user)
        if (id && method === 'DELETE') return KraLibraryService.remove(id, user)
        break

      case 'assessment-categories':
        if (!id && method === 'GET') return AssessmentCategoryService.list(params, user)
        if (!id && method === 'POST') return AssessmentCategoryService.create(body, user)
        if (id === 'seed' && method === 'POST') return AssessmentCategoryService.seed(body, user)
        if (id && !sub && method === 'GET') return AssessmentCategoryService.get(id, user)
        if (id && !sub && method === 'PUT') return AssessmentCategoryService.update(id, body, user)
        if (id && !sub && method === 'DELETE') return AssessmentCategoryService.remove(id, user)
        break

      case 'assessment-content':
        if (!id && method === 'GET') return AssessmentContentService.list(params, user)
        if (!id && method === 'POST') return AssessmentContentService.create(body, user)
        if (id === 'reorder' && method === 'POST') return AssessmentContentService.reorder(body, user)
        if (id && !sub && method === 'GET') return AssessmentContentService.get(id, user)
        if (id && !sub && method === 'PUT') return AssessmentContentService.update(id, body, user)
        if (id && sub === 'publish') return AssessmentContentService.publish(id, body, user)
        if (id && sub === 'archive') return AssessmentContentService.archive(id, user)
        if (id && sub === 'duplicate-version') return AssessmentContentService.duplicateVersion(id, body, user)
        if (id === 'seed' && method === 'POST') return AssessmentContentService.seed(body, user)
        break

      // ─────────────────────────────────────────
      // Accomplishments
      // ─────────────────────────────────────────
      // Per-office rater matrix — who rates whom. Office-scoped.
      case 'rater-matrix':
        if (!id && method === 'GET') return RaterMatrixService.list(params, user)
        if (!id && method === 'PUT') return RaterMatrixService.save(body, user)
        if (id === 'coverage' && method === 'GET') return RaterMatrixService.coverage(params, user)
        if (id === 'seed-defaults' && method === 'POST') return RaterMatrixService.seedDefaults(body, user)
        break

      case 'assessment-rules':
        if (!id && method === 'GET') return AssessmentRulesService.list(params, user)
        if (!id && method === 'PUT') return AssessmentRulesService.update(body, user)
        if (id === 'seed-defaults' && method === 'POST') return AssessmentRulesService.seedDefaults(user)
        break

      case 'accomplishments':
        if (!id && method === 'GET') return AccomplishmentsService.list(params, user)
        if (!id && method === 'POST') return AccomplishmentsService.create(body, user)
        if (id && !sub && method === 'GET') return AccomplishmentsService.get(id, user)
        if (id && !sub && method === 'PUT') return AccomplishmentsService.update(id, body, user)
        if (id && sub === 'status') return AccomplishmentsService.updateStatus(id, body, user)
        if (id && sub === 'approve') return AccomplishmentsService.approve(id, body, user)
        if (id && sub === 'revision') return AccomplishmentsService.requestRevision(id, body, user)
        if (id && sub === 'history') return AccomplishmentsService.history(id, user)
        break

      // ─────────────────────────────────────────
      // MOV Files
      // ─────────────────────────────────────────
      // MOV file uploads were removed by policy: personnel do not upload
      // evidence files. Means of verification are recorded as pasted links or
      // text in the IPCRF/CCEF `movReferences` field instead. Guarded so any
      // stale client call returns a clean 410 rather than a routing 404.
      case 'mov':
        throw HttpError('The MOV file module has been removed. Record means of verification as links or text in the IPCRF/CCEF form.', 410)

      // ─────────────────────────────────────────
      // Reports
      // ─────────────────────────────────────────
      case 'reports':
        if (!id && method === 'GET') return ReportsService.list(params, user)
        if (id === 'options' && method === 'GET') return ReportsService.options(params, user)
        if (id === 'preview' && method === 'POST') return ReportsService.preview(body, user)
        if (id === 'generate' && method === 'POST') return ReportsService.generate(body, user)
        if (id && sub === 'download' && method === 'GET') return ReportsService.download(id, user)
        break

      // ─────────────────────────────────────────
      // Notifications
      // notifications/read-all is an action route (id = 'read-all')
      // ─────────────────────────────────────────
      case 'notifications':
        if (!id && method === 'GET') return NotificationsService.list(user)
        if (id === 'read-all') return NotificationsService.markAllRead(user)
        if (id && sub === 'read') return NotificationsService.markRead(id, user)
        break

      // ─────────────────────────────────────────
      // Audit
      // audit/export is an action route (id = 'export')
      // ─────────────────────────────────────────
      case 'audit':
        if (!id && method === 'GET') return AuditService.list(params, user)
        if (id === 'export') return AuditService.export_(params, user)
        break

      // Maintenance
      case 'maintenance':
        if (id === 'database-reset' && method === 'GET') return DatabaseMaintenanceService.previewReset(user)
        if (id === 'database-reset' && method === 'POST') return DatabaseMaintenanceService.resetTransactionalData(body, user)
        if (id === 'normalize-columns' && method === 'GET') return DatabaseMaintenanceService.previewColumnOrder(user)
        if (id === 'normalize-columns' && method === 'POST') return DatabaseMaintenanceService.normalizeColumnOrder(body, user)
        if (id === 'fresh-schema' && method === 'GET') return DatabaseMaintenanceService.previewFreshRebuild(user)
        if (id === 'fresh-schema' && method === 'POST') return DatabaseMaintenanceService.rebuildFreshDatabase(body, user)
        break

      // ─────────────────────────────────────────
      // Deadlines
      // ─────────────────────────────────────────
      case 'deadlines':
        // Not implemented yet — guarded so calls return a clean 501, not a 500.
        throw HttpError('Deadlines endpoint is not available yet.', 501)

      // ─────────────────────────────────────────────
      // Reserved resources — a client exists in services/api.js but no backend
      // was ever built. Previously these fell through to the default case and
      // returned "Route not found", which reads like a routing bug rather than
      // an unbuilt feature. Guarded so the distinction is unambiguous.
      // Their sheets (Evaluations, AttendanceRecords, AttendanceRatings,
      // PeerAssignments, JRBRatings) are also absent from the live database.
      // See the known-issues register for the implement/remove decision.
      // ─────────────────────────────────────────────
      case 'evaluations':
        throw HttpError('Evaluations endpoint is not available. IPAT scoring is under ipat/*.', 501)

      case 'attendance':
        throw HttpError('Attendance endpoint is not available yet.', 501)

      case 'peer-assignments':
        throw HttpError('Peer assignments endpoint is not available. Rater assignment is under ipat-assignments/*.', 501)

      // ─────────────────────────────────────────
      // IPCRF / CCEF Forms
      // ─────────────────────────────────────────
      case 'ipcrf':
        if (!id && method === 'GET') return IpcrfService.list(params, user)
        if (!id && method === 'POST') return IpcrfService.create(body, user)
        if (id === 'period-status' && method === 'GET') return IpcrfService.getPeriodStatus(params, user)
        if (id === 'review-queue' && method === 'GET') return IpcrfService.reviewQueue(params, user)
        if (id && !sub && method === 'GET') return IpcrfService.get(id, user)
        if (id && !sub && method === 'PUT') return IpcrfService.update(id, body, user)
        if (id && !sub && method === 'DELETE') return IpcrfService.deleteForm(id, user)
        if (id && sub === 'submit') return IpcrfService.submit(id, body, user)
        if (id && sub === 'route') return IpcrfService.route(id, body, user)
        if (id && sub === 'approve') return IpcrfService.approve(id, body, user)
        if (id && sub === 'return') return IpcrfService.return_(id, body, user)
        if (id && sub === 'submit-ratings') return IpcrfService.submitRatings(id, body, user)
        if (id && sub === 'rate') return IpcrfService.rate(id, body, user)
        if (id && sub === 'finalize') return IpcrfService.finalize(id, body, user)
        if (id && sub === 'compute-score') return IpcrfService.computeScore(id, user)
        if (id && sub === 'generate-targets') return PmesDocGenService.generateTargetsDoc(id, user)
        if (id && sub === 'generate-ratings') return PmesDocGenService.generateRatingsDoc(id, user, body.semester)
        if (id && sub === 'review-comments' && method === 'GET') return IpcrfService.listReviewComments(id, params, user)
        if (id && sub === 'review-comments' && method === 'POST') return IpcrfService.saveReviewComments(id, body, user)
        if (id && sub === 'assignable-users' && method === 'GET') return IpcrfService.listAssignableReviewers(id, params, user)
        if (id && sub === 'entries') {
          if (!subId && method === 'GET') return IpcrfService.listEntries(id, user)
          if (!subId && method === 'POST') return IpcrfService.addEntry(id, body, user)
          if (subId && method === 'PUT') return IpcrfService.updateEntry(id, subId, body, user)
          if (subId && method === 'DELETE') return IpcrfService.deleteEntry(id, subId, user)
        }
        break

      // IPAT
      case 'ipat':
        if (!id && method === 'GET')  return IPATService.list(params, user)
        if (!id && method === 'POST') return IPATService.create(body, user)
        if (id && !sub && method === 'GET') return IPATService.get(id, user)
        if (id && sub === 'status')         return IPATService.updateStatus(id, body, user)
        if (id && sub === 'sync-fpo')       return IPATService.syncFPO(id, user)
        if (id && sub === 'set-fpo' && method === 'POST') return IPATService.setFPO(id, body, user)
        if (id && sub === 'cbc' && !subId && method === 'POST')  return IPATService.saveCBCRatings(id, body, user)
        if (id && sub === 'cbc' && subId === 'compute')          return IPATService.computeCBC(id, user)
        if (id && sub === 'cbc-deduction' && method === 'POST')  return IPATService.setCbcDeduction(id, body, user)
        if (id && sub === 'jf' && !subId && method === 'POST')   return IPATService.saveJFRatings(id, body, user)
        if (id && sub === 'jf' && subId === 'compute')           return IPATService.computeJF(id, user)
        if (id && sub === 'compute')                             return IPATService.computeOverall(id, user)
        if (id === 'themes')        return IPATService.getThemes(params, user)
        if (id === 'jf-indicators') return IPATService.getJFIndicators(params, user)
        break

      // IPAT Rater Assignments
      case 'ipat-assignments':
        if (!id && method === 'GET')                     return IPATRaterAssignmentService.list(params, user)
        if (id === 'generate'  && method === 'POST')     return IPATRaterAssignmentService.generateAssignments(body, user)
        if (id === 'my-ratees'   && method === 'GET')     return IPATRaterAssignmentService.getMyRatees(params, user)
        if (id === 'my-results'  && method === 'GET')     return IPATRaterAssignmentService.getMyResults(params, user)
        if (id && sub === 'ratee-assignments' && method === 'GET') return IPATRaterAssignmentService.getRateeAssignments(id, params, user)
        if (id && sub === 'submit-ratings' && method === 'POST') return IPATRaterAssignmentService.submitAssignmentRatings(id, body, user)
        if (id && sub === 'complete' && method === 'POST') return IPATRaterAssignmentService.markCompleted(id, user)
        // Destructive: GET previews what would be removed, POST performs it.
        // The service was implemented but unreachable until 2026-08-04.
        if (id === 'reset-period' && method === 'GET')  return IPATRaterAssignmentService.previewDeleteForPeriod(params, user)
        if (id === 'reset-period' && method === 'POST') {
          const expected = 'RESET ' + String(body.semester || '') + ' ' + String(body.year || '')
          if (String(body.confirmation || '') !== expected) {
            throw HttpError('This action is permanent. Type the confirmation phrase exactly to proceed.', 400)
          }
          return IPATRaterAssignmentService.deleteForPeriod(body.semester, body.year, user)
        }
        break

      // ─────────────────────────────────────────
      // Generated documents — print/export
      // docgen/{fileId}/print — id = the generated Drive file's id
      // ─────────────────────────────────────────
      case 'docgen':
        if (id && sub === 'print') return PmesDocGenService.exportPdf(id, params.tab, user)
        break

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(method + ' ' + route + ' is not a valid endpoint', 404)
  }

  return { dispatch }
})()
