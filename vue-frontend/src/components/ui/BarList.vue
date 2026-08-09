<template>
  <section class="pui-card" style="overflow:hidden;">
    <div class="pui-card-header">
      <div>
        <h2 class="pui-card-title">{{ title }}</h2>
        <p v-if="subtitle" class="pui-card-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>

    <SkeletonRows v-if="loading" :rows="4" :aria-label="`Loading ${title}`" />

    <EmptyState v-else-if="!items.length" :title="emptyTitle" :description="emptyDescription" />

    <!-- A labelled bar list rather than a chart library: it reads correctly at
         any width, survives long office and unit names, and stays legible when
         printed. Each row also states its numbers, so the bar is decoration
         rather than the only way to read the value. -->
    <ul v-else style="list-style:none; margin:0; padding:16px; display:grid; gap:14px;">
      <li v-for="item in items" :key="item.label" class="pui-barlist-row">
        <div class="pui-barlist-head">
          <span class="pui-barlist-label" :title="item.label">{{ item.label }}</span>
          <span class="pui-barlist-value">
            {{ item.completed }}<span class="pui-muted">/{{ item.total }}</span>
            <span class="pui-muted" style="margin-left:6px;">{{ item.completionRate }}%</span>
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
