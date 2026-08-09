<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Office Administration"
      title="Office Assessment Dashboard"
      :subtitle="`${officeName || 'Your office'} — ${period.label || 'current assessment period'}`"
    >
      <template #actions>
        <button class="btn-secondary" type="button" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="card border-red-100 bg-red-50 px-4 py-3" role="alert">
      <p class="text-sm font-bold text-red-800">Office monitoring could not be loaded</p>
      <p class="mt-0.5 text-xs text-red-700">{{ error }}</p>
      <button class="btn-secondary mt-3 !py-1.5" type="button" @click="load">Try again</button>
    </div>

    <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
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

    <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <StatTile label="Submitted" :value="kpis.submittedTasks" :loading="loading" tone="good" />
      <StatTile label="Outstanding" :value="kpis.outstandingTasks" :loading="loading" :tone="kpis.outstandingTasks ? 'warn' : 'default'" />
      <StatTile label="Assessment Records" :value="kpis.assessmentRecords" :loading="loading" />
      <StatTile label="Finalized" :value="kpis.finalizedRecords" :total="kpis.assessmentRecords" :loading="loading" />
    </div>

    <section class="card p-5">
      <div class="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 class="text-sm font-extrabold text-slate-900">Overall rating task completion</h2>
          <p class="text-xs text-slate-500 mt-0.5">{{ period.label }}</p>
        </div>
        <RouterLink to="/office-personnel" class="btn-secondary shrink-0">Personnel Validation</RouterLink>
      </div>
      <ProgressBar
        :value="kpis.submittedTasks"
        :total="kpis.totalTasks"
        :label="`${kpis.submittedTasks} of ${kpis.totalTasks} rating tasks submitted`"
      />
    </section>

    <section class="card overflow-hidden">
      <div class="card-header !px-4 !py-3">
        <h2 class="card-title">Items needing attention</h2>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="item in attention" :key="item.label" class="px-4 py-3 flex items-start gap-3">
          <StatusPill :status="item.level" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-900">{{ item.label }}</p>
            <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">{{ item.detail }}</p>
          </div>
        </li>
      </ul>
    </section>

    <div class="grid gap-4 grid-cols-1 lg:grid-cols-2">
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

    <p v-if="lastUpdatedLabel" class="text-[11px] text-slate-400 px-1">
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
