<template>
  <div class="page">

    <!-- ════════════════════════════════════════
         FORMS LIST VIEW  (shown when no form open)
    ════════════════════════════════════════ -->
    <template v-if="!activeForm">

      <!-- Header -->
      <div class="page-hd">
        <div>
          <h2 class="page-title">IPCRF / CCEF Forms</h2>
          <p class="page-sub">Individual Performance Commitment and Review Forms</p>
        </div>
        <button class="btn btn-primary" @click="showNewFormModal = true">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          New Form
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-tabs">
          <button v-for="t in statusTabs" :key="t.value"
            :class="['ftab', activeStatus === t.value && 'active']"
            @click="activeStatus = t.value">
            {{ t.label }}
            <span v-if="t.value !== 'ALL' && countByStatus(t.value)" class="ftab-count">{{ countByStatus(t.value) }}</span>
          </button>
        </div>
        <div class="filter-right">
          <select v-model="filterType" class="fsel">
            <option value="">All Types</option>
            <option value="IPCRF">IPCRF</option>
            <option value="CCEF">CCEF</option>
          </select>
          <select v-model="filterSemester" class="fsel">
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </div>
      </div>

      <!-- Skeleton loading -->
      <div v-if="loading" class="forms-grid">
        <div v-for="i in 4" :key="i" class="skel-card">
          <div class="sk sk-row"></div>
          <div class="sk sk-name"></div>
          <div class="sk sk-sub"></div>
          <div class="sk sk-foot"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredForms.length === 0" class="empty-state">
        <div class="empty-ill">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="8" y="6" width="36" height="40" rx="4" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
            <path d="M17 18h18M17 25h14M17 32h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-title">No forms found</div>
        <div class="empty-sub">{{ activeStatus !== 'ALL' ? `No ${activeStatus.toLowerCase()} forms yet.` : 'Create your first IPCRF or CCEF form to get started.' }}</div>
        <button v-if="activeStatus === 'ALL'" class="btn btn-primary" @click="showNewFormModal = true">Create New Form</button>
      </div>

      <!-- Forms grid -->
      <div v-else class="forms-grid">
        <div v-for="form in filteredForms" :key="form.id" class="form-card" @click="openForm(form)">
          <div class="fc-top">
            <span :class="['type-pill', form.type === 'IPCRF' ? 'pill-ipcrf' : 'pill-ccef']">{{ form.type }}</span>
            <span :class="['status-chip', `s-${(form.status||'').toLowerCase()}`]">
              <i class="chip-dot"></i>{{ form.status }}
            </span>
          </div>
          <div class="fc-name">{{ form.employeeName }}</div>
          <div class="fc-div">{{ form.divisionName || '—' }}</div>
          <div class="fc-foot">
            <span class="fc-period">Sem {{ form.semester }} · {{ form.year }}</span>
            <span v-if="form.finalNumericalRating" class="fc-score">{{ form.finalNumericalRating }}</span>
          </div>
        </div>
      </div>

    </template>

    <!-- ════════════════════════════════════════
         FORM DETAIL VIEW  (full page, replaces list)
    ════════════════════════════════════════ -->
    <template v-else>

      <!-- Back header -->
      <div class="detail-hd">
        <button class="back-btn" @click="activeForm = null; allEntries = []">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Back
        </button>
        <div class="detail-hd-info">
          <div class="detail-hd-badges">
            <span :class="['type-pill', activeForm.type === 'IPCRF' ? 'pill-ipcrf' : 'pill-ccef']">{{ activeForm.type }}</span>
            <span :class="['status-chip', `s-${(activeForm.status||'').toLowerCase()}`]">
              <i class="chip-dot"></i>{{ activeForm.status }}
            </span>
          </div>
          <div class="detail-hd-name">{{ activeForm.employeeName }}</div>
          <div class="detail-hd-sub">Sem {{ activeForm.semester }} · {{ activeForm.year }} · {{ activeForm.divisionName }}</div>
        </div>
      </div>

      <!-- Detail tabs -->
      <div class="detail-tabs">
        <button :class="['dtab', activeTab === 'indicators' && 'active']" @click="activeTab = 'indicators'">
          Indicators <span v-if="allEntries.length" class="dtab-count">{{ allEntries.length }}</span>
        </button>
        <button :class="['dtab', activeTab === 'details' && 'active']" @click="activeTab = 'details'">Details</button>
        <button :class="['dtab', activeTab === 'score' && 'active']" @click="activeTab = 'score'">Score</button>
      </div>

      <!-- Loading entries -->
      <div v-if="entriesLoading" class="entries-loading-state">
        <div class="spin-sm"></div>
        <span class="muted">Loading indicators…</span>
      </div>

      <!-- ── INDICATORS TAB ── -->
      <div v-else-if="activeTab === 'indicators'" class="indicators-layout">

        <!-- Core block -->
        <div class="fn-section">
          <div class="fn-hd">
            <div class="fn-hd-left">
              <span class="fn-title">Core Functions</span>
              <span class="fn-wt-pill">{{ activeForm.coreFunctionWeight }}%</span>
              <span class="fn-count">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
            </div>
            <div class="fn-hd-right">
              <button class="add-pill" @click="openLibrary('Core')">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                From Library
              </button>
              <button class="add-pill add-pill-ghost" @click="openCustomEntry('Core')">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                Custom
              </button>
            </div>
          </div>
          <div v-if="coreEntries.length === 0" class="fn-empty">No core indicators added yet</div>
          <div v-else class="entries-list">
            <div v-for="e in coreEntries" :key="e.id" class="entry-card">
              <div class="ec-main">
                <div class="ec-top">
                  <span class="ec-kra">{{ e.kraName }}</span>
                  <div class="ec-acts">
                    <button class="act-btn" @click="openEditEntry(e)" title="Edit">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="act-btn act-del" @click="askDelete(e)" title="Remove">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <div class="ec-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 110) }}</div>
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

        <!-- Support block -->
        <div class="fn-section">
          <div class="fn-hd">
            <div class="fn-hd-left">
              <span class="fn-title">Support Functions</span>
              <span class="fn-wt-pill fn-wt-purple">{{ activeForm.supportFunctionWeight }}%</span>
              <span class="fn-count">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
            </div>
            <div class="fn-hd-right">
              <button class="add-pill" @click="openLibrary('Support')">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                From Library
              </button>
              <button class="add-pill add-pill-ghost" @click="openCustomEntry('Support')">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                Custom
              </button>
            </div>
          </div>
          <div v-if="supportEntries.length === 0" class="fn-empty">No support indicators added yet</div>
          <div v-else class="entries-list">
            <div v-for="e in supportEntries" :key="e.id" class="entry-card">
              <div class="ec-main">
                <div class="ec-top">
                  <span class="ec-kra ec-kra-purple">{{ e.kraName }}</span>
                  <div class="ec-acts">
                    <button class="act-btn" @click="openEditEntry(e)" title="Edit">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="act-btn act-del" @click="askDelete(e)" title="Remove">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <div class="ec-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 110) }}</div>
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

        <!-- Workflow bar -->
        <div v-if="['DRAFT','RETURNED'].includes(activeForm.status)" class="workflow-bar">
          <span class="wf-info">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#64748B" stroke-width="1.2"/><path d="M7 6.5v3M7 4.5v.5" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/></svg>
            {{ allEntries.length }} indicator{{ allEntries.length !== 1 ? 's' : '' }} total
          </span>
          <button class="btn btn-primary btn-sm" @click="doSubmitForm">Submit for Review</button>
        </div>
        <div v-else-if="activeForm.status === 'SUBMITTED'" class="workflow-bar">
          <span class="wf-info">Pending Division Chief review</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-success btn-sm" @click="doApproveForm">Approve</button>
            <button class="btn btn-outline-danger btn-sm" @click="doReturnForm">Return</button>
          </div>
        </div>
      </div>

      <!-- ── DETAILS TAB ── -->
      <div v-else-if="activeTab === 'details'" class="detail-body">
        <div class="det-section">
          <div class="det-sec-title">Period & Classification</div>
          <div class="det-grid">
            <div class="det-item"><span class="dk">Form Type</span><span class="dv">{{ activeForm.type }}</span></div>
            <div class="det-item"><span class="dk">Semester / Year</span><span class="dv">Sem {{ activeForm.semester }}, {{ activeForm.year }}</span></div>
            <div class="det-item"><span class="dk">Position Level</span><span class="dv">{{ activeForm.positionLevel || '—' }}</span></div>
            <div class="det-item"><span class="dk">Division</span><span class="dv">{{ activeForm.divisionName || '—' }}</span></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Function Weights</div>
          <div class="weights-bar-wrap">
            <div class="weights-bar">
              <div class="wb-c" :style="{width: activeForm.coreFunctionWeight+'%'}">Core {{ activeForm.coreFunctionWeight }}%</div>
              <div class="wb-s" :style="{width: activeForm.supportFunctionWeight+'%'}">Support {{ activeForm.supportFunctionWeight }}%</div>
            </div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Signatories</div>
          <div class="det-grid">
            <div class="det-item"><span class="dk">Immediate Supervisor</span><span class="dv">{{ activeForm.immediateSupervisor || '—' }}</span></div>
            <div class="det-item"><span class="dk">Supervisor Position</span><span class="dv">{{ activeForm.supervisorPosition || '—' }}</span></div>
            <div class="det-item"><span class="dk">Approving Authority</span><span class="dv">{{ activeForm.approvingAuthority || '—' }}</span></div>
            <div class="det-item"><span class="dk">Authority Position</span><span class="dv">{{ activeForm.authorityPosition || '—' }}</span></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Timeline</div>
          <div class="det-grid">
            <div class="det-item"><span class="dk">Created</span><span class="dv">{{ fmtDate(activeForm.createdAt) || '—' }}</span></div>
            <div class="det-item"><span class="dk">Submitted</span><span class="dv">{{ fmtDate(activeForm.submittedAt) || '—' }}</span></div>
            <div class="det-item"><span class="dk">Approved</span><span class="dv">{{ fmtDate(activeForm.approvedAt) || '—' }}</span></div>
          </div>
        </div>
      </div>

      <!-- ── SCORE TAB ── -->
      <div v-else-if="activeTab === 'score'" class="detail-body">
        <div v-if="!activeForm.finalNumericalRating" class="score-empty">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M22 13v9l6 4" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
          <p class="muted">Score not yet computed</p>
          <button class="btn btn-primary btn-sm" @click="doComputeScore">Compute Score</button>
        </div>
        <div v-else class="score-display">
          <div :class="['score-hero', scoreColorClass]">
            <span class="score-big">{{ activeForm.finalNumericalRating }}</span>
            <span class="score-denom">/ 5.0</span>
          </div>
          <div class="score-adj">{{ activeForm.adjectivalRating }}</div>
          <div class="score-table">
            <div class="st-hd"><span>Indicator</span><span>Avg</span></div>
            <div v-for="e in allEntries" :key="e.id" class="st-row">
              <div class="st-left">
                <span :class="['st-fn', e.functionType === 'Core' ? 'fn-c' : 'fn-s']">{{ e.functionType[0] }}</span>
                <span class="st-name">{{ e.kraName }}</span>
              </div>
              <span :class="['st-val', e.ratingAverage ? '' : 'muted']">{{ e.ratingAverage || '—' }}</span>
            </div>
          </div>
          <button class="btn btn-sm" style="margin-top:16px" @click="doComputeScore">Recompute</button>
        </div>
      </div>

    </template>

    <!-- ════════════════════════════════════════
         MODAL: NEW FORM
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showNewFormModal" class="ov" @click.self="showNewFormModal = false">
        <div class="modal" style="max-width:480px">
          <div class="mhd">
            <div><div class="mtitle">New Performance Form</div><div class="msub">IPCRF or CCEF for this semester</div></div>
            <button class="xbtn" @click="showNewFormModal = false"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          </div>
          <div class="mbody">
            <div class="fsec-title">Basic Info</div>
            <div class="fgrid">
              <div class="field"><label class="fl">Form Type</label><select v-model="newForm.type" class="fi"><option>IPCRF</option><option>CCEF</option></select></div>
              <div class="field"><label class="fl">Position Level</label><select v-model="newForm.positionLevel" class="fi"><option value="II">Level II</option><option value="III">Level III</option><option value="IV">Level IV</option></select></div>
              <div class="field"><label class="fl">Semester</label><select v-model="newForm.semester" class="fi"><option value="1">1st Semester</option><option value="2">2nd Semester</option></select></div>
              <div class="field"><label class="fl">Year</label><input v-model.number="newForm.year" type="number" class="fi"/></div>
            </div>
            <div class="fsec-title" style="margin-top:16px">Signatories</div>
            <div class="fgrid">
              <div class="field full"><label class="fl">Immediate Supervisor</label><input v-model="newForm.immediateSupervisor" type="text" class="fi" placeholder="Full name"/></div>
              <div class="field full"><label class="fl">Supervisor Position</label><input v-model="newForm.supervisorPosition" type="text" class="fi" placeholder="e.g. Division Chief / SWO V"/></div>
              <div class="field full"><label class="fl">Approving Authority</label><input v-model="newForm.approvingAuthority" type="text" class="fi" placeholder="e.g. Helen Y. Suzara"/></div>
              <div class="field full"><label class="fl">Authority Position</label><input v-model="newForm.authorityPosition" type="text" class="fi" placeholder="e.g. Bureau Director"/></div>
            </div>
          </div>
          <div class="mft">
            <button class="btn" @click="showNewFormModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="creating" @click="createForm">{{ creating ? 'Creating…' : 'Create Form' }}</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ════════════════════════════════════════
         MODAL: KRA LIBRARY (multi-select)
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibrary" class="ov" @click.self="cancelLibrary">
        <div class="modal modal-lib">
          <div class="mhd">
            <div>
              <div class="mtitle">
                KRA Library
                <span :class="['type-pill ml-6', currentFnType === 'Core' ? 'pill-ipcrf' : 'pill-ccef']" style="font-size:10px">{{ currentFnType }}</span>
              </div>
              <div class="msub">Select multiple indicators, then click <strong>Add Selected</strong></div>
            </div>
            <button class="xbtn" @click="cancelLibrary">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>

          <!-- Search / filter row -->
          <div class="lib-filters">
            <div class="srch-wrap">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="srch-icon"><circle cx="5.5" cy="5.5" r="4.5" stroke="#94A3B8" stroke-width="1.2"/><path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/></svg>
              <input v-model="libSearch" type="text" class="srch-inp" placeholder="Search KRA name or indicator…" autofocus/>
            </div>
            <select v-model="libPhase" class="fi" style="width:120px">
              <option value="">All Phases</option>
              <option v-for="p in libPhases" :key="p">{{ p }}</option>
            </select>
            <select v-model="libClass" class="fi" style="width:120px">
              <option value="">All Types</option>
              <option>Simple</option>
              <option>Complex</option>
              <option>Highly Technical</option>
              <option>Exempted</option>
            </select>
          </div>

          <!-- Selection strip -->
          <div v-if="libSelected.length" class="sel-strip">
            <span class="sel-count">{{ libSelected.length }} selected</span>
            <button class="sel-clear" @click="libSelected = []">Clear all</button>
          </div>

          <!-- Library list -->
          <div class="mbody lib-scroll">
            <div v-if="libLoading" class="state-wrap"><div class="spinner"></div></div>
            <div v-else-if="filteredLibrary.length === 0" class="state-wrap"><p class="muted">No matching indicators</p></div>
            <div v-else class="lib-list">
              <div v-for="item in filteredLibrary" :key="item.id"
                :class="['lib-item', isSelected(item) && 'lib-item-sel']"
                @click="toggleSelect(item)">
                <!-- Checkbox -->
                <div :class="['lib-chk', isSelected(item) && 'chk-on']">
                  <svg v-if="isSelected(item)" width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <!-- Content -->
                <div class="lib-content">
                  <div class="lib-kra-row">
                    <span class="lib-kra">{{ item.kraName }}</span>
                    <div class="lib-tags">
                      <span class="etag">{{ item.phase }}</span>
                      <span class="etag">Wt: {{ posWeight(item) }}%</span>
                      <span :class="['etag', item.classification !== 'Simple' ? 'etag-blue' : '']">{{ item.classification }}</span>
                    </div>
                  </div>
                  <div class="lib-pi">{{ truncate(item.performanceIndicator || item.successIndicator || '', 120) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="mft lib-ft">
            <span class="muted text-xs">{{ filteredLibrary.length }} indicator{{ filteredLibrary.length !== 1 ? 's' : '' }}</span>
            <div style="display:flex;gap:8px">
              <button class="btn" @click="cancelLibrary">Cancel</button>
              <button class="btn btn-primary" :disabled="!libSelected.length" @click="showLibConfirm = true">
                Add Selected ({{ libSelected.length }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ════════════════════════════════════════
         MODAL: CONFIRM SELECTED KRAs
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibConfirm" class="ov">
        <div class="modal modal-confirm-lib">
          <div class="mhd">
            <div>
              <div class="mtitle">Confirm Adding {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}</div>
              <div class="msub">Review your selection below. Click <em>Back to Edit</em> to change it.</div>
            </div>
          </div>
          <div class="mbody" style="max-height:55vh;overflow-y:auto">
            <div v-for="(item, idx) in libSelected" :key="item.id" class="confirm-item">
              <div class="ci-num">{{ idx + 1 }}</div>
              <div class="ci-body">
                <div class="ci-kra">{{ item.kraName }}</div>
                <div class="ci-pi">{{ truncate(item.performanceIndicator || item.successIndicator || '', 130) }}</div>
                <div class="ci-tags">
                  <span class="etag">{{ item.phase }}</span>
                  <span class="etag">Wt: {{ posWeight(item) }}%</span>
                  <span class="etag">{{ item.classification }}</span>
                  <span :class="['type-pill', currentFnType === 'Core' ? 'pill-ipcrf' : 'pill-ccef']" style="font-size:9px;padding:2px 6px">{{ currentFnType }}</span>
                </div>
              </div>
              <button class="ci-rm" @click="libSelected.splice(idx,1)" title="Remove">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
          <div class="mft">
            <button class="btn" @click="showLibConfirm = false">← Back to Edit</button>
            <button class="btn btn-primary" :disabled="!libSelected.length" @click="commitLibrarySelection">
              Confirm & Add All
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ════════════════════════════════════════
         FULLSCREEN LOCK: Adding indicators
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="addingProgress.active" class="fullscreen-lock">
        <div class="lock-box">
          <div class="lock-spinner"></div>
          <div class="lock-title">Adding Indicators…</div>
          <div class="lock-msg">{{ addingProgress.current }} of {{ addingProgress.total }}</div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: addingProgress.pct + '%' }"></div>
          </div>
          <div class="lock-sub">Please wait, do not close this page</div>
        </div>
      </div>
    </teleport>

    <!-- ════════════════════════════════════════
         MODAL: CUSTOM ENTRY (add / edit)
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showEntryModal" class="ov" @click.self="closeEntryModal">
        <div class="modal" style="max-width:480px">
          <div class="mhd">
            <div>
              <div class="mtitle">{{ editingEntry ? 'Edit Indicator' : 'Custom Indicator' }}</div>
              <div class="msub">
                <span :class="['type-pill', currentFnType === 'Core' ? 'pill-ipcrf' : 'pill-ccef']" style="font-size:10px">{{ currentFnType }} Function</span>
              </div>
            </div>
            <button class="xbtn" @click="closeEntryModal"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
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
              <div class="fsec-title" style="margin-top:16px">Rating</div>
              <div class="fgrid">
                <div class="field full"><label class="fl">Accomplishment</label><textarea v-model="entryForm.accomplishment" class="fi" rows="2" placeholder="What was accomplished this semester…"></textarea></div>
                <div class="field"><label class="fl">Efficiency <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingEfficiency" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div class="field"><label class="fl">Quality <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingQuality" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div class="field"><label class="fl">Timeliness <span class="muted">(1–5)</span></label><input v-model.number="entryForm.ratingTimeliness" type="number" class="fi" min="1" max="5" step="0.01"/></div>
                <div v-if="computedAvg" class="field"><label class="fl">Average</label><div class="fi avg-box">{{ computedAvg }}</div></div>
              </div>
            </template>
          </div>
          <div class="mft">
            <button class="btn" @click="closeEntryModal">Cancel</button>
            <button class="btn btn-primary" :disabled="savingEntry" @click="saveEntry">{{ savingEntry ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Add Indicator') }}</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ════════════════════════════════════════
         MODAL: CONFIRM DELETE
    ════════════════════════════════════════ -->
    <teleport to="body">
      <div v-if="confirmDel.show" class="ov">
        <div class="confirm-box">
          <div class="cb-icon danger"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M8 6V4h6v2M5 6v13a2 2 0 002 2h8a2 2 0 002-2V6" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="cb-title">Remove Indicator?</div>
          <div class="cb-msg">Remove <strong>{{ confirmDel.name }}</strong>?<br><span class="muted text-xs">This cannot be undone.</span></div>
          <div class="cb-btns">
            <button class="btn" @click="confirmDel.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="deletingEntry" @click="doDeleteEntry">{{ deletingEntry ? 'Removing…' : 'Remove' }}</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ── Toast ── -->
    <teleport to="body">
      <transition name="toast">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
          <svg v-if="toast.type === 'success'" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#16A34A" stroke-width="1.2"/><path d="M4 7l2.5 2.5L10 5" stroke="#16A34A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#DC2626" stroke-width="1.2"/><path d="M7 4.5v3M7 9.5v.5" stroke="#DC2626" stroke-width="1.2" stroke-linecap="round"/></svg>
          {{ toast.msg }}
        </div>
      </transition>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'

// ── Core state ──
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

// ── Library state ──
const showLibrary     = ref(false)
const showLibConfirm  = ref(false)
const libSelected     = ref([])
const libraryItems    = ref([])
const libLoading      = ref(false)
const libSearch       = ref('')
const libPhase        = ref('')
const libClass        = ref('')
const currentFnType   = ref('Core')

// ── Progress lock ──
const addingProgress = ref({ active: false, current: 0, total: 0, pct: 0 })

// ── Entry modal ──
const showEntryModal  = ref(false)
const editingEntry    = ref(null)
const savingEntry     = ref(false)
const deletingEntry   = ref(false)
const confirmDel      = ref({ show: false, entryId: null, name: '' })

// ── New form ──
const showNewFormModal = ref(false)
const newForm = ref({
  type: 'IPCRF', semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(), positionLevel: 'III',
  immediateSupervisor: '', supervisorPosition: '',
  approvingAuthority: '', authorityPosition: ''
})
const entryForm = ref({
  kraName: '', successIndicator: '', functionType: 'Core', weight: 5,
  applicableRatingPeriod: 'Both semesters', classification: 'Complex',
  meansOfVerification: '', accomplishment: '',
  ratingEfficiency: '', ratingQuality: '', ratingTimeliness: ''
})

// ── Toast ──
const toast = ref({ show: false, msg: '', type: 'success' })

const statusTabs = [
  { label: 'All', value: 'ALL' }, { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' }, { label: 'Approved', value: 'APPROVED' },
  { label: 'Rated', value: 'RATED' }, { label: 'Finalized', value: 'FINALIZED' }
]

// ── Computed ──
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
  if (libSearch.value) {
    const q = libSearch.value.toLowerCase()
    items = items.filter(i =>
      i.kraName?.toLowerCase().includes(q) ||
      (i.performanceIndicator || i.successIndicator || '').toLowerCase().includes(q)
    )
  }
  if (libPhase.value) items = items.filter(i => i.phase === libPhase.value)
  if (libClass.value) items = items.filter(i => i.classification === libClass.value)
  return items
})
const computedAvg = computed(() => {
  const e = Number(entryForm.value.ratingEfficiency)
  const q = Number(entryForm.value.ratingQuality)
  const t = Number(entryForm.value.ratingTimeliness)
  if (e && q && t) return Math.round((e + q + t) / 3 * 100) / 100
  return null
})
const scoreColorClass = computed(() => {
  const s = Number(activeForm.value?.finalNumericalRating)
  if (s >= 4.5) return 'score-out'
  if (s >= 3.5) return 'score-vs'
  if (s >= 2.5) return 'score-sat'
  return 'score-low'
})

// ── Helpers ──
function truncate(str, len) { if (!str) return ''; return str.length > len ? str.slice(0, len) + '…' : str }
function countByStatus(s)   { return forms.value.filter(f => f.status === s).length }
function posWeight(item)    { const l = activeForm.value?.positionLevel || 'III'; return Number(item[`weight${l}`] || item.weight || 0) }
function fmtDate(iso)       { if (!iso) return ''; return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3000) }
function isSelected(item)   { return libSelected.value.some(s => s.id === item.id) }
function toggleSelect(item) {
  const idx = libSelected.value.findIndex(s => s.id === item.id)
  if (idx !== -1) libSelected.value.splice(idx, 1)
  else libSelected.value.push(item)
}

onMounted(loadForms)

async function loadForms() {
  loading.value = true
  try {
    const res = await ipcrfApi.listForms()
    forms.value = Array.isArray(res) ? res : (res?.items || [])
  } catch (e) { showToast(`Could not load forms: ${e.message}`, 'error') }
  finally { loading.value = false }
}

async function openForm(form) {
  activeForm.value  = form
  activeTab.value   = 'indicators'
  allEntries.value  = []
  entriesLoading.value = true
  try {
    const res = await ipcrfApi.getEntries(form.id)
    allEntries.value = Array.isArray(res) ? res : []
  } catch (e) { showToast(e.message, 'error') }
  finally { entriesLoading.value = false }
  // Background library load
  if (libraryItems.value.length === 0) {
    libLoading.value = true
    kraLibraryApi.list().then(lib => { libraryItems.value = Array.isArray(lib) ? lib : [] }).catch(() => {}).finally(() => { libLoading.value = false })
  }
}

async function createForm() {
  if (creating.value) return
  creating.value = true
  try {
    const form = await ipcrfApi.createForm(newForm.value)
    forms.value.unshift(form)
    showNewFormModal.value = false
    showToast('Form created')
    await openForm(form)
  } catch (e) { showToast(e.message, 'error') }
  finally { creating.value = false }
}

function openLibrary(fnType) {
  currentFnType.value = fnType
  libSearch.value = ''; libPhase.value = ''; libClass.value = ''
  libSelected.value = []
  showLibConfirm.value = false
  showLibrary.value = true
}

function cancelLibrary() {
  showLibrary.value = false
  showLibConfirm.value = false
  libSelected.value = []
}

async function commitLibrarySelection() {
  const items = [...libSelected.value]
  showLibConfirm.value = false
  showLibrary.value = false

  // Fullscreen lock + progress
  addingProgress.value = { active: true, current: 0, total: items.length, pct: 0 }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        masterKRAId:            item.id,
        functionType:           currentFnType.value,
        kraName:                item.kraName,
        successIndicator:       item.performanceIndicator || item.successIndicator || '',
        applicableRatingPeriod: item.applicableTo === 'BOTH' ? 'Both semesters' : (item.applicableTo || 'Both semesters'),
        weight:                 posWeight(item),
        classification:         item.classification || '',
        efficiencyGuide:        item.efficiencyGuide || '',
        qualityGuide:           item.qualityGuide    || '',
        timelinessGuide:        item.timelinessGuide || '',
        meansOfVerification:    item.meansOfVerification || '',
        isCustom: false
      })
      allEntries.value.push(entry)
    } catch (e) {
      console.warn('Failed to add', item.kraName, e.message)
    }
    addingProgress.value.current = i + 1
    addingProgress.value.pct     = Math.round(((i + 1) / items.length) * 100)
  }

  addingProgress.value.active = false
  libSelected.value = []
  showToast(`${items.length} indicator${items.length !== 1 ? 's' : ''} added`)
}

