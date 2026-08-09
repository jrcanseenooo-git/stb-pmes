// src/stores/users.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usersApi } from '@/services/api'

export const useUsersStore = defineStore('users', () => {
  const users   = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      // Backend paginate() defaults to pageSize 50, so an unparameterised call
      // silently drops every account past the 50th — always the newest ones,
      // since rows are appended. See UsersView.loadUsers for the same fix.
      const result = await usersApi.list({ pageSize: 2000 })
      users.value  = result.items ?? result ?? []
    } catch (e) {
      console.warn('[Users] fetchAll failed:', e.message)
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const newUser = await usersApi.create(data)
    users.value.unshift(newUser)
    return newUser
  }

  async function update(id, data) {
    const updated = await usersApi.update(id, data)
    const idx = users.value.findIndex(u => u.id === id)
    if (idx !== -1) users.value[idx] = updated
    return updated
  }

  async function activate(id) {
    await usersApi.activate(id)
    const u = users.value.find(u => u.id === id)
    if (u) u.active = true
  }

  async function deactivate(id) {
    await usersApi.deactivate(id)
    const u = users.value.find(u => u.id === id)
    if (u) u.active = false
  }

  return { users, loading, fetchAll, create, update, activate, deactivate }
})