<template>
  <div class="content">
    <div class="flex-row jc-sb mb-12">
      <div class="pill-tabs">
        <div v-for="d in divTabs" :key="d" :class="['pill', activeDiv===d&&'active']" @click="activeDiv=d">{{ d }}</div>
      </div>
      <button class="btn btn-primary">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        New Entry
      </button>
    </div>

    <div class="card">
      <div class="card-hd">
        <span class="card-title">Accomplishment Tracker — Q1 2025</span>
        <div class="flex-row gap-6">
          <button class="btn btn-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Status
          </button>
          <button class="btn btn-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4-3 4 3M2 8l4 3 4-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Sort
          </button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Employee</th><th>Division</th><th>KRA</th><th>Target / SI</th>
              <th>Progress</th><th>Status</th><th>Deadline</th><th>MOV</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="i" :class="i%2===1?'stripe':''">
              <td>
                <div class="flex-row gap-6">
                  <div class="av" :style="{ background: row.avatarColor }">{{ row.initials }}</div>
                  <span>{{ row.name }}</span>
                </div>
              </td>
              <td><span class="chip">{{ row.division }}</span></td>
              <td class="text-xs muted">{{ row.kra }}</td>
              <td class="text-xs">{{ row.target }}</td>
              <td>
                <div class="flex-row gap-6">
                  <div class="prog-track"><div class="prog-fill" :style="{ width: row.pct+'%', background: row.progColor }"></div></div>
                  <span class="text-xs">{{ row.progress }}</span>
                </div>
              </td>
              <td><span :class="['status-badge', row.statusClass]">{{ row.status }}</span></td>
              <td :class="['text-xs', row.overdue?'overdue':'muted']">{{ row.deadline }}{{ row.overdue?' ⚠':''}}</td>
              <td><span :class="['badge', row.movClass]">{{ row.mov }}</span></td>
              <td>
                <button :class="['btn btn-xs', row.actionDanger?'danger':'']" @click="handleAction(row)">
                  {{ row.action }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeDiv = ref('All Divisions')
const divTabs = ['All Divisions','Admin Pool','Design Formulation','Pilot Implementation']

const rows = [
  { initials:'MS', name:'M. Santos',    avatarColor:'#2F80ED', division:'Admin Pool',  kra:'Admin Support',   target:'Conduct 4 staff trainings',    pct:100, progress:'4/4', progColor:'#27AE60', status:'Completed',    statusClass:'s-green',  deadline:'May 30', overdue:false, mov:'3 files', movClass:'badge-blue',   action:'View',   actionDanger:false },
  { initials:'JC', name:'J. Cruz',      avatarColor:'#27AE60', division:'Design Form.', kra:'Program Planning',target:'Submit draft M&E framework',   pct:60,  progress:'60%', progColor:'#2F80ED', status:'For Revision', statusClass:'s-orange', deadline:'Jun 15', overdue:false, mov:'1 file',  movClass:'badge-gray',   action:'Review', actionDanger:false },
  { initials:'RD', name:'R. Dela Cruz', avatarColor:'#E9A840', division:'Pilot Impl.', kra:'Pilot Monitoring', target:'Pilot test 2 barangays',        pct:50,  progress:'1/2', progColor:'#E9A840', status:'Ongoing',      statusClass:'s-blue',   deadline:'Jun 30', overdue:false, mov:'2 files', movClass:'badge-gray',   action:'View',   actionDanger:false },
  { initials:'AL', name:'A. Lim',       avatarColor:'#EB5757', division:'STAE Div.',   kra:'Research & Docs', target:'Finalize evaluation report',    pct:20,  progress:'20%', progColor:'#EB5757', status:'Delayed',      statusClass:'s-red',    deadline:'Apr 30', overdue:true,  mov:'0 files', movClass:'badge-gray',   action:'Flag',   actionDanger:true  },
  { initials:'PG', name:'P. Garcia',    avatarColor:'#9B59B6', division:'Admin Pool',  kra:'Admin Support',   target:'Update operations manual',      pct:0,   progress:'0%',  progColor:'#E2E8F0', status:'Not Started',  statusClass:'s-gray',   deadline:'Jul 15', overdue:false, mov:'0 files', movClass:'badge-gray',   action:'Start',  actionDanger:false }
]

function handleAction(row) { console.log('Action:', row.action, row.name) }
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;}
.flex-row{display:flex;align-items:center;}
.jc-sb{justify-content:space-between;}
.gap-6{gap:6px;}
.mb-12{margin-bottom:12px;}
.pill-tabs{display:flex;gap:4px;flex-wrap:wrap;}
.pill{padding:4px 12px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;color:#718096;transition:all .15s;}
.pill.active{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:'DM Sans',sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-primary{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn-primary:hover{background:#1a6cd4;color:#fff;}
.btn-sm{padding:3px 8px;font-size:10px;}
.btn-xs{padding:2px 8px;font-size:10px;}
.btn-xs.danger{border-color:#EB5757;color:#EB5757;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.table-wrap{overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{padding:8px 10px;text-align:left;color:#718096;font-weight:500;border-bottom:1px solid #E2E8F0;white-space:nowrap;font-size:10px;text-transform:uppercase;letter-spacing:.3px;background:#F7FAFC;}
.tbl td{padding:9px 10px;border-bottom:1px solid #E2E8F0;color:#4A5568;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#F7FAFC;}
.stripe td{background:rgba(47,128,237,.03);}
.av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;flex-shrink:0;}
.chip{display:inline-flex;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:500;background:#F7FAFC;border:1px solid #E2E8F0;color:#718096;}
.text-xs{font-size:10px;}
.muted{color:#718096;}
.overdue{color:#EB5757;font-weight:500;}
.prog-track{width:60px;height:6px;background:#EDF2F7;border-radius:4px;overflow:hidden;flex-shrink:0;}
.prog-fill{height:100%;border-radius:4px;transition:width .5s;}
.badge{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-blue{background:#EBF4FF;color:#1A56B0;}
.badge-gray{background:#F0F4F8;color:#4A5568;}
/* Status badges */
.status-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.s-green {background:#E6F4EA;color:#1E7E34;}
.s-blue  {background:#EBF4FF;color:#1A56B0;}
.s-orange{background:#FEF3E2;color:#B35A0F;}
.s-red   {background:#FDECEC;color:#C0392B;}
.s-gray  {background:#F0F4F8;color:#4A5568;}
</style>