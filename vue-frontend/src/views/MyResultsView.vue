<template>
  <div class="pui-page">
    <PageHeader
      kicker="Assessment"
      title="My Results"
      subtitle="Your own consolidated assessment results. Individual rater identities and individual rater scores are not shown."
    />

    <div v-if="loading" class="pui-card"><SkeletonRows :rows="4" aria-label="Loading your results" /></div>

    <div v-else-if="error" class="pui-card pui-alert pui-alert-error" style="padding:16px;" role="alert">
      <p class="pui-alert-title">Your results could not be loaded</p>
      <p>{{ error }}</p>
      <button class="pui-btn pui-btn-sm" style="margin-top:10px;" type="button" @click="load">Try again</button>
    </div>

    <div v-else-if="!items.length" class="pui-card">
      <EmptyState
        title="No results available yet"
        description="Your results appear here once all assigned raters have submitted their ratings for an assessment period and the result has been finalized."
      />
    </div>

    <template v-else>
      <!-- Period selector doubles as the assessment history. Selecting an
           earlier period shows that period's consolidated result. -->
      <div v-if="items.length > 1" class="pui-card" style="padding:8px; display:flex; gap:6px; overflow-x:auto;" role="tablist" aria-label="Assessment period">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="selectedId === item.id"
          :class="['pui-tab', selectedId === item.id && 'pui-tab-active']"
          style="padding:8px 14px;"
          @click="selectedId = item.id"
        >
          {{ item.periodLabel }}
        </button>
      </div>

      <section v-if="selected" class="pui-card" style="padding:20px; display:grid; gap:18px;">
        <div class="pui-row-between" style="flex-wrap:wrap;">
          <div>
            <p class="pui-header-kicker">{{ selected.periodLabel }}</p>
            <h2 class="pui-card-title" style="margin-top:2px;">Overall Assessment Result</h2>
          </div>
          <StatusPill :status="selected.status" />
        </div>

        <div style="display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap;">
          <div>
            <p style="font-size:10px; font-weight:800; text-transform:uppercase; color:#94a3b8; margin:0;">Overall Score</p>
            <strong style="font-size:36px; font-weight:800; color:#0f172a; line-height:1;">
              {{ formatScore(selected.overallScore) }}
            </strong>
          </div>
          <p v-if="selected.descriptor" style="font-size:14px; font-weight:700; color:#475569; margin:0 0 4px;">{{ selected.descriptor }}</p>
        </div>

        <div v-if="!selected.raterProgress.allComplete" class="pui-alert pui-alert-warn">
          <p class="pui-alert-title" style="color:#92400e;">This result is not yet final</p>
          <p>
            {{ selected.raterProgress.completed }} of {{ selected.raterProgress.total }} assigned raters have submitted.
            The consolidated score is computed once all ratings are in.
          </p>
        </div>

        <div>
          <h3 style="font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b; margin:0 0 10px;">Domain Scores</h3>
          <div class="pui-grid pui-grid-3">
            <StatTile
              v-for="domain in domainScores"
              :key="domain.label"
              :label="domain.label"
              :value="formatScore(domain.value)"
              :caption="domain.caption"
            />
          </div>
        </div>

        <p v-if="selected.hasDeduction" style="font-size:12px; color:#64748b; line-height:1.5; border-top:1px solid #eef2f7; padding-top:14px; margin:0;">
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
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (Number.isNaN(number)) return '-'
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
