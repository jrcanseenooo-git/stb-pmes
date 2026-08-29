<template>
  <div class="pui-page">
    <PageHeader
      kicker="Assessment"
      title="Assessment Status"
      subtitle="Updates about your rating tasks and assessment period."
    >
      <template #actions>
        <button
          v-if="unreadCount"
          class="pui-btn"
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
      empty-description="Notices about new rating tasks, saved drafts, submitted ratings and assessment updates appear here."
      refreshable
      @refresh="load"
    >
      <ul style="list-style:none; margin:0; padding:0;">
        <li
          v-for="item in visible"
          :key="item.id"
          :style="{ padding: '14px 16px', display: 'flex', gap: '10px', borderBottom: '1px solid #eef2f7', background: item.read ? 'transparent' : 'rgba(239,246,255,.5)' }"
        >
          <span
            :style="{ marginTop: '5px', width: '8px', height: '8px', borderRadius: '999px', flexShrink: 0, background: item.read ? '#cbd5e1' : '#1d4ed8' }"
            :aria-label="item.read ? 'Read' : 'Unread'"
          ></span>
          <div style="min-width:0; flex:1;">
            <p style="margin:0; font-size:13px; color:#334155; line-height:1.5;">
              <b>{{ typeLabel(item.type) }}:</b> {{ item.message }}
            </p>
            <p style="margin:4px 0 0; font-size:11px; color:#94a3b8;">{{ formatDateTime(item.createdAt) }}</p>
          </div>
          <button
            v-if="!item.read"
            type="button"
            style="font-size:11px; font-weight:800; color:#1d4ed8; background:none; border:0; cursor:pointer; flex-shrink:0; align-self:flex-start; margin-top:2px;"
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
  submission: 'Rating Submitted'
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
