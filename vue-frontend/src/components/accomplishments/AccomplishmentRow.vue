<template>
  <tr class="hover:bg-gray-50 transition-colors">
    <!-- Employee -->
    <td>
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
             :style="{ background: avatarColor }">
          {{ initials }}
        </div>
        <span class="font-medium text-gray-800 text-sm whitespace-nowrap">{{ item.employeeName }}</span>
      </div>
    </td>
    <!-- Division -->
    <td><span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{{ item.division }}</span></td>
    <!-- KRA -->
    <td class="text-xs text-gray-500 max-w-[120px] truncate">{{ item.kraTitle }}</td>
    <!-- Target -->
    <td class="text-xs text-gray-700 max-w-[180px]">{{ item.target }}</td>
    <!-- Progress -->
    <td>
      <div class="flex items-center gap-2 min-w-[90px]">
        <div class="progress-track flex-1">
          <div
            class="progress-fill"
            :style="{ width: `${item.progressPct}%`, background: progressColor }"
          ></div>
        </div>
        <span class="text-xs text-gray-500 tabular-nums">{{ item.progressPct }}%</span>
      </div>
    </td>
    <!-- Status -->
    <td><StatusBadge :status="item.status" /></td>
    <!-- Deadline -->
    <td :class="['text-xs tabular-nums', isOverdue ? 'text-red-500 font-medium' : 'text-gray-500']">
      {{ formattedDeadline }}
      <span v-if="isOverdue" class="ml-1">⚠</span>
    </td>
    <!-- MOV -->
    <td>
      <span :class="['text-xs font-medium', item.movCount ? 'text-brand-500' : 'text-gray-400']">
        {{ item.movCount ?? 0 }} file{{ item.movCount !== 1 ? 's' : '' }}
      </span>
    </td>
    <!-- Actions -->
    <td>
      <div class="flex items-center gap-1">
        <button class="btn-secondary text-xs py-0.5 px-2" @click="$emit('view', item)">
          <i class="ti ti-eye text-xs"></i>
        </button>
        <button
          v-if="canApprove && item.status === 'Submitted'"
          class="text-xs px-2 py-0.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
          @click="$emit('approve', item)"
        >✓</button>
        <button
          v-if="canApprove && item.status === 'Submitted'"
          class="text-xs px-2 py-0.5 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
          @click="$emit('revision', item)"
        >↩</button>
      </div>
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/router'
import StatusBadge from '@/components/common/StatusBadge.vue'
import dayjs from 'dayjs'

const props = defineProps({ item: Object })
defineEmits(['approve', 'revision', 'view'])

const authStore = useAuthStore()

const canApprove = computed(() =>
  [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.ASST_DIR, ROLES.DIV_CHIEF].includes(authStore.role)
)

const initials = computed(() =>
  (props.item.employeeName ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
)

const avatarColors = ['#2F80ED','#27AE60','#E9A840','#EB5757','#9B59B6','#1ABC9C']
const avatarColor  = computed(() =>
  avatarColors[Math.abs(hashStr(props.item.employeeName ?? '')) % avatarColors.length]
)

function hashStr(s) {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

const formattedDeadline = computed(() =>
  props.item.deadline ? dayjs(props.item.deadline).format('MMM D') : '-'
)

const isOverdue = computed(() =>
  props.item.deadline && dayjs().isAfter(dayjs(props.item.deadline)) && props.item.status !== 'Completed'
)

const progressColor = computed(() => {
  const p = props.item.progressPct ?? 0
  if (p >= 80) return '#27AE60'
  if (p >= 50) return '#2F80ED'
  if (p >= 20) return '#E9A840'
  return '#EB5757'
})
</script>
