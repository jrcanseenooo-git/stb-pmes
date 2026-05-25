<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
      <h2 class="text-base font-semibold text-gray-800 mb-4">Accomplishment Detail</h2>
      <pre class="text-xs text-gray-500 bg-gray-50 rounded p-3 overflow-auto max-h-64">{{ JSON.stringify(item, null, 2) }}</pre>
      <button class="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-sm" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>
<script setup>
defineProps({ item: Object })
defineEmits(['close'])
</script>
