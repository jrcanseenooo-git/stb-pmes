<template>
  <div v-if="show" class="pui-modal-overlay" @click.self="requestClose">
    <div
      ref="panel"
      :class="['pui-modal', wide && 'pui-modal-wide']"
      :style="{ maxWidth: width }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown.esc.stop.prevent="requestClose"
      @keydown.tab="trapFocus"
    >
      <div class="pui-modal-hd">
        <div>
          <h2 :id="titleId" class="pui-modal-title">{{ title }}</h2>
          <p v-if="description" class="pui-modal-desc">{{ description }}</p>
        </div>
        <button type="button" class="pui-modal-close" aria-label="Close dialog" @click="requestClose">
          &times;
        </button>
      </div>

      <slot />

      <div v-if="$slots.footer" class="pui-modal-actions">
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
  width: { type: String, default: '' },
  wide: { type: Boolean, default: false },
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
