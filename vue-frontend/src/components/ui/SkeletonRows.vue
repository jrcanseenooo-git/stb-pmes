<template>
  <div class="pui-skeleton" role="status" aria-live="polite" :aria-label="ariaLabel">
    <div v-for="n in rows" :key="n" class="pui-skeleton-row"></div>
    <span class="pui-sr-only">{{ ariaLabel }}</span>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 5 },
  ariaLabel: { type: String, default: 'Loading' }
})
</script>
