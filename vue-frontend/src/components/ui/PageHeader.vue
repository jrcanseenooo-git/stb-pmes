<template>
  <header class="pui-header">
    <div>
      <p v-if="kicker" class="pui-header-kicker">{{ kicker }}</p>
      <h1 class="pui-header-title">{{ title }}</h1>
      <p v-if="subtitle" class="pui-header-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="pui-header-actions">
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
