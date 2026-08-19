const fs = require('fs')
const https = require('https')
const path = require('path')

const CENTRAL_SPREADSHEET_ID = '1lCJaa2ywDjlRHrltCDgpY-I_kCR5WxfBXwvIUVSRqrU'
const PREFIX = 'TESTPMES-'
const DEFAULT_SEMESTER = 2
const DEFAULT_YEAR = 2026

const command = process.argv[2] || 'seed'
const allowedCommands = new Set(['seed', 'cleanup', 'verify'])
if (!allowedCommands.has(command)) {
  console.error('Usage: node tools/seed-dashboard-test-data.js [seed|cleanup|verify]')
  process.exit(1)
}

function readClaspToken() {
  const tokenPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.clasprc.json')
  const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'))
  const token = data.tokens && data.tokens.default
  if (!token || !token.refresh_token || !token.client_id || !token.client_secret) {
    throw new Error('No usable clasp OAuth token found.')
  }
  return token
}

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const req = https.request({
      method,
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = text ? JSON.parse(text) : null } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json)
        reject(new Error(`${method} ${url} failed: HTTP ${res.statusCode} ${text.slice(0, 500)}`))
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function accessToken() {
  const token = readClaspToken()
  if (token.access_token && token.expiry_date && token.expiry_date > Date.now() + 60000) {
    return token.access_token
  }
  const form = new URLSearchParams({
    client_id: token.client_id,
    client_secret: token.client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token'
  }).toString()
  const refreshed = await new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(form)
      }
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(JSON.parse(text))
        reject(new Error(`Token refresh failed: HTTP ${res.statusCode} ${text}`))
      })
    })
    req.on('error', reject)
    req.write(form)
    req.end()
  })
  return refreshed.access_token
}

function api(token) {
  const headers = { Authorization: `Bearer ${token}` }
  const root = 'https://sheets.googleapis.com/v4/spreadsheets'
  return {
    get: (spreadsheetId, fields = '') => {
      const url = `${root}/${spreadsheetId}${fields ? `?fields=${encodeURIComponent(fields)}` : ''}`
      return request('GET', url, undefined, headers)
    },
    values: (spreadsheetId, range) => {
      const url = `${root}/${spreadsheetId}/values/${encodeURIComponent(range)}`
      return request('GET', url, undefined, headers)
    },
    append: (spreadsheetId, range, values) => {
      const url = `${root}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      return request('POST', url, { values }, headers)
    },
    batchUpdate: (spreadsheetId, requests) => {
      const url = `${root}/${spreadsheetId}:batchUpdate`
      return request('POST', url, { requests }, headers)
    }
  }
}

function rowsFromValues(values) {
  const headers = (values[0] || []).map(String)
  return (values.slice(1) || [])
    .map((row, index) => {
      const out = { _rowNumber: index + 2 }
      headers.forEach((header, col) => { out[header] = row[col] === undefined ? '' : row[col] })
      return out
    })
    .filter(row => row.id)
}

function rowValues(headers, obj) {
  return headers.map(header => {
    const value = obj[header]
    if (value === true) return 'TRUE'
    if (value === false) return 'FALSE'
    return value === undefined || value === null ? '' : value
  })
}

function safeKey(value) {
  return String(value || 'OFFICE').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'OFFICE'
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function normalize(value) {
  return safeKey(value)
}

async function sheetMap(sheets, spreadsheetId) {
  const meta = await sheets.get(spreadsheetId, 'sheets(properties(sheetId,title))')
  const map = new Map()
  ;(meta.sheets || []).forEach(sheet => {
    map.set(sheet.properties.title, sheet.properties)
  })
  return map
}

function pickSheet(map, names) {
  return names.find(name => map.has(name)) || ''
}

async function readRows(sheets, spreadsheetId, sheetName) {
  const data = await sheets.values(spreadsheetId, `${quoteSheet(sheetName)}!1:100000`)
  return rowsFromValues(data.values || [])
}

async function readHeaders(sheets, spreadsheetId, sheetName) {
  const data = await sheets.values(spreadsheetId, `${quoteSheet(sheetName)}!1:1`)
  return (data.values && data.values[0] || []).map(String)
}

function quoteSheet(name) {
  return `'${String(name).replace(/'/g, "''")}'`
}

