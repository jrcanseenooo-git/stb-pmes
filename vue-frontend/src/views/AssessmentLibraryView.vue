<template>
  <div class="pui-page">
    <PageHeader
      kicker="Reference"
      title="Assessment Library"
      subtitle="The official assessment content used in this office. This is reference material and is read-only."
    >
      <template #actions>
        <RouterLink to="/help" class="pui-btn">Rating Guide</RouterLink>
      </template>
    </PageHeader>

    <DataPanel
      title="Assessment Content"
      :subtitle="contentSubtitle"
      :loading="loading"
      :error="error"
      error-title="The assessment library could not be loaded"
      :empty="!filteredGroups.length"
      :empty-title="items.length ? 'No content matches your search' : 'No assessment content published yet'"
      :empty-description="items.length
        ? 'Try a different search term or category.'
        : 'Assessment content is published centrally. It appears here once the approved content for your office is released.'"
      searchable
      :search="search"
      search-placeholder="Search indicators or guidance..."
      refreshable
      @update:search="value => (search = value)"
      @refresh="load"
    >
      <template #filters>
        <label class="pui-sr-only" for="library-category">Filter by category</label>
        <select id="library-category" v-model="categoryFilter" class="pui-select" style="width:auto; height:34px;">
          <option value="all">All categories</option>
          <option v-for="name in categoryNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </template>

      <div style="padding:16px; display:grid; gap:12px;">
        <article v-for="group in filteredGroups" :key="group.name" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
          <button
            type="button"
            style="width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 16px; background:#f8fafc; text-align:left; border:0; cursor:pointer;"
            :aria-expanded="isOpen(group.name)"
            @click="toggle(group.name)"
          >
            <div style="min-width:0;">
              <h3 style="margin:0; font-size:14px; font-weight:800; color:#0f172a;">{{ group.name }}</h3>
              <p v-if="group.description" style="margin:3px 0 0; font-size:12px; color:#64748b;">{{ group.description }}</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <span class="pui-badge">{{ group.items.length }}</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                :style="{ transform: isOpen(group.name) ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }"
                aria-hidden="true"
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </button>

          <ol v-if="isOpen(group.name)" style="list-style:none; margin:0; padding:0;">
            <li
              v-for="(item, index) in group.items"
              :key="item.id"
              style="padding:14px 16px; border-top:1px solid #f1f5f9; display:flex; gap:10px;"
            >
              <span style="font-size:12px; font-weight:800; color:#94a3b8; flex-shrink:0;">{{ index + 1 }}.</span>
              <div style="min-width:0;">
                <p style="margin:0; font-size:13.5px; font-weight:700; color:#0f172a; line-height:1.4;">{{ item.questionText }}</p>
                <p v-if="item.guidanceText" style="margin:6px 0 0; font-size:12px; color:#475569; line-height:1.5;">{{ item.guidanceText }}</p>
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
                  <span v-if="item.applicableRaters" class="pui-badge pui-badge-brand">
                    Rated by: {{ formatRaters(item.applicableRaters) }}
                  </span>
                  <span v-if="item.evidenceRequired" class="pui-badge pui-badge-warn">Evidence required</span>
                  <span v-if="item.required" class="pui-badge">Required</span>
                </div>
              </div>
            </li>
          </ol>
        </article>
      </div>
    </DataPanel>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'

const RATER_TYPE_LABELS = {
  Self: 'Self',
  Peer: 'Peer',
  Peer1: 'Peer',
  Peer2: 'Peer',
  Subordinate: 'Subordinate',
  Supervisor: 'Immediate Supervisor',
  SkipSupervisor: 'Skip-Level Supervisor'
}

const items = ref([])
const categories = ref([])
const version = ref('')
const loading = ref(false)
const error = ref('')
const search = ref('')
const categoryFilter = ref('all')
const openGroups = ref({})

onMounted(load)

const categoryNames = computed(() =>
  Array.from(new Set(items.value.map(item => item.category).filter(Boolean))).sort()
)

const contentSubtitle = computed(() => {
  const parts = [`${items.value.length} indicators`]
  if (version.value) parts.push(`Version ${version.value}`)
  return parts.join(' · ')
})

const descriptionByCategory = computed(() =>
  Object.fromEntries(categories.value.map(c => [c.name, c.description || '']))
)

const filteredGroups = computed(() => {
  const term = search.value.trim().toLowerCase()
  const filtered = items.value.filter(item => {
    if (categoryFilter.value !== 'all' && item.category !== categoryFilter.value) return false
    if (!term) return true
    return String(item.questionText || '').toLowerCase().includes(term) ||
      String(item.guidanceText || '').toLowerCase().includes(term)
  })

  const groups = new Map()
  filtered.forEach(item => {
    const name = item.category || item.domain || 'Uncategorized'
    if (!groups.has(name)) {
      groups.set(name, { name, description: descriptionByCategory.value[name] || '', items: [] })
    }
    groups.get(name).items.push(item)
  })
  return Array.from(groups.values())
})

function isOpen(name) {
  // Searching should reveal matches rather than leave them collapsed.
  if (search.value.trim()) return true
  return openGroups.value[name] !== false
}

function toggle(name) {
  openGroups.value = { ...openGroups.value, [name]: isOpen(name) ? false : true }
}

function formatRaters(value) {
  return String(value || '')
    .split(/[,;|]/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => RATER_TYPE_LABELS[part] || part)
    .join(', ')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.library()
    items.value = data.items || []
    categories.value = data.categories || []
    version.value = data.version || ''
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>
