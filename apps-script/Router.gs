const Router = (() => {

  function dispatch(route, method, params, body, user) {
    // Normalise: 'users/123' → ['users', '123']
    const parts    = route.split('/')
    const resource = parts[0]
    const id       = parts[1] || null
    const sub      = parts[2] || null
    const subId    = parts[3] || null

    switch (resource) {

      // ── Auth ──
      case 'auth':
        if (sub === 'me')  return AuthService.getProfile(user)
        if (sub === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ── Dashboard ──
      case 'dashboard':
        if (sub === 'summary')   return DashboardService.summary(params, user)
        if (sub === 'divisions') return DashboardService.divisions(params, user)
        if (sub === 'status')    return DashboardService.statusBreakdown(params, user)
        if (sub === 'activity')  return DashboardService.monthlyActivity(params, user)
        break

      // ── Users ──
      case 'users':
        if (!id && method === 'GET')  return UsersService.list(params, user)
        if (!id && method === 'POST') return UsersService.create(body, user)
        if (id  && method === 'GET')  return UsersService.get(id, user)
        if (id  && method === 'PUT')  return UsersService.update(id, body, user)
        if (id && sub === 'deactivate')    return UsersService.deactivate(id, user)
        if (id && sub === 'activate')      return UsersService.activate(id, user)
        if (id && sub === 'reset-password') return UsersService.resetPassword(id, user)
        break

      // ── KRAs ──
      case 'kras':
        if (!id   && method === 'GET')    return KraService.list(params, user)
        if (!id   && method === 'POST')   return KraService.create(body, user)
        if (id    && !sub && method === 'GET')    return KraService.get(id, user)
        if (id    && !sub && method === 'PUT')    return KraService.update(id, body, user)
        if (id    && !sub && method === 'DELETE') return KraService.remove(id, user)
        if (id && sub === 'indicators') {
          if (!subId && method === 'GET')    return KraService.listSI(id, user)
          if (!subId && method === 'POST')   return KraService.createSI(id, body, user)
          if (subId  && method === 'PUT')    return KraService.updateSI(id, subId, body, user)
          if (subId  && method === 'DELETE') return KraService.removeSI(id, subId, user)
        }
        break

      // ── KRA Library (MasterKRALibrary sheet) ──
      case 'kra-library':
        if (!id && method === 'GET')  return KraLibraryService.list(params, user)
        if (id  && method === 'GET')  return KraLibraryService.get(id, user)
        if (!id && method === 'POST') return KraLibraryService.create(body, user)
        if (id  && method === 'PUT')  return KraLibraryService.update(id, body, user)
        if (id  && method === 'DELETE') return KraLibraryService.remove(id, user)
        break

      // ── Accomplishments ──
      case 'accomplishments':
        if (!id   && method === 'GET')  return AccomplishmentsService.list(params, user)
        if (!id   && method === 'POST') return AccomplishmentsService.create(body, user)
        if (id    && method === 'GET')  return AccomplishmentsService.get(id, user)
        if (id    && method === 'PUT')  return AccomplishmentsService.update(id, body, user)
        if (id && sub === 'status')   return AccomplishmentsService.updateStatus(id, body, user)
        if (id && sub === 'approve')  return AccomplishmentsService.approve(id, body, user)
        if (id && sub === 'revision') return AccomplishmentsService.requestRevision(id, body, user)
        if (id && sub === 'history')  return AccomplishmentsService.history(id, user)
        break

      // ── MOV ──
      case 'mov':
        if (!id   && method === 'GET')  return MovService.list(params, user)
        if (sub === 'upload')           return MovService.upload(body, user)
        if (id    && method === 'GET')  return MovService.get(id, user)
        if (id    && method === 'DELETE') return MovService.remove(id, user)
        if (id && sub === 'preview')    return MovService.preview(id, user)
        break

      // ── Evaluations ──
      case 'evaluations':
        if (!id   && method === 'GET')  return EvaluationService.list(params, user)
        if (id    && method === 'GET')  return EvaluationService.get(id, user)
        if (id    && method === 'PUT')  return EvaluationService.update(id, body, user)
        if (sub === 'compute')          return EvaluationService.compute(body.userId, body.period, user)
        if (sub === 'history')          return EvaluationService.history(id, user)
        break

      // ── Reports ──
      case 'reports':
        if (!id   && method === 'GET')  return ReportsService.list(user)
        if (sub === 'generate')         return ReportsService.generate(body, user)
        if (id && sub === 'download')   return ReportsService.download(id, user)
        break

      // ── Notifications ──
      case 'notifications':
        if (!id   && method === 'GET')  return NotificationsService.list(user)
        if (id    && sub === 'read')    return NotificationsService.markRead(id, user)
        if (sub === 'read-all')         return NotificationsService.markAllRead(user)
        break

      // ── Audit ──
      case 'audit':
        if (!id   && method === 'GET')  return AuditService.list(params, user)
        if (sub === 'export')           return AuditService.export_(params, user)
        break

      // ── Deadlines (previously missing route) ──
      case 'deadlines':
        if (!id && method === 'GET')  return DeadlinesService.list(params, user)
        if (!id && method === 'POST') return DeadlinesService.create(body, user)
        if (id  && method === 'GET')  return DeadlinesService.get(id, user)
        if (id  && method === 'PUT')  return DeadlinesService.update(id, body, user)
        if (id  && method === 'DELETE') return DeadlinesService.remove(id, user)
        break

      // ── IPCRF Forms (previously missing route) ──
      case 'ipcrf':
        if (!id && method === 'GET')  return IpcrfService.list(params, user)
        if (!id && method === 'POST') return IpcrfService.create(body, user)
        if (id  && method === 'GET')  return IpcrfService.get(id, user)
        if (id  && method === 'PUT')  return IpcrfService.update(id, body, user)
        if (id && sub === 'submit')   return IpcrfService.submit(id, body, user)
        if (id && sub === 'approve')  return IpcrfService.approve(id, body, user)
        if (id && sub === 'return')   return IpcrfService.return_(id, body, user)
        if (id && sub === 'rate')     return IpcrfService.rate(id, body, user)
        if (id && sub === 'finalize') return IpcrfService.finalize(id, body, user)
        if (id && sub === 'compute-score') return IpcrfService.computeScore(id, user)
        // Form entries sub-resource
        if (id && sub === 'entries') {
          if (!subId && method === 'GET')    return IpcrfService.listEntries(id, user)
          if (!subId && method === 'POST')   return IpcrfService.addEntry(id, body, user)
          if (subId  && method === 'PUT')    return IpcrfService.updateEntry(id, subId, body, user)
          if (subId  && method === 'DELETE') return IpcrfService.deleteEntry(id, subId, user)
        }
        // JRB Ratings sub-resource
        if (id && sub === 'jrb') {
          if (!subId && method === 'GET')  return IpcrfService.listJrbRatings(id, user)
          if (!subId && method === 'POST') return IpcrfService.saveJrbRatings(id, body, user)
        }
        break

      // ── Peer Assignments (previously missing route) ──
      case 'peer-assignments':
        if (!id && method === 'GET')  return PeerAssignmentService.list(params, user)
        if (!id && method === 'POST') return PeerAssignmentService.assign(body, user)
        if (id  && method === 'GET')  return PeerAssignmentService.get(id, user)
        if (id && sub === 'complete') return PeerAssignmentService.markComplete(id, body, user)
        break

      // ── Attendance (previously missing route) ──
      case 'attendance':
        if (!id && method === 'GET')  return AttendanceService.list(params, user)
        if (!id && method === 'POST') return AttendanceService.record(body, user)
        if (id  && method === 'GET')  return AttendanceService.get(id, user)
        if (id  && method === 'PUT')  return AttendanceService.update(id, body, user)
        if (sub === 'compute-rating') return AttendanceService.computeRating(body, user)
        if (sub === 'ratings')        return AttendanceService.listRatings(params, user)
        break

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(`${method} ${route} is not a valid endpoint`, 404)
  }

  return { dispatch }
})()