async function deletePrefixedRows(sheets, spreadsheetId, map, sheetName) {
  const rows = await readRows(sheets, spreadsheetId, sheetName)
  const targets = rows
    .filter(row => String(row.id || '').startsWith(PREFIX))
    .map(row => row._rowNumber)
    .sort((a, b) => b - a)
  if (!targets.length) return 0
  const sheetId = map.get(sheetName).sheetId
  await sheets.batchUpdate(spreadsheetId, targets.map(rowNumber => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowNumber - 1,
        endIndex: rowNumber
      }
    }
  })))
  return targets.length
}

async function cleanupWorkbook(sheets, spreadsheetId) {
  const map = await sheetMap(sheets, spreadsheetId)
  const candidates = [
    ['Users', 'Personnel'],
    ['AssessmentRecords', 'IPATRecords'],
    ['RaterAssignments', 'IPATRaterAssignments'],
    ['CompetencyBehaviorRatings', 'IPATCBCRatings'],
    ['JobFitnessRatings', 'IPATJFRatings'],
    ['RatingDrafts']
  ]
  const details = []
  for (const names of candidates) {
    const sheetName = pickSheet(map, names)
    if (!sheetName) continue
    const deletedRows = await deletePrefixedRows(sheets, spreadsheetId, map, sheetName)
    if (deletedRows) details.push({ sheetName, deletedRows })
  }
  return details
}

async function getOrgOptions(sheets) {
  const map = await sheetMap(sheets, CENTRAL_SPREADSHEET_ID)
  if (!map.has('OfficeOrgOptions')) return []
  return readRows(sheets, CENTRAL_SPREADSHEET_ID, 'OfficeOrgOptions')
}

function orgForOffice(orgRows, officeId) {
  const wanted = normalize(officeId)
  const rows = orgRows.filter(row =>
    normalize(row.officeId) === wanted &&
    (row.active === true || String(row.active).toLowerCase() === 'true')
  )
  const divisions = rows
    .filter(row => String(row.optionType || '').toLowerCase() === 'division')
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
  const sections = rows
    .filter(row => String(row.optionType || '').toLowerCase() === 'section')
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
  return { divisions, sections }
}

function firstSection(sections, division) {
  const parentId = String(division && division.id || '').trim()
  return sections.find(section => String(section.parentId || '').trim() === parentId) || sections[0] || null
}

