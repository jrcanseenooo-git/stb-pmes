/**
 * EvaluationService.gs
 * Computes Efficiency, Quality, and Timeliness ratings
 * and stores results in the Evaluations sheet.
 */

const EvaluationService = (() => {

  // ── Rating scale thresholds ──
  const TIMELINESS_SCALE = [
    { minDays:  3, score: 5, label: 'Outstanding'      }, // ≥3 days early
    { minDays:  1, score: 4, label: 'Very Satisfactory'},
    { minDays:  0, score: 3, label: 'Satisfactory'     }, // on deadline
    { minDays: -3, score: 2, label: 'Unsatisfactory'   },
    { minDays: -Infinity, score: 1, label: 'Poor'      }
  ]

  // ── LIST ──
  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.EVALUATIONS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    // Scope by role
    if (!['System Administrator','Bureau Director'].includes(profile.role)) {
      rows = rows.filter(r => r.userId === profile.id || r.divisionId === profile.divisionId)
    }

    if (params.userId)   rows = rows.filter(r => r.userId === params.userId)
    if (params.semester) rows = rows.filter(r => r.semester === params.semester)
    if (params.year)     rows = rows.filter(r => r.year == params.year)

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── GET ──
  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.EVALUATIONS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Evaluation not found', 404)
    return row
  }

  // ── COMPUTE (triggered for a user + period) ──
  function compute(userId, period, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )

    // Fetch all accomplishments for the user in this period
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const accs     = SpreadsheetService.getAllRows(accSheet).filter(r =>
      r.userId === userId && r.semester === period && !r.deleted
    )

    if (!accs.length) throw HttpError('No accomplishments found for this period', 404)

    // Compute per-accomplishment scores then average
    const scores = accs.map(a => computeSingleScore(a))

    const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length

    const efficiency  = roundTo(avg(scores.map(s => s.efficiency)),  2)
    const quality     = roundTo(avg(scores.map(s => s.quality)),     2)
    const timeliness  = roundTo(avg(scores.map(s => s.timeliness)),  2)
    // Weighted: E 30%, Q 30%, T 40%
    const overall     = roundTo(efficiency * 0.30 + quality * 0.30 + timeliness * 0.40, 2)
    const label       = ratingLabel(overall)

    const evalSheet = SpreadsheetService.getSheet(SHEET.EVALUATIONS)
    const existing  = SpreadsheetService.getAllRows(evalSheet)
      .find(r => r.userId === userId && r.semester === period)

    const evalData = {
      userId,
      period,
      semester:    period,
      year:        new Date().getFullYear(),
      efficiency,
      quality,
      timeliness,
      overall,
      label,
      targetCount: accs.length,
      computedBy:  user.uid,
      computedAt:  new Date().toISOString()
    }

    if (existing) {
      SpreadsheetService.updateRow(evalSheet, existing.id, evalData)
      AuditService.log('COMPUTE', 'Evaluations', `Recomputed for user ${userId} period ${period}`, user)
      return { ...existing, ...evalData }
    } else {
      const newEval = { id: SpreadsheetService.generateId('EVL-'), ...evalData }
      SpreadsheetService.appendRow(evalSheet, newEval)
      AuditService.log('COMPUTE', 'Evaluations', `Created evaluation for user ${userId} period ${period}`, user)
      return newEval
    }
  }

  // ── UPDATE (manual evaluator adjustment) ──
  function update(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Division Chief', 'Bureau Director')
    const sheet = SpreadsheetService.getSheet(SHEET.EVALUATIONS)
    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...body,
      manuallyAdjusted: true,
      adjustedBy: user.uid,
      adjustedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'Evaluations', `Manual adjustment: ${id}`, user)
    return updated
  }

  // ── HISTORY ──
  function history(userId, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.EVALUATIONS)
    return SpreadsheetService.getAllRows(sheet)
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.computedAt) - new Date(a.computedAt))
  }

  // ── Internal: compute score for one accomplishment ──
  function computeSingleScore(acc) {
    const accomplished = Number(acc.accomplished) || 0
    const targetQty    = Number(acc.targetQty)    || 1
    const revisions    = Number(acc.revisions)    || 0

    // Efficiency: % of target achieved
    const pct = (accomplished / targetQty) * 100
    let efficiency
    if (pct >= 100) efficiency = 5
    else if (pct >= 90) efficiency = 4
    else if (pct >= 80) efficiency = 3
    else if (pct >= 51) efficiency = 2
    else efficiency = 1

    // Quality: fewer revisions = higher score
    let quality
    if (revisions === 0) quality = 5
    else if (revisions === 1) quality = 4
    else if (revisions === 2) quality = 3
    else if (revisions === 3) quality = 2
    else quality = 1

    // Timeliness: days between submission and deadline
    let timeliness = 1
    if (acc.submittedAt && acc.deadline) {
      const diffDays = Math.floor(
        (new Date(acc.deadline) - new Date(acc.submittedAt)) / 86400000
      )
      for (const tier of TIMELINESS_SCALE) {
        if (diffDays >= tier.minDays) { timeliness = tier.score; break }
      }
    }

    return { efficiency, quality, timeliness }
  }

  function ratingLabel(score) {
    if (score >= 4.5) return 'Outstanding'
    if (score >= 3.5) return 'Very Satisfactory'
    if (score >= 2.5) return 'Satisfactory'
    if (score >= 1.5) return 'Unsatisfactory'
    return 'Poor'
  }

  function roundTo(val, decimals) {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }

  return { list, get, compute, update, history }
})()
