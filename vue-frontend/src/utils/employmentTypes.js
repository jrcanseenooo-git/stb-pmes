/**
 * Single source of truth for employment types.
 *
 * These exact strings are what the `type` column on the Users sheet stores, so
 * every screen offering a choice must offer exactly these, spelled identically.
 *
 * They had drifted apart: registration wrote "Co-Terminus" while the user
 * management and profile screens wrote "Co-Term", and Profile's own normaliser
 * recognised neither "Co-Terminus" nor "Contractual" - it fell through to
 * 'Regular'. So a person who registered as Co-Terminus displayed as Regular on
 * their profile, and saving that screen wrote 'Regular' back over their real
 * type without warning.
 *
 * Keep in step with `employmentTypes` in apps-script/AuthService.gs.
 */
export const EMPLOYMENT_TYPES = [
  'Regular',
  'Co-Terminus',
  'Contractual',
  'Contract of Service (COS)'
]

// Spellings written by earlier versions of the app, or by an administrator
// typing directly into the sheet, mapped onto the canonical form.
const SYNONYMS = {
  'regular': 'Regular',
  'permanent': 'Regular',
  'plantilla': 'Regular',
  'co-term': 'Co-Terminus',
  'co term': 'Co-Terminus',
  'coterm': 'Co-Terminus',
  'co-terminus': 'Co-Terminus',
  'co-terminous': 'Co-Terminus',
  'coterminous': 'Co-Terminus',
  'contractual': 'Contractual',
  'cos': 'Contract of Service (COS)',
  'contract of service': 'Contract of Service (COS)',
  'contract of service (cos)': 'Contract of Service (COS)'
}

/**
 * Maps a stored value onto its canonical spelling.
 *
 * An unrecognised value is returned unchanged rather than coerced to 'Regular'.
 * Retired types such as 'Casual' and 'Job Order' still sit on existing records,
 * and quietly rewriting them to 'Regular' would destroy the real answer.
 */
export function normalizeEmploymentType(raw) {
  const key = String(raw ?? '').trim().toLowerCase()
  if (!key) return 'Regular'
  return SYNONYMS[key] || String(raw).trim()
}

/**
 * Options a select should offer for a record currently holding `current`.
 *
 * A retired value still on a record is appended, so the control shows what the
 * record actually says instead of rendering blank - and so simply opening the
 * form cannot silently change it.
 */
export function employmentTypeOptions(current) {
  const value = normalizeEmploymentType(current)
  if (!value || EMPLOYMENT_TYPES.includes(value)) return EMPLOYMENT_TYPES
  return [...EMPLOYMENT_TYPES, value]
}
