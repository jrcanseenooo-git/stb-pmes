<template>
  <div class="content">
    <!-- Rating card -->
    <div class="card mb-10">
      <div class="card-hd">
        <span class="card-title">Rating Computation — M. Santos (Admin Pool)</span>
        <span class="sem-tag">Q1 2025</span>
      </div>
      <div class="card-body">
        <!-- Step indicator -->
        <div class="step-line">
          <div class="step-dot done">1</div>
          <div class="step-conn done"></div>
          <div class="step-dot done">2</div>
          <div class="step-conn done"></div>
          <div class="step-dot current">3</div>
          <div class="step-conn"></div>
          <div class="step-dot todo">4</div>
        </div>
        <!-- Scores -->
        <div class="stats-grid">
          <div class="stat-card stat-green">
            <div class="stat-label">Efficiency</div>
            <div class="stat-value">4.5</div>
            <div class="stat-sub">Targets met on time</div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-label">Quality</div>
            <div class="stat-value">4.0</div>
            <div class="stat-sub">1 revision requested</div>
          </div>
          <div class="stat-card stat-gold">
            <div class="stat-label">Timeliness</div>
            <div class="stat-value">4.25</div>
            <div class="stat-sub">Submitted 3 days early</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-label">Overall Rating</div>
            <div class="stat-value">4.25</div>
            <div class="stat-sub up">Outstanding</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rating guide -->
    <div class="card">
      <div class="card-hd"><span class="card-title">Rating Guide Reference</span></div>
      <table class="tbl">
        <thead>
          <tr><th>Rating</th><th>Scale</th><th>Description</th><th>Timeliness Criterion</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in guide" :key="g.scale">
            <td><span :class="['badge', g.badgeClass]">{{ g.label }}</span></td>
            <td class="text-xs fw-500">{{ g.scale }}</td>
            <td class="text-xs">{{ g.desc }}</td>
            <td class="text-xs muted">{{ g.timeliness }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const guide = [
  { label:'Outstanding',      scale:'5', badgeClass:'badge-green',  desc:'100%+ of target',   timeliness:'Submitted ≥3 days before deadline' },
  { label:'Very Satisfactory',scale:'4', badgeClass:'badge-blue',   desc:'90–99% of target',  timeliness:'Submitted 1–2 days before deadline' },
  { label:'Satisfactory',     scale:'3', badgeClass:'badge-gray',   desc:'80–89% of target',  timeliness:'Submitted on deadline day' },
  { label:'Unsatisfactory',   scale:'2', badgeClass:'badge-orange', desc:'51–79% of target',  timeliness:'Submitted 1–3 days late' },
  { label:'Poor',             scale:'1', badgeClass:'badge-red',    desc:'50% or below',      timeliness:'Submitted 4+ days late' }
]
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;}
.mb-10{margin-bottom:10px;}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.card-hd{padding:12px 14px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.card-body{padding:14px;}
.sem-tag{display:inline-flex;padding:2px 8px;background:linear-gradient(135deg,#EBF4FF,#F3EEFF);border:1px solid #C7D8F6;border-radius:20px;font-size:10px;color:#1A56B0;font-weight:500;}
/* Step line */
.step-line{display:flex;align-items:center;gap:6px;margin-bottom:16px;}
.step-dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0;}
.done   {background:#27AE60;color:#fff;}
.current{background:#2F80ED;color:#fff;}
.todo   {background:#E2E8F0;color:#718096;}
.step-conn{flex:1;height:2px;background:#E2E8F0;border-radius:1px;}
.step-conn.done{background:#27AE60;}
/* Stats grid */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.stat-card{border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.stat-blue::before {background:#2F80ED;}
.stat-green::before{background:#27AE60;}
.stat-gold::before {background:#E9A840;}
.stat-label{font-size:10px;color:#718096;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
.stat-value{font-size:22px;font-weight:600;color:#1A2332;line-height:1;font-family:'DM Mono',monospace;margin-bottom:4px;}
.stat-sub{font-size:10px;color:#718096;}
.stat-sub.up{color:#27AE60;}
/* Table */
.tbl{width:100%;border-collapse:collapse;font-size:11px;}
.tbl th{padding:8px 12px;text-align:left;color:#718096;font-weight:500;border-bottom:1px solid #E2E8F0;font-size:10px;text-transform:uppercase;letter-spacing:.3px;background:#F7FAFC;}
.tbl td{padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#4A5568;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#F7FAFC;}
.text-xs{font-size:10px;}.muted{color:#718096;}.fw-500{font-weight:500;}
.badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.badge-green {background:#E6F4EA;color:#1E7E34;}
.badge-blue  {background:#EBF4FF;color:#1A56B0;}
.badge-gray  {background:#F0F4F8;color:#4A5568;}
.badge-orange{background:#FEF3E2;color:#B35A0F;}
.badge-red   {background:#FDECEC;color:#C0392B;}
</style>