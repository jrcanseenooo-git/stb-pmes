<template>
  <section class="card overflow-hidden">
    <div class="card-header !px-4 !py-3 flex-wrap gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-extrabold text-slate-900">{{ title }}</h2>
        <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5">{{ subtitle }}</p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <slot name="filters" />

        <div v-if="searchable" class="relative">
          <label :for="searchId" class="sr-only">{{ searchLabel }}</label>
          <input
            :id="searchId"
            :value="search"
            type="search"
            class="form-input !py-1.5 !w-full sm:!w-64"
            :placeholder="searchPlaceholder"
            @input="onSearchInput"
          />
        </div>

        <slot name="actions" />
      </div>
    </div>

    <div v-if="lastUpdated" class="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
      <span class="text-[11px] font-bold text-slate-500">Last updated {{ lastUpdated }}</span>
      <button v-if="refreshable" type="button" class="text-[11px] font-extrabold text-blue-700 hover:underline" :disabled="loading" @click="$emit('refresh')">
        Refresh
      </button>
    </div>

    <SkeletonRows v-if="loading" :rows="skeletonRows" :aria-label="`Loading ${title}`" />

    <div v-else-if="error" class="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3" role="alert">
      <p class="text-sm font-bold text-red-800">{{ errorTitle }}</p>
      <p class="mt-0.5 text-xs text-red-700 leading-relaxed">{{ error }}</p>
      <button v-if="refreshable" type="button" class="btn-secondary mt-3 !py-1.5" @click="$emit('refresh')">Try again</button>
    </div>

    <EmptyState v-else-if="empty" :title="emptyTitle" :description="emptyDescription">
      <template v-if="$slots.emptyAction" #action><slot name="emptyAction" /></template>
    </EmptyState>

    <div v-else class="overflow-x-auto">
      <slot />
    </div>

    <div v-if="!loading && !error && !empty && $slots.footer" class="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
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
