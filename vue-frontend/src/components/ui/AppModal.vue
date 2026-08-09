<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[80] grid place-items-center p-5 bg-slate-900/45"
    @click.self="requestClose"
  >
    <div
      ref="panel"
      class="card w-full max-h-full overflow-auto p-5 grid gap-4 shadow-2xl"
      :style="{ maxWidth: width }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown.esc.stop.prevent="requestClose"
      @keydown.tab="trapFocus"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 :id="titleId" class="text-base font-extrabold text-slate-900">{{ title }}</h2>
          <p v-if="description" class="text-xs text-slate-500 mt-1">{{ description }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-extrabold hover:bg-slate-200"
          aria-label="Close dialog"
          @click="requestClose"
        >
          &times;
        </button>
      </div>

      <slot />

      <div v-if="$slots.footer" class="flex justify-end gap-2 flex-wrap">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  width: { type: String, default: '620px' },
  // Blocks Esc and backdrop dismissal while a save is in flight, so a user
  // cannot lose typed values by tapping outside mid-request.
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const panel = ref(null)
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`
let previouslyFocused = null

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function requestClose() {
  if (props.busy) return
  emit('close')
}

function focusableItems() {
  if (!panel.value) return []
  return Array.from(panel.value.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null)
}

function trapFocus(event) {
  const items = focusableItems()
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.show, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement
    await nextTick()
    const items = focusableItems()
    if (items.length) items[0].focus()
    else panel.value?.focus()
  } else if (previouslyFocused?.focus) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
})

onBeforeUnmount(() => {
  if (previouslyFocused?.focus) previouslyFocused.focus()
})
</script>
