<template>
  <div class="pui-page">
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

    <section class="pui-card" style="padding:20px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:52px; height:52px; border-radius:14px; background:#0b3b75; color:#fff; display:grid; place-items:center; font-size:17px; font-weight:800; flex-shrink:0;">
          {{ authStore.initials || 'U' }}
        </div>
        <div style="min-width:0;">
          <h2 style="margin:0; font-size:17px; font-weight:800; color:#0f172a;">{{ authStore.fullName || '—' }}</h2>
          <p style="margin:2px 0 0; font-size:12px; color:#64748b;">{{ authStore.position }}</p>
        </div>
        <div style="margin-left:auto; flex-shrink:0;">
          <StatusPill :status="authStore.isActive ? 'ACTIVE' : 'INACTIVE'" />
        </div>
      </div>
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Assessment Record</h2>
      </div>
      <dl style="margin:0; padding:0;">
        <div
          v-for="field in fields"
          :key="field.label"
          style="padding:11px 16px; border-top:1px solid #eef2f7; display:grid; grid-template-columns:1fr 2fr; gap:6px 16px;"
        >
          <dt style="font-size:11.5px; font-weight:800; color:#64748b; margin:0;">{{ field.label }}</dt>
          <dd style="font-size:13px; color:#334155; margin:0; word-break:break-word;">{{ field.value || '—' }}</dd>
        </div>
      </dl>
    </section>

    <section class="pui-alert pui-alert-info">
      <p style="line-height:1.55; margin:0;">
        <b style="color:#1e3a8a;">Need a correction?</b>
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
