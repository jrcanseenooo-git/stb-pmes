/**
 * PositionHelper.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utility that derives `positionLevel` (II / III / IV) and the IPCRF
 * function-weight split (coreFunctionWeight / supportFunctionWeight) from a
 * DSWD position title stored in the Users sheet.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The IPCRForms sheet and MasterKRALibrary both need a "position level" to
 * pick the right weight column (weightII / weightIII / weightIV).  Rather than
 * asking the user to enter their level manually — which introduces human error
 * — this helper reads the position title they already have in their profile and
 * derives everything automatically.
 *
 * POSITION LEVEL LOGIC
 * ─────────────────────
 * DSWD position titles end in a Roman numeral, e.g.:
 *   "Social Welfare Officer II"               → level II  → tier "II"
 *   "Social Welfare Officer III"              → level III → tier "III"
 *   "Project Development Officer IV"          → level IV  → tier "IV"
 *   "Information Technology Officer I"        → level I   → tier "II" (junior)
 *   "Division Chief / SWO V"                  → level V   → tier "IV" (senior)
 *   "Bureau Director"                         → no numeral → tier "IV"
 *
 * FUNCTION-WEIGHT LOGIC  (Reference sheet)
 * ──────────────────────────────────────────
 * SG 15 (SWO II / ITO I–II)   → 78% core / 22% support
 * SG 18 (SWO III / ITO III)   → 66% core / 34% support
 * SG 22+ / Bureau Director    → 70% core / 30% support  (standard DSPMS)
 *
 * If a user's profile has a `sgLevel` field (integer), that takes priority
 * over the heuristic.  Admins can set it explicitly when the title alone is
 * ambiguous (e.g. co-terminus staff with non-standard titles).
 */

const PositionHelper = (() => {

  /**
   * resolveLevel(position)
   * Returns "II", "III", or "IV" from a DSWD position title string.
   */
  function resolveLevel(position) {
    if (!position) return 'III' // safe default

    const str   = String(position).trim()
    // Match the LAST Roman numeral word in the string
    const match = str.match(/\b(VII|VI|V|IV|III|II|I)\b(?:\s*\/.*)?$/)
    if (!match) return 'IV' // no numeral → senior / director tier

    const roman = match[1].toUpperCase()
    if (roman === 'I' || roman === 'II')  return 'II'   // junior staff
    if (roman === 'III')                  return 'III'  // mid-level
    return 'IV'                                          // IV, V, VI, VII → senior
  }

  /**
   * resolveWeights(profile)
   * Returns { core: <number>, support: <number> } as whole-number percentages.
   *
   * @param {Object} profile – user record from the Users sheet
   */
  function resolveWeights(profile) {
    // 1. Explicit sgLevel field wins (admin-set, most reliable)
    const sg = Number(profile.sgLevel || profile.salaryGrade || 0)
    if (sg) {
      if (sg <= 15) return { core: 78, support: 22 }
      if (sg <= 18) return { core: 66, support: 34 }
      return         { core: 70, support: 30 }
    }

    // 2. Heuristic from resolved position level
    const level = resolveLevel(profile.position)
    if (level === 'II')  return { core: 78, support: 22 } // SG ≤15 equivalent
    if (level === 'III') return { core: 66, support: 34 } // SG 18 equivalent
    return               { core: 70, support: 30 }         // SG 22+ / default
  }

  /**
   * pickEntryWeight(libraryRow, positionLevel)
   * Returns the correct numeric weight for a MasterKRALibrary row
   * given the employee's resolved position level.
   *
   * Falls back gracefully: IV→III→II, II→III
   */
  function pickEntryWeight(libraryRow, positionLevel) {
    if (!libraryRow) return 0
    if (positionLevel === 'IV') {
      return Number(libraryRow.weightIV)
          || Number(libraryRow.weightIII)
          || Number(libraryRow.weightII)
          || 0
    }
    if (positionLevel === 'II') {
      return Number(libraryRow.weightII)
          || Number(libraryRow.weightIII)
          || 0
    }
    // Default: III
    return Number(libraryRow.weightIII)
        || Number(libraryRow.weightII)
        || Number(libraryRow.weightIV)
        || 0
  }

  return { resolveLevel, resolveWeights, pickEntryWeight }

})()