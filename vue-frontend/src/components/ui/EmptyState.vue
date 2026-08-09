<template>
  <div class="px-6 py-10 text-center">
    <p class="text-sm font-bold text-slate-700">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Nothing to show yet' },
  description: { type: String, default: '' }
})
</script>
