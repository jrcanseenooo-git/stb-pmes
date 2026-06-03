const Router = (() => {

  function dispatch(route, method, params, body, user) {
    const parts    = route.split('/')
    const resource = parts[0]        // e.g. 'ipcrf', 'users', 'kras'
    const id       = parts[1] || null
    const sub      = parts[2] || null
    const subId    = parts[3] || null

    switch (resource) {

      // ── Auth ──
      case 'auth':
        if (id === 'me')  return AuthService.getProfile(user)
        if (id === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ── Dashboard ──
      case 'dashboard':
        if (id === 'summary')   return DashboardService.summary(params, user)
        if (id === 'divisions') return DashboardService.divisions(params, user)
        if (id === 'status')    return DashboardService.statusBreakdown(params, user)
        if (id === 'activity')  return DashboardService.monthlyActivity(params, user)
        break

      // ── Users ──
      case 'users':
        if (!id   && method === 'GET')  return UsersService.list(params, user)
        if (!id   && method === 'POST') return UsersService.create(body, user)
        if (id    && !sub && method === 'GET') return UsersService.get(id, user)
        if (id    && !sub && method === 'PUT') return UsersService.update(id, body, user)
        if (id    && sub === 'deactivate')     return UsersService.deactivate(id, user)
        if (id    && sub === 'activate')       return UsersService.activate(id, user)
        if (id    && sub === 'reset-password') return UsersService.resetPassword(id, user)
        break

      // ── KRAs ──
      case 'kras':
        if (!id   && method === 'GET')  return KraService.list(params, user)
        if (!id   && method === 'POST') return KraService.create(body, user)
        if (id    && !sub && method === 'GET')    return KraService.get(id, user)
        if (id    && !sub && method === 'PUT')    return KraService.update(id, body, user)
        if (id    && !sub && method === 'DELETE') return KraService.remove(id, user)
        if (id    && sub === 'indicators') {
          if (!subId && method === 'GET')    return KraService.listSI(id, user)
          if (!subId && method === 'POST')   return KraService.createSI(id, body, user)
          if (subId  && method === 'PUT')    return KraService.updateSI(id, subId, body, user)
          if (subId  && method === 'DELETE') return KraService.removeSI(id, subId, user)
        }
        break

      // ── IPCRF / CCEF ──
      case 'ipcrf':
        // ipcrf/library
        if (id === 'library') return IPCRFService.getLibrary(params, user)

        // ipcrf/forms  /  ipcrf/forms/{formId}  /  ipcrf/forms/{formId}/{action}
        if (id === 'forms') {
          const formId = sub    // parts[2]
          const action = subId  // parts[3]

          if (!formId && method === 'GET')  return IPCRFService.listForms(params, user)
          if (!formId && method === 'POST') return IPCRFService.createForm(body, user)

          if (formId && !action && method === 'GET') return IPCRFService.getForm(formId, user)
          if (formId && !action && method === 'PUT') return IPCRFService.updateForm(formId, body, user)

          if (formId && action === 'submit')  return IPCRFService.submitForm(formId, user)
          if (formId && action === 'approve') return IPCRFService.approveForm(formId, body, user)
          if (formId && action === 'return')  return IPCRFService.returnForm(formId, body, user)
          if (formId && action === 'score')   return IPCRFService.computeScore(formId, user)

          if (formId && action === 'entries' && method === 'GET')  return IPCRFService.getEntries(formId, user)
          if (formId && action === 'entries' && method === 'POST') return IPCRFService.addEntry(formId, body, user)
        }

        // ipcrf/entries/{entryId}  (update / delete a single entry)
        if (id === 'entries') {
          const entryId = sub
          if (entryId && method === 'PUT')    return IPCRFService.updateEntry(entryId, body, user)
          if (entryId && method === 'DELETE') return IPCRFService.deleteEntry(entryId, user)
        }
        break

      // ── Accomplishments ──
      case 'accomplishments':
        if (!id   && method === 'GET')  return AccomplishmentsService.list(params, user)
        if (!id   && method === 'POST') return AccomplishmentsService.create(body, user)
        if (id    && !sub && method === 'GET') return AccomplishmentsService.get(id, user)
        if (id    && !sub && method === 'PUT') return AccomplishmentsService.update(id, body, user)
        if (id    && sub === 'status')   return AccomplishmentsService.updateStatus(id, body, user)
        if (id    && sub === 'approve')  return AccomplishmentsService.approve(id, body, user)
        if (id    && sub === 'revision') return AccomplishmentsService.requestRevision(id, body, user)
        if (id    && sub === 'history')  return AccomplishmentsService.history(id, user)
        break

      // ── MOV ──
      case 'mov':
        if (!id   && method === 'GET') return MovService.list(params, user)
        if (id === 'upload')           return MovService.upload(body, user)
        if (id    && !sub && method === 'GET')    return MovService.get(id, user)
        if (id    && !sub && method === 'DELETE') return MovService.remove(id, user)
        if (id    && sub === 'preview')           return MovService.preview(id, user)
        break

      // ── Evaluations ──
      case 'evaluations':
        if (!id   && method === 'GET') return EvaluationService.list(params, user)
        if (id    && !sub && method === 'GET') return EvaluationService.get(id, user)
        if (id    && !sub && method === 'PUT') return EvaluationService.update(id, body, user)
        if (id    === 'compute')               return EvaluationService.compute(body.userId, body.period, user)
        if (id    && sub === 'history')        return EvaluationService.history(id, user)
        break

      // ── Reports ──
      case 'reports':
        if (!id   && method === 'GET') return ReportsService.list(user)
        if (id    === 'generate')      return ReportsService.generate(body, user)
        if (id    && sub === 'download') return ReportsService.download(id, user)
        break

      // ── Notifications ──
      case 'notifications':
        if (!id   && method === 'GET') return NotificationsService.list(user)
        if (id    && sub === 'read')   return NotificationsService.markRead(id, user)
        if (id    === 'read-all')      return NotificationsService.markAllRead(user)
        break

      // ── Audit ──
      case 'audit':
        if (!id   && method === 'GET') return AuditService.list(params, user)
        if (id    === 'export')        return AuditService.export_(params, user)
        break

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(`${method} ${route} is not a valid endpoint`, 404)
  }

  return { dispatch }
})()