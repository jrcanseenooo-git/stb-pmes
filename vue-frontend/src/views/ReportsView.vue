<template>
  <div class="content">
    <div class="grid-2">
      <!-- Generate -->
      <div class="card">
        <div class="card-hd"><span class="card-title">Generate Report</span></div>
        <div class="card-body form-body">
          <div class="field">
            <label class="field-label">Report Type</label>
            <select v-model="form.type" class="field-select">
              <option>IPCR Accomplishment Report</option>
              <option>CCEF Targets Report</option>
              <option>Quarterly Monitoring Report</option>
              <option>Semestral Performance Report</option>
              <option>Division Performance Report</option>
              <option>Delayed Submission Report</option>
              <option>Bureau-Wide Analytics</option>
            </select>
          </div>
          <div class="grid-2-sm">
            <div class="field">
              <label class="field-label">Division</label>
              <select v-model="form.division" class="field-select">
                <option>All Divisions</option>
                <option>Admin Pool</option>
                <option>Design Formulation</option>
                <option>Pilot Implementation</option>
                <option>STAE Division</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Period</label>
              <select v-model="form.period" class="field-select">
                <option>Semester 1 (2025)</option>
                <option>Semester 2 (2024)</option>
                <option>Q1 2025</option>
                <option>Q2 2025</option>
                <option>Annual 2024</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Export Format</label>
            <div class="flex-row gap-12">
              <label v-for="f in formats" :key="f" class="radio-label">
                <input type="radio" v-model="form.format" :value="f" name="fmt"> {{ f }}
              </label>
            </div>
          </div>
          <button class="btn btn-primary full" @click="generate">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11h9M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Generate Report
          </button>
        </div>
      </div>

      <!-- Recent -->
      <div class="card">
        <div class="card-hd"><span class="card-title">Recent Reports</span></div>
        <table class="tbl">
          <thead><tr><th>Report Name</th><th>Generated</th><th>Format</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in recent" :key="r.name">
              <td class="text-xs">{{ r.name }}</td>
              <td class="text-xs muted">{{ r.date }}</td>
              <td><span :class="['badge', r.formatClass]">{{ r.format }}</span></td>
              <td>
                <button class="btn btn-xs">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3.5 6l2.5 2 2.5-2M2 10h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
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

const form = ref({ type:'IPCR Accomplishment Report', division:'All Divisions', period:'Semester 1 (2025)', format:'PDF' })
const formats = ['PDF', 'Excel', 'CSV']

const recent = [
  { name:'Q1 IPCR — All Div.',   date:'May 10', format:'PDF',   formatClass:'badge-red'   },
  { name:'Admin Pool CCEF S1',   date:'May 8',  format:'Excel', formatClass:'badge-green' },
  { name:'Delayed Submissions',  date:'May 5',  format:'PDF',   formatClass:'badge-red'   },
  { name:'Annual 2024 Bureau',   date:'Jan 15', format:'CSV',   formatClass:'badge-gray'  }
]

function generate() { alert(`Generating: ${form.value.type} — ${form.value.period} (${form.value.format})`) }
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.grid-2-sm{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.flex-row{display:flex;align-items:center;}
.gap-12{gap:12px;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.card-body{padding:14px;}
.form-body{display:flex;flex-direction:column;gap:12px;}
.field{display:flex;flex-direction:column;gap:4px;}
.field-label{font-size:10px;color:#718096;font-weight:500;text-transform:uppercase;letter-spacing:.3px;}
.field-select{width:100%;padding:7px 9px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-family:'DM Sans',sans-serif;color:#1A2332;background:#fff;outline:none;cursor:pointer;}
.field-select:focus{border-color:#2F80ED;}
.radio-label{display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:#4A5568;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:'DM Sans',sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-primary{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn-primary:hover{background:#1a6cd4;color:#fff;}
.btn-xs{padding:3px 7px;font-size:10px;}
.full{width:100%;justify-content:center;}
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{padding:8px 10px;text-align:left;color:#718096;font-weight:500;border-bottom:1px solid #E2E8F0;font-size:10px;text-transform:uppercase;letter-spacing:.3px;background:#F7FAFC;}
.tbl td{padding:9px 10px;border-bottom:1px solid #E2E8F0;color:#4A5568;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#F7FAFC;}
.text-xs{font-size:10px;}.muted{color:#718096;}
.badge{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-red{background:#FDECEC;color:#C0392B;}
.badge-green{background:#E6F4EA;color:#1E7E34;}
.badge-gray{background:#F0F4F8;color:#4A5568;}
</style>