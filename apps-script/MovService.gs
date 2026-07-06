/**
 * MovService.gs
 * Stores MOV files in Google Drive; saves only metadata in Sheets.
 *
 * Drive folder structure:
 *   PMES/
 *     MOVs/
 *       {year}/
 *         {semester}/
 *           {divisionId}/
 *             {employeeName}/
 */

const MovService = (() => {

  const DRIVE_ROOT_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID')
  const ALLOWED_MIME_TYPES   = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
  const MAX_SIZE_BYTES = 25 * 1024 * 1024  // 25 MB

  // ── LIST ──
  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.MOV)
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)

    // Scope
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      if (profile.role === 'Division Chief') {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else {
        rows = rows.filter(r => r.uploadedBy === profile.id)
      }
    }

    if (params.accomplishmentId) rows = rows.filter(r => r.accomplishmentId === params.accomplishmentId)
    if (params.kraId)            rows = rows.filter(r => r.kraId === params.kraId)

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── GET ──
  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = SpreadsheetService.getSheet(SHEET.MOV)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('MOV file not found', 404)
    _guardMovAccess(row, profile)
    return row
  }

  // Same scope as list(): admins/bureau see all, Division Chief sees their
  // division, everyone else only their own uploads. Prevents enumerating other
  // users' evidence (and their Drive URLs) by iterating MOV ids.
  function _guardMovAccess(row, profile) {
    if (['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) return
    if (profile.role === 'Division Chief' && row.divisionId === profile.divisionId) return
    if (row.uploadedBy === profile.id) return
    throw HttpError('Access denied to this MOV file', 403)
  }

  // ── UPLOAD ──
  function upload(body, user) {
    const profile = AuthService.getProfile(user)
    const { fileName, mimeType, size, base64, accomplishmentId, kraId, siId, description } = body

    // Validate
    if (!fileName || !mimeType || !base64) throw HttpError('fileName, mimeType and base64 are required', 400)
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) throw HttpError('File type not allowed', 400)
    if (Number(size) > MAX_SIZE_BYTES) throw HttpError('File exceeds 25 MB limit', 400)

    // Decode and create file in Drive
    const bytes    = Utilities.base64Decode(base64)
    const blob     = Utilities.newBlob(bytes, mimeType, fileName)
    const folder   = getOrCreateFolder(profile)
    const driveFile = folder.createFile(blob)

    // Restrict to the organization's Workspace domain rather than the whole
    // internet. Falls back to link-access only if the Drive isn't part of a
    // Workspace domain (so uploads never fail), but the common case keeps
    // evidence readable only to signed-in dswd.gov.ph users.
    _shareRestricted(driveFile)

    const now     = new Date().toISOString()
    const fileId  = driveFile.getId()
    const meta    = {
      id:               SpreadsheetService.generateId('MOV-'),
      driveFileId:      fileId,
      driveUrl:         driveFile.getUrl(),
      fileName:         fileName,
      mimeType:         mimeType,
      sizeBytes:        size,
      description:      description || '',
      accomplishmentId: accomplishmentId || '',
      kraId:            kraId || '',
      siId:             siId  || '',
      divisionId:       profile.divisionId,
      uploadedBy:       profile.id,
      uploadedByName:   profile.fullName,
      uploadedAt:       now,
      verified:         false,
      deleted:          false
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.MOV), meta)

    // Update movCount on the accomplishment row
    if (accomplishmentId) {
      const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
      const acc      = SpreadsheetService.getRow(accSheet, accomplishmentId)
      if (acc) {
        SpreadsheetService.updateRow(accSheet, accomplishmentId, {
          movCount: (Number(acc.movCount) || 0) + 1
        })
      }
    }

    AuditService.log('UPLOAD', 'MOV', `Uploaded file: ${fileName} (${fileId})`, user)
    return meta
  }

  // ── DELETE (soft) ──
  function remove(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.MOV)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('MOV not found', 404)

    // Only uploader, Division Chief (same div), or Admin can delete
    if (row.uploadedBy !== profile.id &&
        !['System Administrator'].includes(profile.role)) {
      throw HttpError('Cannot delete another user\'s MOV', 403)
    }

    SpreadsheetService.softDelete(sheet, id)
    AuditService.log('DELETE', 'MOV', `Deleted MOV: ${id}`, user)
    return { deleted: true }
  }

  // ── PREVIEW (return Drive view URL) ──
  function preview(id, user) {
    const row = get(id, user)
    // Return a preview-friendly URL for Google Drive viewer
    return { previewUrl: `https://drive.google.com/file/d/${row.driveFileId}/preview` }
  }

  // ── Internal: get/create Drive folder path ──
  function getOrCreateFolder(profile) {
    const year   = new Date().getFullYear()
    const sem    = getCurrentSemester()
    const root   = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID)

    const yearFolder = getOrCreate(root,  'MOVs')
    const semFolder  = getOrCreate(yearFolder, String(year))
    const divFolder  = getOrCreate(semFolder,  sem)
    const empFolder  = getOrCreate(divFolder,  profile.divisionName || profile.divisionId)
    return getOrCreate(empFolder, profile.fullName)
  }

  function getOrCreate(parent, name) {
    const existing = parent.getFoldersByName(name)
    if (existing.hasNext()) return existing.next()
    return parent.createFolder(name)
  }

  function getCurrentSemester() {
    const month = new Date().getMonth() + 1
    return month <= 6 ? 'Semester-1' : 'Semester-2'
  }

  function _shareRestricted(driveFile) {
    try {
      driveFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW)
    } catch (e) {
      // Not a Workspace-domain Drive — keep link access so the feature still works.
      Logger.log('[MOV] Domain sharing unavailable, using link access: ' + e.message)
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    }
  }

  return { list, get, upload, remove, preview }
})()
