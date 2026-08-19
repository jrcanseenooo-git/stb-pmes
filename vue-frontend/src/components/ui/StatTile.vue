<template>
  <div class="pui-stat">
    <div class="pui-stat-top">
      <span class="pui-stat-label">{{ label }}</span>
      <span v-if="hint" class="pui-stat-hint">{{ hint }}</span>
    </div>
    <div class="pui-stat-value-row">
      <strong :class="['pui-stat-value', toneClass]">{{ displayValue }}</strong>
      <span v-if="total !== null" class="pui-stat-total">/ {{ total }}</span>
    </div>
    <p v-if="caption" class="pui-stat-caption">{{ caption }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: 0 },
  total: { type: [String, Number], default: null },
  caption: { type: String, default: '' },
  hint: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  tone: { type: String, default: 'default' } // default | good | warn | bad
})

const TONES = {
  default: '',
  good: 'pui-stat-value-good',
  warn: 'pui-stat-value-warn',
  bad: 'pui-stat-value-bad'
}

const displayValue = computed(() => (props.loading ? '-' : props.value))
const toneClass = computed(() => (props.loading ? 'pui-stat-value-loading' : TONES[props.tone] || ''))
</script>
