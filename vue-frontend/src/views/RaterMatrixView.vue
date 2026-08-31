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
                  <option
                    v-for="t in raterTypeOptionsFor(block, row)"
                    :key="t"
                    :value="t"
                    :title="raterTypeHint(t)"
                  >{{ raterTypeLabel(t) }}</option>
                </select>
              </td>
              <td>
                <div v-if="row.scope !== 'self'" class="rm-multi" :data-menu="menuKey(block, index)">
                  <button
                    type="button"
                    class="pui-input rm-multi-toggle"
                    :class="{ 'rm-multi-empty': !sourceRoleList(row).length }"
                    @click.stop="toggleMenu(block, index)"
                  >
                    <span class="rm-multi-value">{{ sourceRolesLabel(row) }}</span>
                    <span class="rm-multi-caret" aria-hidden="true">▾</span>
                  </button>
                  <div v-if="openMenu === menuKey(block, index)" class="rm-multi-menu" @click.stop>
                    <p v-if="!roleOptionsForRow(row).length" class="rm-multi-none">
                      No roles found in Office Structure.
                    </p>
                    <label
                      v-for="opt in roleOptionsForRow(row)"
                      :key="opt"
                      class="rm-multi-opt"
                    >
                      <input
                        type="checkbox"
                        :checked="sourceRoleList(row).includes(opt)"
                        @change="toggleSourceRole(row, opt)"
                      />
                      <span>{{ opt }}</span>
                      <span v-if="!officeRoles.includes(opt)" class="rm-multi-stale">not in structure</span>
                    </label>
                  </div>
                </div>
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
        <select v-model="newRoleName" class="pui-select" style="max-width:280px;">
          <option value="">{{ addableRoles.length ? 'Select a role to add…' : 'Every office role already has rules' }}</option>
          <option v-for="r in addableRoles" :key="r" :value="r">{{ r }}</option>
        </select>
        <button class="pui-btn" type="button" :disabled="!newRoleName" @click="addRoleBlock(newRoleName)">
          Add Role
        </button>
      </div>
      <p v-if="!officeRoles.length" class="pui-hint" style="margin-top:10px; color:#92400E;">
        No roles were found for this office in Office Structure, so there is nothing to choose from.
        Add the office's roles there first - rules can only be written against roles that exist.
      </p>
      <p class="pui-hint" style="margin-top:10px;">
        Rating weights are not set here. They follow the rater type and are managed centrally under
        assessment rules, so the same weight applies consistently across every office.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { raterMatrixApi } from '@/services/api'
import { useConfirm } from '@/composables/useConfirm'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatTile from '@/components/ui/StatTile.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonRows from '@/components/ui/SkeletonRows.vue'

const { confirm } = useConfirm()
const toast = useToast()

// Every role gets a Peer. The fourth slot is then EITHER Subordinate OR Peer 2 -
// they are substitutes for one another, which is why Peer 2 says so in its own
// label. That framing matches the protocol directly (no subordinate means the
// subordinate's share passes to a second peer) and is easier to hold than the
// branch-per-arrangement grouping this replaced.
//
// Peer1 is legacy: offices configured before this vocabulary still hold it, and
// it scores identically to Peer, so it stays translatable but is not offered as
// a new choice. See raterTypeOptionsFor().
const RATER_TYPE_LABELS = {
  Self: 'Self',
  Peer: 'Peer',
  Subordinate: 'Subordinate',
  Peer2: 'Peer 2 (substitute to subordinate)',
  Supervisor: 'Immediate Supervisor',
  SkipSupervisor: 'Skip-Level Supervisor',
  Peer1: 'Peer 1 (older setup - same as Peer)'
}

// Offered order. Peer sits next to Subordinate and Peer 2 so the either/or is
// visible without reading the labels twice.
const RATER_TYPE_ORDER = ['Self', 'Peer', 'Subordinate', 'Peer2', 'Supervisor', 'SkipSupervisor']

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
  Peer: 'A colleague at the same level. Every role has one.',
  Subordinate: 'Someone this role supervises, rating upward. Use this when the role has people under it - instead of Peer 2.',
  Peer2: 'A second colleague, standing in for the Subordinate when this role supervises nobody. Use this OR Subordinate, never both.',
  Supervisor: 'The head this person reports to directly.',
  SkipSupervisor: "One level higher again - the supervisor's own supervisor.",
  Peer1: 'From an older setup. Scores exactly like Peer; you can leave it or switch it to Peer.'
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
// The roles this office actually declared in Office Structure. Rules are only
// meaningful against these: a rater rule naming a role nobody holds matches
// nobody, and the people it was meant to cover end up rated by no one at all.
const officeRoles = ref([])
const openMenu = ref('')
const coverage = ref({})
const actionNotice = ref({ show: false, type: 'info', title: '', message: '' })
const scopes = ref(['self', 'same-section', 'same-division', 'office-wide', 'same-section-preferred'])
const raterTypes = ref(['Self', 'Peer', 'Peer1', 'Peer2', 'Subordinate', 'Supervisor', 'SkipSupervisor'])

