<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Reference"
      title="Assessment Library"
      subtitle="The official assessment content used in this office. This is reference material and is read-only."
    >
      <template #actions>
        <RouterLink to="/help" class="btn-secondary">Rating Guide</RouterLink>
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
        <label class="sr-only" for="library-category">Filter by category</label>
        <select id="library-category" v-model="categoryFilter" class="form-select !py-1.5 !w-auto">
          <option value="all">All categories</option>
          <option v-for="name in categoryNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </template>

      <div class="p-4 grid gap-3">
        <article v-for="group in filteredGroups" :key="group.name" class="rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 text-left hover:bg-slate-100 transition-colors"
            :aria-expanded="isOpen(group.name)"
            @click="toggle(group.name)"
          >
            <div class="min-w-0">
              <h3 class="text-sm font-extrabold text-slate-900">{{ group.name }}</h3>
              <p v-if="group.description" class="text-xs text-slate-500 mt-0.5">{{ group.description }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="badge-status bg-slate-200 text-slate-600">{{ group.items.length }}</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                :class="['transition-transform', isOpen(group.name) && 'rotate-180']"
                aria-hidden="true"
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </button>

          <ol v-if="isOpen(group.name)" class="divide-y divide-slate-100">
            <li v-for="(item, index) in group.items" :key="item.id" class="px-4 py-3.5">
              <div class="flex gap-3">
                <span class="text-xs font-extrabold text-slate-400 pt-0.5 shrink-0">{{ index + 1 }}.</span>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-900 leading-snug">{{ item.questionText }}</p>
                  <p v-if="item.guidanceText" class="mt-1.5 text-xs text-slate-600 leading-relaxed">{{ item.guidanceText }}</p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <span v-if="item.applicableRaters" class="badge-status bg-blue-50 text-blue-700">
                      Rated by: {{ formatRaters(item.applicableRaters) }}
                    </span>
                    <span v-if="item.evidenceRequired" class="badge-status bg-amber-50 text-amber-700">Evidence required</span>
                    <span v-if="item.required" class="badge-status bg-slate-100 text-slate-600">Required</span>
                  </div>
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
