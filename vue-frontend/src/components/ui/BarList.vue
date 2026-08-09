<template>
  <section class="card overflow-hidden">
    <div class="card-header !px-4 !py-3">
      <div class="min-w-0">
        <h2 class="card-title">{{ title }}</h2>
        <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>

    <SkeletonRows v-if="loading" :rows="4" :aria-label="`Loading ${title}`" />

    <EmptyState
      v-else-if="!items.length"
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <!-- A labelled bar list rather than a chart library: it reads correctly at
         any width, survives long office and unit names, and stays legible when
         printed. Each row also states its numbers, so the bar is decoration
         rather than the only way to read the value. -->
    <ul v-else class="p-4 grid gap-3.5">
      <li v-for="item in items" :key="item.label">
        <div class="flex items-baseline justify-between gap-3 mb-1.5">
          <span class="text-xs font-bold text-slate-700 truncate" :title="item.label">{{ item.label }}</span>
          <span class="text-xs font-extrabold text-slate-900 shrink-0 tabular-nums">
            {{ item.completed }}<span class="text-slate-400">/{{ item.total }}</span>
            <span class="ml-1.5 text-slate-500">{{ item.completionRate }}%</span>
          </span>
        </div>
        <ProgressBar :value="item.completed" :total="item.total" :show-value="false" />
      </li>
    </ul>
  </section>
</template>

<script setup>
import ProgressBar from './ProgressBar.vue'
import SkeletonRows from './SkeletonRows.vue'
import EmptyState from './EmptyState.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyTitle: { type: String, default: 'No data for this period' },
  emptyDescription: { type: String, default: '' }
})
</script>
