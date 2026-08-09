<template>
  <div>
    <div v-if="label || showValue" class="flex items-center justify-between gap-2 mb-1.5">
      <span class="text-xs font-bold text-slate-600 truncate">{{ label }}</span>
      <span v-if="showValue" class="text-xs font-extrabold text-slate-900 shrink-0">{{ percent }}%</span>
    </div>
    <div
      class="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label || 'Completion'"
    >
      <div :class="['h-full rounded-full transition-all duration-500', toneClass]" :style="{ width: percent + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  label: { type: String, default: '' },
  showValue: { type: Boolean, default: true },
  tone: { type: String, default: 'auto' } // auto | good | warn | bad | brand
})

const percent = computed(() => {
  if (!props.total) return 0
  return Math.min(100, Math.max(0, Math.round((props.value / props.total) * 100)))
})

const toneClass = computed(() => {
  if (props.tone === 'good') return 'bg-emerald-500'
  if (props.tone === 'warn') return 'bg-amber-500'
  if (props.tone === 'bad') return 'bg-red-500'
  if (props.tone === 'brand') return 'bg-blue-700'
  if (percent.value >= 80) return 'bg-emerald-500'
  if (percent.value >= 40) return 'bg-blue-700'
  return 'bg-amber-500'
})
</script>
