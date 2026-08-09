<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <!--
      Read-only personal information for participating-office personnel.
      Deliberately excluded per the cluster specification: the Account Settings
      card, profile editing, notification preferences, and all account-management
      functions. Corrections go through the Office Administrator.
    -->
    <PageHeader
      kicker="My Account"
      title="Personal Information"
      subtitle="Your assessment record for this office. These details are maintained by your office administrator."
    />

    <section class="card p-5">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-blue-700 text-white grid place-items-center text-lg font-extrabold shrink-0">
          {{ authStore.initials || 'U' }}
        </div>
        <div class="min-w-0">
          <h2 class="text-lg font-extrabold text-slate-900 truncate">{{ authStore.fullName || '—' }}</h2>
          <p class="text-xs text-slate-500 mt-0.5 truncate">{{ authStore.position }}</p>
        </div>
        <div class="ml-auto shrink-0">
          <StatusPill :status="authStore.isActive ? 'ACTIVE' : 'INACTIVE'" />
        </div>
      </div>
    </section>

    <section class="card overflow-hidden">
      <div class="card-header !px-4 !py-3">
        <h2 class="card-title">Assessment Record</h2>
      </div>
      <dl class="divide-y divide-slate-100">
        <div v-for="field in fields" :key="field.label" class="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
          <dt class="text-xs font-extrabold text-slate-500">{{ field.label }}</dt>
          <dd class="sm:col-span-2 text-sm text-slate-800 break-words">{{ field.value || '—' }}</dd>
        </div>
      </dl>
    </section>

    <section class="card p-4 bg-slate-50">
      <p class="text-xs text-slate-600 leading-relaxed">
        <b class="text-slate-800">Need a correction?</b>
        Personnel details, organizational assignment and supervisor information are validated by your
        office administrator. Contact them to request a change — these fields cannot be edited here.
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBranding } from '@/composables/useBranding'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusPill from '@/components/ui/StatusPill.vue'

const authStore = useAuthStore()
const { officeName } = useBranding()

const currentPeriod = computed(() => {
  const now = new Date()
  const semester = now.getMonth() < 6 ? 1 : 2
  return `Semester ${semester} · ${now.getFullYear()}`
})

const fields = computed(() => [
  { label: 'Full Name', value: authStore.fullName },
  { label: 'Employee No.', value: authStore.employeeNo },
  { label: 'Official Email', value: authStore.profile?.email },
  { label: 'Office', value: officeName.value },
  { label: 'Division / Unit', value: authStore.divisionName },
  { label: 'Section', value: authStore.profile?.section },
  { label: 'Position', value: authStore.position },
  { label: 'Immediate Supervisor', value: authStore.profile?.supervisorName },
  { label: 'Account Status', value: authStore.isActive ? 'Active' : 'Inactive' },
  { label: 'Current Assessment Period', value: currentPeriod.value }
])
</script>
