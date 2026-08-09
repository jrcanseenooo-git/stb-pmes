<template>
  <div class="pui-empty">
    <p class="pui-empty-title">{{ title }}</p>
    <p v-if="description" class="pui-empty-desc">{{ description }}</p>
    <div v-if="$slots.action" style="margin-top:14px; display:flex; justify-content:center;">
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
