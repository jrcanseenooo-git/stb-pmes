/**
 * DatabaseMaintenanceService.gs
 * Safe database reset helpers for clearing transactional/test data.
 *
 * This intentionally preserves sheets, headers, users, divisions, and the master KRA
 * library so the system can still boot and generate new forms after the reset.
 */

const DatabaseMaintenanceService = (() => {
  const CONFIRM_RESET_PHRASE = 'RESET_DATABASE_KEEP_USERS_DIVISIONS_KRAS'
  const CONFIRM_REBUILD_PHRASE = 'REBUILD_FRESH_DATABASE_KEEP_USERS_DIVISIONS_KRAS'
  const PRESERVED_SHEETS = [
    SHEET.USERS,
    SHEET.DIVISIONS,
    SHEET.MASTER_KRA_LIBRARY
  ]
  const ACTIVE_SCHEMA = [
    {
      name: SHEET.USERS,
      preserveData: true,
      headers: [
      'id', 'uid', 'email', 'fullName',
      'role', 'divisionId', 'divisionName', 'section', 'position', 'employeeNo',
      'type', 'positionLevel', 'sgLevel',
      'tempPassword', 'tempPasswordHash', 'mustChangePassword',
      'permissionGroups', 'permissions',
      'active', 'createdAt', 'updatedAt', 'lastLoginAt',
      'pendingActivation', 'requestedRole', 'selfRegistered',
      'firstName', 'middleName', 'lastName', 'suffix'
      ]
    },
    {
      name: SHEET.DIVISIONS,
      preserveData: true,
      headers: [
      'id', 'name', 'code', 'chiefId', 'chiefName', 'parentId', 'color', 'active', 'createdAt'
      ]
    },
    {
      name: SHEET.MASTER_KRA_LIBRARY,
      preserveData: true,
      headers: [
      'id', 'phase', 'kraName', 'classification', 'performanceIndicator',
      'weightII', 'weightIII', 'weightIV',
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide',
      'meansOfVerification', 'applicableTo', 'functionType', 'remarks', 'active'
      ]
    },
    {
      name: SHEET.FOCAL_ASSIGNMENTS,
      headers: [
        'id', 'assignmentType', 'divisionId', 'divisionName',
        'focalRole',
        'userId', 'userName', 'userEmail', 'active',
        'assignedBy', 'assignedByName', 'assignedAt', 'updatedAt'
      ]
    },
    {
      name: SHEET.IPCRF_FORMS,
      headers: [
        'id', 'type', 'userId', 'employeeName', 'position', 'positionLevel',
        'divisionId', 'divisionName', 'sectionName', 'semester', 'year', 'status',
        'coreFunctionWeight', 'supportFunctionWeight',
        'finalNumericalRating', 'adjectivalRating',
        'immediateSupervisor', 'supervisorPosition',
        'approvingAuthority', 'authorityPosition',
        'dateSignedRatee', 'dateSignedSupervisor', 'dateSignedAuthority',
        'feedbackStrengths', 'feedbackAreasForImprovement',
        'feedbackComments', 'feedbackRecommendations',
        'submittedAt', 'approvedAt', 'ratedAt', 'finalizedAt',
        'targetReviewStage', 'targetRoutedToUserId', 'targetRoutedToName',
        'targetRoutedAt', 'targetCompletedAt',
        'ratingReviewStage', 'ratingRoutedToUserId', 'ratingRoutedToName',
        'ratingRoutedAt', 'ratingCompletedAt',
        'docFileId', 'targetsGeneratedAt', 'ratingsGeneratedAt', 's1RatingsGeneratedAt', 's2RatingsGeneratedAt',
        'createdAt', 'updatedAt'
      ]
    },
    {
      name: SHEET.FORM_ENTRIES,
      headers: [
        'id', 'formId', 'masterKRAId', 'functionType', 'kraName',
        'successIndicator', 'applicableRatingPeriod', 'weight', 'classification',
        'efficiencyGuide', 'qualityGuide', 'timelinessGuide', 'meansOfVerification',
        'accomplishment',
        'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
        'movReferences', 'remarks', 'isCustom', 'order',
        'createdAt', 'updatedAt'
      ]
    },
    {
      name: SHEET.ACCOMPLISHMENTS,
      headers: [
        'id', 'type', 'semester', 'year',
        'userId', 'employeeName', 'divisionId', 'division',
        'formId', 'entryId',
        'kraId', 'kraTitle', 'siId', 'target', 'targetQty', 'targetUnit',
        'accomplishment', 'movReferences',
        'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
        'submittedAt', 'approvedAt', 'approvedBy',
        'remarks', 'revisions', 'movCount',
        'createdBy', 'createdAt', 'updatedAt', 'deleted', 'deletedAt'
      ]
    },
    {
      name: SHEET.REVISIONS,
      headers: ['id', 'accomplishmentId', 'fromStatus', 'toStatus', 'remarks', 'changedBy', 'changedByName', 'changedAt']
    },
    {
      name: SHEET.REVIEW_COMMENTS,
      headers: ['id', 'formId', 'entryId', 'reviewType', 'comment', 'reviewerId', 'reviewerName', 'createdAt', 'updatedAt']
    },
    {
      name: SHEET.MOV,
      headers: [
        'id', 'driveFileId', 'driveUrl', 'fileName', 'mimeType', 'sizeBytes',
        'description', 'accomplishmentId', 'kraId', 'siId', 'divisionId',
        'uploadedBy', 'uploadedByName', 'uploadedAt',
        'verified', 'verifiedBy', 'verifiedAt', 'deleted', 'deletedAt'
      ]
    },
    {
      name: SHEET.NOTIFICATIONS,
      headers: ['id', 'recipientId', 'type', 'message', 'relatedId', 'module', 'read', 'readAt', 'createdAt']
    },
    {
      name: SHEET.AUDIT,
      headers: ['id', 'timestamp', 'userId', 'userEmail', 'userName', 'role', 'action', 'module', 'details', 'ipAddress']
    },
    {
      name: SHEET.IPAT_RECORDS,
      headers: [
        'id','rateeId','rateeName','divisionId','divisionName','position','positionLevel',
        'semester','year','hasSubordinate','status',
        'cbcScore','fpoScore','jfScore','overallScore','descriptor',
        'ipcrfFormId','createdAt','updatedAt'
      ]
    },
    {
      name: SHEET.IPAT_CBC_RATINGS,
      headers: [
        'id','ipatId','rateeId','raterId','raterName','raterType',
        'themeId','themeName','indicator','indicatorIdx',
        'rating','semester','year','createdAt','updatedAt'
      ]
    },
    {
      name: SHEET.IPAT_JF_RATINGS,
      headers: [
        'id','ipatId','rateeId','raterId','raterName','raterType',
        'indicator','indicatorIdx','rating','evidence',
        'semester','year','createdAt','updatedAt'
      ]
    },
    {
      name: SHEET.IPAT_EDAP,
      headers: [
        'id','ipatId','rateeId','rateeName',
        'rows',
        'sem1Status','sem1Notes','sem2Status','sem2Notes',
        'createdAt','updatedAt'
      ]
    },
    {
      name: SHEET.IPAT_ASSIGNMENTS,
      headers: [
        'id','semester','year',
        'rateeId','rateeName','rateeDivisionId','rateeRole','rateeSection',
        'raterId','raterName','raterType',
        'ipatRecordId',
        'status',
        'createdAt','updatedAt'
      ]
    },
    {
      name: SHEET.ASSESSMENT_CATEGORIES,
      headers: ['id', 'domainId', 'domainName', 'categoryId', 'categoryName', 'description', 'sequence', 'status', 'createdAt', 'updatedAt']
    },
    {
      name: SHEET.ASSESSMENT_CONTENT,
      headers: [
        'id', 'domain', 'category', 'questionText', 'guidanceText', 'sequence',
        'scaleType', 'required', 'evidenceRequired',
        'applicableRaters', 'applicableLevels',
        'status', 'period', 'version', 'hasBeenUsed', 'changeNotes',
        'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'archivedAt'
      ]
    }
  ]
  const EXPECTED_HEADERS = ACTIVE_SCHEMA.reduce((acc, sheet) => {
    acc[sheet.name] = sheet.headers
    return acc
  }, {})

  function previewReset(user) {
    requireAdmin_(user)
    const ss = SpreadsheetService.getSpreadsheet()
    const preservedSet = toSet_(PRESERVED_SHEETS)
    const sheets = ss.getSheets().map(sheet => {
      const name = sheet.getName()
      const dataRows = Math.max(sheet.getLastRow() - 1, 0)
      const preserved = !!preservedSet[name]
      return {
        name,
        preserved,
        dataRows,
        action: preserved ? 'preserve' : 'clear-data-rows'
      }
    })

    return {
      confirmationPhrase: CONFIRM_RESET_PHRASE,
      preservedSheets: PRESERVED_SHEETS,
      clearSheets: sheets.filter(s => !s.preserved).map(s => s.name),
      sheets
    }
  }

  function resetTransactionalData(body, user) {
    requireAdmin_(user)
    const confirmation = String(body.confirmation || '').trim()
    if (confirmation !== CONFIRM_RESET_PHRASE) {
      throw HttpError('Reset confirmation phrase is invalid.', 400)
    }

    const ss = SpreadsheetService.getSpreadsheet()
    const backup = body.skipBackup === true ? null : backupDatabase_(ss, user)
    const preservedSet = toSet_(PRESERVED_SHEETS)
    const cleared = []
    const preserved = []

    ss.getSheets().forEach(sheet => {
      const name = sheet.getName()
      const dataRows = Math.max(sheet.getLastRow() - 1, 0)
      if (preservedSet[name]) {
        preserved.push({ name, dataRows })
        return
      }

      if (dataRows > 0) {
        sheet.getRange(2, 1, dataRows, Math.max(sheet.getLastColumn(), 1)).clearContent()
      }
      cleared.push({ name, deletedRows: dataRows })
    })

    AuditService.log(
      'RESET_DATABASE',
      'Maintenance',
      `Cleared transactional database data. Preserved: ${PRESERVED_SHEETS.join(', ')}`,
      user
    )

    return {
      resetAt: new Date().toISOString(),
      backup,
      preserved,
      cleared,
      deletedRows: cleared.reduce((sum, item) => sum + item.deletedRows, 0)
    }
  }

  function previewFreshRebuild(user) {
    requireAdmin_(user)
    const ss = SpreadsheetService.getSpreadsheet()
    const activeSet = schemaSet_()
    const activeNames = ACTIVE_SCHEMA.map(sheet => sheet.name)
    const existingNames = ss.getSheets().map(sheet => sheet.getName())
    const removeSheets = existingNames.filter(name => !activeSet[name])
    const createSheets = activeNames.filter(name => existingNames.indexOf(name) < 0)
    const retainedSheets = activeNames.filter(name => existingNames.indexOf(name) >= 0)

    return {
      confirmationPhrase: CONFIRM_REBUILD_PHRASE,
      preservedDataSheets: ACTIVE_SCHEMA.filter(sheet => sheet.preserveData).map(sheet => sheet.name),
      retainedSheets,
      createSheets,
      removeSheets,
      finalSheetOrder: activeNames,
      note: 'This rebuild preserves Users, Divisions, and MasterKRALibrary rows. Other active sheets keep headers only.'
    }
  }

  function rebuildFreshDatabase(body, user) {
    requireAdmin_(user)
    const confirmation = String(body.confirmation || '').trim()
    if (confirmation !== CONFIRM_REBUILD_PHRASE) {
      throw HttpError('Fresh rebuild confirmation phrase is invalid.', 400)
    }

    const ss = SpreadsheetService.getSpreadsheet()
    const backup = body.skipBackup === true ? null : backupDatabase_(ss, user)
    const activeSet = schemaSet_()
    const preservedData = {}
    const removedSheets = []
    const rebuiltSheets = []

    ACTIVE_SCHEMA.forEach(schema => {
      if (!schema.preserveData) return
      const sheet = ss.getSheetByName(schema.name)
      preservedData[schema.name] = sheet ? readRowsByHeader_(sheet) : []
    })

    let sheets = ss.getSheets()
    if (sheets.length === 1 && !activeSet[sheets[0].getName()]) ss.insertSheet(ACTIVE_SCHEMA[0].name)

    ss.getSheets().forEach(sheet => {
      const name = sheet.getName()
      if (activeSet[name]) return
      ss.deleteSheet(sheet)
      removedSheets.push(name)
    })

    ACTIVE_SCHEMA.forEach((schema, index) => {
      let sheet = ss.getSheetByName(schema.name)
      if (!sheet) sheet = ss.insertSheet(schema.name)

      const rows = schema.preserveData ? preservedData[schema.name] || [] : []
      rebuildSheet_(sheet, schema.headers, rows)
      ss.setActiveSheet(sheet)
      ss.moveActiveSheet(index + 1)
      rebuiltSheets.push({ name: schema.name, preservedRows: rows.length, columns: schema.headers.length })
    })

    AuditService.log(
      'REBUILD_FRESH_DATABASE',
      'Maintenance',
      `Fresh database schema rebuilt. Removed sheets: ${removedSheets.join(', ') || 'none'}`,
      user
    )

    return {
      rebuiltAt: new Date().toISOString(),
      backup,
      removedSheets,
      rebuiltSheets,
      finalSheetOrder: ACTIVE_SCHEMA.map(sheet => sheet.name)
    }
  }

  function previewColumnOrder(user) {
    requireAdmin_(user)
    const ss = SpreadsheetService.getSpreadsheet()
    return Object.keys(EXPECTED_HEADERS).map(name => {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return { name, exists: false, needsReorder: false, currentHeaders: [], expectedHeaders: EXPECTED_HEADERS[name] }
      const currentHeaders = getHeaders_(sheet)
      const expectedHeaders = buildFinalHeaders_(currentHeaders, EXPECTED_HEADERS[name])
      return {
        name,
        exists: true,
        needsReorder: currentHeaders.join('\u0001') !== expectedHeaders.join('\u0001'),
        currentHeaders,
        expectedHeaders
      }
    })
  }

  function normalizeColumnOrder(body, user) {
    requireAdmin_(user)
    const ss = SpreadsheetService.getSpreadsheet()
    const backup = body && body.skipBackup === true ? null : backupDatabase_(ss, user)
    const results = Object.keys(EXPECTED_HEADERS).map(name => normalizeSheetColumns_(ss, name, EXPECTED_HEADERS[name]))

    AuditService.log(
      'NORMALIZE_COLUMNS',
      'Maintenance',
      `Normalized database column order for: ${results.map(r => r.name).join(', ')}`,
      user
    )

    return {
      normalizedAt: new Date().toISOString(),
      backup,
      results
    }
  }

  function backupDatabase_(ss, user) {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
    const name = `PMES Database Backup ${timestamp}`
    const file = DriveApp.getFileById(ss.getId()).makeCopy(name)
    return {
      fileId: file.getId(),
      name,
      url: file.getUrl(),
      createdBy: user.email || user.uid || ''
    }
  }

  function normalizeSheetColumns_(ss, name, preferredHeaders) {
    const sheet = ss.getSheetByName(name)
    if (!sheet) return { name, exists: false, changed: false }

    const currentHeaders = getHeaders_(sheet)
    const finalHeaders = buildFinalHeaders_(currentHeaders, preferredHeaders)
    const changed = currentHeaders.join('\u0001') !== finalHeaders.join('\u0001')
    if (!changed) return { name, exists: true, changed: false, columns: finalHeaders.length }

    const dataRange = sheet.getDataRange()
    const values = dataRange.getValues()
    const dataRows = values.slice(1)
    const headerIndex = {}
    currentHeaders.forEach((header, index) => { headerIndex[header] = index })
    const reorderedRows = dataRows.map(row => finalHeaders.map(header => {
      const index = headerIndex[header]
      return index === undefined ? '' : row[index]
    }))

    sheet.clearContents()
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders])
    if (reorderedRows.length) sheet.getRange(2, 1, reorderedRows.length, finalHeaders.length).setValues(reorderedRows)
    styleHeader_(sheet, finalHeaders.length)

    return {
      name,
      exists: true,
      changed: true,
      columns: finalHeaders.length,
      rows: reorderedRows.length
    }
  }

  function rebuildSheet_(sheet, headers, rowObjects) {
    sheet.clear()
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    if (rowObjects.length) {
      const values = rowObjects.map(row => headers.map(header => {
        const value = row[header]
        return value === undefined || value === null ? '' : value
      }))
      sheet.getRange(2, 1, values.length, headers.length).setValues(values)
    }
    styleHeader_(sheet, headers.length)
    sheet.autoResizeColumns(1, headers.length)
  }

  function readRowsByHeader_(sheet) {
    const values = sheet.getDataRange().getValues()
    if (values.length < 2) return []
    const headers = values[0].map(h => String(h || '').trim())
    return values.slice(1).filter(row => row.some(value => value !== '' && value !== null)).map(row => {
      const obj = {}
      headers.forEach((header, index) => {
        if (header) obj[header] = row[index]
      })
      return obj
    })
  }

  function getHeaders_(sheet) {
    if (sheet.getLastColumn() < 1) return []
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim())
      .filter(Boolean)
  }

  function buildFinalHeaders_(currentHeaders, preferredHeaders) {
    const preferredSet = toSet_(preferredHeaders)
    const extras = currentHeaders.filter(header => !preferredSet[header])
    return preferredHeaders.concat(extras)
  }

  function schemaSet_() {
    return ACTIVE_SCHEMA.reduce((acc, sheet) => {
      acc[sheet.name] = true
      return acc
    }, {})
  }

  function styleHeader_(sheet, columns) {
    const headerRange = sheet.getRange(1, 1, 1, columns)
    headerRange
      .setBackground('#0D2137')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
    sheet.setFrozenRows(1)
  }

  function requireAdmin_(user) {
    AuthService.requirePermission(user, 'manage_database')
  }

  function toSet_(items) {
    return items.reduce((acc, item) => {
      acc[item] = true
      return acc
    }, {})
  }

  return {
    previewReset,
    resetTransactionalData,
    previewFreshRebuild,
    rebuildFreshDatabase,
    previewColumnOrder,
    normalizeColumnOrder
  }
})()
