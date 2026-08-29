<template>
  <div class="pui-page">
    <PageHeader
      kicker="Assessment Administration"
      title="Rater Tagging"
      subtitle="Who rates whom, per role. The automated assignment generator reads these rules - it does not have its own built-in hierarchy."
    >
      <template #actions>
        <button class="pui-btn" type="button" :disabled="loading || saving" @click="reload">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
        <button class="pui-btn" type="button" :disabled="loading || saving" @click="restoreDefaults">
          Reset to Standard Hierarchy
        </button>
        <button class="pui-btn pui-btn-primary" type="button" :disabled="loading || saving || !dirty" @click="save">
          {{ saving ? 'Saving...' : 'Save Matrix' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="pui-alert pui-alert-error" role="alert">
      <p class="pui-alert-title">{{ errorTitle }}</p>
      <p>{{ error }}</p>
    </div>

    <div v-if="actionNotice.show" :class="['pui-alert', actionNoticeClass]" role="status" aria-live="polite">
      <p class="pui-alert-title" :style="{ color: actionNoticeTitleColor }">{{ actionNotice.title }}</p>
      <p>{{ actionNotice.message }}</p>
    </div>

    <!-- Coverage is the whole point of this screen: it surfaces roles whose
         personnel would be silently skipped by assignment generation. -->
    <div class="pui-grid pui-grid-3">
      <StatTile label="Roles Configured" :value="configuredRoleCount" :total="coverageItems.length" :loading="loading" />
      <StatTile
        label="Roles Not Configured"
        :value="coverage.unmappedRoles || 0"
        :loading="loading"
        :tone="(coverage.unmappedRoles || 0) ? 'bad' : 'good'"
      />
      <StatTile
        label="Personnel Affected"
        :value="coverage.unmappedPersonnel || 0"
        :loading="loading"
        :tone="(coverage.unmappedPersonnel || 0) ? 'bad' : 'good'"
        caption="Would receive no rating tasks"
      />
    </div>

    <div v-if="unmappedItems.length" class="pui-alert pui-alert-warn">
      <p class="pui-alert-title" style="color:#92400e;">
        {{ coverage.unmappedPersonnel }} person(s) would not be rated
      </p>
      <p>
        These roles exist on the roster but have no rater rules. Assignment generation skips them
        entirely - they receive no rating tasks and nobody is asked to rate them.
      </p>
      <ul style="margin:8px 0 0; padding-left:18px;">
        <li v-for="item in unmappedItems" :key="item.role">
          <b>{{ item.role }}</b> - {{ item.personnel }} personnel
          <button type="button" class="pui-btn pui-btn-sm" style="margin-left:8px;" @click="addRoleBlock(item.role)">
            Configure
          </button>
        </li>
      </ul>
    </div>

    <div v-if="loading" class="pui-card"><SkeletonRows :rows="6" aria-label="Loading rater matrix" /></div>

    <div v-else-if="!roleBlocks.length" class="pui-card">
      <EmptyState
        title="No rater rules configured"
        description="Start from the standard hierarchy (self, peers, subordinate, immediate supervisor, skip-level supervisor) and adjust it to this office's structure."
      >
        <template #action>
          <button class="pui-btn pui-btn-primary" type="button" @click="restoreDefaults">
            Use Standard Hierarchy
          </button>
        </template>
      </EmptyState>
    </div>

    <section v-for="block in roleBlocks" :key="block.role" class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <div>
          <h2 class="pui-card-title">{{ block.role }}</h2>
          <p class="pui-card-subtitle">
            Rated by: {{ block.rows.map(r => raterTypeLabel(r.raterType)).join(', ') || 'nobody yet' }}
          </p>
        </div>
        <div class="pui-row">
          <span v-if="personnelCountFor(block.role)" class="pui-badge">
            {{ personnelCountFor(block.role) }} personnel
          </span>
          <button class="pui-btn pui-btn-sm" type="button" @click="addRow(block.role)">Add Rater</button>
          <button class="pui-btn pui-btn-sm pui-btn-danger" type="button" @click="removeRoleBlock(block.role)">
            Remove Role
          </button>
        </div>
      </div>

      <!-- Caught here rather than only on save: the combination looks perfectly
           reasonable in the editor - three peer rows, three peers - and its
           consequence is invisible. A plain Peer alongside the numbered pair is
           not a third peer; when all three are configured the plain Peer's
           submitted answers are discarded by the score calculation, so a
           colleague does the rating and it never counts. -->
      <div v-if="peerConflict(block)" class="pui-alert pui-alert-warn" style="margin:0 16px 12px;">
        <strong style="display:block;margin-bottom:2px;">Check the peer rows</strong>{{ peerConflict(block) }}
      </div>

      <div class="pui-table-wrap">
        <table class="pui-table">
          <thead>
            <tr>
              <th scope="col" style="width:230px;">Rater Type</th>
              <th scope="col">Drawn From Role(s)</th>
              <th scope="col" style="width:190px;">Where To Look</th>
              <th scope="col" style="width:190px;">If Nobody Found</th>
              <th scope="col" style="width:60px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in block.rows" :key="block.role + '-' + index">
              <td>
                <!-- The explanation is a hover tooltip rather than a line of text
                     under every row: seven rows of help text pushed the table to
                     roughly double its height and buried the configuration it was
                     meant to explain. Titled on the options too, so the meaning is
                     readable while choosing, not only after. -->
                <select
                  v-model="row.raterType"
                  class="pui-select"
                  :title="raterTypeHint(row.raterType)"
                  @change="markDirty"
                >
                  <optgroup v-for="grp in raterTypeGroups" :key="grp.label" :label="grp.label">
                    <option v-for="t in grp.types" :key="t" :value="t" :title="raterTypeHint(t)">{{ raterTypeLabel(t) }}</option>
                  </optgroup>
                </select>
              </td>
              <td>
                <input
                  v-if="row.scope !== 'self'"
                  v-model="row.sourceRoles"
                  class="pui-input"
                  type="text"
                  placeholder="e.g. Section Head"
                  @input="markDirty"
                />
                <span v-else class="pui-muted" style="font-size:12px;">The person themselves</span>
              </td>
              <td>
                <select v-model="row.scope" class="pui-select" @change="markDirty">
                  <option v-for="s in scopes" :key="s" :value="s">{{ scopeLabel(s) }}</option>
                </select>
              </td>
              <td>
                <select v-if="row.scope !== 'self'" v-model="row.fallbackScope" class="pui-select" @change="markDirty">
                  <option value="">Leave unassigned</option>
                  <option v-for="s in fallbackScopes" :key="s" :value="s">{{ scopeLabel(s) }}</option>
                </select>
                <span v-else class="pui-muted" style="font-size:12px;">-</span>
              </td>
              <td style="text-align:right;">
                <button class="pui-btn pui-btn-sm pui-btn-danger" type="button" @click="removeRow(block.role, index)">
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="!loading" class="pui-card" style="padding:16px;">
      <div class="pui-row" style="gap:10px; flex-wrap:wrap;">
        <input
          v-model="newRoleName"
          class="pui-input"
          style="max-width:280px;"
          type="text"
          placeholder="Add a role, e.g. Program Manager"
          @keyup.enter="addRoleBlock(newRoleName)"
        />
        <button class="pui-btn" type="button" :disabled="!newRoleName.trim()" @click="addRoleBlock(newRoleName)">
          Add Role
        </button>
      </div>
      <p class="pui-hint" style="margin-top:10px;">
        Rating weights are not set here. They follow the rater type and are managed centrally under
        assessment rules, so the same weight applies consistently across every office.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { raterMatrixApi } from '@/services/api'
import { useConfirm } from '@/composables/useConfirm'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatTile from '@/components/ui/StatTile.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonRows from '@/components/ui/SkeletonRows.vue'

const { confirm } = useConfirm()
const toast = useToast()

const RATER_TYPE_LABELS = {
  Self: 'Self',
  Peer: 'Peer (the single peer)',
  Peer1: 'Peer 1 of 2',
  Peer2: 'Peer 2 of 2',
  Subordinate: 'Subordinate (rates upward)',
  Supervisor: 'Immediate Supervisor',
  SkipSupervisor: 'Skip-Level Supervisor'
}

// Grouped by the protocol's actual rule rather than listed as seven equal
// choices. The peer arrangement is not a free choice: it follows from whether
// the role is rated by a Subordinate, because generation derives hasSubordinate
// from exactly that - `raterList.some(r => r.raterType === 'Subordinate')` - and
// computeCBC then reads one peer slot or two. Presenting the options as a flat
// list invited the mix that silently discards a rating; presenting them under
// the condition that governs them makes the correct pair obvious while choosing.
const RATER_TYPE_GROUPS = [
  { label: 'Always include these', types: ['Self', 'Supervisor', 'SkipSupervisor'] },
  { label: 'If this role supervises people', types: ['Subordinate', 'Peer'] },
  { label: 'If this role supervises nobody', types: ['Peer1', 'Peer2'] }
]

// An office administrator picks these without knowing the protocol behind them,
// and three of the seven are genuinely not guessable from a label: that Peer and
// the Peer 1/Peer 2 pair are ALTERNATIVES rather than additions, that Subordinate
// means the ratee is rated by someone beneath them, and that adding a Subordinate
// is what collapses the two peer slots back into one. Describe the person, and
// the relationship between the slots - deliberately no percentages, because the
// weights live in each office's Assessment Rules and a number hardcoded here
// would start lying the moment an office changed one.
const RATER_TYPE_HINTS = {
  Self: 'The person rates themselves. Every role has this.',
  Peer: 'The single peer, used when this role also has a Subordinate. The subordinate takes the second peer\'s place.',
  Peer1: 'First of two colleagues, used when this role has no Subordinate.',
  Peer2: 'Second of two colleagues. Always goes with Peer 1 of 2.',
  Subordinate: 'Someone this role supervises rates them upward. Pair it with a single Peer.',
  Supervisor: 'The head this person reports to directly.',
  SkipSupervisor: "One level higher again - the supervisor's own supervisor."
}

const SCOPE_LABELS = {
  'self': 'The person themselves',
  'same-section': 'Same section',
  'same-division': 'Same division',
  'office-wide': 'Anywhere in the office',
  // Named honestly: this scope is a coin weighted 70/30, not a preference the
  // system tries hard to honour. An administrator choosing it should know some
  // raters WILL come from outside the section, so a cross-section pairing later
  // reads as the setting working rather than as a bug.
  'same-section-preferred': 'Same section 70% of the time'
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const errorTitle = ref('Something went wrong')
const dirty = ref(false)
const newRoleName = ref('')
const roleBlocks = ref([])
const coverage = ref({})
const actionNotice = ref({ show: false, type: 'info', title: '', message: '' })
const scopes = ref(['self', 'same-section', 'same-division', 'office-wide', 'same-section-preferred'])
const raterTypes = ref(['Self', 'Peer', 'Peer1', 'Peer2', 'Subordinate', 'Supervisor', 'SkipSupervisor'])

// Built from raterTypes rather than from the static group list, because the
// server can replace raterTypes wholesale. Grouping a fixed set would quietly
// drop any type it did not know about, leaving an administrator unable to pick
// a rater the backend still accepts - so anything unrecognised is kept and
// shown under its own heading instead of disappearing.
const raterTypeGroups = computed(() => {
  const available = raterTypes.value || []
  const groups = RATER_TYPE_GROUPS
    .map(g => ({ label: g.label, types: g.types.filter(t => available.includes(t)) }))
    .filter(g => g.types.length)
  const grouped = new Set(groups.flatMap(g => g.types))
  const rest = available.filter(t => !grouped.has(t))
  if (rest.length) groups.push({ label: 'Other', types: rest })
  return groups
})

// A fallback of 'self' makes no sense - self is not a pool to search.
const fallbackScopes = computed(() => scopes.value.filter(s => s !== 'self'))

const coverageItems = computed(() => coverage.value.items || [])
const unmappedItems = computed(() => coverageItems.value.filter(i => !i.configured))
const configuredRoleCount = computed(() => coverageItems.value.filter(i => i.configured).length)
const actionNoticeClass = computed(() => {
  if (actionNotice.value.type === 'error') return 'pui-alert-error'
  if (actionNotice.value.type === 'success') return 'pui-alert-info'
  return 'pui-alert-warn'
})
const actionNoticeTitleColor = computed(() => {
  if (actionNotice.value.type === 'error') return '#991b1b'
  if (actionNotice.value.type === 'success') return '#047857'
  return '#92400e'
})

onMounted(reload)

function raterTypeLabel(type) { return RATER_TYPE_LABELS[type] || type }
function raterTypeHint(type) { return RATER_TYPE_HINTS[type] || '' }

// 'Peer' and the 'Peer1'/'Peer2' pair are two ways of filling the SAME peer
// share, not three separate peers. computeCBC prefers the numbered pair, so with
// all three configured the plain Peer's rating is dropped from the score
// entirely - no error, no warning, and the rater is never told their work was
// ignored. Flag it in the editor where the choice is made.
function peerConflict(block) {
  const types = (block?.rows || []).map(r => String(r.raterType || ''))
  const hasPlain = types.includes('Peer')
  const numbered = types.filter(t => t === 'Peer1' || t === 'Peer2')
  const hasSub = types.includes('Subordinate')

  // Worst case first: the plain Peer's answers are thrown away entirely.
  if (hasPlain && numbered.length >= 2) {
    return 'This role has Peer, Peer 1 of 2 and Peer 2 of 2. That is not three peers - Peer 1 and Peer 2 already fill the whole peer share, ' +
      'so the plain Peer\'s rating would be left out of the score. Remove the plain Peer row.'
  }
  if (hasPlain && numbered.length) {
    return 'This role mixes the plain Peer with ' + raterTypeLabel(numbered[0]) +
      '. Use one Peer, or the Peer 1 / Peer 2 pair - not a mix of both.'
  }

  // Then the two arrangements that run but do not match the protocol.
  if (hasSub && numbered.length) {
    return 'This role is rated by a Subordinate, so it takes a single Peer - the subordinate fills the second peer\'s place. ' +
      'With Peer 1 and Peer 2 here, those two colleagues would share one slot between them. Replace them with a single Peer.'
  }
  if (!hasSub && hasPlain) {
    return 'This role has no Subordinate, so the protocol expects two peers - Peer 1 of 2 and Peer 2 of 2. ' +
      'A single Peer still works and carries the whole peer share on its own, but only one colleague will rate this role.'
  }
  if (!hasSub && numbered.length === 1) {
    return raterTypeLabel(numbered[0]) + ' is set without its partner. Add the other half of the pair, ' +
      'or use a single Peer instead.'
  }
  return ''
}
function scopeLabel(scope) { return SCOPE_LABELS[scope] || scope }

function personnelCountFor(role) {
  const found = coverageItems.value.find(i => i.role === role)
  return found ? found.personnel : 0
}

function markDirty() { dirty.value = true }

function setActionNotice(type, title, message) {
  actionNotice.value = { show: true, type, title, message }
}

function clearActionNotice() {
  actionNotice.value = { show: false, type: 'info', title: '', message: '' }
}

// The backend stores a flat row list; the screen groups by role because that is
// how an administrator thinks about it ("who rates a Technical Staff?").
function groupRows(items) {
  const map = new Map()
  items.forEach(item => {
    const role = item.rateeRole
    if (!map.has(role)) map.set(role, { role, rows: [] })
    map.get(role).rows.push({
      raterType: item.raterType,
      sourceRoles: item.sourceRoles || '',
      scope: item.scope || 'office-wide',
      fallbackScope: item.fallbackScope || ''
    })
  })
  return Array.from(map.values())
}

function flattenBlocks() {
  const items = []
  roleBlocks.value.forEach(block => {
    block.rows.forEach((row, index) => {
      items.push({
        rateeRole: block.role,
        raterType: row.raterType,
        sourceRoles: row.scope === 'self' ? '' : row.sourceRoles,
        scope: row.scope,
        fallbackScope: row.scope === 'self' ? '' : row.fallbackScope,
        sequence: items.length + index + 1
      })
    })
  })
  return items
}

async function reload() {
  loading.value = true
  error.value = ''
  if (!saving.value) clearActionNotice()
  try {
    const [matrix, cov] = await Promise.all([
      raterMatrixApi.list(),
      raterMatrixApi.coverage()
    ])
    applyMatrix(matrix)
    coverage.value = cov || {}
    dirty.value = false
  } catch (e) {
    errorTitle.value = 'The rater matrix could not be loaded'
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function applyMatrix(matrix) {
  roleBlocks.value = groupRows(matrix?.items || [])
  if (matrix?.scopes?.length) scopes.value = matrix.scopes
  if (matrix?.raterTypes?.length) raterTypes.value = matrix.raterTypes
}

function addRoleBlock(role) {
  const name = String(role || '').trim()
  if (!name) return
  if (roleBlocks.value.some(b => b.role === name)) return
  roleBlocks.value.push({
    role: name,
    rows: [{ raterType: 'Self', sourceRoles: '', scope: 'self', fallbackScope: '' }]
  })
  newRoleName.value = ''
  markDirty()
}

async function removeRoleBlock(role) {
  const ok = await confirm({
    type: 'danger',
    title: 'Remove Role Rules',
    message: `All rater rules for "${role}" will be removed. Anyone in that role will receive no rating tasks until it is configured again.`,
    confirmLabel: 'Remove'
  })
  if (!ok) return
  roleBlocks.value = roleBlocks.value.filter(b => b.role !== role)
  markDirty()
}

function addRow(role) {
  const block = roleBlocks.value.find(b => b.role === role)
  if (!block) return
  block.rows.push({ raterType: 'Peer', sourceRoles: '', scope: 'same-division', fallbackScope: '' })
  markDirty()
}

function removeRow(role, index) {
  const block = roleBlocks.value.find(b => b.role === role)
  if (!block) return
  block.rows.splice(index, 1)
  markDirty()
}

async function save() {
  const ok = await confirm({
    title: 'Save Rater Matrix',
    message: 'This replaces the current rater rules for this office. Existing assignments and submitted ratings are not affected - the change applies the next time assignments are generated.',
    confirmLabel: 'Save'
  })
  if (!ok) return

  saving.value = true
  error.value = ''
  setActionNotice('info', 'Saving rater matrix', 'Writing the rater rules to the database. Please keep this page open.')
  toast.info('Saving rater matrix...')
  try {
    const matrix = await raterMatrixApi.save(flattenBlocks())
    applyMatrix(matrix)
    setActionNotice('info', 'Updating coverage', 'Save completed. Checking the latest personnel coverage.')
    coverage.value = await raterMatrixApi.coverage()
    dirty.value = false
    setActionNotice('success', 'Rater matrix saved', 'The latest rules are now stored in the database.')
    toast.success('Rater matrix saved.')
  } catch (e) {
    errorTitle.value = 'The rater matrix could not be saved'
    error.value = e?.message || 'Please review the rules and try again.'
    setActionNotice('error', 'Save failed', error.value)
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}

async function restoreDefaults() {
  const ok = await confirm({
    type: 'danger',
    title: 'Reset to Standard Hierarchy',
    message: 'Current rater rules for this office are replaced with the standard hierarchy: self, peers, subordinate, immediate supervisor and skip-level supervisor. Any custom roles you configured are removed.',
    confirmLabel: 'Reset'
  })
  if (!ok) return

  saving.value = true
  error.value = ''
  setActionNotice('info', 'Applying standard hierarchy', 'Building rater rules from this office structure and saving them to the database.')
  toast.info('Applying standard hierarchy...')
  try {
    const matrix = await raterMatrixApi.seedDefaults()
    applyMatrix(matrix)
    setActionNotice('info', 'Updating coverage', 'The standard hierarchy was saved. Checking the latest personnel coverage.')
    coverage.value = await raterMatrixApi.coverage()
    dirty.value = false
    setActionNotice('success', 'Standard hierarchy applied', 'The rater matrix now follows this office structure.')
    toast.success('Standard hierarchy applied.')
  } catch (e) {
    errorTitle.value = 'The standard hierarchy could not be applied'
    error.value = e?.message || 'Please try again.'
    setActionNotice('error', 'Reset failed', error.value)
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}
</script>
