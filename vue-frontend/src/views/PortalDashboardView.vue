<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <!--
      Simplified Dashboard for participating-office personnel.
      Deliberately excluded per the cluster specification: Account Settings,
      Quick Actions, Recent Activity, Performance Summary, and anything KRA.
      Everything here answers one question — what do I still have to rate?
    -->
    <section class="card p-5">
      <p class="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">{{ portalSubtitle }}</p>
      <h1 class="mt-1 text-2xl font-extrabold text-slate-900 leading-tight">
        {{ loading ? '—' : (person.fullName || 'Welcome') }}
      </h1>
      <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <div v-for="item in identityItems" :key="item.label" class="min-w-0">
          <dt class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{{ item.label }}</dt>
          <dd class="text-sm font-bold text-slate-800 truncate">{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <div v-if="error" class="card border-red-100 bg-red-50 px-4 py-3" role="alert">
      <p class="text-sm font-bold text-red-800">Your assessment summary could not be loaded</p>
      <p class="mt-0.5 text-xs text-red-700">{{ error }}</p>
      <button class="btn-secondary mt-3 !py-1.5" type="button" @click="load">Try again</button>
    </div>

    <div class="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <StatTile
        label="Pending"
        :value="tasks.pending"
        :loading="loading"
        :tone="tasks.pending ? 'warn' : 'default'"
        caption="Not yet started"
      />
      <StatTile
        label="Draft"
        :value="tasks.draft"
        :loading="loading"
        caption="Saved but not submitted"
      />
      <StatTile
        label="Completed"
        :value="tasks.completed"
        :total="tasks.total"
        :loading="loading"
        tone="good"
        caption="Final rating submitted"
      />
    </div>

    <section class="card p-5 grid gap-4">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-sm font-extrabold text-slate-900">Your rating task completion</h2>
          <p class="text-xs text-slate-500 mt-0.5">{{ period.label || 'Current assessment period' }}</p>
        </div>
        <RouterLink to="/my-tasks" class="btn-primary shrink-0">
          {{ tasks.pending || tasks.draft ? 'Continue Rating' : 'Open My Rating Tasks' }}
        </RouterLink>
      </div>

      <ProgressBar
        :value="tasks.completed"
        :total="tasks.total"
        :label="`${tasks.completed} of ${tasks.total} rating tasks submitted`"
      />

      <p v-if="!loading && !tasks.total" class="text-xs text-slate-500 leading-relaxed">
        You have no rating tasks for this assessment period yet. Your office administrator assigns
        them once the period opens — nothing is required from you until then.
      </p>
      <p v-else-if="!loading && !tasks.pending && !tasks.draft" class="text-xs text-emerald-700 font-bold">
        All of your rating tasks for this period have been submitted.
      </p>
    </section>

    <p v-if="lastUpdatedLabel" class="text-[11px] text-slate-400 px-1">
      Last updated {{ lastUpdatedLabel }} ·
      <button type="button" class="font-extrabold text-blue-700 hover:underline" :disabled="loading" @click="load">
        Refresh
      </button>
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import { useBranding } from '@/composables/useBranding'
import StatTile from '@/components/ui/StatTile.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const { portalSubtitle } = useBranding()

const loading = ref(false)
const error = ref('')
const person = ref({})
const period = ref({})
const tasks = ref({ total: 0, pending: 0, draft: 0, completed: 0, completionRate: 0 })
const lastUpdatedAt = ref(null)

onMounted(load)

const identityItems = computed(() => {
  const p = person.value
  return [
    { label: 'Position', value: p.position || p.positionLevel || '—' },
    { label: 'Office', value: p.officeName || '—' },
    { label: 'Division / Unit', value: p.divisionName || '—' },
    { label: 'Section', value: p.section || '—' },
    { label: 'Assessment Period', value: period.value.label || '—' }
  ].filter(item => item.value !== '—' || item.label === 'Assessment Period')
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.summary()
    person.value = data.person || {}
    period.value = data.period || {}
    tasks.value = { total: 0, pending: 0, draft: 0, completed: 0, completionRate: 0, ...(data.tasks || {}) }
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>
