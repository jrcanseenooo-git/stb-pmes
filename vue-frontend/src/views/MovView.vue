<template>
  <div class="content">
    <div class="flex-row jc-sb mb-12">
      <p class="text-sm muted">Means of Verification storage linked to Google Drive</p>
      <button class="btn btn-primary">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7M4 6l2.5 2.5L9 6M2 10v1a1 1 0 001 1h7a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Upload MOV
      </button>
    </div>

    <div class="grid-3">
      <div v-for="f in files" :key="f.name" class="card" :style="{ borderTop: '3px solid '+f.color }">
        <div class="card-body">
          <div class="flex-row gap-8 mb-8">
            <div class="file-icon" :style="{ background: f.iconBg }">
              <svg v-if="f.type==='pdf'" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#EB5757" stroke-width="1.5"/><path d="M7 7h6M7 10h4M7 13h5" stroke="#EB5757" stroke-width="1.2" stroke-linecap="round"/></svg>
              <svg v-else-if="f.type==='doc'" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#2F80ED" stroke-width="1.5"/><path d="M7 7h6M7 10h6M7 13h4" stroke="#2F80ED" stroke-width="1.2" stroke-linecap="round"/></svg>
              <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#27AE60" stroke-width="1.5"/><path d="M7 8h6M7 11h6M7 14h3" stroke="#27AE60" stroke-width="1.2" stroke-linecap="round"/></svg>
            </div>
            <div>
              <div class="fw-500 text-sm">{{ f.name }}</div>
              <div class="text-xs muted">{{ f.division }}</div>
            </div>
          </div>
          <div class="text-xs muted mb-8">Linked to: {{ f.link }}</div>
          <div class="flex-row jc-sb">
            <span :class="['badge', f.statusClass]">{{ f.status }}</span>
            <div class="flex-row gap-6">
              <button class="btn btn-xs">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
              <button class="btn btn-xs">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3.5 6l2.5 2 2.5-2M2 10h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-10">
      <div class="card-hd"><span class="card-title">Upload New MOV</span></div>
      <div class="upload-zone" @dragover.prevent @drop.prevent="handleDrop">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:8px"><path d="M20 6v20M12 14l8-8 8 8" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 30v2a2 2 0 002 2h24a2 2 0 002-2v-2" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/></svg>
        <div class="fw-500 text-sm" style="margin-bottom:4px">Drag & drop files here</div>
        <div class="text-xs muted" style="margin-bottom:12px">PDF, DOCX, XLSX, PNG, JPG (max 25MB)</div>
        <button class="btn btn-primary" @click="$refs.fileInput.click()">Browse Files</button>
        <input ref="fileInput" type="file" style="display:none" multiple accept=".pdf,.docx,.xlsx,.png,.jpg" @change="handleFileSelect">
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const fileInput = ref(null)

const files = [
  { type:'pdf', name:'Q1_IPCR_Santos.pdf',      division:'Admin Pool',        link:'Admin Support → SI-3',    status:'Verified', statusClass:'badge-green', color:'#EB5757', iconBg:'#FDECEC' },
  { type:'doc', name:'Training_Matrix_Q1.docx',  division:'Design Formulation',link:'Program Planning → SI-1', status:'Pending',  statusClass:'badge-orange',color:'#2F80ED', iconBg:'#EBF4FF' },
  { type:'xls', name:'Pilot_Results_Q1.xlsx',    division:'Pilot Implementation',link:'Pilot Monitoring → SI-2',status:'Verified', statusClass:'badge-green', color:'#27AE60', iconBg:'#E6F4EA' }
]

function handleDrop(e) { console.log('Dropped files:', e.dataTransfer.files) }
function handleFileSelect(e) { console.log('Selected files:', e.target.files) }
</script>

<style scoped>
*{box-sizing:border-box;}
.content{padding:0;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;color:#1A2332;}
.flex-row{display:flex;align-items:center;}
.jc-sb{justify-content:space-between;}
.gap-6{gap:6px;}.gap-8{gap:8px;}
.mb-8{margin-bottom:8px;}.mb-12{margin-bottom:12px;}.mt-10{margin-top:10px;}
.text-sm{font-size:12px;}.text-xs{font-size:10px;}.muted{color:#718096;}.fw-500{font-weight:500;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-primary{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn-primary:hover{background:#1a6cd4;color:#fff;}
.btn-xs{padding:3px 7px;font-size:10px;}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:0;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.card-body{padding:14px;}
.file-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.badge{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-green{background:#E6F4EA;color:#1E7E34;}
.badge-orange{background:#FEF3E2;color:#B35A0F;}
.mb-8{margin-bottom:8px;}
.upload-zone{display:flex;flex-direction:column;align-items:center;padding:36px 14px;border:2px dashed #E2E8F0;border-radius:0 0 12px 12px;transition:border-color .15s;}
.upload-zone:hover{border-color:#2F80ED;}
</style>