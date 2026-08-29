<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <template v-if="profileUnavailable">
        <div class="text-6xl font-bold text-amber-500 mb-4">!</div>
        <h1 class="text-xl font-semibold text-gray-800 mb-2">Unable to load your account</h1>
        <p class="text-gray-500 mb-6">Your sign-in was successful, but the system is temporarily busy. Please try again.</p>
        <button type="button" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" @click="retry">Try again</button>
      </template>
      <template v-else>
        <div class="text-6xl font-bold text-red-400 mb-4">403</div>
        <h1 class="text-xl font-semibold text-gray-800 mb-2">Access Denied</h1>
        <p class="text-gray-500 mb-6">You do not have permission to view this page.</p>
        <RouterLink to="/dashboard" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Go to Dashboard</RouterLink>
      </template>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileUnavailable = computed(() => route.query.reason === 'profile-unavailable')

async function retry() {
  await authStore.fetchProfile()
  await router.replace('/dashboard')
}
</script>
