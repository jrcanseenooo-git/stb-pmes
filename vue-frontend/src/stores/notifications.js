// src/stores/notifications.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notificationsApi } from '@/services/api'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  const loading       = ref(false)

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  async function fetchAll() {
    loading.value = true
    try {
      notifications.value = await notificationsApi.list()
    } finally {
      loading.value = false
    }
  }

  async function markRead(id) {
    await notificationsApi.markRead(id)
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
  }

  async function markAllRead() {
    await notificationsApi.markAllRead()
    notifications.value.forEach(n => { n.read = true })
  }

  return { notifications, unreadCount, loading, fetchAll, markRead, markAllRead }
})
