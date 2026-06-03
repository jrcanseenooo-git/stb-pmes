<template>
  <div class="page">

    <!-- ══════════════════════════════════════
         FORMS LIST
    ══════════════════════════════════════ -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">IPCRF / CCEF Forms</h2>
        <p class="page-sub">Individual Performance Commitment and Review Forms</p>
      </div>
      <button class="btn btn-primary" @click="showNewFormModal = true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        New Form
      </button>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="t in statusTabs" :key="t.value"
          :class="['ftab', activeStatus === t.value && 'active']"
          @click="activeStatus = t.value">
          {{ t.label }}
          <span v-if="t.value !== 'ALL' && countByStatus(t.value)" class="ftab-badge">{{ countByStatus(t.value) }}</span>
        </button>
      </div>
      <div class="filter-right">
        <select v-model="filterType" class="fsel"><option value="">All Types</option><option value="IPCRF">IPCRF</option><option value="CCEF">CCEF</option></select>
        <select v-model="filterSemester" class="fsel"><option value="">All Semesters</option><option value="1">Semester 1</option><option value="2">Semester 2</option></select>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="forms-grid">
      <div v-for="i in 4" :key="i" class="skel-card">
        <div class="sk sk-top"></div><div class="sk sk-name"></div><div class="sk sk-sub"></div><div class="sk sk-foot"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredForms.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="7" y="5" width="34" height="38" rx="4" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/><path d="M15 17h18M15 24h13M15 31h9" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="empty-title">{{ activeStatus !== 'ALL' ? `No ${activeStatus.toLowerCase()} forms` : 'No forms yet' }}</div>
      <div class="empty-sub">{{ activeStatus !== 'ALL' ? 'Try a different filter.' : 'Create your first IPCRF or CCEF form to get started.' }}</div>
      <button v-if="activeStatus === 'ALL'" class="btn btn-primary btn-sm" @click="showNewFormModal = true">Create New Form</button>
    </div>

    <!-- Grid -->
    <div v-else class="forms-grid">
      <div v-for="form in filteredForms" :key="form.id" class="form-card" @click="openFormModal(form)">
        <div class="fc-top">
          <span :class="['type-pill', form.type === 'IPCRF' ? 'pill-ipcrf' : 'pill-ccef']">{{ form.type }}</span>
          <span :class="['status-chip', `s-${(form.status||'').toLowerCase()}`]"><i class="chip-dot"></i>{{ form.status }}</span>
        </div>
        <div class="fc-name">{{ form.employeeName }}</div>
        <div class="fc-div">{{ form.divisionName || '—' }}</div>
        <div class="fc-foot">
          <span class="fc-period">Sem {{ form.semester }} · {{ form.year }}</span>
          <span v-if="form.finalNumericalRating" class="fc-score">{{ form.finalNumericalRating }}</span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════
         MODAL: FORM DETAIL (large modal)
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showFormModal" class="ov" @click.self="showFormModal = false">
        <div class="modal modal-xl">

          <!-- Modal header -->
          <div class="mhd">
            <div class="mhd-left">
              <div class="mhd-badges">
                <span :class="['type-pill', activeForm?.type === 'IPCRF' ? 'pill-ipcrf' : 'pill-ccef']">{{ activeForm?.type }}</span>
                <span :class="['status-chip', `s-${(activeForm?.status||'').toLowerCase()}`]"><i class="chip-dot"></i>{{ activeForm?.status }}</span>
              </div>
              <div class="mhd-name">{{ activeForm?.employeeName }}</div>
              <div class="mhd-sub">Sem {{ activeForm?.semester }} · {{ activeForm?.year }} · {{ activeForm?.divisionName }}</div>
            </div>
            <button class="xbtn" @click="showFormModal = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>

          <!-- Modal tabs -->
          <div class="modal-tabs">
            <button :class="['mtab', activeTab === 'indicators' && 'active']" @click="activeTab='indicators'">
              Indicators <span v-if="allEntries.length" class="mtab-count">{{ allEntries.length }}</span>
            </button>
            <button :class="['mtab', activeTab === 'details' && 'active']" @click="activeTab='details'">Details</button>
            <button :class="['mtab', activeTab === 'score' && 'active']" @click="activeTab='score'">Score</button>
          </div>

          <!-- Loading entries -->
          <div v-if="entriesLoading" class="loading-entries">
            <div class="spin-sm"></div><span class="muted">Loading indicators…</span>
          </div>

          <!-- ── INDICATORS TAB ── -->
          <div v-else-if="activeTab === 'indicators'" class="mbody tab-body">

            <!-- Core -->
            <div class="fn-block">
              <div class="fn-hd">
                <div class="fn-hd-l">
                  <span class="fn-label">Core Functions</span>
                  <span class="fn-wt">{{ activeForm?.coreFunctionWeight }}%</span>
                  <span class="fn-cnt">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="fn-hd-r">
                  <button class="lib-btn" @click="openLibrary('Core')">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>From Library
                  </button>
                  <button class="lib-btn lib-btn-ghost" @click="openCustomEntry('Core')">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>Custom
                  </button>
                </div>
              </div>
              <div v-if="!coreEntries.length" class="fn-empty">No core indicators added yet</div>
              <div v-else class="entries-list">
                <div v-for="e in coreEntries" :key="e.id" class="ec">
                  <div class="ec-body">
                    <div class="ec-row1">
                      <span class="ec-kra">{{ e.kraName }}</span>
                      <div class="ec-acts">
                        <button class="act" @click.stop="openEditEntry(e)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></button>
                        <button class="act act-del" @click.stop="askDelete(e)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
                      </div>
                    </div>
                    <div class="ec-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 120) }}</div>
                    <div class="ec-tags">
                      <span class="etag">Wt: {{ e.weight }}%</span>
                      <span class="etag">{{ e.applicableRatingPeriod }}</span>
                      <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                      <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Support -->
            <div class="fn-block">
              <div class="fn-hd">
                <div class="fn-hd-l">
                  <span class="fn-label">Support Functions</span>
                  <span class="fn-wt fn-wt-p">{{ activeForm?.supportFunctionWeight }}%</span>
                  <span class="fn-cnt">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="fn-hd-r">
                  <button class="lib-btn" @click="openLibrary('Support')">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>From Library
                  </button>
                  <button class="lib-btn lib-btn-ghost" @click="openCustomEntry('Support')">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>Custom
                  </button>
                </div>
              </div>
              <div v-if="!supportEntries.length" class="fn-empty">No support indicators added yet</div>
              <div v-else class="entries-list">
                <div v-for="e in supportEntries" :key="e.id" class="ec">
                  <div class="ec-body">
                    <div class="ec-row1">
                      <span class="ec-kra ec-kra-p">{{ e.kraName }}</span>
                      <div class="ec-acts">
                        <button class="act" @click.stop="openEditEntry(e)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></button>
                        <button class="act act-del" @click.stop="askDelete(e)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
                      </div>
                    </div>
                    <div class="ec-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 120) }}</div>
                    <div class="ec-tags">
                      <span class="etag">Wt: {{ e.weight }}%</span>
                      <span class="etag">{{ e.applicableRatingPeriod }}</span>
                      <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                      <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Workflow -->
            <div v-if="['DRAFT','RETURNED'].includes(activeForm?.status)" class="wf-bar">
              <span class="wf-info"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#64748B" stroke-width="1.2"/><path d="M6.5 6v3M6.5 4v.5" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/></svg>{{ allEntries.length }} indicator{{ allEntries.length !== 1 ? 's' : '' }} total</span>
              <button class="btn btn-primary btn-sm" @click="doSubmit">Submit for Review</button>
            </div>
            <div v-else-if="activeForm?.status === 'SUBMITTED'" class="wf-bar">
              <span class="wf-info">Pending Division Chief review</span>
              <div style="display:flex;gap:8px">
                <button class="btn btn-success btn-sm" @click="doApprove">Approve</button>
                <button class="btn btn-outline-danger btn-sm" @click="doReturn">Return</button>
              </div>
            </div>
          </div>

          <!-- ── DETAILS TAB ── -->
          <div v-else-if="activeTab === 'details'" class="mbody tab-body">
            <div class="det-2col">
              <div>
                <div class="det-section-title">Period & Role</div>
                <div class="det-row"><span class="dk">Form Type</span><span class="dv">{{ activeForm?.type }}</span></div>
                <div class="det-row"><span class="dk">Semester / Year</span><span class="dv">Sem {{ activeForm?.semester }}, {{ activeForm?.year }}</span></div>
                <div class="det-row"><span class="dk">Position Level</span><span class="dv">{{ activeForm?.positionLevel || '—' }}</span></div>
                <div class="det-row"><span class="dk">Division</span><span class="dv">{{ activeForm?.divisionName || '—' }}</span></div>
                <div class="det-section-title" style="margin-top:18px">Timeline</div>
                <div class="det-row"><span class="dk">Created</span><span class="dv">{{ fmtDate(activeForm?.createdAt) || '—' }}</span></div>
                <div class="det-row"><span class="dk">Submitted</span><span class="dv">{{ fmtDate(activeForm?.submittedAt) || '—' }}</span></div>
                <div class="det-row"><span class="dk">Approved</span><span class="dv">{{ fmtDate(activeForm?.approvedAt) || '—' }}</span></div>
              </div>
              <div>
                <div class="det-section-title">Signatories</div>
                <div class="det-row"><span class="dk">Immediate Supervisor</span><span class="dv">{{ activeForm?.immediateSupervisor || '—' }}</span></div>
                <div class="det-row"><span class="dk">Supervisor Position</span><span class="dv">{{ activeForm?.supervisorPosition || '—' }}</span></div>
                <div class="det-row"><span class="dk">Approving Authority</span><span class="dv">{{ activeForm?.approvingAuthority || '—' }}</span></div>
                <div class="det-row"><span class="dk">Authority Position</span><span class="dv">{{ activeForm?.authorityPosition || '—' }}</span></div>
                <div class="det-section-title" style="margin-top:18px">Weights</div>
                <div class="weights-bar-wrap">
                  <div class="weights-bar">
                    <div class="wb-c" :style="{width:activeForm?.coreFunctionWeight+'%'}">Core {{ activeForm?.coreFunctionWeight }}%</div>
                    <div class="wb-s" :style="{width:activeForm?.supportFunctionWeight+'%'}">Support {{ activeForm?.supportFunctionWeight }}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── SCORE TAB ── -->
          <div v-else-if="activeTab === 'score'" class="mbody tab-body">
            <div v-if="!activeForm?.finalNumericalRating" class="score-empty">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" stroke="#E2E8F0" stroke-width="2"/><path d="M20 12v8l5 3" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
              <p class="muted">Score not yet computed</p>
              <button class="btn btn-primary btn-sm" @click="doCompute">Compute Score</button>
            </div>
            <div v-else class="score-view">
              <div :class="['score-hero', scoreColorClass]">
                <span class="score-big">{{ activeForm?.finalNumericalRating }}</span>
                <span class="score-denom">/ 5.0</span>
              </div>
              <div class="score-adj">{{ activeForm?.adjectivalRating }}</div>
              <div class="score-table">
                <div class="st-hd"><span>Indicator</span><span>Avg</span></div>
                <div v-for="e in allEntries" :key="e.id" class="st-row">
                  <div class="st-l">
                    <span :class="['st-fn', e.functionType==='Core'?'fn-c':'fn-s']">{{ e.functionType[0] }}</span>
                    <span class="st-name">{{ e.kraName }}</span>
                  </div>
                  <span :class="['st-val', e.ratingAverage ? '' : 'muted']">{{ e.ratingAverage || '—' }}</span>
                </div>
              </div>
              <button class="btn btn-sm" style="margin-top:14px" @click="doCompute">Recompute</button>
            </div>
          </div>

        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         MODAL: NEW FORM
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showNewFormModal" class="ov" @click.self="showNewFormModal=false">
        <div class="modal" style="max-width:480px">
          <div class="mhd"><div><div class="mtitle">New Performance Form</div><div class="msub">IPCRF or CCEF for this semester</div></div><button class="xbtn" @click="showNewFormModal=false"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
          <div class="mbody">
            <div class="fsec">Basic Info</div>
            <div class="fgrid">
              <div class="field"><label class="fl">Form Type</label><select v-model="newForm.type" class="fi"><option>IPCRF</option><option>CCEF</option></select></div>
              <div class="field"><label class="fl">Position Level</label><select v-model="newForm.positionLevel" class="fi"><option value="II">Level II</option><option value="III">Level III</option><option value="IV">Level IV</option></select></div>
              <div class="field"><label class="fl">Semester</label><select v-model="newForm.semester" class="fi"><option value="1">1st Semester</option><option value="2">2nd Semester</option></select></div>
              <div class="field"><label class="fl">Year</label><input v-model.number="newForm.year" type="number" class="fi"/></div>
            </div>
            <div class="fsec" style="margin-top:16px">Signatories</div>
            <div class="fgrid">
              <div class="field full"><label class="fl">Immediate Supervisor</label><input v-model="newForm.immediateSupervisor" type="text" class="fi" placeholder="Full name"/></div>
              <div class="field full"><label class="fl">Supervisor Position</label><input v-model="newForm.supervisorPosition" type="text" class="fi" placeholder="e.g. Division Chief / SWO V"/></div>
              <div class="field full"><label class="fl">Approving Authority</label><input v-model="newForm.approvingAuthority" type="text" class="fi" placeholder="e.g. Helen Y. Suzara"/></div>
              <div class="field full"><label class="fl">Authority Position</label><input v-model="newForm.authorityPosition" type="text" class="fi" placeholder="e.g. Bureau Director"/></div>
            </div>
          </div>
          <div class="mft"><button class="btn" @click="showNewFormModal=false">Cancel</button><button class="btn btn-primary" :disabled="creating" @click="createForm">{{ creating ? 'Creating…' : 'Create Form' }}</button></div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         MODAL: KRA LIBRARY — multi-select
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibrary" class="ov" @click.self="cancelLibrary">
        <div class="modal modal-lib">
          <div class="mhd">
            <div>
              <div class="mtitle">KRA Library <span :class="['type-pill', currentFnType==='Core'?'pill-ipcrf':'pill-ccef']" style="font-size:10px;margin-left:6px">{{ currentFnType }}</span></div>
              <div class="msub">Tap indicators to select, then click <strong>Add Selected</strong></div>
            </div>
            <button class="xbtn" @click="cancelLibrary"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
          </div>
          <div class="lib-filters">
            <div class="srch-wrap">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="srch-icon"><circle cx="5.5" cy="5.5" r="4.5" stroke="#94A3B8" stroke-width="1.2"/><path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/></svg>
              <input v-model="libSearch" type="text" class="srch-inp" placeholder="Search KRA or indicator…" autofocus/>
            </div>
            <select v-model="libPhase" class="fi" style="width:120px"><option value="">All Phases</option><option v-for="p in libPhases" :key="p">{{ p }}</option></select>
            <select v-model="libClass" class="fi" style="width:130px"><option value="">All Types</option><option>Simple</option><option>Complex</option><option>Highly Technical</option><option>Exempted</option></select>
          </div>
          <div v-if="libSelected.length" class="sel-strip">
            <span class="sel-count">{{ libSelected.length }} selected</span>
            <button class="sel-clear" @click="libSelected=[]">Clear all</button>
          </div>
          <div class="mbody lib-scroll">
            <div v-if="libLoading" class="state-wrap"><div class="spinner"></div></div>
            <div v-else-if="!filteredLibrary.length" class="state-wrap"><p class="muted">No matching indicators</p></div>
            <div v-else class="lib-list">
              <div v-for="item in filteredLibrary" :key="item.id"
                :class="['lib-item', isSelected(item) && 'lib-sel']"
                @click="toggleSelect(item)">
                <div :class="['chk', isSelected(item) && 'chk-on']">
                  <svg v-if="isSelected(item)" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="lib-content">
                  <div class="lib-kra-row">
                    <span class="lib-kra">{{ item.kraName }}</span>
                    <div class="lib-tags">
                      <span class="etag">{{ item.phase }}</span>
                      <span class="etag">Wt: {{ posWeight(item) }}%</span>
                      <span :class="['etag', item.classification !== 'Simple' ? 'etag-blue' : '']">{{ item.classification }}</span>
                    </div>
                  </div>
                  <div class="lib-pi">{{ item.performanceIndicator || item.successIndicator || '' }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="mft lib-mft">
            <span class="muted" style="font-size:11px">{{ filteredLibrary.length }} result{{ filteredLibrary.length !== 1 ? 's' : '' }}</span>
            <div style="display:flex;gap:8px">
              <button class="btn" @click="cancelLibrary">Cancel</button>
              <button class="btn btn-primary" :disabled="!libSelected.length" @click="showLibConfirm=true">Add Selected ({{ libSelected.length }})</button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         MODAL: CONFIRM SELECTION (full indicator text)
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibConfirm" class="ov">
        <div class="modal modal-confirm">
          <div class="mhd">
            <div>
              <div class="mtitle">Confirm — {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}</div>
              <div class="msub">Review the full details below before adding. Click <em>← Back</em> to change selection.</div>
            </div>
          </div>
          <div class="mbody confirm-scroll">
            <div v-for="(item, idx) in libSelected" :key="item.id" class="ci">
              <div class="ci-num">{{ idx + 1 }}</div>
              <div class="ci-body">
                <div class="ci-kra">{{ item.kraName }}</div>
                <div class="ci-pi">{{ item.performanceIndicator || item.successIndicator || '' }}</div>
                <div class="ci-meta">
                  <span class="etag">{{ item.phase }}</span>
                  <span class="etag">Weight: {{ posWeight(item) }}%</span>
                  <span :class="['etag', item.classification !== 'Simple' ? 'etag-blue' : '']">{{ item.classification }}</span>
                  <span :class="['type-pill', currentFnType==='Core'?'pill-ipcrf':'pill-ccef']" style="font-size:9px;padding:1px 6px">{{ currentFnType }}</span>
                </div>
                <div v-if="item.meansOfVerification" class="ci-mov">
                  <span class="ci-mov-label">MOV:</span> {{ item.meansOfVerification }}
                </div>
              </div>
              <button class="ci-rm" @click="libSelected.splice(idx,1)" title="Remove">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="#CBD5E1" stroke-width="1.4" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
          <div class="mft">
            <button class="btn" @click="showLibConfirm=false">← Back</button>
            <button class="btn btn-primary" :disabled="!libSelected.length" @click="commitSelection">Confirm & Add All</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         FULLSCREEN LOCK — adding progress
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="addProg.active" class="fullscreen-lock">
        <div class="lock-box">
          <div class="lock-spin"></div>
          <div class="lock-title">Adding Indicators…</div>
          <div class="lock-count">{{ addProg.current }} of {{ addProg.total }}</div>
          <div class="prog-track"><div class="prog-fill" :style="{width: addProg.pct+'%'}"></div></div>
          <div class="lock-hint">Do not close or navigate away</div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         MODAL: CUSTOM ENTRY
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showEntryModal" class="ov" @click.self="closeEntry">
        <div class="modal" style="max-width:480px">
          <div class="mhd">
            <div><div class="mtitle">{{ editingEntry ? 'Edit Indicator' : 'Custom Indicator' }}</div><div class="msub"><span :class="['type-pill', currentFnType==='Core'?'pill-ipcrf':'pill-ccef']" style="font-size:10px">{{ currentFnType }} Function</span></div></div>
            <button class="xbtn" @click="closeEntry"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
          </div>
          <div class="mbody">
            <div class="fgrid">
              <div class="field full"><label class="fl">KRA Name <span class="req">*</span></label><input v-model="entryForm.kraName" type="text" class="fi" placeholder="e.g. Research"/></div>
              <div class="field full"><label class="fl">Success Indicator <span class="req">*</span></label><textarea v-model="entryForm.successIndicator" class="fi" rows="3" placeholder="Describe the specific target output…"></textarea></div>
              <div class="field"><label class="fl">Weight (%)</label><input v-model.number="entryForm.weight" type="number" class="fi" min="0" max="100"/></div>
              <div class="field"><label class="fl">Classification</label><select v-model="entryForm.classification" class="fi"><option>Simple</option><option>Complex</option><option>Highly Technical</option><option>Exempted</option></select></div>
              <div class="field full"><label class="fl">Applicable Period</label><select v-model="entryForm.applicableRatingPeriod" class="fi"><option>Both semesters</option><option>1st Semester</option><option>2nd Semester</option></select></div>
              <div class="field full"><label class="fl">Means of Verification</label><input v-model="entryForm.meansOfVerification" type="text" class="fi" placeholder="e.g. Approved report with memo endorsement"/></div>
            </div>
            <template v-if="editingEntry">
              <div class="fsec" style="margin-top:16px">Rating</div>
              <div class="fgrid">
                <div class="field full"><label class="fl">Accomplishment</label><textarea v-model="entryForm.accomplishment" class="fi" rows="2" placeholder="What was accomplished…"></textarea></div>
                <div class="field"><label class="fl">Efficiency <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingEfficiency" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div class="field"><label class="fl">Quality <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingQuality" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div class="field"><label class="fl">Timeliness <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingTimeliness" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div v-if="computedAvg" class="field"><label class="fl">Average</label><div class="fi avg-box">{{ computedAvg }}</div></div>
              </div>
            </template>
          </div>
          <div class="mft"><button class="btn" @click="closeEntry">Cancel</button><button class="btn btn-primary" :disabled="savingEntry" @click="saveEntry">{{ savingEntry ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Add Indicator') }}</button></div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════════
         CONFIRM DELETE
    ══════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="confirmDel.show" class="ov">
        <div class="confirm-box">
          <div class="cb-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M8 6V4h6v2M5 6v13a2 2 0 002 2h8a2 2 0 002-2V6" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="cb-title">Remove Indicator?</div>
          <div class="cb-msg">Remove <strong>{{ confirmDel.name }}</strong> from this form?<br><span class="muted" style="font-size:11px">This cannot be undone.</span></div>
          <div class="cb-btns"><button class="btn" @click="confirmDel.show=false">Cancel</button><button class="btn btn-danger" :disabled="deletingEntry" @click="doDelete">{{ deletingEntry ? 'Removing…' : 'Remove' }}</button></div>
        </div>
      </div>
    </teleport>

    <!-- Toast -->
    <teleport to="body">
      <transition name="toast"><div v-if="toast.show" :class="['toast','toast-'+toast.type]">{{ toast.msg }}</div></transition>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'

const forms           = ref([])
const loading         = ref(false)
const entriesLoading  = ref(false)
const creating        = ref(false)
const activeStatus    = ref('ALL')
const filterType      = ref('')
const filterSemester  = ref('')
const activeForm      = ref(null)
const activeTab       = ref('indicators')
const allEntries      = ref([])
const showFormModal   = ref(false)
const showNewFormModal = ref(false)
const showLibrary     = ref(false)
const showLibConfirm  = ref(false)
const libSelected     = ref([])
const libraryItems    = ref([])
const libLoading      = ref(false)
const libSearch       = ref('')
const libPhase        = ref('')
const libClass        = ref('')
const currentFnType   = ref('Core')
const addProg         = ref({ active: false, current: 0, total: 0, pct: 0 })
const showEntryModal  = ref(false)
const editingEntry    = ref(null)
const savingEntry     = ref(false)
const deletingEntry   = ref(false)
const confirmDel      = ref({ show: false, entryId: null, name: '' })
const toast           = ref({ show: false, msg: '', type: 'success' })

const newForm = ref({ type:'IPCRF', semester: String(new Date().getMonth()<6?1:2), year:new Date().getFullYear(), positionLevel:'III', immediateSupervisor:'', supervisorPosition:'', approvingAuthority:'', authorityPosition:'' })
const entryForm = ref({ kraName:'', successIndicator:'', functionType:'Core', weight:5, applicableRatingPeriod:'Both semesters', classification:'Complex', meansOfVerification:'', accomplishment:'', ratingEfficiency:'', ratingQuality:'', ratingTimeliness:'' })

const statusTabs = [
  {label:'All',value:'ALL'},{label:'Draft',value:'DRAFT'},{label:'Submitted',value:'SUBMITTED'},
  {label:'Approved',value:'APPROVED'},{label:'Rated',value:'RATED'},{label:'Finalized',value:'FINALIZED'}
]

const filteredForms = computed(() => {
  let f = forms.value
  if (activeStatus.value !== 'ALL') f = f.filter(x => x.status === activeStatus.value)
  if (filterType.value)     f = f.filter(x => x.type === filterType.value)
  if (filterSemester.value) f = f.filter(x => String(x.semester) === filterSemester.value)
  return f
})
const coreEntries    = computed(() => allEntries.value.filter(e => e.functionType === 'Core'))
const supportEntries = computed(() => allEntries.value.filter(e => e.functionType === 'Support'))
const libPhases      = computed(() => [...new Set(libraryItems.value.map(i => i.phase).filter(Boolean))])
const filteredLibrary = computed(() => {
  let items = libraryItems.value
  if (libSearch.value) { const q = libSearch.value.toLowerCase(); items = items.filter(i => i.kraName?.toLowerCase().includes(q) || (i.performanceIndicator||i.successIndicator||'').toLowerCase().includes(q)) }
  if (libPhase.value) items = items.filter(i => i.phase === libPhase.value)
  if (libClass.value) items = items.filter(i => i.classification === libClass.value)
  return items
})
const computedAvg = computed(() => {
  const e = Number(entryForm.value.ratingEfficiency), q = Number(entryForm.value.ratingQuality), t = Number(entryForm.value.ratingTimeliness)
  return (e && q && t) ? Math.round((e+q+t)/3*100)/100 : null
})
const scoreColorClass = computed(() => {
  const s = Number(activeForm.value?.finalNumericalRating)
  if (s >= 4.5) return 'score-out'; if (s >= 3.5) return 'score-vs'; if (s >= 2.5) return 'score-sat'; return 'score-low'
})

function truncate(str, len) { return (!str || str.length <= len) ? (str||'') : str.slice(0,len)+'…' }
function countByStatus(s)   { return forms.value.filter(f => f.status === s).length }
function posWeight(item)    { const l = activeForm.value?.positionLevel||'III'; return Number(item[`weight${l}`]||item.weight||0) }
function fmtDate(iso)       { return iso ? new Date(iso).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '' }
function showToast(msg, type='success') { toast.value={show:true,msg,type}; setTimeout(()=>{toast.value.show=false},3000) }
function isSelected(item)   { return libSelected.value.some(s => s.id === item.id) }
function toggleSelect(item) { const i=libSelected.value.findIndex(s=>s.id===item.id); i!==-1?libSelected.value.splice(i,1):libSelected.value.push(item) }
function cancelLibrary()    { showLibrary.value=false; showLibConfirm.value=false; libSelected.value=[] }
function closeEntry()       { showEntryModal.value=false; editingEntry.value=null }

onMounted(loadForms)

async function loadForms() {
  loading.value = true
  try { const r = await ipcrfApi.listForms(); forms.value = Array.isArray(r) ? r : (r?.items||[]) }
  catch (e) { showToast(`Could not load forms: ${e.message}`, 'error') }
  finally { loading.value = false }
}

async function openFormModal(form) {
  activeForm.value = form; activeTab.value = 'indicators'; allEntries.value = []; showFormModal.value = true
  entriesLoading.value = true
  try { const r = await ipcrfApi.getEntries(form.id); allEntries.value = Array.isArray(r) ? r : [] }
  catch (e) { showToast(e.message,'error') }
  finally { entriesLoading.value = false }
  if (!libraryItems.value.length) {
    libLoading.value = true
    kraLibraryApi.list().then(l=>{libraryItems.value=Array.isArray(l)?l:[]}).catch(()=>{}).finally(()=>{libLoading.value=false})
  }
}

async function createForm() {
  if (creating.value) return; creating.value = true
  try { const f=await ipcrfApi.createForm(newForm.value); forms.value.unshift(f); showNewFormModal.value=false; showToast('Form created'); await openFormModal(f) }
  catch (e) { showToast(e.message,'error') } finally { creating.value=false }
}

function openLibrary(fnType) { currentFnType.value=fnType; libSearch.value=''; libPhase.value=''; libClass.value=''; libSelected.value=[]; showLibConfirm.value=false; showLibrary.value=true }

async function commitSelection() {
  const items = [...libSelected.value]
  showLibConfirm.value=false; showLibrary.value=false
  addProg.value = { active:true, current:0, total:items.length, pct:0 }
  for (let i=0; i<items.length; i++) {
    const item = items[i]
    try {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        masterKRAId: item.id, functionType: currentFnType.value,
        kraName: item.kraName,
        successIndicator: item.performanceIndicator || item.successIndicator || '',
        applicableRatingPeriod: item.applicableTo==='BOTH'?'Both semesters':(item.applicableTo||'Both semesters'),
        weight: posWeight(item), classification: item.classification||'',
        efficiencyGuide: item.efficiencyGuide||'', qualityGuide: item.qualityGuide||'',
        timelinessGuide: item.timelinessGuide||'', meansOfVerification: item.meansOfVerification||'',
        isCustom: false
      })
      allEntries.value.push(entry)
    } catch (e) { console.warn('Failed:', item.kraName, e.message) }
    addProg.value.current = i+1; addProg.value.pct = Math.round(((i+1)/items.length)*100)
  }
  addProg.value.active=false; libSelected.value=[]
  showToast(`${items.length} indicator${items.length!==1?'s':''} added`)
}

function openCustomEntry(fnType) {
  currentFnType.value=fnType; editingEntry.value=null
  entryForm.value={kraName:'',successIndicator:'',functionType:fnType,weight:5,applicableRatingPeriod:'Both semesters',classification:'Complex',meansOfVerification:'',accomplishment:'',ratingEfficiency:'',ratingQuality:'',ratingTimeliness:''}
  showEntryModal.value=true
}
function openEditEntry(entry) {
  editingEntry.value=entry; currentFnType.value=entry.functionType
  entryForm.value={kraName:entry.kraName,successIndicator:entry.successIndicator,functionType:entry.functionType,weight:Number(entry.weight),applicableRatingPeriod:entry.applicableRatingPeriod,classification:entry.classification,meansOfVerification:entry.meansOfVerification,accomplishment:entry.accomplishment,ratingEfficiency:entry.ratingEfficiency,ratingQuality:entry.ratingQuality,ratingTimeliness:entry.ratingTimeliness}
  showEntryModal.value=true
}
async function saveEntry() {
  if (!entryForm.value.kraName||!entryForm.value.successIndicator) { showToast('KRA name and indicator are required','error'); return }
  savingEntry.value=true
  try {
    if (editingEntry.value) {
      const u=await ipcrfApi.updateEntry(editingEntry.value.id,{...entryForm.value,ratingAverage:computedAvg.value||entryForm.value.ratingAverage||''})
      const i=allEntries.value.findIndex(e=>e.id===editingEntry.value.id); if(i!==-1) allEntries.value[i]={...allEntries.value[i],...u}
      showToast('Indicator updated')
    } else {
      const e=await ipcrfApi.addEntry(activeForm.value.id,{...entryForm.value,functionType:currentFnType.value,isCustom:true})
      allEntries.value.push(e); showToast('Indicator added')
    }
    closeEntry()
  } catch(e){showToast(e.message,'error')} finally{savingEntry.value=false}
}

function askDelete(entry) { confirmDel.value={show:true,entryId:entry.id,name:entry.kraName} }
async function doDelete() {
  deletingEntry.value=true
  try { await ipcrfApi.deleteEntry(confirmDel.value.entryId); allEntries.value=allEntries.value.filter(e=>e.id!==confirmDel.value.entryId); showToast('Indicator removed'); confirmDel.value.show=false }
  catch(e){showToast(e.message,'error')} finally{deletingEntry.value=false}
}

async function doSubmit()  { try{const u=await ipcrfApi.submitForm(activeForm.value.id);_sync(u);showToast('Form submitted')}catch(e){showToast(e.message,'error')} }
async function doApprove() { try{const u=await ipcrfApi.approveForm(activeForm.value.id);_sync(u);showToast('Form approved')}catch(e){showToast(e.message,'error')} }
async function doReturn()  { try{const u=await ipcrfApi.returnForm(activeForm.value.id);_sync(u);showToast('Form returned')}catch(e){showToast(e.message,'error')} }
async function doCompute() { try{const u=await ipcrfApi.computeScore(activeForm.value.id);_sync(u);showToast(`Score: ${u.finalNumericalRating} — ${u.adjectivalRating}`)}catch(e){showToast(e.message,'error')} }
function _sync(u) { activeForm.value={...activeForm.value,...u}; const i=forms.value.findIndex(f=>f.id===activeForm.value.id); if(i!==-1)forms.value[i]=activeForm.value }
</script>

<style scoped>
/* System font stack — no Google Fonts import, uses Inter/system UI */
* { box-sizing: border-box; }
.page {
  padding: 20px 24px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  color: #1e293b;
  min-height: 100%;
}
.muted  { color: #94a3b8; }
.req    { color: #ef4444; font-size: 11px; }

/* ── Page header ── */
.page-hd  { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
.page-title { font-size:18px; font-weight:700; color:#0f172a; margin:0 0 3px; letter-spacing:-.3px; }
.page-sub   { font-size:12px; color:#94a3b8; margin:0; }

/* ── Filters ── */
.filter-bar   { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:10px; flex-wrap:wrap; }
.filter-tabs  { display:flex; gap:3px; flex-wrap:wrap; }
.ftab { padding:5px 13px; border-radius:20px; font-size:12px; font-weight:500; cursor:pointer; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; display:inline-flex; align-items:center; gap:5px; transition:all .15s; font-family:inherit; }
.ftab:hover   { border-color:#cbd5e1; background:#f8fafc; }
.ftab.active  { background:#0f172a; color:#fff; border-color:#0f172a; }
.ftab-badge   { background:#3b82f6; color:#fff; border-radius:10px; font-size:10px; padding:1px 5px; }
.filter-right { display:flex; gap:6px; }
.fsel { padding:6px 10px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:12px; font-family:inherit; background:#fff; cursor:pointer; outline:none; color:#374151; font-weight:500; }

/* ── Skeleton ── */
.forms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; }
.skel-card  { background:#fff; border:1.5px solid #e8edf3; border-radius:10px; padding:16px; }
.sk { background:linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:5px; }
.sk-top  { height:14px; width:55%; margin-bottom:10px; }
.sk-name { height:18px; width:80%; margin-bottom:8px; }
.sk-sub  { height:13px; width:50%; margin-bottom:12px; }
.sk-foot { height:13px; width:40%; }
@keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

/* ── Empty ── */
.empty-state  { display:flex; flex-direction:column; align-items:center; gap:10px; padding:64px 0; text-align:center; }
.empty-title  { font-size:15px; font-weight:600; color:#374151; margin:0; }
.empty-sub    { font-size:12px; color:#94a3b8; margin:0 0 6px; }

/* ── Form cards ── */
.form-card  { background:#fff; border:1.5px solid #e8edf3; border-radius:10px; padding:14px 16px; cursor:pointer; transition:all .15s; }
.form-card:hover { border-color:#bfdbfe; box-shadow:0 2px 10px rgba(59,130,246,.09); transform:translateY(-1px); }
.fc-top     { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
.fc-name    { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:2px; }
.fc-div     { font-size:11px; color:#94a3b8; margin-bottom:10px; }
.fc-foot    { display:flex; align-items:center; justify-content:space-between; }
.fc-period  { font-size:11px; color:#64748b; }
.fc-score   { font-size:16px; font-weight:700; color:#16a34a; }

/* ── Badges ── */
.type-pill   { padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; letter-spacing:.01em; }
.pill-ipcrf  { background:#dbeafe; color:#1d4ed8; }
.pill-ccef   { background:#ede9fe; color:#6d28d9; }
.status-chip { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:2px 7px; border-radius:10px; }
.chip-dot    { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.7; }
.s-draft     { background:#f1f5f9; color:#64748b; }
.s-submitted { background:#dbeafe; color:#1d4ed8; }
.s-returned  { background:#fef9c3; color:#92400e; }
.s-approved  { background:#dcfce7; color:#166534; }
.s-rated     { background:#e0f2fe; color:#075985; }
.s-finalized { background:#f3e8ff; color:#6b21a8; }

/* ── Buttons ── */
.btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer; border:1.5px solid #e2e8f0; background:#fff; color:#374151; transition:all .15s; font-family:inherit; }
.btn:hover    { background:#f8fafc; border-color:#cbd5e1; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.btn-primary  { background:#2563eb; color:#fff; border-color:#2563eb; }
.btn-primary:hover  { background:#1d4ed8; }
.btn-success  { background:#16a34a; color:#fff; border-color:#16a34a; }
.btn-success:hover  { background:#15803d; }
.btn-danger   { background:#ef4444; color:#fff; border-color:#ef4444; }
.btn-danger:hover   { background:#dc2626; }
.btn-outline-danger { background:#fff; color:#ef4444; border-color:#fca5a5; }
.btn-outline-danger:hover { background:#fef2f2; }
.btn-sm  { padding:5px 12px; font-size:11px; }
.xbtn    { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; border:none; background:transparent; cursor:pointer; color:#94a3b8; flex-shrink:0; }
.xbtn:hover { background:#f1f5f9; color:#475569; }

/* ── Modals ── */
.ov { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:200; backdrop-filter:blur(3px); }
.modal { background:#fff; border-radius:14px; width:calc(100% - 32px); max-width:500px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(0,0,0,.22); animation:pop-in .18s ease; }
.modal-xl { max-width:800px; }
.modal-lib { max-width:700px; }
.modal-confirm { max-width:560px; }
@keyframes pop-in { from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none} }
.mhd { display:flex; align-items:flex-start; justify-content:space-between; padding:18px 24px 14px; border-bottom:1px solid #f1f5f9; flex-shrink:0; gap:12px; }
.mhd-left  { flex:1; min-width:0; }
.mhd-badges { display:flex; gap:6px; margin-bottom:6px; }
.mhd-name { font-size:16px; font-weight:700; color:#0f172a; letter-spacing:-.3px; }
.mhd-sub  { font-size:11px; color:#94a3b8; margin-top:2px; }
.mtitle   { font-size:15px; font-weight:700; color:#0f172a; letter-spacing:-.2px; }
.msub     { font-size:11px; color:#94a3b8; margin-top:3px; }
.mbody    { padding:16px 24px; overflow-y:auto; flex:1; }
.mft      { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 24px; border-top:1px solid #f1f5f9; background:#f8fafc; border-radius:0 0 14px 14px; flex-shrink:0; }
.lib-mft  { justify-content:space-between; }

/* ── Modal tabs ── */
.modal-tabs { display:flex; padding:0 24px; border-bottom:1px solid #e8edf3; flex-shrink:0; }
.mtab { padding:10px 14px; font-size:12px; font-weight:500; cursor:pointer; border:none; background:transparent; color:#64748b; border-bottom:2px solid transparent; margin-bottom:-1px; font-family:inherit; transition:all .15s; display:inline-flex; align-items:center; gap:5px; }
.mtab:hover  { color:#374151; }
.mtab.active { color:#2563eb; border-bottom-color:#2563eb; font-weight:600; }
.mtab-count  { background:#eff6ff; color:#2563eb; border-radius:9px; font-size:10px; padding:1px 6px; font-weight:600; }

.tab-body    { display:flex; flex-direction:column; gap:0; }
.loading-entries { display:flex; align-items:center; justify-content:center; gap:10px; padding:40px 0; flex:1; }
.spin-sm { width:18px; height:18px; border:2px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation:spin .6s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }

/* ── Function sections ── */
.fn-block { margin-bottom:20px; }
.fn-hd    { display:flex; align-items:center; justify-content:space-between; background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:8px 14px; margin-bottom:8px; }
.fn-hd-l  { display:flex; align-items:center; gap:8px; }
.fn-label { font-size:12px; font-weight:600; color:#374151; }
.fn-wt    { background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:600; padding:1px 7px; border-radius:8px; }
.fn-wt-p  { background:#f3e8ff; color:#6d28d9; }
.fn-cnt   { font-size:10px; color:#94a3b8; }
.fn-hd-r  { display:flex; gap:5px; }
.fn-empty { text-align:center; padding:12px; font-size:11px; color:#94a3b8; border:1.5px dashed #e2e8f0; border-radius:8px; }

.lib-btn  { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:600; border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; cursor:pointer; font-family:inherit; transition:all .12s; }
.lib-btn:hover { background:#2563eb; color:#fff; border-color:#2563eb; }
.lib-btn-ghost { border-color:#e2e8f0; background:#fff; color:#475569; }
.lib-btn-ghost:hover { background:#f8fafc; border-color:#cbd5e1; color:#1d4ed8; }

/* ── Entry cards ── */
.entries-list { display:flex; flex-direction:column; gap:5px; }
.ec           { background:#fff; border:1.5px solid #e8edf3; border-radius:8px; transition:border-color .12s; }
.ec:hover     { border-color:#bfdbfe; }
.ec-body      { padding:10px 12px; }
.ec-row1      { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
.ec-kra       { font-size:11px; font-weight:600; color:#1d4ed8; background:#eff6ff; padding:2px 8px; border-radius:8px; }
.ec-kra-p     { color:#6d28d9; background:#f3e8ff; }
.ec-acts      { display:flex; gap:3px; }
.act  { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; border:1px solid transparent; background:transparent; cursor:pointer; color:#94a3b8; transition:all .12s; }
.act:hover    { background:#f1f5f9; border-color:#e2e8f0; color:#475569; }
.act-del:hover { background:#fef2f2; border-color:#fca5a5; color:#ef4444; }
.ec-si  { font-size:11px; color:#475569; line-height:1.55; margin-bottom:7px; }
.ec-tags { display:flex; flex-wrap:wrap; gap:4px; }

/* ── Tags ── */
.etag       { padding:2px 7px; border-radius:9px; font-size:10px; font-weight:500; background:#f1f5f9; color:#64748b; }
.etag-blue  { background:#dbeafe; color:#1d4ed8; }
.etag-amber { background:#fef3c7; color:#92400e; }
.etag-green { background:#dcfce7; color:#166534; }

/* ── Workflow bar ── */
.wf-bar  { display:flex; align-items:center; justify-content:space-between; padding:14px 0; margin-top:4px; border-top:1px solid #f1f5f9; }
.wf-info { font-size:11px; color:#64748b; display:flex; align-items:center; gap:5px; }

/* ── Details 2-col ── */
.det-2col { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.det-section-title { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.07em; margin-bottom:10px; }
.det-row  { display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid #f8fafc; gap:12px; }
.dk { font-size:11px; color:#94a3b8; font-weight:500; flex-shrink:0; }
.dv { font-size:12px; color:#1a2332; text-align:right; }
.weights-bar-wrap { padding:4px 0; }
.weights-bar { display:flex; height:26px; border-radius:6px; overflow:hidden; }
.wb-c { background:#2563eb; display:flex; align-items:center; justify-content:center; font-size:11px; color:#fff; font-weight:600; }
.wb-s { background:#7c3aed; display:flex; align-items:center; justify-content:center; font-size:11px; color:#fff; font-weight:600; }

/* ── Score ── */
.score-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px 0; }
.score-view  { text-align:center; }
.score-hero  { display:inline-flex; align-items:baseline; gap:5px; padding:14px 24px; border-radius:14px; margin-bottom:8px; }
.score-out { background:#dcfce7; } .score-vs { background:#dbeafe; } .score-sat { background:#fef9c3; } .score-low { background:#fee2e2; }
.score-big  { font-size:52px; font-weight:800; color:#0f172a; line-height:1; letter-spacing:-2px; }
.score-denom { font-size:16px; color:#94a3b8; }
.score-adj  { font-size:15px; font-weight:600; color:#374151; }
.score-table { margin-top:20px; border:1px solid #f1f5f9; border-radius:9px; overflow:hidden; text-align:left; }
.st-hd  { display:flex; justify-content:space-between; padding:8px 14px; background:#f8fafc; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; }
.st-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-top:1px solid #f8fafc; }
.st-l   { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
.st-fn  { width:18px; height:18px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; flex-shrink:0; }
.fn-c   { background:#dbeafe; color:#1d4ed8; }
.fn-s   { background:#ede9fe; color:#6d28d9; }
.st-name { font-size:12px; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.st-val  { font-size:12px; font-weight:600; color:#0f172a; flex-shrink:0; }

/* ── Library ── */
.lib-filters { display:flex; gap:8px; padding:12px 24px; border-bottom:1px solid #f1f5f9; flex-shrink:0; flex-wrap:wrap; }
.srch-wrap   { flex:1; position:relative; min-width:160px; }
.srch-icon   { position:absolute; left:10px; top:50%; transform:translateY(-50%); pointer-events:none; }
.srch-inp    { width:100%; padding:8px 11px 8px 30px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:12px; font-family:inherit; color:#0f172a; outline:none; }
.srch-inp:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }
.sel-strip   { display:flex; align-items:center; justify-content:space-between; padding:7px 24px; background:#eff6ff; border-bottom:1px solid #dbeafe; flex-shrink:0; }
.sel-count   { font-size:12px; font-weight:600; color:#1d4ed8; }
.sel-clear   { font-size:11px; color:#64748b; background:none; border:none; cursor:pointer; text-decoration:underline; font-family:inherit; }
.lib-scroll  { max-height:48vh; overflow-y:auto; padding:12px 24px !important; }
.lib-list    { display:flex; flex-direction:column; gap:6px; }
.lib-item    { display:flex; align-items:flex-start; gap:12px; padding:11px 14px; border:1.5px solid #e8edf3; border-radius:9px; cursor:pointer; transition:all .12s; user-select:none; }
.lib-item:hover { border-color:#bfdbfe; background:#f8fbff; }
.lib-sel     { border-color:#3b82f6; background:#eff6ff; }
.chk         { width:20px; height:20px; border-radius:5px; border:2px solid #cbd5e1; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; transition:all .12s; }
.chk-on      { background:#2563eb; border-color:#2563eb; }
.lib-content  { flex:1; min-width:0; }
.lib-kra-row  { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
.lib-kra      { font-size:12px; font-weight:600; color:#0f172a; }
.lib-tags     { display:flex; flex-wrap:wrap; gap:3px; }
.lib-pi       { font-size:11px; color:#475569; line-height:1.55; }

/* ── Confirm selection items ── */
.confirm-scroll { max-height:52vh; overflow-y:auto; padding:16px 24px !important; }
.ci   { display:flex; align-items:flex-start; gap:12px; padding:14px 0; border-bottom:1px solid #f1f5f9; }
.ci-num { width:24px; height:24px; border-radius:50%; background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
.ci-body { flex:1; min-width:0; }
.ci-kra  { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:5px; letter-spacing:-.1px; }
.ci-pi   { font-size:12px; color:#475569; line-height:1.6; margin-bottom:8px; }
.ci-meta { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
.ci-mov  { font-size:11px; color:#64748b; background:#f8fafc; border:1px solid #f1f5f9; border-radius:6px; padding:5px 8px; line-height:1.5; }
.ci-mov-label { font-weight:600; color:#374151; }
.ci-rm   { display:flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:5px; border:none; background:transparent; cursor:pointer; color:#cbd5e1; flex-shrink:0; }
.ci-rm:hover { background:#fef2f2; color:#ef4444; }

/* ── Fullscreen lock ── */
.fullscreen-lock { position:fixed; inset:0; background:rgba(15,23,42,.88); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); }
.lock-box    { background:#fff; border-radius:20px; padding:40px 48px; text-align:center; width:340px; box-shadow:0 32px 80px rgba(0,0,0,.3); }
.lock-spin   { width:48px; height:48px; border:4px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin .7s linear infinite; margin:0 auto 20px; }
.lock-title  { font-size:16px; font-weight:700; color:#0f172a; margin-bottom:4px; letter-spacing:-.2px; }
.lock-count  { font-size:13px; color:#64748b; margin-bottom:16px; }
.prog-track  { height:6px; background:#f1f5f9; border-radius:6px; overflow:hidden; margin-bottom:10px; }
.prog-fill   { height:100%; background:linear-gradient(90deg,#2563eb,#7c3aed); border-radius:6px; transition:width .3s ease; }
.lock-hint   { font-size:11px; color:#94a3b8; }

/* ── Form fields ── */
.fsec  { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.07em; margin-bottom:10px; }
.fgrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.field      { display:flex; flex-direction:column; gap:5px; }
.field.full { grid-column:span 2; }
.fl  { font-size:11px; font-weight:600; color:#374151; }
.fi  { padding:8px 11px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:12px; font-family:inherit; color:#0f172a; outline:none; transition:border-color .15s,box-shadow .15s; resize:vertical; background:#fff; }
.fi:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }
.fi::placeholder { color:#cbd5e1; }
.avg-box { background:#f0fdf4; color:#16a34a; font-weight:600; cursor:default; pointer-events:none; }

/* ── Confirm delete ── */
.confirm-box { background:#fff; border-radius:14px; padding:28px 26px; max-width:360px; width:calc(100% - 32px); text-align:center; box-shadow:0 24px 64px rgba(0,0,0,.22); animation:pop-in .18s ease; }
.cb-icon  { width:48px; height:48px; border-radius:14px; background:#fef2f2; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.cb-title { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:7px; letter-spacing:-.2px; }
.cb-msg   { font-size:12px; color:#475569; line-height:1.65; margin-bottom:20px; }
.cb-btns  { display:flex; justify-content:center; gap:8px; }

/* ── Toast ── */
.toast { position:fixed; bottom:24px; right:24px; z-index:400; padding:10px 16px; border-radius:9px; font-size:12px; font-weight:500; box-shadow:0 4px 20px rgba(0,0,0,.12); pointer-events:none; }
.toast-success { background:#f0fdf4; color:#166534; border:1px solid #86efac; }
.toast-error   { background:#fef2f2; color:#991b1b; border:1px solid #fca5a5; }
.toast-enter-active,.toast-leave-active { transition:opacity .25s,transform .25s; }
.toast-enter-from,.toast-leave-to       { opacity:0; transform:translateY(8px); }

/* ── State wrap / spinner ── */
.spinner    { width:24px; height:24px; border:2.5px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation:spin .7s linear infinite; }
.state-wrap { display:flex; flex-direction:column; align-items:center; gap:10px; padding:32px 0; }
</style>