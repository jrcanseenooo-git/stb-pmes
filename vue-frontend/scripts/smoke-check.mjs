import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/main.js',
  'src/router/index.js',
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

if (!failures.length) {
  const router = read('src/router/index.js')
  const api = read('src/services/api.js')
  const auth = read('src/stores/auth.js')
  const evaluation = read('src/views/EvaluationView.vue')

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
    }
  ]

  checks.forEach(check => {
    if (!check.ok) failures.push(check.message)
  })
}

if (failures.length) {
  console.error('Smoke check failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Smoke check passed.')
