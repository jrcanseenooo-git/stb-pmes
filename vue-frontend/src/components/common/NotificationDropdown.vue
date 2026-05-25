<template>
  <div class="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
    <div class="p-3 border-b border-gray-100 flex items-center justify-between">
      <span class="text-sm font-semibold text-gray-800">Notifications</span>
      <button class="text-xs text-blue-500 hover:underline" @click="$emit('close')">Close</button>
    </div>
    <div class="p-3 text-sm text-gray-400 text-center">No new notifications.</div>
  </div>
</template>
<script setup>
defineEmits(['close'])
</script>
