<template>
  <div class="pui-page">
    <!--
      Simplified Dashboard for participating-office personnel.
      Deliberately excluded per the cluster specification: Account Settings,
      Quick Actions, Recent Activity, Performance Summary, and anything KRA.
      Everything here answers one question - what do I still have to rate?
    -->
    <section class="pui-card" style="padding:20px;">
      <p class="pui-header-kicker">{{ portalSubtitle }}</p>
      <h1 style="margin:4px 0 0; font-size:24px; font-weight:800; color:#0f172a; line-height:1.2;">
        {{ loading ? '-' : (person.fullName || 'Welcome') }}
      </h1>
      <dl style="margin:14px 0 0; display:flex; flex-wrap:wrap; gap:8px 28px; padding:0;">
        <div v-for="item in identityItems" :key="item.label" style="min-width:0;">
          <dt style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#94a3b8;">{{ item.label }}</dt>
          <dd style="margin:2px 0 0; font-size:13px; font-weight:700; color:#334155;">{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <div v-if="error" class="pui-card pui-alert pui-alert-error" style="padding:16px;" role="alert">
      <p class="pui-alert-title">Your assessment summary could not be loaded</p>
      <p>{{ error }}</p>
      <button class="pui-btn pui-btn-sm" style="margin-top:10px;" type="button" @click="load">Try again</button>
    </div>

    <div class="pui-grid pui-grid-3">
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

    <section class="pui-card" style="padding:20px; display:grid; gap:16px;">
      <div class="pui-row-between" style="flex-wrap:wrap;">
        <div>
          <h2 class="pui-card-title">Your rating task completion</h2>
          <p class="pui-card-subtitle">{{ period.label || 'Current assessment period' }}</p>
        </div>
        <RouterLink to="/my-tasks" class="pui-btn pui-btn-primary" style="flex-shrink:0;">
          {{ tasks.pending || tasks.draft ? 'Continue Rating' : 'Open My Rating Tasks' }}
        </RouterLink>
      </div>

      <ProgressBar
        :value="tasks.completed"
        :total="tasks.total"
        :label="`${tasks.completed} of ${tasks.total} rating tasks submitted`"
      />

      <p v-if="!loading && !tasks.total" class="pui-muted" style="font-size:12px; line-height:1.5;">
        You have no rating tasks for this assessment period yet. Your office administrator assigns
        them once the period opens - nothing is required from you until then.
      </p>
      <p v-else-if="!loading && !tasks.pending && !tasks.draft" style="font-size:12px; font-weight:700; color:#047857;">
        All of your rating tasks for this period have been submitted.
      </p>
    </section>

    <p v-if="lastUpdatedLabel" style="font-size:11px; color:#94a3b8; padding:0 2px;">
      Last updated {{ lastUpdatedLabel }} ·
      <button type="button" style="font-weight:800; color:#1d4ed8; background:none; border:0; cursor:pointer; padding:0; font-size:11px;" :disabled="loading" @click="load">
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
    { label: 'Position', value: p.position || p.positionLevel || '-' },
    { label: 'Office', value: p.officeName || '-' },
    { label: 'Division / Unit', value: p.divisionName || '-' },
    { label: 'Section', value: p.section || '-' },
    { label: 'Assessment Period', value: period.value.label || '-' }
  ].filter(item => item.value !== '-' || item.label === 'Assessment Period')
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
