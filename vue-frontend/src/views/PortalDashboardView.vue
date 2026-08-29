<template>
  <div class="pui-page">
    <!--
      Simplified Dashboard for participating-office personnel.
      Deliberately excluded per the cluster specification: Account Settings,
      Quick Actions, Recent Activity, Performance Summary, and anything KRA.
      Everything here answers one question - what do I still have to rate?

      No identity/office header card here - it duplicated the Assessment
      Record already shown in full on Personal Information (My Account),
      which is one click away in the sidebar.
    -->
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
        <RouterLink :to="evaluationLink" class="pui-btn pui-btn-primary" style="flex-shrink:0;">
          {{ tasks.pending || tasks.draft ? 'Continue Rating' : 'Open Evaluation' }}
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
import StatTile from '@/components/ui/StatTile.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const loading = ref(false)
const error = ref('')
const period = ref({})
const tasks = ref({ total: 0, pending: 0, draft: 0, completed: 0, completionRate: 0 })
const lastUpdatedAt = ref(null)

onMounted(load)

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

const evaluationLink = computed(() => ({
  path: '/evaluation',
  query: {
    semester: String(period.value.semester || (new Date().getMonth() < 6 ? 1 : 2)),
    year: String(period.value.year || new Date().getFullYear())
  }
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.summary()
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
