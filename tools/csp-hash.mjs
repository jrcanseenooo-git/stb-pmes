/**
 * Recompute the CSP sha256 for the inline <script> in the built index.html,
 * and check it against vue-frontend/vercel.json.
 *
 * Run after ANY edit to the inline boot script in vue-frontend/index.html:
 *
 *   npm --prefix vue-frontend run build
 *   node tools/csp-hash.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * The HTML parser normalises CRLF to LF before the browser hashes a script
 * element, so hashing the file's bytes directly gives the wrong value on a
 * CRLF checkout - which is what Windows clones of this repo have. The first
 * version of the Content-Security-Policy carried exactly that wrong hash. It
 * was caught only because the policy shipped as Report-Only; enforcing it
 * would have blocked the boot splash script in production.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const builtHtml = path.join(root, 'vue-frontend', 'dist', 'index.html')
const configPath = path.join(root, 'vue-frontend', 'vercel.json')

if (!fs.existsSync(builtHtml)) {
  console.error('No build found at vue-frontend/dist/index.html - run the build first.')
  process.exit(1)
}

const html = fs.readFileSync(builtHtml, 'utf8')
const config = fs.readFileSync(configPath, 'utf8')

// Inline = no src attribute.
const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]

if (!inlineScripts.length) {
  console.log('No inline scripts in the built HTML - no script hash is needed.')
  process.exit(0)
}

let allPresent = true

inlineScripts.forEach((match, i) => {
  // Normalise line endings exactly as the HTML parser does before hashing.
  const source = match[1].replace(/\r\n/g, '\n')
  const hash = 'sha256-' + crypto.createHash('sha256').update(source, 'utf8').digest('base64')
  const present = config.includes(hash)
  if (!present) allPresent = false
  console.log(`inline script #${i + 1}: ${hash}  ${present ? '(in vercel.json)' : '*** MISSING from vercel.json ***'}`)
})

if (!allPresent) {
  console.error('\nvercel.json is out of date. Update the script-src hash before deploying,')
  console.error('or the boot script will be blocked once the CSP is enforced.')
  process.exit(1)
}

console.log('\nvercel.json matches the built output.')
