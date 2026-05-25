<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
      <h2 class="text-base font-semibold text-gray-800 mb-4">New Accomplishment Entry</h2>
      <p class="text-sm text-gray-400 mb-6">Form coming soon.</p>
      <button class="px-4 py-2 bg-gray-100 rounded-lg text-sm" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>
<script setup>
defineEmits(['close', 'saved'])
</script>
