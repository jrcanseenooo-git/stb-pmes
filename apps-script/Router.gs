const Router = (() => {

  function dispatch(route, method, params, body, user) {
    // Normalise: 'ipcrf/forms/123/entries' → ['ipcrf', 'forms', '123', 'entries']
    const parts    = route.split('/')
    const resource = parts[0]
    const sub0     = parts[1] || null   // e.g. 'forms', 'entries', 'library'
    const id       = parts[2] || null   // form id or entry id
    const sub1     = parts[3] || null   // e.g. 'entries', 'submit', 'approve', 'score'

    switch (resource) {

      // ── Auth ──
      case 'auth':
        if (sub0 === 'me')  return AuthService.getProfile(user)
        if (sub0 === 'log') return AuditService.log(body.action, body.module, body.details, user)
        break

      // ── Dashboard ──
      case 'dashboard':
        if (sub0 === 'summary')   return DashboardService.summary(params, user)
        if (sub0 === 'divisions') return DashboardService.divisions(params, user)
        if (sub0 === 'status')    return DashboardService.statusBreakdown(params, user)
        if (sub0 === 'activity')  return DashboardService.monthlyActivity(params, user)
        break

      // ── Users ──
      case 'users':
        if (!sub0 && method === 'GET')  return UsersService.list(params, user)
        if (!sub0 && method === 'POST') return UsersService.create(body, user)
        if (sub0  && !id && method === 'GET')  return UsersService.get(sub0, user)
        if (sub0  && !id && method === 'PUT')  return UsersService.update(sub0, body, user)
        if (sub0  && id === 'deactivate')      return UsersService.deactivate(sub0, user)
        if (sub0  && id === 'activate')        return UsersService.activate(sub0, user)
        if (sub0  && id === 'reset-password')  return UsersService.resetPassword(sub0, user)
        break

      // ── KRAs ──
      case 'kras': {
        const kraId  = sub0
        const kraId2 = id
        const sub    = sub1
        if (!kraId  && method === 'GET')  return KraService.list(params, user)
        if (!kraId  && method === 'POST') return KraService.create(body, user)
        if (kraId   && !kraId2 && method === 'GET')    return KraService.get(kraId, user)
        if (kraId   && !kraId2 && method === 'PUT')    return KraService.update(kraId, body, user)
        if (kraId   && !kraId2 && method === 'DELETE') return KraService.remove(kraId, user)
        if (kraId   && kraId2 === 'indicators') {
          if (!sub  && method === 'GET')    return KraService.listSI(kraId, user)
          if (!sub  && method === 'POST')   return KraService.createSI(kraId, body, user)
          if (sub   && method === 'PUT')    return KraService.updateSI(kraId, sub, body, user)
          if (sub   && method === 'DELETE') return KraService.removeSI(kraId, sub, user)
        }
        break
      }

      // ── IPCRF ──
      case 'ipcrf': {
        // sub0 = 'forms' | 'entries' | 'library'
        const formId  = id    // ipcrf/forms/{formId}
        const action  = sub1  // ipcrf/forms/{formId}/{action}

        if (sub0 === 'library') {
          return IPCRFService.getLibrary(params, user)
        }

        if (sub0 === 'forms') {
          if (!formId && method === 'GET')  return IPCRFService.listForms(params, user)
          if (!formId && method === 'POST') return IPCRFService.createForm(body, user)
          if (formId  && !action && method === 'GET') return IPCRFService.getForm(formId, user)
          if (formId  && !action && method === 'PUT') return IPCRFService.updateForm(formId, body, user)
          if (formId  && action === 'submit')         return IPCRFService.submitForm(formId, user)
          if (formId  && action === 'approve')        return IPCRFService.approveForm(formId, body, user)
          if (formId  && action === 'return')         return IPCRFService.returnForm(formId, body, user)
          if (formId  && action === 'score')          return IPCRFService.computeScore(formId, user)
          if (formId  && action === 'entries' && method === 'GET')  return IPCRFService.getEntries(formId, user)
          if (formId  && action === 'entries' && method === 'POST') return IPCRFService.addEntry(formId, body, user)
        }

        if (sub0 === 'entries') {
          const entryId = id
          if (entryId && method === 'PUT')    return IPCRFService.updateEntry(entryId, body, user)
          if (entryId && method === 'DELETE') return IPCRFService.deleteEntry(entryId, user)
        }

        break
      }

      // ── Accomplishments ──
      case 'accomplishments': {
        const accId = sub0
        const sub   = id
        if (!accId && method === 'GET')  return AccomplishmentsService.list(params, user)
        if (!accId && method === 'POST') return AccomplishmentsService.create(body, user)
        if (accId  && !sub && method === 'GET') return AccomplishmentsService.get(accId, user)
        if (accId  && !sub && method === 'PUT') return AccomplishmentsService.update(accId, body, user)
        if (accId  && sub === 'status')   return AccomplishmentsService.updateStatus(accId, body, user)
        if (accId  && sub === 'approve')  return AccomplishmentsService.approve(accId, body, user)
        if (accId  && sub === 'revision') return AccomplishmentsService.requestRevision(accId, body, user)
        if (accId  && sub === 'history')  return AccomplishmentsService.history(accId, user)
        break
      }

      // ── MOV ──
      case 'mov': {
        const movId = sub0
        const sub   = id
        if (!movId && method === 'GET') return MovService.list(params, user)
        if (sub0 === 'upload')          return MovService.upload(body, user)
        if (movId  && !sub && method === 'GET')    return MovService.get(movId, user)
        if (movId  && !sub && method === 'DELETE') return MovService.remove(movId, user)
        if (movId  && sub === 'preview')           return MovService.preview(movId, user)
        break
      }

      // ── Evaluations ──
      case 'evaluations': {
        const evalId = sub0
        const sub    = id
        if (!evalId && method === 'GET') return EvaluationService.list(params, user)
        if (evalId  && !sub && method === 'GET') return EvaluationService.get(evalId, user)
        if (evalId  && !sub && method === 'PUT') return EvaluationService.update(evalId, body, user)
        if (sub0    === 'compute')               return EvaluationService.compute(body.userId, body.period, user)
        if (evalId  && sub === 'history')        return EvaluationService.history(evalId, user)
        break
      }

      // ── Reports ──
      case 'reports': {
        const rptId = sub0
        const sub   = id
        if (!rptId && method === 'GET') return ReportsService.list(user)
        if (sub0 === 'generate')        return ReportsService.generate(body, user)
        if (rptId && sub === 'download') return ReportsService.download(rptId, user)
        break
      }

      // ── Notifications ──
      case 'notifications': {
        const notifId = sub0
        const sub     = id
        if (!notifId && method === 'GET') return NotificationsService.list(user)
        if (notifId && sub === 'read')    return NotificationsService.markRead(notifId, user)
        if (sub0 === 'read-all')          return NotificationsService.markAllRead(user)
        break
      }

      // ── Audit ──
      case 'audit': {
        const sub = sub0
        if (!sub && method === 'GET') return AuditService.list(params, user)
        if (sub === 'export')         return AuditService.export_(params, user)
        break
      }

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(`${method} ${route} is not a valid endpoint`, 404)
  }

  return { dispatch }
})()