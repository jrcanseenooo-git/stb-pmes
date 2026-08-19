const RoleLabelService = (() => {
  const STAFF_CANONICAL = 'Technical Staff'

  function canonicalRole(value) {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
    if (key === 'staff' || key === 'technical staff') return STAFF_CANONICAL
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
    canonicalRoleList,
    STAFF_CANONICAL
  }
})()
