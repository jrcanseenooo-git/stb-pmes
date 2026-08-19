const ACRONYM_OVERRIDES = {
  'TARA-BASA': 'TBTP',
  'TARA BASA': 'TBTP',
  'TARA, BASA! TUTORING PROGRAM': 'TBTP',
  'TARA BASA TUTORING PROGRAM': 'TBTP',
  'WALANG-GUTOM': 'WGP',
  'WALANG GUTOM': 'WGP',
  'WALANG GUTOM PROGRAM': 'WGP'
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
