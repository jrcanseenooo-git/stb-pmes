<template>
  <div>
    <div v-if="label || showValue" class="pui-progress-head">
      <span class="pui-progress-label">{{ label }}</span>
      <span v-if="showValue" class="pui-progress-value">{{ percent }}%</span>
    </div>
    <div
      class="pui-progress-track"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label || 'Completion'"
    >
      <div :class="['pui-progress-fill', toneClass]" :style="{ width: percent + '%' }"></div>
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
  if (props.tone === 'good') return 'pui-progress-fill-good'
  if (props.tone === 'warn') return 'pui-progress-fill-warn'
  if (props.tone === 'bad') return 'pui-progress-fill-bad'
  if (props.tone === 'brand') return ''
  if (percent.value >= 80) return 'pui-progress-fill-good'
  if (percent.value >= 40) return ''
  return 'pui-progress-fill-warn'
})
</script>
