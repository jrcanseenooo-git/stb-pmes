<template>
  <span :class="['badge-status', badgeClass]">
    <i :class="`ti ti-${icon} text-xs`"></i>
    {{ status }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: String
})

const config = {
  'Completed':    { class: 'badge-completed',    icon: 'check'           },
  'Ongoing':      { class: 'badge-ongoing',       icon: 'player-play'     },
  'Submitted':    { class: 'badge-submitted',     icon: 'upload'          },
  'For Revision': { class: 'badge-for-revision',  icon: 'refresh'         },
  'Approved':     { class: 'badge-approved',      icon: 'circle-check'    },
  'Delayed':      { class: 'badge-delayed',       icon: 'alert-triangle'  },
  'Not Started':  { class: 'badge-not-started',   icon: 'minus'           }
}

const badgeClass = computed(() => config[props.status]?.class ?? 'badge-not-started')
const icon       = computed(() => config[props.status]?.icon  ?? 'minus')
</script>
