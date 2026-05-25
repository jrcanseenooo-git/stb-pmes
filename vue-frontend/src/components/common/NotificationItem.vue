<template>
  <div class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer" @click="$emit('read')">
    <div class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" v-if="!notification.read"></div>
    <div class="w-2 h-2 flex-shrink-0 mt-1.5" v-else></div>
    <div>
      <p class="text-xs text-gray-700">{{ notification.message }}</p>
      <p class="text-[10px] text-gray-400 mt-1">{{ notification.createdAt }}</p>
    </div>
  </div>
</template>
<script setup>
defineProps({ notification: Object })
defineEmits(['read'])
</script>
