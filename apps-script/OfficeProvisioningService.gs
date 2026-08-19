const OfficeProvisioningService = (() => {
  function provisionEvaluationSpreadsheet(office, user) {
    const name = 'ICPAP_' + office.officeCode + '_Assessment_Data'
    const ss = SpreadsheetApp.create(name)
    try {
      const validation = OfficeSchemaService.initializeSpreadsheet(ss, office, user)
      applySharing_(ss, office)
      return {
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        validation
      }
    } catch (e) {
      try {
        DriveApp.getFileById(ss.getId()).setTrashed(true)
      } catch (trashErr) {
        Logger.log('[OfficeProvisioning] Could not trash incomplete spreadsheet: ' + trashErr.message)
      }
      throw e
    }
  }

  function applySharing_(ss, office) {
    if (!office.primaryAdminEmail) return
    try {
      DriveApp.getFileById(ss.getId()).addViewer(office.primaryAdminEmail)
    } catch (e) {
      Logger.log('[OfficeProvisioning] Could not add office admin viewer: ' + e.message)
    }
  }

  return {
    provisionEvaluationSpreadsheet
  }
})()