// A rater type already used elsewhere in this role is not offered again. The
// backend rejects duplicates outright, so offering one could only ever lead to a
// failed save; removing it also means that once Self, Peer, Immediate Supervisor
// and Skip-Level Supervisor are set, the only choices left are exactly the two
// that matter - Subordinate or Peer 2 - and the decision makes itself.
//
// The row's OWN current value is always kept, or the select would have nothing
// selected and silently reassign the row on the next change. Legacy values the
// standard list no longer offers (Peer1) are kept for the same reason, and only
// for the row that already holds them.
function raterTypeOptionsFor(block, row) {
  const available = raterTypes.value || []
  const current = String(row?.raterType || '')
  const takenElsewhere = new Set(
    (block?.rows || [])
      .filter(r => r !== row)
      .map(r => String(r.raterType || ''))
  )
  const offered = RATER_TYPE_ORDER
    .filter(t => available.includes(t))
    .filter(t => t === current || !takenElsewhere.has(t))
  if (current && !offered.includes(current)) offered.unshift(current)
  return offered
}

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

// The menu is a plain absolutely-positioned panel, so nothing else dismisses
// it. Without this, one left open stays open while the administrator scrolls
// and clicks elsewhere, covering the rows beneath it.
onMounted(() => {
  reload()
  document.addEventListener('click', closeMenus)
})
onBeforeUnmount(() => document.removeEventListener('click', closeMenus))

function raterTypeLabel(type) { return RATER_TYPE_LABELS[type] || type }
function raterTypeHint(type) { return RATER_TYPE_HINTS[type] || '' }

// 'Peer' and the 'Peer1'/'Peer2' pair are two ways of filling the SAME peer
// share, not three separate peers. computeCBC prefers the numbered pair, so with
// all three configured the plain Peer's rating is dropped from the score
// entirely - no error, no warning, and the rater is never told their work was
// ignored. Flag it in the editor where the choice is made.
// Subordinate and Peer 2 are substitutes, so having both is the one arrangement
// that is simply wrong: computeCBC collapses every peer into a single slot once a
// Subordinate is present, so the Peer 2 colleague rates and their answers are
// averaged away against the other peer instead of counting on their own.
//
// Having neither is the quieter mistake - it costs the role a rater with nothing
// on screen to say so - so it is called out too.
function peerConflict(block) {
  const types = (block?.rows || []).map(r => String(r.raterType || ''))
  const hasSub = types.includes('Subordinate')
  const hasPeer2 = types.includes('Peer2')
  const hasPeer = types.includes('Peer') || types.includes('Peer1')

  if (hasSub && hasPeer2) {
    return 'This role has both Subordinate and Peer 2. They are substitutes - a role uses one or the other. ' +
      'Keep Subordinate if this role supervises people; keep Peer 2 if it supervises nobody. ' +
      'With both, the Peer 2 colleague still rates but their answers are merged into the same slot as the Peer and largely cancel out.'
  }
  if (types.includes('Peer') && types.includes('Peer1')) {
    return 'This role has both Peer and Peer 1, which are the same thing under different names. Remove one of them.'
  }
  if (hasPeer && !hasSub && !hasPeer2) {
    return 'This role has one Peer and no Subordinate. Add Peer 2 as the substitute, ' +
      'or add Subordinate if this role does supervise people - otherwise it is rated by one colleague instead of two.'
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
  if (Array.isArray(matrix?.officeRoles)) officeRoles.value = matrix.officeRoles
}

// Roles that have no rules yet. A role already carrying a block is not offered
// again, because a second block for it would silently shadow the first.
const addableRoles = computed(() => {
  const taken = new Set(roleBlocks.value.map(b => String(b.role || '')))
  return (officeRoles.value || []).filter(r => !taken.has(String(r)))
})

function menuKey(block, index) {
  return String(block?.role || '') + '::' + index
}

function toggleMenu(block, index) {
  const key = menuKey(block, index)
  openMenu.value = openMenu.value === key ? '' : key
}

function sourceRoleList(row) {
  return String(row?.sourceRoles || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

// Roles saved before this dropdown existed - or since removed from Office
// Structure - are still offered, but only for the row already holding them.
// Dropping them from the list would silently clear a rule the administrator
// never asked to change.
function roleOptionsForRow(row) {
  const chosen = sourceRoleList(row)
  const known = officeRoles.value || []
  return known.concat(chosen.filter(r => !known.includes(r)))
}

function sourceRolesLabel(row) {
  const chosen = sourceRoleList(row)
  if (!chosen.length) return 'Select role(s)…'
  if (chosen.length <= 2) return chosen.join(', ')
  return chosen.slice(0, 2).join(', ') + ' +' + (chosen.length - 2)
}

function toggleSourceRole(row, role) {
  const chosen = sourceRoleList(row)
  const next = chosen.includes(role)
    ? chosen.filter(r => r !== role)
    : chosen.concat([role])
  row.sourceRoles = next.join(',')
  markDirty()
}

function closeMenus() {
  openMenu.value = ''
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
