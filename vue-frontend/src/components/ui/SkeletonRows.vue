<template>
  <div class="p-4 space-y-2.5" role="status" aria-live="polite" :aria-label="ariaLabel">
    <div v-for="n in rows" :key="n" class="h-9 rounded-xl bg-slate-100 animate-pulse"></div>
    <span class="sr-only">{{ ariaLabel }}</span>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 5 },
  ariaLabel: { type: String, default: 'Loading' }
})
</script>
