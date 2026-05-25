<template>
  <div class="flex items-end gap-2 h-24 pt-2">
    <div v-for="item in data" :key="item.label" class="flex-1 flex flex-col items-center gap-1">
      <div class="w-full rounded-t transition-all duration-500 bg-blue-500"
        :style="{ height: maxCount ? (item.count / maxCount * 80) + 'px' : '4px', minHeight: '4px', opacity: 0.7 }"></div>
      <span class="text-[9px] text-gray-400">{{ item.label }}</span>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Array, default: () => [] }, type: String })
const maxCount = computed(() => Math.max(...props.data.map(d => d.count || 0), 1))
</script>
