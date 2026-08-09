<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Assessment"
      title="Assessment Status"
      subtitle="Updates about your rating tasks and assessment period."
    >
      <template #actions>
        <button
          v-if="unreadCount"
          class="btn-secondary"
          type="button"
          :disabled="marking"
          @click="markAll"
        >
          {{ marking ? 'Marking...' : `Mark all read (${unreadCount})` }}
        </button>
      </template>
    </PageHeader>

    <DataPanel
      title="Updates"
      :subtitle="`${visible.length} assessment ${visible.length === 1 ? 'update' : 'updates'}`"
      :loading="store.loading"
      :error="error"
      error-title="Your updates could not be loaded"
      :empty="!visible.length"
      empty-title="No assessment updates"
      empty-description="Notices about new rating tasks, saved drafts, submitted ratings and reopened tasks appear here."
      refreshable
      @refresh="load"
    >
      <ul class="divide-y divide-slate-100">
        <li
          v-for="item in visible"
          :key="item.id"
          :class="['px-4 py-3.5 flex gap-3', !item.read && 'bg-blue-50/40']"
        >
          <span
            :class="['mt-1.5 w-2 h-2 rounded-full shrink-0', item.read ? 'bg-slate-300' : 'bg-blue-600']"
            :aria-label="item.read ? 'Read' : 'Unread'"
          ></span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-slate-800 leading-snug">
              <b>{{ typeLabel(item.type) }}:</b> {{ item.message }}
            </p>
            <p class="mt-1 text-[11px] text-slate-400">{{ formatDateTime(item.createdAt) }}</p>
          </div>
          <button
            v-if="!item.read"
            type="button"
            class="text-[11px] font-extrabold text-blue-700 hover:underline shrink-0 self-start mt-0.5"
            @click="markOne(item)"
          >
            Mark read
          </button>
        </li>
      </ul>
    </DataPanel>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'

const store = useNotificationsStore()
const error = ref('')
const marking = ref(false)

// Personnel see assessment notices only. Administrative and system notifications
// are filtered out here rather than hidden by styling, so nothing about user
// management, provisioning or configuration reaches this screen.
const ASSESSMENT_MODULES = ['Evaluation', 'IPAT', 'Assessment', 'Ratings']
const ADMIN_TYPES = ['system', 'maintenance', 'provisioning', 'registry', 'audit']

const TYPE_LABELS = {
  approval: 'Approved',
  revision: 'For Revision',
  deadline: 'Deadline',
  alert: 'Notice',
  assignment: 'New Rating Task',
  submission: 'Rating Submitted',
  reopened: 'Rating Reopened'
}

onMounted(load)

const visible = computed(() =>
  store.notifications.filter(item => {
    const type = String(item.type || '').toLowerCase()
    if (ADMIN_TYPES.includes(type)) return false
    if (!item.module) return true
    return ASSESSMENT_MODULES.some(name =>
      String(item.module).toLowerCase().includes(name.toLowerCase())
    )
  })
)

const unreadCount = computed(() => visible.value.filter(item => !item.read).length)

function typeLabel(type) {
  return TYPE_LABELS[String(type || '').toLowerCase()] || 'Update'
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  error.value = ''
  try {
    await store.fetchAll()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  }
}

async function markOne(item) {
  try {
    await store.markRead(item.id)
  } catch (e) {
    error.value = e?.message || 'Could not update this notification.'
  }
}

async function markAll() {
  marking.value = true
  try {
    await store.markAllRead()
  } catch (e) {
    error.value = e?.message || 'Could not update your notifications.'
  } finally {
    marking.value = false
  }
}
</script>
