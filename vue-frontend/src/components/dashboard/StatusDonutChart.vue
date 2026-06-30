<template>
  <div class="flex items-center justify-center gap-6">
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="45" fill="none" stroke="#E2E8F0" stroke-width="16"/>
      <circle cx="60" cy="60" r="45" fill="none" stroke="#27AE60" stroke-width="16"
        :stroke-dasharray="`${completed} ${circumference}`" stroke-dashoffset="0"/>
      <text x="60" y="55" text-anchor="middle" font-size="18" font-weight="bold" fill="#1A2332" font-family="DM Mono,monospace">{{ total }}</text>
      <text x="60" y="70" text-anchor="middle" font-size="9" fill="#718096" font-family="Inter,system-ui,sans-serif">targets</text>
    </svg>
    <div class="space-y-2">
      <div v-for="item in data" :key="item.status" class="flex items-center gap-2 text-xs text-gray-600">
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: colorMap[item.status] || '#E2E8F0' }"></div>
        {{ item.status }} ({{ item.count }})
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Array, default: () => [] } })
const circumference = Math.PI * 2 * 45
const total = computed(() => props.data.reduce((s, d) => s + (d.count || 0), 0))
const completed = computed(() => {
  const c = props.data.find(d => d.status === 'Completed')
  return total.value ? ((c?.count || 0) / total.value) * circumference : 0
})
const colorMap = { Completed: '#27AE60', Ongoing: '#2F80ED', 'For Revision': '#F2994A', Delayed: '#EB5757', 'Not Started': '#CBD5E0' }
</script>
