<template>
  <div class="pui-page">
    <PageHeader
      kicker="Office Administration"
      title="Office Assessment Dashboard"
      :subtitle="`${officeName || 'Your office'} — ${period.label || 'current assessment period'}`"
    >
      <template #actions>
        <button class="pui-btn" type="button" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="pui-card pui-alert pui-alert-error" style="padding:16px;" role="alert">
      <p class="pui-alert-title">Office monitoring could not be loaded</p>
      <p>{{ error }}</p>
      <button class="pui-btn pui-btn-sm" style="margin-top:10px;" type="button" @click="load">Try again</button>
    </div>

    <div class="pui-grid pui-grid-4">
      <StatTile label="Active Personnel" :value="kpis.activePersonnel" :total="kpis.totalPersonnel" :loading="loading" />
      <StatTile
        label="For Validation"
        :value="kpis.pendingValidation"
        :loading="loading"
        :tone="kpis.pendingValidation ? 'warn' : 'default'"
      />
      <StatTile label="Rating Tasks" :value="kpis.totalTasks" :loading="loading" />
      <StatTile
        label="Completion Rate"
        :value="`${kpis.completionRate}%`"
        :loading="loading"
        :tone="completionTone"
      />
    </div>

    <div class="pui-grid pui-grid-4">
      <StatTile label="Submitted" :value="kpis.submittedTasks" :loading="loading" tone="good" />
      <StatTile label="Outstanding" :value="kpis.outstandingTasks" :loading="loading" :tone="kpis.outstandingTasks ? 'warn' : 'default'" />
      <StatTile label="Assessment Records" :value="kpis.assessmentRecords" :loading="loading" />
      <StatTile label="Finalized" :value="kpis.finalizedRecords" :total="kpis.assessmentRecords" :loading="loading" />
    </div>

    <section class="pui-card" style="padding:20px;">
      <div class="pui-row-between" style="flex-wrap:wrap; margin-bottom:16px;">
        <div>
          <h2 class="pui-card-title">Overall rating task completion</h2>
          <p class="pui-card-subtitle">{{ period.label }}</p>
        </div>
        <RouterLink to="/office-personnel" class="pui-btn" style="flex-shrink:0;">Personnel Validation</RouterLink>
      </div>
      <ProgressBar
        :value="kpis.submittedTasks"
        :total="kpis.totalTasks"
        :label="`${kpis.submittedTasks} of ${kpis.totalTasks} rating tasks submitted`"
      />
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Items needing attention</h2>
      </div>
      <ul style="list-style:none; margin:0; padding:0;">
        <li v-for="item in attention" :key="item.label" style="padding:12px 16px; border-top:1px solid #eef2f7; display:flex; align-items:flex-start; gap:10px;">
          <StatusPill :status="item.level" />
          <div style="min-width:0;">
            <p style="margin:0; font-size:13px; font-weight:700; color:#0f172a;">{{ item.label }}</p>
            <p style="margin:2px 0 0; font-size:12px; color:#64748b; line-height:1.5;">{{ item.detail }}</p>
          </div>
        </li>
      </ul>
    </section>

    <div class="pui-grid pui-grid-2">
      <BarList
        title="Completion by Organizational Unit"
        :subtitle="period.label"
        :items="byUnit"
        :loading="loading"
        empty-description="Completion by unit appears once rating assignments exist for this period."
      />
      <BarList
        title="Completion by Rater Relationship"
        :subtitle="period.label"
        :items="byRaterType"
        :loading="loading"
        empty-description="Completion by rater relationship appears once rating assignments exist for this period."
      />
    </div>

    <p v-if="lastUpdatedLabel" style="font-size:11px; color:#94a3b8; padding:0 2px;">
      Last updated {{ lastUpdatedLabel }}
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import { useBranding } from '@/composables/useBranding'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import BarList from '@/components/ui/BarList.vue'

const { officeName } = useBranding()

const EMPTY_KPIS = {
  totalPersonnel: 0, activePersonnel: 0, pendingValidation: 0, inactivePersonnel: 0,
  totalTasks: 0, submittedTasks: 0, outstandingTasks: 0, completionRate: 0,
  assessmentRecords: 0, finalizedRecords: 0
}

const loading = ref(false)
const error = ref('')
const kpis = ref({ ...EMPTY_KPIS })
const period = ref({})
const byUnit = ref([])
const byRaterType = ref([])
const attention = ref([])
const lastUpdatedAt = ref(null)

onMounted(load)

const completionTone = computed(() => {
  if (kpis.value.completionRate >= 80) return 'good'
  if (kpis.value.completionRate >= 40) return 'default'
  return 'warn'
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.officeSummary()
    kpis.value = { ...EMPTY_KPIS, ...(data.kpis || {}) }
    period.value = data.period || {}
    byUnit.value = data.byUnit || []
    byRaterType.value = data.byRaterType || []
    attention.value = data.attention || []
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>
