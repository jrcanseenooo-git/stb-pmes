<template>
  <div class="card px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{{ label }}</span>
      <span v-if="hint" class="text-[10px] font-bold text-slate-400">{{ hint }}</span>
    </div>
    <div class="mt-1.5 flex items-baseline gap-1.5">
      <strong :class="['text-2xl font-extrabold leading-none', toneClass]">{{ displayValue }}</strong>
      <span v-if="total !== null" class="text-xs font-bold text-slate-400">/ {{ total }}</span>
    </div>
    <p v-if="caption" class="mt-1 text-[11px] text-slate-500 leading-snug">{{ caption }}</p>
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
  default: 'text-slate-900',
  good: 'text-emerald-700',
  warn: 'text-amber-600',
  bad: 'text-red-700'
}

const displayValue = computed(() => (props.loading ? '—' : props.value))
const toneClass = computed(() => (props.loading ? 'text-slate-300' : TONES[props.tone] || TONES.default))
</script>
