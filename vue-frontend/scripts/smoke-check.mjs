import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/main.js',
  'src/router/index.js',
  'src/layouts/AppLayout.vue',
  'src/services/api.js',
  'src/views/EvaluationView.vue',
  'src/stores/auth.js',
  'src/composables/usePermissions.js'
]

const failures = []

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`)
}

function read(file) {
  return readFileSync(join(root, file), 'utf8')
}

function walk(dir) {
  return readdirSync(join(root, dir))
    .flatMap(name => {
      const file = join(dir, name)
      const full = join(root, file)
      if (statSync(full).isDirectory()) return walk(file)
      return [file]
    })
}

if (!failures.length) {
  const router = read('src/router/index.js')
  const api = read('src/services/api.js')
  const auth = read('src/stores/auth.js')
  const evaluation = read('src/views/EvaluationView.vue')
  const appLayout = read('src/layouts/AppLayout.vue')

  const checks = [
    {
      ok: router.includes('isEvaluationOnlyRollout') &&
        router.includes('EVALUATION_ROLLOUT_ALLOWED_PATHS') &&
        router.includes('/evaluation'),
      message: 'Evaluation-only route guard is missing.'
    },
    {
      ok: api.includes("'/gas'") && api.includes("'/api/gas'"),
      message: 'API proxy transport is not configured for local and production.'
    },
    {
      ok: !api.includes('deleteForPeriod'),
      message: 'Destructive IPAT period delete is still exposed in the frontend API.'
    },
    {
      ok: auth.includes('Invalid email or password.'),
      message: 'Auth failure messages can reveal account existence.'
    },
    {
      ok: evaluation.includes('Generate / Backfill Assignments') && !evaluation.includes('Delete All & Regenerate'),
      message: 'Assignment UI must default to safe backfill, not destructive regeneration.'
    },
    {
      ok: !api.includes('kraApi') &&
        !api.includes('evaluationApi') &&
        !api.includes('deadlinesApi') &&
        !api.includes('attendanceApi') &&
        !api.includes('peerAssignmentsApi'),
      message: 'Frontend API still exports clients for backend routes that intentionally return 501.'
    },
    {
      ok: !api.includes('officePersonnelApi') && !router.includes('OfficePersonnelView'),
      message: 'Duplicate Office Personnel management remains exposed alongside User Management.'
    },
    {
      // The portal Dashboard link may carry extra guards beside showPortalNav
      // (the Undersecretary, for one, has no dashboard). What matters is that
      // it routes through dashboardPath rather than a hardcoded destination.
      ok: /v-if="showPortalNav[^"]*" :to="dashboardPath"/.test(appLayout),
      message: 'Portal Dashboard navigation bypasses the role-aware dashboard destination.'
    }
  ]

  checks.forEach(check => {
    if (!check.ok) failures.push(check.message)
  })

  const fontAllowedFiles = new Set([
    'src/assets/fonts.css',
    'src/assets/main.css',
    'src/views/LoginView.vue'
  ])
  const fontViolations = walk('src')
    .filter(file => /\.(vue|js|css)$/.test(file))
    .filter(file => !fontAllowedFiles.has(file.replaceAll('\\', '/')))
    .flatMap(file => {
      const normalized = file.replaceAll('\\', '/')
      return read(file).split(/\r?\n/).flatMap((line, idx) => {
        if (!/font-family|fonts\.googleapis\.com/.test(line)) return []
        if (/font-family="/.test(line)) return []
        if (/monospace/.test(line)) return []
        return [`${normalized}:${idx + 1}`]
      })
    })

  if (fontViolations.length) {
    failures.push(`Non-central font-family declarations found: ${fontViolations.join(', ')}`)
  }
}

if (failures.length) {
  console.error('Smoke check failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Smoke check passed.')
