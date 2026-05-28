/**
 * Router.gs v2 — Complete PMES Route Dispatcher
 * Handles all routes for the PMES system including IPCRF, JRB, Attendance
 */

const Router = (() => {

  function dispatch(route, method, params, body, user) {
    const parts    = route.split('/')
    const resource = parts[0]
    const id       = parts[1] || null
    const sub      = parts[2] || null
    const subId    = parts[3] || null

    switch (resource) {

      // ── AUTH ───────────────────────────────────────────────
      case 'auth':
        if (sub === 'me')  return AuthService.getProfile(user)
        if (sub === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ── DASHBOARD ─────────────────────────────────────────
      case 'dashboard':
        if (sub === 'summary')   return DashboardService.summary(params, user)
        if (sub === 'divisions') return DashboardService.divisions(params, user)
        if (sub === 'status')    return DashboardService.statusBreakdown(params, user)
        if (sub === 'activity')  return DashboardService.monthlyActivity(params, user)
        return DashboardService.summary(params, user)

      // ── USERS ─────────────────────────────────────────────
      case 'users':
        if (!id && method === 'GET')  return UsersService.list(params, user)
        if (!id && method === 'POST') return UsersService.create(body, user)
        if (id  && method === 'GET')  return UsersService.get(id, user)
        if (id  && sub === 'profile' && method === 'PUT') return UsersService.updateOwnProfile(id, body, user)
        if (id  && method === 'PUT')  return UsersService.update(id, body, user)
        if (id  && sub === 'activate')    return UsersService.activate(id, user)
        if (id  && sub === 'deactivate')  return UsersService.deactivate(id, user)
        if (id  && sub === 'reset-password') return UsersService.resetPassword(id, body, user)
        break

      // ── MASTER KRA LIBRARY ────────────────────────────────
      case 'kra-library':
        if (!id && method === 'GET') return IPCRFService.listMasterKRAs(params, user)
        break

      // ── IPCRF / CCEF FORMS ────────────────────────────────
      case 'ipcrf':
        // Form-level operations
        if (!id && method === 'GET')  return IPCRFService.listForms(params, user)
        if (!id && method === 'POST') return IPCRFService.createForm(body, user)
        if (id  && !sub && method === 'GET') return IPCRFService.getForm(id, user)
        if (id  && !sub && method === 'PUT') return IPCRFService.updateForm(id, body, user)

        // Form status transitions
        if (id && sub === 'submit')      return IPCRFService.submitForm(id, user)
        if (id && sub === 'approve')     return IPCRFService.approveForm(id, body, user)
        if (id && sub === 'for-rating')  return IPCRFService.submitForRating(id, user)
        if (id && sub === 'compute')     return IPCRFService.computeFormScore(id, user)

        // Form entries (KRA + SI rows)
        if (id && sub === 'entries') {
          if (!subId && method === 'GET')  return IPCRFService.getEntries(id, user)
          if (!subId && method === 'POST') return IPCRFService.addEntry(id, body, user)
        }
        break

      // ── FORM ENTRIES ──────────────────────────────────────
      case 'form-entries':
        if (id && method === 'PUT')    return IPCRFService.updateEntry(id, body, user)
        if (id && method === 'DELETE') return IPCRFService.deleteEntry(id, user)
        if (id && sub === 'rate')      return IPCRFService.rateEntry(id, body, user)
        break

      // ── JRB RATINGS ───────────────────────────────────────
      case 'jrb':
        // Get JRB item list (for the rating form UI)
        if (sub === 'items' && method === 'GET') return JRBService.getJRBItems()

        // Submit ratings (supervisor or peer)
        if (!id && method === 'POST') return JRBService.submitRatings(body.formId, body, user)

        // Get ratings for a specific form
        if (id && sub === 'ratings' && method === 'GET') return JRBService.getFormRatings(id, user)

        // Peer assignment
        if (id && sub === 'assign-peers' && method === 'POST') {
          return JRBService.assignPeers(id, body.semester, body.year, user)
        }
        if (id && sub === 'assignment' && method === 'GET') {
          return JRBService.getAssignment(id, params.semester, params.year, user)
        }

        // Get my peer rating forms (forms I need to rate as a peer)
        if (sub === 'my-peer-forms' && method === 'GET') {
          return JRBService.getMyPeerForms(params.semester, params.year, user)
        }
        break

      // ── ATTENDANCE ────────────────────────────────────────
      case 'attendance':
        if (!id && method === 'GET')  return AttendanceService.listRecords(params, user)
        if (!id && method === 'POST') return AttendanceService.logRecord(body, user)

        // Compute semester rating
        if (id && sub === 'compute-rating' && method === 'POST') {
          return AttendanceService.computeSemesterRating(id, body.semester, body.year, user)
        }

        // Get semester rating for a user
        if (id && sub === 'rating' && method === 'GET') {
          return AttendanceService.getRating(id, params.semester, params.year, user)
        }
        break

      // ── NOTIFICATIONS ─────────────────────────────────────
      case 'notifications':
        if (!id && method === 'GET')        return NotificationsService.list(user)
        if (id && sub === 'read')           return NotificationsService.markRead(id, user)
        if (sub === 'read-all')             return NotificationsService.markAllRead(user)
        break

      // ── KRAs (old schema, kept for reference) ─────────────
      case 'kras':
        if (!id && method === 'GET') return []  // Deprecated, use kra-library
        break

      // ── ACCOMPLISHMENTS (old schema) ───────────────────────
      case 'accomplishments':
        if (!id && method === 'GET') return AccomplishmentsService.list(params, user)
        if (!id && method === 'POST') return AccomplishmentsService.create(body, user)
        if (id && method === 'GET')  return AccomplishmentsService.get(id, user)
        if (id && method === 'PUT')  return AccomplishmentsService.update(id, body, user)
        if (id && sub === 'approve')   return AccomplishmentsService.approve(id, body, user)
        if (id && sub === 'revision')  return AccomplishmentsService.requestRevision(id, body, user)
        if (id && sub === 'status')    return AccomplishmentsService.updateStatus(id, body, user)
        if (id && sub === 'history')   return AccomplishmentsService.history(id, user)
        break

      // ── MOV FILES ─────────────────────────────────────────
      case 'mov':
        if (!id && method === 'GET') return MovService.list(params, user)
        if (sub === 'upload')        return MovService.upload(body, user)
        if (id && method === 'GET')  return MovService.get(id, user)
        if (id && method === 'DELETE') return MovService.remove(id, user)
        if (id && sub === 'preview') return MovService.preview(id, user)
        break

      // ── EVALUATIONS (final score summary) ─────────────────
      case 'evaluations':
        if (!id && method === 'GET') return EvaluationService.list(params, user)
        if (id && method === 'GET')  return EvaluationService.get(id, user)
        if (id && method === 'PUT')  return EvaluationService.update(id, body, user)
        if (!id && sub === 'compute') return EvaluationService.compute(body.userId, body.period, user)
        if (id && sub === 'history')  return EvaluationService.history(id, user)
        break

      // ── REPORTS ───────────────────────────────────────────
      case 'reports':
        if (!id && method === 'GET') return ReportsService.list(user)
        if (sub === 'generate')      return ReportsService.generate(body, user)
        if (id && sub === 'download') return ReportsService.download(id, user)
        break

      // ── AUDIT ─────────────────────────────────────────────
      case 'audit':
        if (!id && method === 'GET') return AuditService.list(params, user)
        if (sub === 'export')        return AuditService.export_(params, user)
        break

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(method + ' ' + route + ' is not a valid endpoint', 404)
  }

  return { dispatch }
})()