function buildRows(office, org) {
  const now = new Date().toISOString()
  const period = { semester: DEFAULT_SEMESTER, year: DEFAULT_YEAR }
  const divisionA = org.divisions[0] || { id: 'TEST-DIV-A', name: 'Test Division A' }
  const divisionB = org.divisions[1] || org.divisions[0] || { id: 'TEST-DIV-B', name: 'Test Division B' }
  const sectionA = firstSection(org.sections, divisionA) || { id: 'TEST-SEC-A', name: 'Test Section A' }
  const sectionB = firstSection(org.sections, divisionB) || { id: 'TEST-SEC-B', name: 'Test Section B' }
  const officeKey = safeKey(office.officeCode || office.officeId || 'OFFICE')
  const base = `${PREFIX}${officeKey}-${period.year}S${period.semester}-`

  const person = (index, division, section, role) => {
    const id = `${base}USR-${pad(index)}`
    return {
      id,
      uid: '',
      email: `testdata+${safeKey(office.officeCode || office.officeId).toLowerCase()}${pad(index)}@example.invalid`,
      fullName: `[TEST] ${office.officeShortName || office.officeCode || 'Office'} Personnel ${index}`,
      employeeNo: `TEST-${pad(index)}`,
      position: role,
      positionLevel: role,
      role,
      divisionId: division.id || division.code || division.name || '',
      divisionName: division.name || '',
      organizationalUnitId: division.id || division.code || division.name || '',
      organizationalUnitName: division.name || '',
      section: section.name || '',
      officeId: office.officeId || office.officeCode || '',
      officeCode: office.officeCode || office.officeId || '',
      officeName: office.officeName || '',
      systemScope: office.officeId === 'STB' ? 'STB_FULL' : 'CLUSTER_PORTAL',
      officeRole: 'OFFICE_PERSONNEL',
      active: true,
      pendingActivation: false,
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
      validatedBy: 'TEST_DATA'
    }
  }

  const people = [
    person(1, divisionA, sectionA, 'Division Chief'),
    person(2, divisionA, sectionA, 'Section Head'),
    person(3, divisionA, sectionA, 'Technical Staff'),
    person(4, divisionA, sectionA, 'Technical Staff'),
    person(5, divisionB, sectionB, 'Section Head'),
    person(6, divisionB, sectionB, 'Technical Staff')
  ]

  const record = (index, personRow, score, descriptor) => ({
    id: `${base}REC-${pad(index)}`,
    officeId: office.officeId || office.officeCode || '',
    rateeId: personRow.id,
    rateeName: personRow.fullName,
    divisionId: personRow.divisionId,
    divisionName: personRow.divisionName,
    organizationalUnitId: personRow.organizationalUnitId,
    organizationalUnitName: personRow.organizationalUnitName,
    section: personRow.section,
    position: personRow.position,
    positionLevel: personRow.positionLevel,
    semester: period.semester,
    year: period.year,
    hasSubordinate: personRow.role === 'Division Chief' || personRow.role === 'Section Head',
    status: 'Computed',
    cbcBaseScore: score,
    cbcScore: score,
    fpoScore: score,
    jfScore: score,
    overallScore: score,
    descriptor,
    createdAt: now,
    updatedAt: now
  })

  const records = [
    record(1, people[0], 3.92, 'Outstanding'),
    record(2, people[1], 3.74, 'Outstanding'),
    record(3, people[2], 3.18, 'Very Satisfactory'),
    record(4, people[3], 2.21, 'Needs Improvement'),
    record(5, people[4], 2.43, 'Needs Improvement'),
    record(6, people[5], 3.37, 'Very Satisfactory')
  ]

  const assignment = (recordRow, ratee, rater, raterType, status, index) => ({
    id: `${base}ASN-${recordRow.id.split('-').pop()}-${pad(index)}`,
    officeId: recordRow.officeId,
    semester: period.semester,
    year: period.year,
    rateeId: ratee.id,
    rateeName: ratee.fullName,
    rateeDivisionId: ratee.divisionId,
    rateeUnitId: ratee.organizationalUnitId,
    rateeRole: ratee.role,
    rateeSection: ratee.section,
    raterId: rater.id,
    raterName: rater.fullName,
    raterType,
    ipatRecordId: recordRow.id,
    assessmentRecordId: recordRow.id,
    status,
    completedAt: status === 'Completed' ? now : '',
    createdAt: now,
    updatedAt: now
  })

  const assignments = []
  records.forEach((recordRow, index) => {
    const ratee = people[index]
    assignments.push(assignment(recordRow, ratee, people[0], 'Self', 'Completed', 1))
    assignments.push(assignment(recordRow, ratee, people[1], 'Peer', index % 2 === 0 ? 'Pending' : 'Completed', 2))
    assignments.push(assignment(recordRow, ratee, people[4], 'Immediate Supervisor', index >= 3 ? 'Pending' : 'Completed', 3))
  })

  return { people, records, assignments }
}

