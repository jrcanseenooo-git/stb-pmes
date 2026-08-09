<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Assessment"
      title="My Results"
      subtitle="Your own consolidated assessment results. Individual rater identities and individual rater scores are not shown."
    />

    <div v-if="loading" class="card"><SkeletonRows :rows="4" aria-label="Loading your results" /></div>

    <div v-else-if="error" class="card border-red-100 bg-red-50 px-4 py-3" role="alert">
      <p class="text-sm font-bold text-red-800">Your results could not be loaded</p>
      <p class="mt-0.5 text-xs text-red-700">{{ error }}</p>
      <button class="btn-secondary mt-3 !py-1.5" type="button" @click="load">Try again</button>
    </div>

    <div v-else-if="!items.length" class="card">
      <EmptyState
        title="No results available yet"
        description="Your results appear here once all assigned raters have submitted their ratings for an assessment period and the result has been finalized."
      />
    </div>

    <template v-else>
      <!-- Period selector doubles as the assessment history. Selecting an
           earlier period shows that period's consolidated result. -->
      <div v-if="items.length > 1" class="card p-2 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Assessment period">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="selectedId === item.id"
          :class="[
            'px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors',
            selectedId === item.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
          @click="selectedId = item.id"
        >
          {{ item.periodLabel }}
        </button>
      </div>

      <section v-if="selected" class="card p-5 grid gap-5">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">{{ selected.periodLabel }}</p>
            <h2 class="mt-1 text-sm font-extrabold text-slate-900">Overall Assessment Result</h2>
          </div>
          <StatusPill :status="selected.status" />
        </div>

        <div class="flex items-end gap-4 flex-wrap">
          <div>
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Overall Score</p>
            <strong class="text-4xl font-extrabold text-slate-900 leading-none">
              {{ formatScore(selected.overallScore) }}
            </strong>
          </div>
          <p v-if="selected.descriptor" class="text-sm font-bold text-slate-600 pb-1">{{ selected.descriptor }}</p>
        </div>

        <div v-if="!selected.raterProgress.allComplete" class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p class="text-xs font-bold text-amber-800">This result is not yet final</p>
          <p class="mt-0.5 text-xs text-amber-700 leading-relaxed">
            {{ selected.raterProgress.completed }} of {{ selected.raterProgress.total }} assigned raters have submitted.
            The consolidated score is computed once all ratings are in.
          </p>
        </div>

        <div>
          <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Domain Scores</h3>
          <div class="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <StatTile
              v-for="domain in domainScores"
              :key="domain.label"
              :label="domain.label"
              :value="formatScore(domain.value)"
              :caption="domain.caption"
            />
          </div>
        </div>

        <p v-if="selected.hasDeduction" class="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
          A deduction has been applied to this result under the approved assessment protocol.
          Contact your office administrator if you need an explanation of the adjustment.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { portalApi } from '@/services/api'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonRows from '@/components/ui/SkeletonRows.vue'

const items = ref([])
const loading = ref(false)
const error = ref('')
const selectedId = ref('')

onMounted(load)

const selected = computed(() => items.value.find(item => item.id === selectedId.value) || items.value[0] || null)

const domainScores = computed(() => {
  const record = selected.value
  if (!record) return []
  return [
    { label: 'Competency & Behavior', value: record.cbcScore, caption: 'CBC' },
    { label: 'Functional / Performance Output', value: record.fpoScore, caption: 'FPO' },
    { label: 'Job Fitness', value: record.jfScore, caption: 'JF' }
  ]
})

watch(items, (rows) => {
  if (rows.length && !selectedId.value) selectedId.value = rows[0].id
})

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (Number.isNaN(number)) return '—'
  return number.toFixed(2)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.myResults()
    items.value = data.items || []
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>
