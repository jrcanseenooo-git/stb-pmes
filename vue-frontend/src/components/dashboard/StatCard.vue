<template>
  <div :class="['card relative overflow-hidden', `border-t-2 border-t-${colorMap[color]}`]">
    <div class="card-body">
      <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{ label }}</p>
      <p class="text-2xl font-bold text-gray-800 font-mono leading-none">
        <span v-if="loading" class="inline-block w-12 h-6 bg-gray-100 rounded animate-pulse"></span>
        <span v-else>{{ value }}</span>
      </p>
      <p v-if="sub" :class="['text-xs mt-1.5', subClass]">{{ sub }}</p>
      <div :class="[`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center`, iconBg]">
        <i :class="`ti ti-${icon} text-base ${iconColor}`"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label:   String,
  value:   [String, Number],
  sub:     String,
  subType: { type: String, default: '' }, // 'up' | 'down' | ''
  icon:    String,
  color:   { type: String, default: 'blue' }, // blue | green | gold | red
  loading: Boolean
})

const colorMap = { blue: 'brand-500', green: 'green-500', gold: 'amber-400', red: 'red-400' }

const subClass = computed(() => ({
  'text-green-600': props.subType === 'up',
  'text-red-500':   props.subType === 'down',
  'text-gray-400':  !props.subType
}))

const iconBg = computed(() => ({
  'bg-blue-50':   props.color === 'blue',
  'bg-green-50':  props.color === 'green',
  'bg-amber-50':  props.color === 'gold',
  'bg-red-50':    props.color === 'red'
}))

const iconColor = computed(() => ({
  'text-brand-500':  props.color === 'blue',
  'text-green-600':  props.color === 'green',
  'text-amber-500':  props.color === 'gold',
  'text-red-500':    props.color === 'red'
}))
</script>
