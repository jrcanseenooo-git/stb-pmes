const Router = (() => {

  function dispatch(route, method, params, body, user) {
    const parts = route.split('/')
    const resource = parts[0]
    const id = parts[1] || null   // could be an action word OR a real id
    const sub = parts[2] || null   // could be an action word on top of a real id
    const subId = parts[3] || null

    switch (resource) {

      // ─────────────────────────────────────────
      // Auth — routes: auth/me, auth/log
      // id='me' or id='log' (no real object id)
      // ─────────────────────────────────────────
      case 'auth':
        if (id === 'me') return AuthService.getProfile(user)
        if (id === 'whoami') return AuthService.whoami(user)
        if (id === 'register-options') return AuthService.registrationOptions()
        if (id === 'register' && method === 'POST') return UsersService.selfRegister(body, user)
        if (id === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ─────────────────────────────────────────
      // Dashboard — routes: dashboard/summary, /divisions, /status, /activity
      // id = action name
      // ─────────────────────────────────────────
      case 'dashboard':
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
        if (id && sub === 'deactivate') return UsersService.deactivate(id, user)
        if (id && sub === 'activate') return UsersService.activate(id, user)
        if (id && sub === 'decline') return UsersService.decline(id, user)
        if (id && sub === 'reset-password') return UsersService.resetPassword(id, body, user)
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

      // ─────────────────────────────────────────
      // Accomplishments
      // ─────────────────────────────────────────
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
      case 'mov':
        if (!id && method === 'GET') return MovService.list(params, user)
        if (id === 'upload') return MovService.upload(body, user)
        if (id && !sub && method === 'GET') return MovService.get(id, user)
        if (id && !sub && method === 'DELETE') return MovService.remove(id, user)
        if (id && sub === 'preview') return MovService.preview(id, user)
        break

      // ─────────────────────────────────────────
      // Reports
      // ─────────────────────────────────────────
      case 'reports':
        // Not implemented yet — guarded so calls return a clean 501, not a 500.
        throw HttpError('Reports endpoint is not available yet.', 501)

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

      // ─────────────────────────────────────────
      // Deadlines
      // ─────────────────────────────────────────
      case 'deadlines':
        // Not implemented yet — guarded so calls return a clean 501, not a 500.
        throw HttpError('Deadlines endpoint is not available yet.', 501)

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
        if (id && sub === 'cbc' && !subId && method === 'POST')  return IPATService.saveCBCRatings(id, body, user)
        if (id && sub === 'cbc' && subId === 'compute')          return IPATService.computeCBC(id, user)
        if (id && sub === 'jf' && !subId && method === 'POST')   return IPATService.saveJFRatings(id, body, user)
        if (id && sub === 'jf' && subId === 'compute')           return IPATService.computeJF(id, user)
        if (id && sub === 'compute')                             return IPATService.computeOverall(id, user)
        if (id && sub === 'edap' && method === 'GET')            return IPATService.getEdap(id, user)
        if (id && sub === 'edap' && method === 'POST')           return IPATService.saveEdap(id, body, user)
        if (id === 'themes')        return IPATService.getThemes(params, user)
        if (id === 'jf-indicators') return IPATService.getJFIndicators(params, user)
        break

      // IPAT Rater Assignments
      case 'ipat-assignments':
        if (!id && method === 'GET')                     return IPATRaterAssignmentService.list(params, user)
        if (!id && method === 'DELETE')                  return IPATRaterAssignmentService.deleteForPeriod(params.semester, params.year, user)
        if (id === 'generate'  && method === 'POST')     return IPATRaterAssignmentService.generateAssignments(body, user)
        if (id === 'my-ratees'   && method === 'GET')     return IPATRaterAssignmentService.getMyRatees(params, user)
        if (id === 'my-results'  && method === 'GET')     return IPATRaterAssignmentService.getMyResults(params, user)
        if (id && sub === 'ratee-assignments' && method === 'GET') return IPATRaterAssignmentService.getRateeAssignments(id, params, user)
        if (id && sub === 'complete' && method === 'POST') return IPATRaterAssignmentService.markCompleted(id, user)
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
