<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <div class="text-6xl font-bold text-gray-300 mb-4">404</div>
      <h1 class="text-xl font-semibold text-gray-800 mb-2">Page Not Found</h1>
      <p class="text-gray-500 mb-6">The page you are looking for does not exist.</p>
      <RouterLink to="/dashboard" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Go to Dashboard</RouterLink>
    </div>
  </div>
</template>
<script setup>
import { RouterLink } from 'vue-router'
</script>