async function getOffices(sheets) {
  const registry = await readRows(sheets, CENTRAL_SPREADSHEET_ID, 'OfficeRegistry')
  const active = registry
    .filter(row => row.spreadsheetId && String(row.spreadsheetStatus || '').toUpperCase() === 'ACTIVE')
    .map(row => ({
      officeId: row.officeId,
      officeCode: row.officeCode,
      officeShortName: row.officeShortName || row.officeCode,
      officeName: row.officeName,
      spreadsheetId: row.spreadsheetId
    }))
  return [{
    officeId: 'STB',
    officeCode: 'STB',
    officeShortName: 'STB',
    officeName: 'Social Technology Bureau',
    spreadsheetId: CENTRAL_SPREADSHEET_ID
  }].concat(active)
}

async function appendObjects(sheets, spreadsheetId, map, names, objects) {
  const sheetName = pickSheet(map, names)
  if (!sheetName) throw new Error(`No sheet found: ${names.join(' / ')}`)
  const headers = await readHeaders(sheets, spreadsheetId, sheetName)
  await sheets.append(spreadsheetId, `${quoteSheet(sheetName)}!A1`, objects.map(obj => rowValues(headers, obj)))
  return { sheetName, count: objects.length }
}

async function seedWorkbook(sheets, office, orgRows) {
  const map = await sheetMap(sheets, office.spreadsheetId)
  const removed = await cleanupWorkbook(sheets, office.spreadsheetId)
  const org = orgForOffice(orgRows, office.officeId)
  const rows = buildRows(office, org)
  const personnel = await appendObjects(sheets, office.spreadsheetId, map, ['Users', 'Personnel'], rows.people)
  const records = await appendObjects(sheets, office.spreadsheetId, map, ['AssessmentRecords', 'IPATRecords'], rows.records)
  const assignments = await appendObjects(sheets, office.spreadsheetId, map, ['RaterAssignments', 'IPATRaterAssignments'], rows.assignments)
  return {
    officeCode: office.officeCode,
    officeName: office.officeName,
    removedBeforeSeed: removed.reduce((sum, item) => sum + item.deletedRows, 0),
    personnel: personnel.count,
    assessmentRecords: records.count,
    raterAssignments: assignments.count
  }
}

async function verifyWorkbook(sheets, office) {
  const map = await sheetMap(sheets, office.spreadsheetId)
  const countFor = async names => {
    const sheetName = pickSheet(map, names)
    if (!sheetName) return 0
    const rows = await readRows(sheets, office.spreadsheetId, sheetName)
    return rows.filter(row => String(row.id || '').startsWith(PREFIX)).length
  }
  return {
    officeCode: office.officeCode,
    officeName: office.officeName,
    personnel: await countFor(['Users', 'Personnel']),
    assessmentRecords: await countFor(['AssessmentRecords', 'IPATRecords']),
    raterAssignments: await countFor(['RaterAssignments', 'IPATRaterAssignments'])
  }
}

async function main() {
  const token = await accessToken()
  const sheets = api(token)
  const offices = await getOffices(sheets)

  if (command === 'seed') {
    const orgRows = await getOrgOptions(sheets)
    const results = []
    for (const office of offices) {
      results.push(await seedWorkbook(sheets, office, orgRows))
    }
    console.log(JSON.stringify({ seeded: true, offices: results }, null, 2))
    return
  }

  if (command === 'cleanup') {
    const results = []
    for (const office of offices) {
      const details = await cleanupWorkbook(sheets, office.spreadsheetId)
      results.push({
        officeCode: office.officeCode,
        officeName: office.officeName,
        deletedRows: details.reduce((sum, item) => sum + item.deletedRows, 0),
        details
      })
    }
    console.log(JSON.stringify({ cleaned: true, offices: results }, null, 2))
    return
  }

  const results = []
  for (const office of offices) {
    results.push(await verifyWorkbook(sheets, office))
  }
  console.log(JSON.stringify({ verified: true, offices: results }, null, 2))
}

main().catch(err => {
  console.error(err && err.stack || err)
  process.exit(1)
})