function openCustomEntry(fnType) {
  currentFnType.value = fnType; editingEntry.value = null
  entryForm.value = { kraName:'', successIndicator:'', functionType: fnType, weight:5, applicableRatingPeriod:'Both semesters', classification:'Complex', meansOfVerification:'', accomplishment:'', ratingEfficiency:'', ratingQuality:'', ratingTimeliness:'' }
  showEntryModal.value = true
}
function openEditEntry(entry) {
  editingEntry.value   = entry
  currentFnType.value  = entry.functionType
  entryForm.value = { kraName: entry.kraName, successIndicator: entry.successIndicator, functionType: entry.functionType, weight: Number(entry.weight), applicableRatingPeriod: entry.applicableRatingPeriod, classification: entry.classification, meansOfVerification: entry.meansOfVerification, accomplishment: entry.accomplishment, ratingEfficiency: entry.ratingEfficiency, ratingQuality: entry.ratingQuality, ratingTimeliness: entry.ratingTimeliness }
  showEntryModal.value = true
}
function closeEntryModal() { showEntryModal.value = false; editingEntry.value = null }

async function saveEntry() {
  if (!entryForm.value.kraName || !entryForm.value.successIndicator) { showToast('KRA name and indicator are required', 'error'); return }
  savingEntry.value = true
  try {
    if (editingEntry.value) {
      const updated = await ipcrfApi.updateEntry(editingEntry.value.id, { ...entryForm.value, ratingAverage: computedAvg.value || entryForm.value.ratingAverage || '' })
      const idx = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (idx !== -1) allEntries.value[idx] = { ...allEntries.value[idx], ...updated }
      showToast('Indicator updated')
    } else {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, { ...entryForm.value, functionType: currentFnType.value, isCustom: true })
      allEntries.value.push(entry)
      showToast('Indicator added')
    }
    closeEntryModal()
  } catch (e) { showToast(e.message, 'error') }
  finally { savingEntry.value = false }
}

