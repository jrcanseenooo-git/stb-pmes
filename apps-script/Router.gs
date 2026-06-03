const Router = (() => {

  function dispatch(route, method, params, body, user) {
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
        if (id  && sub === 'deactivate')     return UsersService.deactivate(id, user)
        if (id  && sub === 'activate')       return UsersService.activate(id, user)
        if (id  && sub === 'reset-password') return UsersService.resetPassword(id, user)
        break

      // ── KRAs ──
      case 'kras':
        if (!id   && method === 'GET')  return KraService.list(params, user)
        if (!id   && method === 'POST') return KraService.create(body, user)
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

      // ── KRA Master Library ──
      case 'kra-library':
        if (!id && method === 'GET')    return KraLibraryService.list(params, user)
        if (!id && method === 'POST')   return KraLibraryService.create(body, user)
        if (id  && method === 'GET')    return KraLibraryService.get(id, user)
        if (id  && method === 'PUT')    return KraLibraryService.update(id, body, user)
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
        if (!id   && method === 'GET')    return MovService.list(params, user)
        if (sub === 'upload')             return MovService.upload(body, user)
        if (id    && method === 'GET')    return MovService.get(id, user)
        if (id    && method === 'DELETE') return MovService.remove(id, user)
        if (id && sub === 'preview')      return MovService.preview(id, user)
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
        if (!id   && method === 'GET')   return NotificationsService.list(user)
        if (id    && sub === 'read')     return NotificationsService.markRead(id, user)
        if (sub === 'read-all')          return NotificationsService.markAllRead(user)
        break

      // ── Audit ──
      case 'audit':
        if (!id   && method === 'GET')  return AuditService.list(params, user)
        if (sub === 'export')           return AuditService.export_(params, user)
        break

      // ── IPCRF Forms & Entries ──
      // Pattern: ipcrf/forms[/:formId[/action|entries[/:entryId[/rate]]]]
      case 'ipcrf': {
        const formId   = parts[2] || null  // ipcrf/forms/:formId
        const action   = parts[3] || null  // /submit|approve|return|finalize|compute|entries
        const entryId  = parts[4] || null  // /entries/:entryId
        const entryAct = parts[5] || null  // /rate

        if (!formId && method === 'GET')  return IPCRFService.listForms(params, user)
        if (!formId && method === 'POST') return IPCRFService.createForm(body, user)

        if (formId) {
          if (!action && method === 'GET')    return IPCRFService.getForm(formId, user)
          if (!action && method === 'PUT')    return IPCRFService.updateForm(formId, body, user)
          if (!action && method === 'DELETE') return IPCRFService.deleteForm(formId, user)

          if (action === 'submit')   return IPCRFService.submitForm(formId, user)
          if (action === 'approve')  return IPCRFService.approveForm(formId, body, user)
          if (action === 'return')   return IPCRFService.returnForm(formId, body, user)
          if (action === 'finalize') return IPCRFService.finalizeForm(formId, body, user)
          if (action === 'compute')  return IPCRFService.computeScore(formId, user)

          if (action === 'entries') {
            if (!entryId && method === 'GET')  return IPCRFService.listEntries(formId, params, user)
            if (!entryId && method === 'POST') return IPCRFService.addEntry(formId, body, user)
            if (entryId) {
              if (!entryAct && method === 'PUT')    return IPCRFService.updateEntry(formId, entryId, body, user)
              if (!entryAct && method === 'DELETE') return IPCRFService.deleteEntry(formId, entryId, user)
              if (entryAct === 'rate')              return IPCRFService.rateEntry(formId, entryId, body, user)
            }
          }
        }
        break
      }

      default:
        throw HttpError('Route not found: ' + route, 404)
    }

    throw HttpError(`${method} ${route} is not a valid endpoint`, 404)
  }

  return { dispatch }
})()