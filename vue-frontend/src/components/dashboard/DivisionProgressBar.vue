<template>
  <div>
    <div class="flex items-center justify-between mb-1">
      <span class="text-sm font-medium text-gray-700">{{ name }}</span>
      <span class="text-xs text-gray-500">{{ rate }}%</span>
    </div>
    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div class="h-full rounded-full transition-all duration-500" :style="{ width: rate + '%', background: barColor }"></div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ name: String, rate: Number, color: String })
const barColor = computed(() => ({
  green: '#27AE60', blue: '#2F80ED', gold: '#E9A840', red: '#EB5757'
})[props.color] || '#2F80ED')
</script>