function askDelete(entry) { confirmDel.value = { show: true, entryId: entry.id, name: entry.kraName } }
async function doDeleteEntry() {
  deletingEntry.value = true
  try {
    await ipcrfApi.deleteEntry(confirmDel.value.entryId)
    allEntries.value = allEntries.value.filter(e => e.id !== confirmDel.value.entryId)
    showToast('Indicator removed'); confirmDel.value.show = false
  } catch (e) { showToast(e.message, 'error') }
  finally { deletingEntry.value = false }
}

async function doSubmitForm() {
  try { const u = await ipcrfApi.submitForm(activeForm.value.id); _sync(u); showToast('Form submitted for review') }
  catch (e) { showToast(e.message, 'error') }
}
async function doApproveForm() {
  try { const u = await ipcrfApi.approveForm(activeForm.value.id); _sync(u); showToast('Form approved') }
  catch (e) { showToast(e.message, 'error') }
}
async function doReturnForm() {
  try { const u = await ipcrfApi.returnForm(activeForm.value.id); _sync(u); showToast('Form returned') }
  catch (e) { showToast(e.message, 'error') }
}
async function doComputeScore() {
  try { const u = await ipcrfApi.computeScore(activeForm.value.id); _sync(u); showToast(`Score: ${u.finalNumericalRating} — ${u.adjectivalRating}`) }
  catch (e) { showToast(e.message, 'error') }
}
function _sync(u) {
  activeForm.value = { ...activeForm.value, ...u }
  const i = forms.value.findIndex(f => f.id === activeForm.value.id)
  if (i !== -1) forms.value[i] = activeForm.value
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
*{box-sizing:border-box;}

.page { padding: 20px 24px 32px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.muted  { color: #94A3B8; }
.text-xs { font-size: 11px; }
.req    { color: #EF4444; font-size: 11px; }
.ml-6   { margin-left: 6px; }

/* ── Page header ── */
.page-hd { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
.page-title { font-size:18px; font-weight:700; color:#0F172A; margin:0 0 3px; }
.page-sub   { font-size:12px; color:#94A3B8; margin:0; }

/* ── Filters ── */
.filter-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:10px; }
.filter-tabs { display:flex; gap:3px; flex-wrap:wrap; }
.ftab { padding:5px 13px; border-radius:20px; font-size:12px; font-weight:500; cursor:pointer; border:1.5px solid #E2E8F0; background:#fff; color:#64748B; display:inline-flex; align-items:center; gap:5px; transition:all .15s; font-family:'DM Sans',sans-serif; }
.ftab:hover  { border-color:#CBD5E1; background:#F8FAFC; }
.ftab.active { background:#0F172A; color:#fff; border-color:#0F172A; }
.ftab-count  { background:#3B82F6; color:#fff; border-radius:10px; font-size:10px; padding:1px 5px; }
.filter-right { display:flex; gap:6px; }
.fsel { padding:6px 10px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:12px; font-family:'DM Sans',sans-serif; background:#fff; cursor:pointer; outline:none; color:#374151; font-weight:500; }

/* ── Skeleton ── */
.forms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; }
.skel-card  { background:#fff; border:1.5px solid #E8EDF3; border-radius:10px; padding:16px; }
.sk { background:linear-gradient(90deg,#F1F5F9 25%,#E8EDF3 50%,#F1F5F9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:5px; }
.sk-row  { height:14px; width:55%; margin-bottom:10px; }
.sk-name { height:18px; width:80%; margin-bottom:8px; }
.sk-sub  { height:13px; width:50%; margin-bottom:12px; }
.sk-foot { height:13px; width:40%; }
@keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

/* ── Empty ── */
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:64px 0; text-align:center; }
.empty-ill  { color:#CBD5E1; }
.empty-title { font-size:15px; font-weight:600; color:#374151; margin:0; }
.empty-sub   { font-size:12px; color:#94A3B8; margin:0 0 6px; }

/* ── Form cards ── */
.form-card { background:#fff; border:1.5px solid #E8EDF3; border-radius:10px; padding:14px 16px; cursor:pointer; transition:all .15s; }
.form-card:hover { border-color:#BFDBFE; box-shadow:0 2px 10px rgba(59,130,246,.09); transform:translateY(-1px); }
.fc-top  { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
.fc-name { font-size:13px; font-weight:600; color:#0F172A; margin-bottom:2px; }
.fc-div  { font-size:11px; color:#94A3B8; margin-bottom:10px; }
.fc-foot { display:flex; align-items:center; justify-content:space-between; }
.fc-period { font-size:11px; color:#64748B; }
.fc-score  { font-size:16px; font-weight:700; color:#16A34A; }

/* ── Badges / chips ── */
.type-pill { padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; letter-spacing:.01em; }
.pill-ipcrf { background:#DBEAFE; color:#1D4ED8; }
.pill-ccef  { background:#EDE9FE; color:#6D28D9; }
.status-chip { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:2px 7px; border-radius:10px; }
.chip-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; background:currentColor; opacity:.7; }
.s-draft     { background:#F1F5F9; color:#64748B; }
.s-submitted { background:#DBEAFE; color:#1D4ED8; }
.s-returned  { background:#FEF9C3; color:#92400E; }
.s-approved  { background:#DCFCE7; color:#166534; }
.s-rated     { background:#E0F2FE; color:#075985; }
.s-finalized { background:#F3E8FF; color:#6B21A8; }

/* ── Detail header ── */
.detail-hd { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
.back-btn  { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:7px; border:1.5px solid #E2E8F0; background:#fff; cursor:pointer; font-size:12px; font-weight:500; color:#374151; font-family:'DM Sans',sans-serif; transition:all .15s; flex-shrink:0; }
.back-btn:hover { background:#F8FAFC; border-color:#CBD5E1; }
.detail-hd-info { min-width:0; }
.detail-hd-badges { display:flex; gap:6px; margin-bottom:5px; }
.detail-hd-name { font-size:16px; font-weight:700; color:#0F172A; }
.detail-hd-sub  { font-size:11px; color:#94A3B8; margin-top:2px; }

/* ── Detail tabs ── */
.detail-tabs { display:flex; border-bottom:1px solid #E8EDF3; margin-bottom:20px; }
.dtab { padding:9px 16px; font-size:13px; font-weight:500; cursor:pointer; border:none; background:transparent; color:#64748B; border-bottom:2px solid transparent; margin-bottom:-1px; font-family:'DM Sans',sans-serif; transition:all .15s; display:inline-flex; align-items:center; gap:6px; }
.dtab:hover  { color:#374151; }
.dtab.active { color:#2563EB; border-bottom-color:#2563EB; font-weight:600; }
.dtab-count  { background:#EFF6FF; color:#2563EB; border-radius:9px; font-size:10px; padding:1px 6px; font-weight:600; }

.entries-loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:48px 0; }
.spin-sm { width:18px; height:18px; border:2px solid #E2E8F0; border-top-color:#3B82F6; border-radius:50%; animation:spin .6s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }

/* ── Indicators layout ── */
.indicators-layout { display:flex; flex-direction:column; gap:0; }
.fn-section { margin-bottom:24px; }
.fn-hd { display:flex; align-items:center; justify-content:space-between; background:#F8FAFC; border:1px solid #F1F5F9; border-radius:9px; padding:9px 14px; margin-bottom:8px; }
.fn-hd-left  { display:flex; align-items:center; gap:8px; }
.fn-title    { font-size:12px; font-weight:600; color:#374151; }
.fn-wt-pill  { background:#EFF6FF; color:#1D4ED8; font-size:11px; font-weight:600; padding:1px 7px; border-radius:8px; }
.fn-wt-purple { background:#F3E8FF; color:#6D28D9; }
.fn-count    { font-size:10px; color:#94A3B8; }
.fn-hd-right { display:flex; gap:5px; }
.fn-empty    { text-align:center; padding:14px; font-size:11px; color:#94A3B8; border:1.5px dashed #E2E8F0; border-radius:8px; }

.add-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:600; border:1px solid #BFDBFE; background:#EFF6FF; color:#1D4ED8; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all .12s; }
.add-pill:hover { background:#2563EB; color:#fff; border-color:#2563EB; }
.add-pill-ghost { border-color:#E2E8F0; background:#fff; color:#475569; }
.add-pill-ghost:hover { background:#F8FAFC; border-color:#CBD5E1; color:#1D4ED8; }

/* ── Entry cards ── */
.entries-list { display:flex; flex-direction:column; gap:6px; }
.entry-card   { background:#fff; border:1.5px solid #E8EDF3; border-radius:8px; transition:border-color .12s; }
.entry-card:hover { border-color:#BFDBFE; }
.ec-main { padding:11px 12px; }
.ec-top  { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }
.ec-kra  { font-size:11px; font-weight:600; color:#1D4ED8; background:#EFF6FF; padding:2px 8px; border-radius:8px; }
.ec-kra-purple { color:#6D28D9; background:#F3E8FF; }
.ec-acts { display:flex; gap:3px; }
.act-btn { display:flex; align-items:center; justify-content:center; width:23px; height:23px; border-radius:5px; border:1px solid transparent; background:transparent; cursor:pointer; color:#94A3B8; transition:all .12s; }
.act-btn:hover { background:#F1F5F9; border-color:#E2E8F0; color:#475569; }
.act-del:hover { background:#FEF2F2; border-color:#FCA5A5; color:#EF4444; }
.ec-si   { font-size:11px; color:#475569; line-height:1.55; margin-bottom:7px; }
.ec-tags { display:flex; flex-wrap:wrap; gap:4px; }

/* ── Tags ── */
.etag        { padding:2px 7px; border-radius:9px; font-size:10px; font-weight:500; background:#F1F5F9; color:#64748B; }
.etag-blue   { background:#DBEAFE; color:#1D4ED8; }
.etag-amber  { background:#FEF3C7; color:#92400E; }
.etag-green  { background:#DCFCE7; color:#166534; }

/* ── Workflow bar ── */
.workflow-bar { display:flex; align-items:center; justify-content:space-between; padding:14px 0; margin-top:4px; border-top:1px solid #F1F5F9; }
.wf-info      { font-size:11px; color:#64748B; display:flex; align-items:center; gap:5px; }

/* ── Detail body ── */
.detail-body { max-width:720px; }
.det-section    { margin-bottom:22px; }
.det-sec-title  { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.07em; margin-bottom:10px; }
.det-grid       { display:grid; grid-template-columns:1fr 1fr; gap:2px; }
.det-item       { display:flex; align-items:flex-start; justify-content:space-between; padding:8px 0; border-bottom:1px solid #F8FAFC; gap:12px; }
.dk             { font-size:11px; color:#94A3B8; font-weight:500; flex-shrink:0; }
.dv             { font-size:12px; color:#1A2332; text-align:right; }
.weights-bar-wrap { padding:4px 0; }
.weights-bar    { display:flex; height:28px; border-radius:6px; overflow:hidden; }
.wb-c { background:#2563EB; display:flex; align-items:center; justify-content:center; font-size:11px; color:#fff; font-weight:600; }
.wb-s { background:#7C3AED; display:flex; align-items:center; justify-content:center; font-size:11px; color:#fff; font-weight:600; }

/* ── Score ── */
.score-empty   { display:flex; flex-direction:column; align-items:center; gap:12px; padding:48px 0; }
.score-display { text-align:center; }
.score-hero    { display:inline-flex; align-items:baseline; gap:5px; padding:14px 24px; border-radius:14px; margin-bottom:8px; }
.score-out  { background:#DCFCE7; }
.score-vs   { background:#DBEAFE; }
.score-sat  { background:#FEF9C3; }
.score-low  { background:#FEE2E2; }
.score-big  { font-size:52px; font-weight:800; color:#0F172A; line-height:1; }
.score-denom { font-size:16px; color:#94A3B8; }
.score-adj  { font-size:15px; font-weight:600; color:#374151; }
.score-table { margin-top:20px; border:1px solid #F1F5F9; border-radius:9px; overflow:hidden; }
.st-hd  { display:flex; justify-content:space-between; padding:8px 14px; background:#F8FAFC; font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.06em; }
.st-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-top:1px solid #F8FAFC; }
.st-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
.st-fn  { width:19px; height:19px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; flex-shrink:0; }
.fn-c   { background:#DBEAFE; color:#1D4ED8; }
.fn-s   { background:#EDE9FE; color:#6D28D9; }
.st-name { font-size:12px; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.st-val  { font-size:12px; font-weight:600; color:#0F172A; flex-shrink:0; }

/* ── Buttons ── */
.btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer; border:1.5px solid #E2E8F0; background:#fff; color:#374151; transition:all .15s; font-family:'DM Sans',sans-serif; }
.btn:hover    { background:#F8FAFC; border-color:#CBD5E1; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.btn-primary  { background:#2563EB; color:#fff; border-color:#2563EB; }
.btn-primary:hover  { background:#1D4ED8; }
.btn-success  { background:#16A34A; color:#fff; border-color:#16A34A; }
.btn-success:hover  { background:#15803D; }
.btn-danger   { background:#EF4444; color:#fff; border-color:#EF4444; }
.btn-danger:hover   { background:#DC2626; }
.btn-outline-danger { background:#fff; color:#EF4444; border-color:#FCA5A5; }
.btn-outline-danger:hover { background:#FEF2F2; }
.btn-sm  { padding:5px 12px; font-size:11px; }
.xbtn    { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; border:none; background:transparent; cursor:pointer; color:#94A3B8; flex-shrink:0; }
.xbtn:hover { background:#F1F5F9; color:#475569; }

/* ── Modals ── */
.ov { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:200; backdrop-filter:blur(3px); }
.modal { background:#fff; border-radius:14px; width:calc(100% - 32px); max-height:90vh; display:flex; flex-direction:column; box-shadow:0 24px 64px rgba(0,0,0,.2); animation:min .18s ease; }
.modal-lib { max-width:660px; }
.modal-confirm-lib { max-width:520px; }
@keyframes min { from{opacity:0;transform:scale(.97) translateY(8px)} to{opacity:1;transform:none} }
.mhd { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px 14px; border-bottom:1px solid #F1F5F9; flex-shrink:0; }
.mtitle { font-size:15px; font-weight:700; color:#0F172A; }
.msub   { font-size:11px; color:#94A3B8; margin-top:3px; }
.mbody  { padding:16px 24px; overflow-y:auto; flex:1; }
.mft    { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 24px; border-top:1px solid #F1F5F9; background:#F8FAFC; border-radius:0 0 14px 14px; flex-shrink:0; }
.lib-ft { justify-content:space-between; }

/* ── Library ── */
.lib-filters { display:flex; gap:8px; padding:12px 24px; border-bottom:1px solid #F1F5F9; flex-shrink:0; flex-wrap:wrap; }
.srch-wrap { flex:1; position:relative; min-width:160px; }
.srch-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); pointer-events:none; }
.srch-inp  { width:100%; padding:8px 11px 8px 30px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:12px; font-family:'DM Sans',sans-serif; color:#0F172A; outline:none; }
.srch-inp:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }

.sel-strip { display:flex; align-items:center; justify-content:space-between; padding:7px 24px; background:#EFF6FF; border-bottom:1px solid #DBEAFE; flex-shrink:0; }
.sel-count { font-size:12px; font-weight:600; color:#1D4ED8; }
.sel-clear { font-size:11px; color:#64748B; background:none; border:none; cursor:pointer; text-decoration:underline; font-family:'DM Sans',sans-serif; }

.lib-scroll { max-height:50vh; overflow-y:auto; padding:12px 24px !important; }
.lib-list   { display:flex; flex-direction:column; gap:6px; }
.lib-item   { display:flex; align-items:flex-start; gap:12px; padding:11px 14px; border:1.5px solid #E8EDF3; border-radius:9px; cursor:pointer; transition:all .12s; user-select:none; }
.lib-item:hover    { border-color:#BFDBFE; background:#F8FBFF; }
.lib-item-sel      { border-color:#3B82F6; background:#EFF6FF; }
.lib-chk           { width:20px; height:20px; border-radius:5px; border:2px solid #CBD5E1; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; transition:all .12s; }
.chk-on            { background:#2563EB; border-color:#2563EB; }
.lib-content       { flex:1; min-width:0; }
.lib-kra-row       { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
.lib-kra           { font-size:12px; font-weight:600; color:#0F172A; }
.lib-tags          { display:flex; flex-wrap:wrap; gap:3px; }
.lib-pi            { font-size:11px; color:#475569; line-height:1.55; }

/* ── Confirm selection items ── */
.confirm-item { display:flex; align-items:flex-start; gap:10px; padding:12px 0; border-bottom:1px solid #F1F5F9; }
.ci-num   { width:22px; height:22px; border-radius:50%; background:#EFF6FF; color:#1D4ED8; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
.ci-body  { flex:1; min-width:0; }
.ci-kra   { font-size:12px; font-weight:600; color:#0F172A; margin-bottom:3px; }
.ci-pi    { font-size:11px; color:#475569; line-height:1.5; margin-bottom:6px; }
.ci-tags  { display:flex; flex-wrap:wrap; gap:4px; }
.ci-rm    { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; border:none; background:transparent; cursor:pointer; color:#CBD5E1; flex-shrink:0; }
.ci-rm:hover { background:#FEF2F2; color:#EF4444; }

/* ── FULLSCREEN LOCK ── */
.fullscreen-lock { position:fixed; inset:0; background:rgba(15,23,42,.85); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
.lock-box    { background:#fff; border-radius:20px; padding:40px 48px; text-align:center; width:340px; box-shadow:0 32px 80px rgba(0,0,0,.3); }
.lock-spinner { width:48px; height:48px; border:4px solid #E2E8F0; border-top-color:#2563EB; border-radius:50%; animation:spin .7s linear infinite; margin:0 auto 20px; }
.lock-title  { font-size:16px; font-weight:700; color:#0F172A; margin-bottom:4px; }
.lock-msg    { font-size:13px; color:#64748B; margin-bottom:16px; }
.progress-track { height:6px; background:#F1F5F9; border-radius:6px; overflow:hidden; margin-bottom:10px; }
.progress-fill  { height:100%; background:linear-gradient(90deg,#2563EB,#7C3AED); border-radius:6px; transition:width .3s ease; }
.lock-sub    { font-size:11px; color:#94A3B8; }

/* ── Confirm box ── */
.confirm-box { background:#fff; border-radius:14px; padding:28px 26px; max-width:360px; width:calc(100%-32px); text-align:center; box-shadow:0 24px 64px rgba(0,0,0,.2); animation:min .18s ease; }
.cb-icon     { width:50px; height:50px; border-radius:14px; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.cb-icon.danger { background:#FEF2F2; }
.cb-title    { font-size:15px; font-weight:700; color:#0F172A; margin-bottom:7px; }
.cb-msg      { font-size:12px; color:#475569; line-height:1.65; margin-bottom:20px; }
.cb-btns     { display:flex; justify-content:center; gap:8px; }

/* ── Form fields ── */
.fsec-title { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.07em; margin-bottom:10px; }
.fgrid      { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.field      { display:flex; flex-direction:column; gap:5px; }
.field.full { grid-column:span 2; }
.fl         { font-size:11px; font-weight:600; color:#374151; }
.fi         { padding:8px 11px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:12px; font-family:'DM Sans',sans-serif; color:#0F172A; outline:none; transition:border-color .15s,box-shadow .15s; resize:vertical; background:#fff; }
.fi:focus   { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }
.fi::placeholder { color:#CBD5E1; }
.avg-box    { background:#F0FDF4; color:#16A34A; font-weight:600; cursor:default; pointer-events:none; }

/* ── Toast ── */
.toast { position:fixed; bottom:24px; right:24px; z-index:400; padding:10px 16px; border-radius:9px; font-size:12px; font-weight:500; box-shadow:0 4px 20px rgba(0,0,0,.12); pointer-events:none; display:flex; align-items:center; gap:7px; }
.toast-success { background:#F0FDF4; color:#166534; border:1px solid #86EFAC; }
.toast-error   { background:#FEF2F2; color:#991B1B; border:1px solid #FCA5A5; }
.toast-enter-active,.toast-leave-active { transition:opacity .25s,transform .25s; }
.toast-enter-from,.toast-leave-to       { opacity:0; transform:translateY(8px); }

/* ── Spinner (for state-wrap) ── */
.spinner    { width:24px; height:24px; border:2.5px solid #E2E8F0; border-top-color:#3B82F6; border-radius:50%; animation:spin .7s linear infinite; }
.state-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:32px 0; }
</style>