const RoleLabelService = (() => {
  const STAFF_CANONICAL = 'Technical Staff'

  function canonicalRole(value) {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
    if (key === 'staff' || key === 'technical staff') return STAFF_CANONICAL
    if (key === 'oic dc' || key === 'oic division chief' ||
        key === 'officer in charge division chief') return 'Division Chief'
    return raw
  }

  // Storage/display normalization intentionally preserves OIC-Division Chief
  // as a distinct title.  Permission and hierarchy code should call
  // canonicalRole() when it needs the functional Division Chief equivalent;
  // account and office-structure data must retain the user's selected label.
  function storedRole(value) {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
    if (key === 'staff' || key === 'technical staff') return STAFF_CANONICAL
    if (key === 'oic dc' || key === 'oic division chief' ||
        key === 'officer in charge division chief') return 'OIC-Division Chief'
    return raw
  }

  function canonicalRoleList(value) {
    const seen = {}
    return String(value || '')
      .split(/[,|]/)
      .map(canonicalRole)
      .filter(Boolean)
      .filter(role => {
        if (seen[role]) return false
        seen[role] = true
        return true
      })
      .join(',')
  }

  return {
    canonicalRole,
    storedRole,
    canonicalRoleList,
    STAFF_CANONICAL
  }
})()
