<template>
  <section class="pui-card" style="overflow:hidden;">
    <div class="pui-card-header">
      <div>
        <h2 class="pui-card-title">{{ title }}</h2>
        <p v-if="subtitle" class="pui-card-subtitle">{{ subtitle }}</p>
      </div>

      <div class="pui-row pui-row-wrap">
        <slot name="filters" />

        <div v-if="searchable">
          <label :for="searchId" class="pui-sr-only">{{ searchLabel }}</label>
          <input
            :id="searchId"
            :value="search"
            type="search"
            class="pui-input"
            style="width:240px;"
            :placeholder="searchPlaceholder"
            @input="onSearchInput"
          />
        </div>

        <slot name="actions" />
      </div>
    </div>

    <div v-if="lastUpdated" style="padding:6px 16px; background:#f8fafc; border-bottom:1px solid #eef2f7; display:flex; align-items:center; gap:10px;">
      <span style="font-size:11px; font-weight:700; color:#64748b;">Last updated {{ lastUpdated }}</span>
      <button v-if="refreshable" type="button" style="font-size:11px; font-weight:800; color:#1d4ed8; background:none; border:0; cursor:pointer; padding:0;" :disabled="loading" @click="$emit('refresh')">
        Refresh
      </button>
    </div>

    <SkeletonRows v-if="loading" :rows="skeletonRows" :aria-label="`Loading ${title}`" />

    <div v-else-if="error" class="pui-alert pui-alert-error" style="margin:16px;" role="alert">
      <p class="pui-alert-title">{{ errorTitle }}</p>
      <p>{{ error }}</p>
      <button v-if="refreshable" type="button" class="pui-btn pui-btn-sm" style="margin-top:10px;" @click="$emit('refresh')">Try again</button>
    </div>

    <EmptyState v-else-if="empty" :title="emptyTitle" :description="emptyDescription">
      <template v-if="$slots.emptyAction" #action><slot name="emptyAction" /></template>
    </EmptyState>

    <div v-else class="pui-table-wrap">
      <slot />
    </div>

    <div v-if="!loading && !error && !empty && $slots.footer" style="padding:10px 16px; border-top:1px solid #eef2f7; background:#fafcff;">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup>
import SkeletonRows from './SkeletonRows.vue'
import EmptyState from './EmptyState.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  errorTitle: { type: String, default: 'This list could not be loaded' },
  empty: { type: Boolean, default: false },
  emptyTitle: { type: String, default: 'Nothing to show yet' },
  emptyDescription: { type: String, default: '' },
  searchable: { type: Boolean, default: false },
  search: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Search...' },
  searchLabel: { type: String, default: 'Search this list' },
  skeletonRows: { type: Number, default: 5 },
  lastUpdated: { type: String, default: '' },
  refreshable: { type: Boolean, default: false }
})

const emit = defineEmits(['update:search', 'refresh'])
const searchId = `panel-search-${Math.random().toString(36).slice(2, 9)}`

// Debounced upward so a keystroke does not fire a request per character.
let debounce = null
function onSearchInput(event) {
  const value = event.target.value
  clearTimeout(debounce)
  debounce = setTimeout(() => emit('update:search', value), 300)
}
</script>
