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

  async function fetchAll(options = {}) {
    const silent = options.silent === true
    if (!silent) loading.value = true
    try {
      notifications.value = await notificationsApi.list()
    } finally {
      if (!silent) loading.value = false
    }
  }

  async function markRead(id) {
    const n = notifications.value.find(n => n.id === id)
    const previous = n?.read
    if (n) n.read = true

    try {
      await notificationsApi.markRead(id)
    } catch (error) {
      if (n) n.read = previous
      throw error
    }
  }

  async function markAllRead() {
    const previous = notifications.value.map(n => ({ id: n.id, read: n.read }))
    notifications.value.forEach(n => { n.read = true })

    try {
      await notificationsApi.markAllRead()
    } catch (error) {
      previous.forEach(saved => {
        const n = notifications.value.find(item => item.id === saved.id)
        if (n) n.read = saved.read
      })
      throw error
    }
  }

  return { notifications, unreadCount, loading, fetchAll, markRead, markAllRead }
})
