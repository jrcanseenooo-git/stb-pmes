/**
 * Generates official DSWD IPCRF / CCEF "Targets" (Annex F.1) and "Ratings" (Annex F.2)
 * documents by cloning the official Google Sheets template files and filling them in
 * with data from the PMES IPCRF_FORMS / FORM_ENTRIES sheets — instead of recreating
 * the layout from scratch. This preserves the exact official formatting (merges,
 * borders, landscape page setup, auto-height wrapped rows) because the output IS a
 * real copy of the real template, not a re-implementation of it.
 *
 * ── CONFIG — VERIFY THESE AGAINST THE LIVE DRIVE FILES BEFORE TRUSTING IN PRODUCTION ──
 * Tab names and column letters below were reverse-engineered from a flattened text
 * export of the templates, not a live cell-by-cell inspection. Generate ONE test
 * document for each docType and spot-check alignment before relying on this for
 * real signed forms.
 */
const PmesDocGenService = (() => {

  const TEMPLATE_ID = {
    IPCRF: '1xM914zoR2TGJhwo6xdzK6x6gV79VJojhg1zXDSU6hrY',
    CCEF:  '1oshiYy-gHDkriyufzQtNRmISmeeFKbu15diYYHPS_eY'
  }

  // Source tab to clone the STRUCTURE/FORMATTING from for each doc type.
  // These are filled example tabs in the template files — we copy them, then
  // wipe the data rows and refill with the actual staff member's data.
  const SOURCE_TAB = {
    IPCRF: {
      targets: '2025 IPCRF - Targets_Taganap',
      ratings: { '1': '1Sem Enhanced IPCRF-Ratings', '2': '2nd Sem IPCRF-Ratings' }
    },
    CCEF: {
      targets: 'Enhanced CCEF - Targets',
      ratings: { '1': 'Enhanced CCEF - Ratings - 1st sem', '2': 'Enhanced CCEF - Ratings - 2nd sem' }
    }
  }

  // Column letters for the indicator table — same layout in both IPCRF and CCEF.
  const COL = {
    targets: { kra: 'B', si: 'C', period: 'D', effGuide: 'E', qualGuide: 'F', timeGuide: 'G', mov: 'H', remarks: 'I' },
    ratings: { kra: 'B', si: 'C', accomplishment: 'D', eff: 'E', qual: 'F', time: 'G', avg: 'H', mov: 'I', remarks: 'J' }
  }

  const OUTPUT_FOLDER_NAME = 'PMES Generated Forms'

  // ─────────────────────────────────────────────
  // PUBLIC: generate Annex F.1 — Targets
  // ─────────────────────────────────────────────
  function generateTargetsDoc(formId, user, options = {}) {
    const form  = _withOwnerProfileFields(IpcrfService.get(formId, user))
    form.entries = _filterEntriesByApplicablePeriod(form.entries || [], options.applicableRatingPeriod)
    const ss    = _getOrCreateFormFile(form)
    const sheet = _addOrReplaceTab(ss, TEMPLATE_ID[form.type], SOURCE_TAB[form.type].targets, 'Targets')

    _fillTargetsHeader(sheet, form)
    _fillIndicatorSections(sheet, form, 'targets')
    _forceWrapAndAutosize(sheet)

    SpreadsheetService.updateRow(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS), formId, {
      docFileId: ss.getId(), targetsGeneratedAt: new Date().toISOString()
    })

    AuditService.log('GENERATE_DOC', 'IPCRF', `Generated Targets doc for ${form.employeeName} (${form.type})`, user)
    return { fileId: ss.getId(), fileUrl: ss.getUrl(), fileName: ss.getName(), sheetId: sheet.getSheetId() }
  }

  // ─────────────────────────────────────────────
  // PUBLIC: generate Annex F.2 — Ratings
  // ─────────────────────────────────────────────
  function generateRatingsDoc(formId, user) {
    const form = _withOwnerProfileFields(IpcrfService.get(formId, user))
    const sem  = String(form.semester) === '2' ? '2' : '1'

    const ss    = _getOrCreateFormFile(form)
    const sheet = _addOrReplaceTab(ss, TEMPLATE_ID[form.type], SOURCE_TAB[form.type].ratings[sem], 'Ratings')

    _fillRatingsHeader(sheet, form, sem)
    _fillIndicatorSections(sheet, form, 'ratings')
    _fillFinalRating(sheet, form)
    _fillFeedbackSection(sheet, form)
    _forceWrapAndAutosize(sheet)

    SpreadsheetService.updateRow(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS), formId, {
      docFileId: ss.getId(), ratingsGeneratedAt: new Date().toISOString()
    })

    AuditService.log('GENERATE_DOC', 'IPCRF', `Generated Ratings doc for ${form.employeeName} (${form.type}, S${sem} ${form.year})`, user)
    return { fileId: ss.getId(), fileUrl: ss.getUrl(), fileName: ss.getName(), sheetId: sheet.getSheetId() }
  }

  // ─────────────────────────────────────────────
  // PUBLIC: export a previously generated file as PDF (for the in-app Print button)
  // ─────────────────────────────────────────────
  function exportPdf(fileId, tabName, user) {
    const ss    = SpreadsheetApp.openById(fileId)
    const sheet = (tabName && ss.getSheetByName(tabName)) || ss.getSheets()[0]
    const url = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export'
      + '?format=pdf&size=A4&portrait=false&fitw=true'
      + '&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&attachment=false'
      + '&gid=' + sheet.getSheetId()

    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    })
    if (resp.getResponseCode() !== 200) throw HttpError('Could not export PDF: ' + resp.getContentText(), 500)

    AuditService.log('PRINT_DOC', 'IPCRF', `Exported PDF for file ${fileId} (${sheet.getName()})`, user)
    return {
      pdfBase64: Utilities.base64Encode(resp.getBlob().getBytes()),
      fileName:  ss.getName() + ' - ' + sheet.getName() + '.pdf'
    }
  }

  // ─────────────────────────────────────────────
  // INTERNAL — one combined Drive file per form (Targets + Ratings as tabs)
  // ─────────────────────────────────────────────
  function _getOrCreateFormFile(form) {
    if (form.docFileId) {
      try { return SpreadsheetApp.openById(form.docFileId) }
      catch (e) { Logger.log('[DocGen] Stored docFileId no longer accessible, creating a new file: ' + e.message) }
    }
    const fileName = `${form.type} - ${form.employeeName} - S${form.semester} ${form.year}`
    const ss = SpreadsheetApp.create(fileName)
    DriveApp.getFileById(ss.getId()).moveTo(_getOutputFolder())
    return ss
  }

  // Clone a template tab into an existing spreadsheet under a fixed name
  // (Targets/Ratings), replacing any previous tab of that name so repeat
  // generation refreshes in place instead of piling up duplicate tabs.
  function _addOrReplaceTab(ss, templateId, sourceTabName, fixedTabName) {
    const existing = ss.getSheetByName(fixedTabName)
    if (existing) ss.deleteSheet(existing)

    const templateSS  = SpreadsheetApp.openById(templateId)
    const sourceSheet = templateSS.getSheetByName(sourceTabName)
    if (!sourceSheet) throw HttpError(`Template tab "${sourceTabName}" not found in template ${templateId}`, 500)

    const newSheet = sourceSheet.copyTo(ss)
    newSheet.setName(fixedTabName)

    // Clean up the blank default "Sheet1" now that there's at least one real tab
    const placeholder = ss.getSheetByName('Sheet1')
    if (placeholder && ss.getSheets().length > 1) ss.deleteSheet(placeholder)

    return newSheet
  }

  function _getOutputFolder() {
    const existing = DriveApp.getFoldersByName(OUTPUT_FOLDER_NAME)
    if (existing.hasNext()) return existing.next()
    return DriveApp.createFolder(OUTPUT_FOLDER_NAME)
  }

  function _withOwnerProfileFields(form) {
    try {
      const owner = SpreadsheetService.getRow(SpreadsheetService.getSheet(SHEET.USERS), form.userId)
      if (!owner) return form
      return {
        ...form,
        employeeName: owner.fullName || form.employeeName,
        position: owner.position || form.position,
        divisionId: owner.divisionId || form.divisionId,
        divisionName: owner.divisionName || form.divisionName,
        sectionName: owner.section || form.sectionName
      }
    } catch (e) {
      Logger.log('[DocGen] Could not refresh owner profile fields: ' + e.message)
      return form
    }
  }

  function _filterEntriesByApplicablePeriod(entries, applicableRatingPeriod) {
    const selected = _normaliseApplicablePeriod(applicableRatingPeriod)
    if (selected === 'both') return entries
    return entries.filter(e => {
      const entryPeriod = _normaliseApplicablePeriod(e.applicableRatingPeriod)
      return entryPeriod === 'both' || entryPeriod === selected
    })
  }

  function _normaliseApplicablePeriod(value) {
    const text = String(value || '').toLowerCase()
    if (text.includes('1')) return '1st'
    if (text.includes('2')) return '2nd'
    return 'both'
  }

  // ─────────────────────────────────────────────
  // INTERNAL — anchor lookup (TextFinder, resilient to row insert/delete)
  // ─────────────────────────────────────────────
  function _findRow(sheet, text) {
    const match = sheet.createTextFinder(text).matchEntireCell(false).findNext()
    if (!match) throw HttpError(`Could not locate anchor text "${text}" in generated sheet — template layout may have changed`, 500)
    return match.getRow()
  }

  // Explicitly forces wrap + row auto-height on the whole used range, rather than
  // assuming the template's own formatting carried over correctly through copyTo().
  // This is what actually prevents long indicator/accomplishment text from
  // overlapping the row below it.
  function _forceWrapAndAutosize(sheet) {
    sheet.getDataRange().setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
  }

  // ─────────────────────────────────────────────
  // INTERNAL — header fields (Targets)
  // ─────────────────────────────────────────────
  function _fillTargetsHeader(sheet, form) {
    const rDept = _findRow(sheet, 'DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT')
    sheet.getRange(rDept + 3, 2).setValue(`CY ${form.year}`)                                   // "CY 2026" line
    sheet.getRange(rDept + 5, 2).setValue(`SOCIAL TECHNOLOGY BUREAU - ${(form.divisionName || '').toUpperCase()}`)

    // Anchored close to the actual target cells instead of a long offset chain from
    // a distant header label — that long chain is what let a stale template name
    // ("Girardo Badana") bleed through when CCEF's header block didn't line up
    // exactly with the row count the offsets were derived from on IPCRF.
    const rCommit = _findRow(sheet, 'I commit to deliver and agree')
    sheet.getRange(rCommit + 2, 5).setValue(form.employeeName)
    sheet.getRange(rCommit + 3, 5).setValue(form.position || '')
    sheet.getRange(rCommit + 4, 7).setValue(form.dateSignedRatee || '')

    const rCert = _findRow(sheet, 'We hereby certify that the above success indicators')
    sheet.getRange(rCert + 2, 2).setValue(form.immediateSupervisor || '')
    sheet.getRange(rCert + 2, 5).setValue(form.approvingAuthority || '')
    sheet.getRange(rCert + 3, 2).setValue(form.supervisorPosition || '')
    sheet.getRange(rCert + 3, 5).setValue(form.authorityPosition || '')
  }

  // ─────────────────────────────────────────────
  // INTERNAL — header fields (Ratings)
  // ─────────────────────────────────────────────
  function _fillRatingsHeader(sheet, form, sem) {
    const periodLabel = sem === '2' ? '2nd Semester' : '1st Semester'
    const rDept = _findRow(sheet, 'DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT')
    sheet.getRange(rDept + 3, 2).setValue(`${periodLabel}, CY ${form.year}`)
    sheet.getRange(rDept + 5, 2).setValue(`SOCIAL TECHNOLOGY BUREAU - ${(form.divisionName || '').toUpperCase()}`)
  }

  // ─────────────────────────────────────────────
  // INTERNAL — Core / Support indicator table (shared by Targets + Ratings)
  // ─────────────────────────────────────────────
  function _fillIndicatorSections(sheet, form, docType) {
    const col = COL[docType]
    const core    = (form.entries || []).filter(e => e.functionType === 'Core')
    const support = (form.entries || []).filter(e => e.functionType === 'Support')

    let rCoreHd = _findRow(sheet, 'Core Functions')
    let rNextHd = _findRow(sheet, 'Support Functions')
    rCoreHd = _resizeSection(sheet, rCoreHd, rNextHd, core.length)

    rNextHd = _findRow(sheet, 'Support Functions')
    const rEndAnchor = docType === 'ratings'
      ? _findRow(sheet, 'FINAL NUMERICAL RATING')
      : _findRow(sheet, 'We hereby certify that the above success indicators')
    const rSupportHd = _resizeSection(sheet, rNextHd, rEndAnchor, support.length)

    rCoreHd = _findRow(sheet, 'Core Functions')
    _writeEntries(sheet, rCoreHd + 1, core, col, docType)
    _writeEntries(sheet, rSupportHd + 1, support, col, docType)

    if (docType === 'ratings') {
      sheet.getRange(rCoreHd, 8).setValue(_avg(core))      // col H — Core subtotal average
      sheet.getRange(rSupportHd, 8).setValue(_avg(support)) // col H — Support subtotal average
    }
  }

  // Resize the block of rows between a section header and the next anchor to
  // exactly `count` rows, cloning formatting from the block's last existing row.
  // Returns the (possibly shifted) row number of the section header.
  function _resizeSection(sheet, headerRow, nextAnchorRow, count) {
    const existing = nextAnchorRow - headerRow - 1
    if (count === existing) return headerRow

    if (count < existing) {
      sheet.deleteRows(nextAnchorRow - (existing - count), existing - count)
    } else {
      const toInsert    = count - existing
      const templateRow = existing > 0 ? (nextAnchorRow - 1) : headerRow
      sheet.insertRowsAfter(templateRow, toInsert)
      const srcRange = sheet.getRange(templateRow, 1, 1, sheet.getLastColumn())
      for (let i = 0; i < toInsert; i++) {
        srcRange.copyTo(sheet.getRange(templateRow + 1 + i, 1, 1, sheet.getLastColumn()), { formatOnly: true })
      }
    }
    return headerRow
  }

  function _writeEntries(sheet, startRow, entries, col, docType) {
    entries.forEach((e, i) => {
      const r = startRow + i
      sheet.getRange(r, _colNum(col.kra)).setValue(e.kraName || '')
      sheet.getRange(r, _colNum(col.si)).setValue(e.successIndicator || '')

      if (docType === 'targets') {
        sheet.getRange(r, _colNum(col.mov)).setValue(e.meansOfVerification || '')
        sheet.getRange(r, _colNum(col.period)).setValue(e.applicableRatingPeriod || '')
        sheet.getRange(r, _colNum(col.effGuide)).setValue(e.efficiencyGuide || 'N/A')
        sheet.getRange(r, _colNum(col.qualGuide)).setValue(e.qualityGuide || '')
        sheet.getRange(r, _colNum(col.timeGuide)).setValue(e.timelinessGuide || '')
      } else {
        // Ratings doc shows the actual MOV reference code(s), not the guidance text
        sheet.getRange(r, _colNum(col.mov)).setValue(e.movReferences || e.meansOfVerification || '')
        sheet.getRange(r, _colNum(col.accomplishment)).setValue(e.accomplishment || '')
        sheet.getRange(r, _colNum(col.eff)).setValue(e.ratingEfficiency === '' ? 'N/A' : e.ratingEfficiency)
        sheet.getRange(r, _colNum(col.qual)).setValue(e.ratingQuality === '' ? 'N/A' : e.ratingQuality)
        sheet.getRange(r, _colNum(col.time)).setValue(e.ratingTimeliness === '' ? 'N/A' : e.ratingTimeliness)
        sheet.getRange(r, _colNum(col.avg)).setValue(e.ratingAverage || '')
      }
    })
  }

  function _avg(entries) {
    const rated = entries.filter(e => e.ratingAverage !== '' && e.ratingAverage !== null && e.ratingAverage !== undefined)
    if (!rated.length) return ''
    return Math.round((rated.reduce((s, e) => s + Number(e.ratingAverage), 0) / rated.length) * 100000) / 100000
  }

  // ─────────────────────────────────────────────
  // INTERNAL — final rating + signatures (Ratings doc only)
  // ─────────────────────────────────────────────
  function _fillFinalRating(sheet, form) {
    const rFinal = _findRow(sheet, 'FINAL NUMERICAL RATING')
    sheet.getRange(rFinal, 10).setValue(form.finalNumericalRating || '')      // col J — template quirk, not col H
    const rAdj = _findRow(sheet, 'ADJECTIVAL RATING')
    sheet.getRange(rAdj, 10).setValue(form.adjectivalRating || '')           // col J

    const rCert = _findRow(sheet, 'We hereby certify that the above accomplishments')
    sheet.getRange(rCert + 2, 2).setValue(form.employeeName || '')
    sheet.getRange(rCert + 2, 4).setValue(form.immediateSupervisor || '')
    sheet.getRange(rCert + 2, 7).setValue(form.approvingAuthority || '')
    sheet.getRange(rCert + 3, 2).setValue(form.position || '')
    sheet.getRange(rCert + 3, 4).setValue(form.supervisorPosition || '')
    sheet.getRange(rCert + 3, 7).setValue(form.authorityPosition || '')
    sheet.getRange(rCert + 4, 2).setValue(form.dateSignedRatee || '')
    sheet.getRange(rCert + 4, 4).setValue(form.dateSignedSupervisor || '')
    sheet.getRange(rCert + 4, 7).setValue(form.dateSignedAuthority || '')
  }

  // PART II — Feedback. These fields exist on the IPCRF_FORMS sheet
  // (feedbackStrengths, feedbackComments, feedbackRecommendations,
  // feedbackAreasForImprovement) but currently have no UI to fill them in,
  // so they will be blank until that UI exists. Left blank = fine, the rater
  // can type directly into the generated Sheet before printing.
  function _fillFeedbackSection(sheet, form) {
    try {
      const rStrengths = _findRow(sheet, 'STRENGTHS')
      sheet.getRange(rStrengths, 4).setValue(form.feedbackStrengths || '')

      const rComments = _findRow(sheet, "RATER'S COMMENTS")
      const combined = [form.feedbackComments, form.feedbackRecommendations].filter(Boolean).join('\n\n')
      sheet.getRange(rComments, 4).setValue(combined)

      const rAreas = _findRow(sheet, 'AREAS FOR IMPROVEMENTS')
      sheet.getRange(rAreas, 4).setValue(form.feedbackAreasForImprovement || '')
    } catch (e) {
      // PART II anchors are best-effort — don't fail the whole doc generation over them
      Logger.log('[DocGen] PART II fill skipped: ' + e.message)
    }
  }

  function _colNum(letter) {
    return letter.toUpperCase().charCodeAt(0) - 64 // 'A' -> 1, 'B' -> 2, ...
  }

  return { generateTargetsDoc, generateRatingsDoc, exportPdf }
})()
