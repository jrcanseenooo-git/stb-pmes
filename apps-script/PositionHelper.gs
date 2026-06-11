/**
 * PositionHelper.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Derives `positionLevel` (II / III / IV) and the IPCRF function-weight split
 * from a DSWD position title stored in the Users sheet.
 *
 * POSITION LEVEL RULES (per STB protocol):
 * ─────────────────────────────────────────
 *   Roman numeral I   → Level III  (e.g. Information Technology Officer I)
 *   Roman numeral II  → Level II   (e.g. Social Welfare Officer II, PDO II)
 *   Roman numeral III → Level III  (e.g. Social Welfare Officer III, PDO III)
 *   Roman numeral IV+ → Level IV   (e.g. SWO IV, PDO IV, Division Chief)
 *   No numeral        → Level IV   (e.g. Bureau Director, Assistant BD)
 *
 * WEIGHT SPLIT (Reference sheet):
 * ─────────────────────────────────
 *   Level II  → 78% core / 22% support  (SG ≤15)
 *   Level III → 66% core / 34% support  (SG 18)
 *   Level IV  → 70% core / 30% support  (SG 22+ / standard DSPMS)
 */

const PositionHelper = (() => {

  /**
   * resolveLevel(position)
   * Returns "II", "III", or "IV" from a DSWD position title string.
   */
  function resolveLevel(position) {
    if (!position) return 'III'

    const str   = String(position).trim()
    // Match the LAST Roman numeral word in the title
    const match = str.match(/\b(VII|VI|V|IV|III|II|I)\b(?:\s*\/.*)?$/)
    if (!match) return 'IV' // no numeral → senior / director tier

    const roman = match[1].toUpperCase()

    if (roman === 'II')  return 'II'   // SWO II, PDO II → Level II
    if (roman === 'III') return 'III'  // SWO III, PDO III → Level III
    if (roman === 'I')   return 'III'  // ITO I and all Officer I → Level III
    return 'IV'                         // IV, V, VI, VII → Level IV (senior)
  }

  /**
   * resolveWeights(profile)
   * Returns { core: <number>, support: <number> } as whole-number percentages.
   */
  function resolveWeights(profile) {
    // 1. Explicit sgLevel field wins (admin-set, most reliable)
    const sg = Number(profile.sgLevel || profile.salaryGrade || 0)
    if (sg) {
      if (sg <= 15) return { core: 78, support: 22 }
      if (sg <= 18) return { core: 66, support: 34 }
      return         { core: 70, support: 30 }
    }

    // 2. Derive from position title
    const level = resolveLevel(profile.position)
    if (level === 'II')  return { core: 78, support: 22 }
    if (level === 'III') return { core: 66, support: 34 }
    return               { core: 70, support: 30 }  // Level IV default
  }

  /**
   * pickEntryWeight(libraryRow, positionLevel)
   * Returns the correct numeric weight for a MasterKRALibrary row
   * given the employee's resolved position level.
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