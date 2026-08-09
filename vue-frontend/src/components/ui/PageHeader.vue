<template>
  <header class="card px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
    <div class="min-w-0">
      <p v-if="kicker" class="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 mb-1">{{ kicker }}</p>
      <h1 class="text-xl font-extrabold text-slate-900 leading-tight truncate">{{ title }}</h1>
      <p v-if="subtitle" class="text-xs text-slate-500 mt-1">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  kicker: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>
