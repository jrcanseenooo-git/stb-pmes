<template>
  <div class="content">
    <div class="card">
      <div class="card-hd">
        <span class="card-title">Audit Trail Log</span>
        <div class="flex-row gap-6">
          <div class="search-box">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/><path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/></svg>
            <input v-model="search" type="text" placeholder="Search logs..."/>
          </div>
          <button class="btn btn-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3.5 6l2.5 2 2.5-2M2 10h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Export
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Details</th></tr>
          </thead>
          <tbody>
            <tr v-for="(log, i) in filteredLogs" :key="i" :class="i%2===1?'stripe':''">
              <td class="mono text-xs">{{ log.timestamp }}</td>
              <td class="text-xs fw-500">{{ log.user }}</td>
              <td><span :class="['badge', log.roleClass]">{{ log.role }}</span></td>
              <td><span :class="['badge', log.actionClass]">{{ log.action }}</span></td>
              <td class="text-xs muted">{{ log.module }}</td>
              <td class="text-xs muted">{{ log.details }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="tbl-footer">
        <span class="text-xs muted">Showing {{ filteredLogs.length }} of {{ logs.length }} entries</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const search = ref('')

const logs = [
  { timestamp:'2025-05-11 09:14:22', user:'J. Reyes',  role:'Director',   roleClass:'badge-purple', action:'LOGIN',    actionClass:'badge-blue',   module:'Auth',            details:'Successful login via email' },
  { timestamp:'2025-05-10 14:02:11', user:'M. Santos', role:'Staff',      roleClass:'badge-gray',   action:'UPLOAD',   actionClass:'badge-green',  module:'MOV',             details:'Uploaded Q1_IPCR_Santos.pdf' },
  { timestamp:'2025-05-10 13:45:00', user:'R. Perez',  role:'Div. Chief', roleClass:'badge-blue',   action:'APPROVE',  actionClass:'badge-orange', module:'Accomplishments', details:'Approved Santos IPCR entry' },
  { timestamp:'2025-05-09 10:30:55', user:'R. Perez',  role:'Div. Chief', roleClass:'badge-blue',   action:'REVISION', actionClass:'badge-orange', module:'Accomplishments', details:'Requested revision — J. Cruz KRA3' },
  { timestamp:'2025-05-08 08:00:01', user:'System',    role:'Admin',      roleClass:'badge-red',    action:'NOTIF',    actionClass:'badge-gray',   module:'Notifications',   details:'Deadline alert sent to 17 users' }
]

const filteredLogs = computed(() => {
  if (!search.value) return logs
  const q = search.value.toLowerCase()
  return logs.filter(l =>
    l.user.toLowerCase().includes(q) ||
    l.action.toLowerCase().includes(q) ||
    l.module.toLowerCase().includes(q) ||
    l.details.toLowerCase().includes(q)
  )
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;}
.flex-row{display:flex;align-items:center;}
.gap-6{gap:6px;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.search-box{display:flex;align-items:center;gap:6px;background:#F7FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:5px 9px;}
.search-box input{border:none;background:transparent;font-size:11px;color:#1A2332;width:150px;outline:none;font-family:'DM Sans',sans-serif;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:'DM Sans',sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-sm{padding:4px 9px;font-size:10px;}
.table-wrap{overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{padding:8px 12px;text-align:left;color:#718096;font-weight:500;border-bottom:1px solid #E2E8F0;font-size:10px;text-transform:uppercase;letter-spacing:.3px;background:#F7FAFC;white-space:nowrap;}
.tbl td{padding:9px 12px;border-bottom:1px solid #E2E8F0;color:#4A5568;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#F7FAFC;}
.stripe td{background:rgba(47,128,237,.03);}
.tbl-footer{padding:8px 14px;border-top:1px solid #E2E8F0;}
.mono{font-family:'DM Mono',monospace;}
.text-xs{font-size:10px;}.muted{color:#718096;}.fw-500{font-weight:500;}
.badge{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-blue  {background:#EBF4FF;color:#1A56B0;}
.badge-green {background:#E6F4EA;color:#1E7E34;}
.badge-orange{background:#FEF3E2;color:#B35A0F;}
.badge-gray  {background:#F0F4F8;color:#4A5568;}
.badge-red   {background:#FDECEC;color:#C0392B;}
.badge-purple{background:#F3EEFF;color:#6B3FA0;}
</style>