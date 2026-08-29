// The office marks as the cluster uses them. Without an entry here the mark
// falls back to the office CODE, which is the wrong string for some offices
// ("OSAS-IPD" rather than "OSASI") and the wrong casing for others ("BANGUN"
// rather than "BangUn"). Keys are matched after normalizeKey(), so they are
// uppercase and punctuation-stripped; the VALUE is printed verbatim, which is
// what lets a deliberately mixed-case mark like BangUn survive.
//
// Confirmed marks: OUSI · OASI · OSASI · STB · WGP · TBTP · PAG-ABOT · EPAHP ·
// BangUn. Codes that already equal their mark (OUSI, OASI, EPAHP, PAG-ABOT,
// STB) need no entry and are listed here only so the full set is readable.
const ACRONYM_OVERRIDES = {
  'TARA-BASA': 'TBTP',
  'TARA BASA': 'TBTP',
  'TARA, BASA! TUTORING PROGRAM': 'TBTP',
  'TARA BASA TUTORING PROGRAM': 'TBTP',
  'WALANG-GUTOM': 'WGP',
  'WALANG GUTOM': 'WGP',
  'WALANG GUTOM PROGRAM': 'WGP',
  'OSAS-IPD': 'OSASI',
  'OFF-OSAS-IPD': 'OSASI',
  'OSAS IPD': 'OSASI',
  'OFFICE OF THE SPECIAL ASSISTANT TO THE SECRETARY FOR INNOVATIONS AND PROGRAM DEVELOPMENT': 'OSASI',
  'BANGUN': 'BangUn',
  'OFF-BANGUN': 'BangUn'
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[!,.]/g, '')
    .replace(/\s+/g, ' ')
}

export function officeAcronym(office = {}) {
  const values = [
    office.officeShortName,
    office.officeCode,
    office.officeId,
    office.officeName
  ]
  for (const value of values) {
    const key = normalizeKey(value)
    if (ACRONYM_OVERRIDES[key]) return ACRONYM_OVERRIDES[key]
  }
  const shortName = String(office.officeShortName || '').trim()
  if (shortName && shortName.length <= 12 && !/\s/.test(shortName)) return shortName
  return String(office.officeCode || office.officeId || shortName).trim()
}
