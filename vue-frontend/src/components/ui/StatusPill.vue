<template>
  <span :class="['pui-badge', toneClass]">{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: [String, Number], default: '' },
  label: { type: String, default: '' }
})

// Neutral, non-punitive wording. Section 36 of the cluster specification bans
// labels that read as a judgement of the employee - these describe the record.
const LABELS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PENDING: 'Pending',
  PENDING_VALIDATION: 'For Validation',
  REJECTED: 'Not Accepted',
  ARCHIVED: 'Archived',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  COMPLETED: 'Completed',
  REOPENED: 'Reopened',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  FOR_VALIDATION: 'Ready to Activate',
  NOT_PROVISIONED: 'Not Created',
  PROVISIONING: 'Creating',
  INVALID_SCHEMA: 'Needs Repair',
  INACCESSIBLE: 'Cannot Access',
  SUSPENDED: 'Suspended',
  FOR_CONFIGURATION: 'Configuration Required',
  ON_TRACK: 'On Track',
  FOR_ATTENTION: 'For Attention'
}

const GOOD = ['ACTIVE', 'COMPLETED', 'SUBMITTED', 'ON_TRACK']
const WARN = ['PENDING', 'PENDING_VALIDATION', 'DRAFT', 'REOPENED', 'FOR_VALIDATION', 'PROVISIONING', 'FOR_CONFIGURATION', 'FOR_ATTENTION']
const BAD  = ['REJECTED', 'INVALID_SCHEMA', 'INACCESSIBLE', 'EXPIRED', 'SUSPENDED']

const key = computed(() => String(props.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_'))
const display = computed(() => props.label || LABELS[key.value] || props.status || '-')

const toneClass = computed(() => {
  if (GOOD.includes(key.value)) return 'pui-badge-good'
  if (WARN.includes(key.value)) return 'pui-badge-warn'
  if (BAD.includes(key.value)) return 'pui-badge-bad'
  return 'pui-badge-neutral'
})
</script>
