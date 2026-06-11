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
 * WEIGHT SPLIT:
 * ─────────────
 *   All positions → 70% core / 30% support (standard STB protocol)
 *
 *   The positionLevel (II / III / IV) only determines which weight COLUMN
 *   to use from the MasterKRALibrary (weightII / weightIII / weightIV).
 */

const PositionHelper = (() => {

  /**
   * resolveLevel(position)
   * Returns "II", "III", or "IV" from a DSWD position title string.
   */
  function resolveLevel(position) {
    if (!position) return 'III'

    const str   = String(position).trim()
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
   * Returns { core: 70, support: 30 } for all positions — STB standard.
   */
  function resolveWeights(profile) {
    return { core: 70, support: 30 }
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