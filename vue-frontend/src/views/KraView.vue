<template>
  <div class="content">
    <div class="flex-row jc-sb mb-12">
      <div class="pill-tabs">
        <div :class="['pill', activeType==='IPCR'&&'active']" @click="activeType='IPCR'">IPCR</div>
        <div :class="['pill', activeType==='CCEF'&&'active']" @click="activeType='CCEF'">CCEF</div>
      </div>
      <div class="flex-row gap-6">
        <button class="btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 4h11M3 8h7M5 12h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Filter
        </button>
        <button class="btn btn-primary">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Add KRA
        </button>
      </div>
    </div>

    <div class="grid-2">
      <!-- Core Functions -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Core Functions — KRAs</span>
          <span class="badge badge-blue">4 KRAs</span>
        </div>
        <div class="card-body pd-sm">
          <div v-for="kra in coreKras" :key="kra.id" class="kra-item">
            <div class="kra-num" style="background:#2F80ED">{{ kra.id }}</div>
            <div>
              <div class="kra-title">{{ kra.title }}</div>
              <div class="kra-sub">Success Indicators: {{ kra.si }} • Rating: <span :style="{ color: kra.ratingColor, fontWeight: 500 }">{{ kra.rating }}</span></div>
              <div class="chips-row">
                <span v-for="m in kra.metrics" :key="m" class="chip">{{ m }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Support Functions -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Support Functions — KRAs</span>
          <span class="badge badge-purple">2 KRAs</span>
        </div>
        <div class="card-body pd-sm">
          <div v-for="kra in supportKras" :key="kra.id" class="kra-item">
            <div class="kra-num" style="background:#0D2137">{{ kra.id }}</div>
            <div>
              <div class="kra-title">{{ kra.title }}</div>
              <div class="kra-sub">Success Indicators: {{ kra.si }} • Rating: <span :style="{ color: kra.ratingColor, fontWeight: 500 }">{{ kra.rating }}</span></div>
              <div class="chips-row">
                <span v-for="m in kra.metrics" :key="m" class="chip">{{ m }}</span>
              </div>
            </div>
          </div>
          <div class="info-box">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#718096" stroke-width="1.2"/><path d="M6.5 6v3M6.5 4.5v.5" stroke="#718096" stroke-width="1.2" stroke-linecap="round"/></svg>
            Rating scale: 5 (Outstanding) → 1 (Poor)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const activeType = ref('IPCR')

const coreKras = [
  { id:1, title:'Program Planning and Development', si:6, rating:'4.25', ratingColor:'#27AE60', metrics:['Efficiency','Quality','Timeliness'] },
  { id:2, title:'Pilot Implementation & Monitoring', si:8, rating:'3.75', ratingColor:'#2F80ED', metrics:['Efficiency','Timeliness'] },
  { id:3, title:'Social Technology Analysis',        si:5, rating:'3.50', ratingColor:'#C8882A', metrics:['Quality','Timeliness'] },
  { id:4, title:'Research and Documentation',        si:4, rating:'4.50', ratingColor:'#27AE60', metrics:['Efficiency','Quality'] }
]
const supportKras = [
  { id:5, title:'Administrative Support Services', si:7, rating:'4.10', ratingColor:'#27AE60', metrics:['Efficiency','Quality','Timeliness'] },
  { id:6, title:'Stakeholder Engagement',          si:3, rating:'3.25', ratingColor:'#F2994A', metrics:['Quality'] }
]
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;}
.flex-row{display:flex;align-items:center;}
.jc-sb{justify-content:space-between;}
.gap-6{gap:6px;}
.mb-12{margin-bottom:12px;}
.pill-tabs{display:flex;gap:4px;}
.pill{padding:4px 12px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;color:#718096;transition:all .15s;}
.pill.active{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:'DM Sans',sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-primary{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn-primary:hover{background:#1a6cd4;color:#fff;}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.card-body{padding:14px;}
.pd-sm{padding:10px 14px;}
.badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-blue{background:#EBF4FF;color:#1A56B0;}
.badge-purple{background:#F3EEFF;color:#6B3FA0;}
.kra-item{padding:10px 0;border-bottom:1px solid #E2E8F0;display:flex;align-items:flex-start;gap:10px;}
.kra-item:last-child{border-bottom:none;}
.kra-num{width:22px;height:22px;border-radius:50%;color:#fff;font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.kra-title{font-size:12px;font-weight:500;color:#1A2332;margin-bottom:3px;}
.kra-sub{font-size:10px;color:#718096;margin-bottom:4px;}
.chips-row{display:flex;gap:4px;flex-wrap:wrap;}
.chip{display:inline-flex;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:500;background:#F7FAFC;border:1px solid #E2E8F0;color:#718096;}
.info-box{margin-top:12px;padding:10px;background:#F7FAFC;border-radius:8px;border:1px dashed #E2E8F0;display:flex;align-items:center;gap:6px;font-size:11px;color:#718096;}
</style>