<template>
  <div class="eval-page">

    <!-- Content card -->
    <div class="content-card">

    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">Evaluation</h2>
        <p class="page-sub">Innovations Performance Assessment Tool</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button v-if="canAdmin" class="btn btn-outline" @click="openGenerateModal">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M6.5 3.5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Generate Assignments
        </button>
      </div>
    </div>

    <!-- Domain weight bar -->
    <div class="domain-bar">
      <div class="domain-item d-cbc">
        <div class="domain-pct">30%</div>
        <div class="domain-label">Core Behavioral Competencies</div>
        <div class="domain-sub">5 HEARTWORK Values</div>
      </div>
      <div class="domain-sep">+</div>
      <div class="domain-item d-fpo">
        <div class="domain-pct">55%</div>
        <div class="domain-label">Functional Performance Output</div>
        <div class="domain-sub">IPCRF/CCEF Final Numerical Rating</div>
      </div>
      <div class="domain-sep">+</div>
      <div class="domain-item d-jf">
        <div class="domain-pct">15%</div>
        <div class="domain-label">Job Fitness</div>
        <div class="domain-sub">7 Indicators · Self + Immediate Supervisor</div>
      </div>
      <div class="domain-sep">=</div>
      <div class="domain-item d-overall">
        <div class="domain-pct">100%</div>
        <div class="domain-label">Overall Performance Audit Score</div>
        <div class="domain-sub">1.00 - 4.00 Scale</div>
      </div>
    </div>

    <!-- View toggle -->
    <div class="view-tabs">
      <button :class="['view-tab', activeView === 'my-tasks' && 'active']" @click="activeView = 'my-tasks'">
        My Rating Tasks
        <span v-if="pendingTaskCount > 0" class="view-tab-badge">{{ pendingTaskCount }}</span>
      </button>
      <button :class="['view-tab', activeView === 'my-results' && 'active']" @click="switchToMyResults">
        My Results
      </button>
      <button v-if="canAdmin" :class="['view-tab', activeView === 'all' && 'active']" @click="switchToAll">
        All Assessments
      </button>
    </div>

    <!-- ══ TWO-PANEL BODY ══ -->
    <div class="eval-tp-shell">

      <!-- LEFT PANEL -->
      <div class="eval-tp-left">

        <!-- Period bar (Tasks & Results) -->
        <div v-if="activeView !== 'all'" class="tasks-period-bar">
          <label class="tasks-period-label">Period:</label>
          <select v-model="tasksSemester" class="filter-select" style="width:175px">
            <option value="1">1st Semester (Jan&#8211;Jun)</option>
            <option value="2">2nd Semester (Jul&#8211;Dec)</option>
          </select>
          <select v-model="tasksYear" class="filter-select" style="width:80px">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <button class="btn" @click="activeView === 'my-tasks' ? loadMyTasks() : loadMyResults()" :disabled="loadingTasks || loadingResults">
            <span v-if="loadingTasks || loadingResults" class="spinner-sm"></span>
            {{ (loadingTasks || loadingResults) ? '' : 'Refresh Data' }}
          </button>
        </div>

        <!-- Filter bar (All view) -->
        <div v-if="activeView === 'all'" class="filter-bar" style="margin-bottom:10px">
          <div class="status-tabs">
            <button v-for="t in statusTabs" :key="t.value"
              :class="['status-tab', activeStatus === t.value && 'active']"
              @click="activeStatus = t.value">
              {{ t.label }}
            </button>
          </div>
          <div class="filter-right">
            <div class="srch-wrap">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon">
                <circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/>
                <path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <input v-model="search" type="text" class="srch-inp" placeholder="Search employee..."/>
            </div>
            <select v-model="filterDiv" class="filter-select">
              <option value="">All Divisions</option>
              <option v-for="d in availableDivisions" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </div>

        <!-- MY TASKS LIST -->
        <template v-if="activeView === 'my-tasks'">
          <div v-if="loadingTasks" class="eli-list">
            <div v-for="i in 4" :key="i" class="eli eli-sk">
              <div style="display:flex;gap:6px;margin-bottom:7px"><div class="sk-badge"></div><div class="sk-badge" style="width:60px"></div></div>
              <div class="sk-line" style="width:75%;margin-bottom:5px"></div>
              <div class="sk-line" style="width:50%"></div>
            </div>
          </div>
          <div v-else-if="!myTasks.length" class="eval-lp-empty">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M16 24h16M24 16v16" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
            <p>No rating tasks found</p>
            <span>{{ canAdmin ? 'Use Generate Assignments to create rater assignments.' : 'You have no assigned evaluations for this period.' }}</span>
          </div>
          <div v-else class="eli-list">
            <div v-for="task in myTasks" :key="task.id"
              :class="['eli', selectedTask && selectedTask.id === task.id ? 'eli-active' : '']"
              @click="selectTask(task)">
              <div class="eli-row">
                <div :class="['eli-av', rterTypeCls(task.raterType)]">{{ task.rateeName?.charAt(0)?.toUpperCase() || '?' }}</div>
                <div class="eli-info">
                  <div class="eli-name">{{ task.rateeName }}</div>
                  <div class="eli-meta">S{{ task.semester }} {{ task.year }}{{ task.rateeDivisionId ? ' · ' + task.rateeDivisionId : '' }}</div>
                </div>
                <div :class="['eli-dot', task.status === 'Completed' ? 'eli-dot-done' : 'eli-dot-pend']" :title="task.status"></div>
              </div>
              <div class="eli-chips">
                <span :class="['rtype-badge', rterTypeCls(task.raterType)]">{{ raterTypeLabel(task.raterType) }}</span>
                <span :class="['status-badge', task.status === 'Completed' ? 'st-green' : 'st-draft']">{{ task.status }}</span>
                <span v-if="task.ipatStatus === 'Final'" class="eli-final">
                  <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1 3.25V6c0 2.3 1.67 4.35 4.5 4.75 2.83-.4 4.5-2.45 4.5-4.75V3.25L5.5 1z" fill="#15803D" stroke="#15803D" stroke-width=".4"/><path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Finalized
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- MY RESULTS LIST -->
        <template v-if="activeView === 'my-results'">
          <div v-if="loadingResults" class="eli-list">
            <div v-for="i in 2" :key="i" class="eli eli-sk">
              <div style="display:flex;gap:6px;margin-bottom:7px"><div class="sk-badge"></div></div>
              <div class="sk-line" style="width:65%;margin-bottom:5px"></div>
              <div class="sk-line" style="width:40%"></div>
            </div>
          </div>
          <div v-else-if="!myResults.length" class="eval-lp-empty">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M16 28l4-4 3 3 6-6" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <p>No assessment records found</p>
            <span>No assessment has been generated for this period yet.</span>
          </div>
          <div v-else class="eli-list">
            <div v-for="res in myResults" :key="res.id"
              :class="['eli', selectedResult && selectedResult.id === res.id ? 'eli-active' : '']"
              @click="selectResult(res)">
              <div class="eli-row">
                <div class="eli-av eli-av-res">{{ res.rateeName?.charAt(0)?.toUpperCase() || '?' }}</div>
                <div class="eli-info">
                  <div class="eli-name">{{ res.rateeName }}</div>
                  <div class="eli-meta">{{ res.divisionName }}</div>
                </div>
                <span v-if="res.allComplete && res.overallScore" class="rc-status-badge rc-done" style="font-size:10px">Computed</span>
                <span v-else class="rc-status-badge rc-pending" style="font-size:10px">In Progress</span>
              </div>
              <div class="eli-chips">
                <span class="eli-period-pill">S{{ res.semester }} {{ res.year }}</span>
                <template v-if="res.overallScore">
                  <span class="eli-score-big">{{ res.overallScore }}</span>
                  <span v-if="res.descriptor" :class="['eli-desc-chip', descriptorClass(res.descriptor)]">{{ res.descriptor }}</span>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- ALL RECORDS LIST -->
        <template v-if="activeView === 'all'">
          <div v-if="loading" class="eli-list">
            <div v-for="i in 3" :key="i" class="eli eli-sk">
              <div style="display:flex;gap:6px;margin-bottom:7px"><div class="sk-badge"></div><div class="sk-badge" style="width:55px"></div></div>
              <div class="sk-line" style="width:80%;margin-bottom:5px"></div>
              <div class="sk-line" style="width:50%"></div>
            </div>
          </div>
          <div v-else-if="!filteredRecords.length" class="eval-lp-empty">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M24 14v10l6 4" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
            <p>{{ records.length === 0 ? 'No assessments yet' : 'No matches' }}</p>
            <span>{{ records.length === 0 ? 'Generate assignments to start.' : 'Try adjusting your filters.' }}</span>
          </div>
          <div v-else class="eli-list">
            <div v-for="rec in filteredRecords" :key="rec.id"
              :class="['eli', selectedRecord && selectedRecord.id === rec.id ? 'eli-active' : '']"
              @click="selectRecord(rec)">
              <div class="eli-row">
                <div class="eli-av eli-av-rec">{{ rec.rateeName?.charAt(0)?.toUpperCase() || '?' }}</div>
                <div class="eli-info">
                  <div class="eli-name">{{ rec.rateeName }}</div>
                  <div class="eli-meta">{{ rec.divisionName || '—' }}</div>
                </div>
                <span :class="['status-badge', statusClass(rec.status)]">{{ rec.status }}</span>
              </div>
              <div class="eli-chips">
                <span class="eli-period-pill">S{{ rec.semester }} {{ rec.year }}</span>
                <template v-if="rec.overallScore">
                  <span class="eli-score-big">{{ rec.overallScore }}</span>
                  <span v-if="rec.descriptor" :class="['eli-desc-chip', descriptorClass(rec.descriptor)]">{{ rec.descriptor }}</span>
                </template>
              </div>
            </div>
          </div>
        </template>

      </div>
      <!-- /eval-tp-left -->

      <!-- RIGHT PANEL -->
      <div class="eval-tp-right">

        <!-- Empty state -->
        <div v-if="!selectedTask && !selectedResult && !selectedRecord" class="eval-rp-empty">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/>
            <path d="M16 28l4-4 3 3 6-6" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p class="eval-rp-empty-title">Select an item</p>
          <p class="eval-rp-empty-sub">Click any item from the list to preview it here</p>
        </div>

        <!-- INLINE ASSESSMENT / RATING FORM (rater task or admin record) -->
        <template v-else-if="selectedTask || selectedRecord">
          <div class="eval-form-hd">
            <div class="eval-form-hd-main">
              <div :class="['eval-form-av', activeAssignment ? rterTypeCls(activeAssignment.raterType) : 'eli-av-rec']">
                {{ ((activeRecord || selectedTask || selectedRecord).rateeName || '?').charAt(0).toUpperCase() }}
              </div>
              <div class="eval-form-hd-info">
                <div class="eval-form-title">{{ (activeRecord || selectedTask || selectedRecord).rateeName }}</div>
                <div class="eval-form-sub" v-if="activeAssignment">{{ raterRoleDesc(activeAssignment.raterType) }}</div>
                <div class="eval-form-sub" v-else>{{ activeRecord?.divisionName || selectedRecord?.divisionName || '—' }}<template v-if="activeRecord?.position"> · {{ activeRecord.position }}</template></div>
              </div>
            </div>
            <div class="eval-form-hd-right">
              <span v-if="activeAssignment" :class="['rtype-badge', rterTypeCls(activeAssignment.raterType)]">{{ raterTypeLabel(activeAssignment.raterType) }}</span>
              <span v-else-if="activeRecord" :class="['status-badge', statusClass(activeRecord.status)]">{{ activeRecord.status }}</span>
              <span class="period-badge">S{{ (activeRecord || selectedTask || selectedRecord).semester }} {{ (activeRecord || selectedTask || selectedRecord).year }}</span>
              <button class="eval-form-close" @click="closeDetailModal" title="Back to list">
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>

          <!-- loading -->
          <div v-if="loadingDetail && !loadedRec" class="detail-loading">
            <span class="spinner-sm" style="border-color:rgba(0,0,0,.12);border-top-color:#1A56B0"></span>
            Loading assessment data…
          </div>

          <!-- no linked record -->
          <div v-else-if="!activeRecord" class="eval-rp-empty" style="min-height:220px">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M18 24h12M24 18v12" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
            <p class="eval-rp-empty-title">No assessment record</p>
            <p class="eval-rp-empty-sub">This task has no linked IPAT record for this period yet.</p>
          </div>

          <template v-else>
            <div class="eval-form-scroll">

              <!-- Finalized note (rater) -->
              <div v-if="activeAssignment && selectedTask && selectedTask.ipatStatus === 'Final'" class="rp-final-note" style="margin-bottom:14px">
                <svg width="14" height="14" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1 3.25V6c0 2.3 1.67 4.35 4.5 4.75 2.83-.4 4.5-2.45 4.5-4.75V3.25L5.5 1z" fill="#15803D" stroke="#15803D" stroke-width=".4"/><path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                This assessment has been finalized.
              </div>

              <!-- Score summary (admin/self view only) -->
              <div v-if="!activeAssignment" class="score-summary-bar">
                <div class="sscore"><div class="sscore-lbl">CBC (30%)</div><div :class="['sscore-val', activeRecord?.cbcScore ? 'has-val' : '']">{{ activeRecord?.cbcScore || '—' }}</div></div>
                <div class="sscore-op">+</div>
                <div class="sscore"><div class="sscore-lbl">FPO (55%)</div><div :class="['sscore-val', activeRecord?.fpoScore ? 'has-val' : '']">{{ activeRecord?.fpoScore || '—' }}</div></div>
                <div class="sscore-op">+</div>
                <div class="sscore"><div class="sscore-lbl">JF (15%)</div><div :class="['sscore-val', activeRecord?.jfScore ? 'has-val' : '']">{{ activeRecord?.jfScore || '—' }}</div></div>
                <div class="sscore-op">=</div>
                <div class="sscore sscore-overall">
                  <div class="sscore-lbl">Overall</div>
                  <div v-if="activeRecord?.overallScore" :class="['sscore-val', descriptorClass(activeRecord.descriptor)]" style="font-size:22px;font-weight:800">{{ activeRecord.overallScore }}</div>
                  <div v-else class="sscore-val">—</div>
                  <div v-if="activeRecord?.descriptor" :class="['sscore-desc', descriptorClass(activeRecord.descriptor)]">{{ activeRecord.descriptor }}</div>
                </div>
              </div>

              <!-- Assignment context banner (rater) -->
              <div v-if="activeAssignment" class="assignment-banner">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#1A56B0" stroke-width="1.3"/><path d="M6.5 4v3.5M6.5 9.5v.1" stroke="#1A56B0" stroke-width="1.3" stroke-linecap="round"/></svg>
                Your role: <strong>{{ raterTypeLabel(activeAssignment.raterType) }}</strong>
                <span class="banner-desc"> — {{ raterRoleDesc(activeAssignment.raterType) }}</span>
                <span v-if="!showJFTab"> · CBC only</span>
              </div>

              <!-- Tabs -->
              <div class="dtabs">
                <button :class="['dtab', activeTab === 'cbc' && 'active']" @click="activeTab = 'cbc'">A. Core Behavioral Competencies</button>
                <button v-if="!activeAssignment" :class="['dtab', activeTab === 'fpo' && 'active']" @click="activeTab = 'fpo'">B. Functional Performance Output</button>
                <button v-if="showJFTab" :class="['dtab', activeTab === 'jf'  && 'active']" @click="activeTab = 'jf'">C. Job Fitness</button>
                <button v-if="!activeAssignment" :class="['dtab', activeTab === 'edap' && 'active', edapRequired && 'dtab-alert']" @click="activeTab = 'edap'">
                  <svg v-if="edapRequired" width="11" height="11" viewBox="0 0 11 11" fill="none" style="margin-right:4px;flex-shrink:0"><path d="M5.5 1L1 10h9L5.5 1z" fill="#F59E0B" stroke="#F59E0B" stroke-width=".5" stroke-linejoin="round"/><path d="M5.5 4.5v2.5M5.5 8.5v.1" stroke="#fff" stroke-width="1" stroke-linecap="round"/></svg>
                  D. Employee Development &amp; Action Plan
                </button>
              </div>

              <!-- ── CBC TAB ── -->
              <div v-if="activeTab === 'cbc'" class="modal-body-scroll">
                <template v-if="activeAssignment">
                  <div class="rating-progress-wrap">
                    <div class="rating-progress-label">
                      <span>Core Behavioral Competencies</span>
                      <span :class="['rating-progress-count', cbcAnsweredCount >= cbcTotalCount ? 'all-done' : '']">
                        {{ cbcAnsweredCount }} / {{ cbcTotalCount }} answered
                        <svg v-if="cbcAnsweredCount >= cbcTotalCount" width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:-2px;margin-left:3px"><circle cx="7" cy="7" r="6" fill="#16A34A"/><path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </span>
                    </div>
                    <div class="rating-progress-bar"><div class="rating-progress-fill" :style="{ width: cbcProgress + '%' }"></div></div>
                  </div>
                  <div class="scale-legend">
                    <span class="scale-pill"><strong>1</strong> Never</span>
                    <span class="scale-pill"><strong>2</strong> Rarely</span>
                    <span class="scale-pill"><strong>3</strong> Frequently</span>
                    <span class="scale-pill"><strong>4</strong> Always</span>
                  </div>
                  <div v-if="showValidation && cbcAnsweredCount < cbcTotalCount" class="validation-banner">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FEF2F2" stroke="#EF4444" stroke-width="1.2"/><path d="M7 4v4M7 9.5v.5" stroke="#EF4444" stroke-width="1.3" stroke-linecap="round"/></svg>
                    Please answer all <strong>{{ cbcTotalCount - cbcAnsweredCount }}</strong> remaining question{{ cbcTotalCount - cbcAnsweredCount !== 1 ? 's' : '' }} before submitting.
                  </div>
                </template>
                <template v-else>
                  <div class="tab-intro">
                    Rate each behavioral indicator using the <strong>1–4 Likert scale</strong>:
                    <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                  </div>
                  <div class="rater-row">
                    <div class="rater-selector">
                      <span class="rater-label">Rating as:</span>
                      <select v-model="cbcRaterType" class="field-input" style="width:220px">
                        <option value="Self">Self (15%)</option>
                        <option value="Peer">Peer (15%)</option>
                        <option value="Peer1">Peer 1 (15%)</option>
                        <option value="Peer2">Peer 2 (15%)</option>
                        <option value="Subordinate">Subordinate (15%)</option>
                        <option value="Supervisor">Immediate Supervisor (30%)</option>
                        <option value="SkipSupervisor">Skip Supervisor (25%)</option>
                      </select>
                    </div>
                    <div class="has-sub-note">
                      Subordinates: <strong>{{ activeRecord?.hasSubordinate ? 'Yes' : 'No' }}</strong>
                      {{ !activeRecord?.hasSubordinate ? '— Peer1 + Peer2 each 15%' : '' }}
                    </div>
                  </div>
                </template>

                <div v-for="theme in HEARTWORK_THEMES" :key="theme.id" class="theme-section">
                  <div class="theme-hd">
                    <div class="theme-hd-left">
                      <span class="theme-badge">{{ theme.label }}</span>
                      <span class="theme-desc">{{ theme.description }}</span>
                    </div>
                    <span v-if="activeAssignment" :class="['theme-progress-chip', themeAnsweredCount(theme) === theme.indicators.length ? 'chip-done' : '']">{{ themeAnsweredCount(theme) }}/{{ theme.indicators.length }}</span>
                    <span v-else-if="themeAvg(theme.id)" class="theme-avg">Avg: {{ themeAvg(theme.id) }}</span>
                  </div>
                  <div class="indicator-list">
                    <div v-for="(ind, idx) in theme.indicators" :key="idx" :class="['indicator-row', showValidation && getCBCRating(theme.id, idx) === null ? 'unanswered' : '']">
                      <div class="ind-num">{{ idx + 1 }}</div>
                      <div class="ind-text">{{ ind }}</div>
                      <div class="ind-rating">
                        <button v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getCBCRating(theme.id, idx) === n && 'selected']" :title="['Never','Rarely','Frequently','Always'][n-1]" @click="setCBCRating(theme.id, idx, n)">{{ n }}</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="!activeAssignment" class="action-bar">
                  <button class="btn btn-primary" :disabled="savingCBC" @click="saveCBCRatings"><span v-if="savingCBC" class="spinner-sm"></span>{{ savingCBC ? 'Saving…' : 'Save CBC Ratings' }}</button>
                  <button class="btn" :disabled="computingCBC" @click="computeCBC">{{ computingCBC ? 'Computing…' : 'Compute CBC Score' }}</button>
                </div>
              </div>

              <!-- ── FPO TAB ── -->
              <div v-if="activeTab === 'fpo'" class="modal-body-scroll">
                <div class="tab-intro">
                  The <strong>Functional Performance Output</strong> domain uses the employee's <strong>IPCRF/DPCR Final Numerical Rating</strong> (1–5 scale) as the basis. It constitutes <strong>55%</strong> of the overall IPAT score. This score is pulled directly from the employee's own rated IPCRF/CCEF for the same period — it is never entered by hand here.
                </div>
                <div class="fpo-panel">
                  <div class="fpo-current">
                    <div class="fpo-label">Current IPCRF/CCEF Score (1–5 scale)</div>
                    <div class="fpo-score">{{ activeRecord?.fpoScore || '—' }}</div>
                    <div v-if="activeRecord?.fpoScore" class="fpo-converted">Converted to 4-pt IPAT scale: <strong>{{ convertFPO(activeRecord.fpoScore) }}</strong></div>
                  </div>
                  <div class="fpo-update">
                    <label class="field-label">{{ activeRecord?.fpoScore ? 'Refresh from IPCRF/CCEF' : 'Pull from IPCRF/CCEF' }}</label>
                    <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                      <button class="btn btn-primary" :disabled="syncingFPO" @click="syncFPOScore"><span v-if="syncingFPO" class="spinner-sm"></span>{{ syncingFPO ? 'Syncing…' : (activeRecord?.fpoScore ? 'Re-sync Score' : 'Sync Score') }}</button>
                    </div>
                    <span v-if="fpoSource" style="font-size:10px;color:#16A34A;margin-top:6px;display:block">Pulled from {{ fpoSource.type }} ({{ fpoSource.status }}) — S{{ fpoSource.semester }} {{ fpoSource.year }}{{ fpoSource.adjectivalRating ? ' · ' + fpoSource.adjectivalRating : '' }}</span>
                    <span v-else style="font-size:10px;color:#94A3B8;margin-top:4px;display:block">Requires the employee's IPCRF/CCEF for this period to be Rated or Finalized.</span>
                  </div>
                </div>
                <div class="fpo-formula">
                  <div class="formula-label">Scale Conversion (IPCRF 5-pt → IPAT 4-pt)</div>
                  <div class="formula-text">Converted = ((IPCRF Score − 1) ÷ 4) × 3 + 1</div>
                  <div class="formula-examples"><span>5.00 → 4.00</span><span>4.50 → 3.63</span><span>4.00 → 3.25</span><span>3.50 → 2.88</span><span>3.00 → 2.50</span><span>2.50 → 2.13</span></div>
                </div>
              </div>

              <!-- ── JF TAB ── -->
              <div v-if="activeTab === 'jf'" class="modal-body-scroll">
                <template v-if="activeAssignment">
                  <div class="rating-progress-wrap">
                    <div class="rating-progress-label">
                      <span>Job Fitness</span>
                      <span :class="['rating-progress-count', jfAnsweredCount >= JF_INDICATORS.length ? 'all-done' : '']">
                        {{ jfAnsweredCount }} / {{ JF_INDICATORS.length }} answered
                        <svg v-if="jfAnsweredCount >= JF_INDICATORS.length" width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:-2px;margin-left:3px"><circle cx="7" cy="7" r="6" fill="#16A34A"/><path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </span>
                    </div>
                    <div class="rating-progress-bar"><div class="rating-progress-fill" :style="{ width: (jfAnsweredCount / JF_INDICATORS.length * 100) + '%' }"></div></div>
                  </div>
                  <div class="scale-legend">
                    <span class="scale-pill"><strong>1</strong> Never</span>
                    <span class="scale-pill"><strong>2</strong> Rarely</span>
                    <span class="scale-pill"><strong>3</strong> Frequently</span>
                    <span class="scale-pill"><strong>4</strong> Always</span>
                  </div>
                  <div v-if="showValidation && jfAnsweredCount < JF_INDICATORS.length" class="validation-banner">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FEF2F2" stroke="#EF4444" stroke-width="1.2"/><path d="M7 4v4M7 9.5v.5" stroke="#EF4444" stroke-width="1.3" stroke-linecap="round"/></svg>
                    Please answer all <strong>{{ JF_INDICATORS.length - jfAnsweredCount }}</strong> remaining question{{ JF_INDICATORS.length - jfAnsweredCount !== 1 ? 's' : '' }} before submitting.
                  </div>
                </template>
                <template v-else>
                  <div class="tab-intro">
                    <strong>Job Fitness</strong> is rated by the Ratee (Self) and Immediate Supervisor only. JF Indicator Score = (Self + Supervisor) ÷ 2
                    <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                  </div>
                  <div class="rater-selector" style="margin-bottom:16px">
                    <span class="rater-label">Rating as:</span>
                    <select v-model="jfRaterType" class="field-input" style="width:220px">
                      <option value="Self">Self (Ratee)</option>
                      <option value="Supervisor">Immediate Supervisor</option>
                    </select>
                  </div>
                </template>
                <div v-if="!activeAssignment && loadedRec?.jfVarianceFlagged" class="variance-banner">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 14h14L8 1z" fill="#FEF9C3" stroke="#CA8A04" stroke-width="1.2"/><path d="M8 6v4M8 11.5v.5" stroke="#CA8A04" stroke-width="1.4" stroke-linecap="round"/></svg>
                  <div><strong>Significant variance detected</strong> — the Self-rating and Supervisor rating differ by {{ loadedRec.jfVarianceGap }} points. This record is flagged for Skip Supervisor review per Section 11 of the evaluation guidelines.</div>
                </div>
                <div class="jf-list">
                  <div v-for="(ind, idx) in JF_INDICATORS" :key="idx" :class="['jf-row', showValidation && getJFRating(idx) === null ? 'unanswered' : '']">
                    <div class="jf-num">{{ idx + 1 }}</div>
                    <div class="jf-info">
                      <div class="jf-label">{{ ind }}</div>
                      <input v-model="jfEvidence[idx]" type="text" class="jf-evidence" placeholder="Supporting evidence / document reference (optional)"/>
                    </div>
                    <div class="ind-rating">
                      <button v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getJFRating(idx) === n && 'selected']" :title="['Never','Rarely','Frequently','Always'][n-1]" @click="setJFRating(idx, n)">{{ n }}</button>
                    </div>
                  </div>
                </div>
                <div v-if="!activeAssignment" class="action-bar">
                  <button class="btn btn-primary" :disabled="savingJF" @click="saveJFRatings"><span v-if="savingJF" class="spinner-sm"></span>{{ savingJF ? 'Saving…' : 'Save Job Fitness Ratings' }}</button>
                  <button class="btn" :disabled="computingJF" @click="computeJF">{{ computingJF ? 'Computing…' : 'Compute JF Score' }}</button>
                </div>
              </div>

              <!-- ── EDAP TAB ── -->
              <div v-if="activeTab === 'edap'" class="modal-body-scroll">
                <div class="tab-intro">
                  The <strong>Employee Development and Action Plan (EDAP)</strong> documents learning interventions when any domain score falls at <strong>Level 1 (1.00–1.49)</strong> or <strong>Level 2 (1.50–2.49)</strong>. It follows the 70-20-10 Learning Framework.
                </div>
                <div v-if="!edapRequired" class="edap-ok">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#F0FDF4" stroke="#22C55E" stroke-width="1.3"/><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  No EDAP required. All domain scores are above Level 2.
                </div>
                <template v-else>
                  <div class="edap-section-title">Competency Action Matrix</div>
                  <p class="edap-hint">Identify top 2–3 priority competency areas below target levels.</p>
                  <div v-for="(row, i) in edapRows" :key="i" class="edap-row">
                    <div class="edap-row-hd">
                      <span class="edap-row-num">{{ i + 1 }}</span>
                      <button class="edap-row-remove" v-if="edapRows.length > 1" @click="edapRows.splice(i, 1)">×</button>
                    </div>
                    <div class="edap-fields">
                      <div class="edap-field full"><label class="field-label">Priority Development Area <span class="req">*</span></label><input v-model="row.area" class="field-input" placeholder="Specify competency gap (e.g., Technical Mastery — Marunong)"/></div>
                      <div class="edap-field"><label class="field-label">Target Level</label><select v-model="row.targetLevel" class="field-input"><option value="2">Level 2 (Intermediate)</option><option value="3">Level 3 (Advanced)</option><option value="4">Level 4 (Expert)</option></select></div>
                      <div class="edap-field"><label class="field-label">Target Completion Date</label><input v-model="row.targetDate" type="date" class="field-input"/></div>
                      <div class="edap-field full"><label class="field-label">Proposed Learning Interventions <span class="edap-framework-hint">(70% Experience · 20% Relationship · 10% Formal)</span></label><textarea v-model="row.interventions" class="field-input" rows="2" placeholder="Describe specific learning activities aligned with the 70-20-10 framework…"></textarea></div>
                      <div class="edap-field full"><label class="field-label">Expected Output / Success Indicators</label><input v-model="row.successIndicators" class="field-input" placeholder="e.g., Complete policy brief, demonstrate improved facilitation in next quarter"/></div>
                    </div>
                  </div>
                  <button class="btn edap-add-btn" @click="edapRows.push({ area:'', targetLevel:'3', targetDate:'', interventions:'', successIndicators:'' })">+ Add Development Area</button>
                  <div class="edap-section-title" style="margin-top:20px">Commitments</div>
                  <div class="edap-commit-box"><div class="edap-commit-label">Employee Commitment</div><p class="edap-commit-text">I commit to actively pursuing the learning interventions detailed above, allocating the necessary focus, and applying newly gained proficiencies directly to my assigned targets.</p></div>
                  <div class="edap-commit-box"><div class="edap-commit-label">Supervisor Support Commitment</div><p class="edap-commit-text">I commit to supporting this development pathway by providing regular coaching, facilitating access to the necessary workplace assignments, and monitoring progress milestones.</p></div>
                  <div class="edap-section-title" style="margin-top:20px">Monitoring &amp; Catch-up Tracker</div>
                  <div class="edap-tracker">
                    <div class="edap-tracker-row">
                      <div class="edap-tracker-sem">1st Semester</div>
                      <div class="edap-status-group"><label v-for="s in EDAP_STATUSES" :key="s.val" class="edap-status-opt"><input type="radio" v-model="edapSem1Status" :value="s.val"/><span :class="['edap-status-chip', `chip-${s.cls}`]">{{ s.label }}</span></label></div>
                      <textarea v-model="edapSem1Notes" class="field-input edap-notes" rows="2" placeholder="Supervisor feedback / progress notes…"></textarea>
                    </div>
                    <div class="edap-tracker-row">
                      <div class="edap-tracker-sem">2nd Semester</div>
                      <div class="edap-status-group"><label v-for="s in EDAP_STATUSES" :key="s.val" class="edap-status-opt"><input type="radio" v-model="edapSem2Status" :value="s.val"/><span :class="['edap-status-chip', `chip-${s.cls}`]">{{ s.label }}</span></label></div>
                      <textarea v-model="edapSem2Notes" class="field-input edap-notes" rows="2" placeholder="Supervisor feedback / progress notes…"></textarea>
                    </div>
                  </div>
                  <div class="modal-actions" style="padding:16px 0 0"><button class="btn btn-primary" :disabled="savingEdap" @click="saveEdap"><span v-if="savingEdap" class="spinner-sm"></span>{{ savingEdap ? 'Saving…' : 'Save EDAP' }}</button></div>
                </template>
              </div>

            </div>

            <!-- Sticky footer actions -->
            <div class="eval-form-footer">
              <template v-if="activeAssignment">
                <div class="eval-footer-progress">
                  <span :class="['eval-footer-count', allRaterAnswered ? 'done' : '']">{{ raterAnsweredTotal }} / {{ raterTotal }} answered</span>
                </div>
                <button class="btn btn-submit-rating" :disabled="submittingRating" @click="submitRatings">
                  <span v-if="submittingRating" class="spinner-sm" style="border-top-color:#fff"></span>
                  <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  {{ submittingRating ? 'Submitting…' : (selectedTask?.status === 'Completed' ? 'Update Ratings' : 'Submit Ratings') }}
                </button>
              </template>
              <template v-else-if="activeRecord?.status !== 'Final'">
                <button v-if="activeRecord?.status === 'Computed'" class="btn btn-finalize" @click="finalizeRecord">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L2 3.5V6.5c0 2.76 2 5.15 4.5 5.5C9 11.65 11 9.26 11 6.5V3.5L6.5 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Finalize Assessment
                </button>
                <button class="btn btn-primary" :disabled="computingOverall" @click="computeOverall"><span v-if="computingOverall" class="spinner-sm"></span>{{ computingOverall ? 'Computing…' : 'Compute Overall Score' }}</button>
              </template>
              <span v-else class="finalized-badge">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1.5 3.25V6c0 2.5 1.8 4.65 4.5 5 2.7-.35 4.5-2.5 4.5-5V3.25L6 1z" fill="#15803D" stroke="#15803D" stroke-width=".5" stroke-linejoin="round"/><path d="M3.75 6l1.5 1.5L9 4.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Finalized
              </span>
            </div>
          </template>
        </template>

        <!-- RESULT DETAIL -->
        <template v-else-if="activeView === 'my-results' && selectedResult">
          <div class="eval-rp-hd">
            <div class="eval-rp-hd-info">
              <div class="eval-rp-title">{{ selectedResult.rateeName }}</div>
              <div class="eval-rp-sub">S{{ selectedResult.semester }} {{ selectedResult.year }} · {{ selectedResult.divisionName }}</div>
            </div>
            <span v-if="selectedResult.allComplete && selectedResult.overallScore" class="rc-status-badge rc-done">Computed</span>
            <span v-else class="rc-status-badge rc-pending">In Progress</span>
          </div>
          <div class="eval-rp-body">
            <div v-if="!selectedResult.allComplete" class="rp-progress-wrap">
              <div class="rp-progress-meta">
                <span class="rp-progress-label">Rating Progress</span>
                <span class="rp-progress-count">{{ selectedResult.completedRaters }} / {{ selectedResult.totalRaters }} raters</span>
              </div>
              <div class="rp-progress-bar"><div class="rp-progress-fill" :style="{ width: selectedResult.totalRaters ? (selectedResult.completedRaters / selectedResult.totalRaters * 100) + '%' : '0%' }"></div></div>
              <div v-if="selectedResult.pendingRaters && selectedResult.pendingRaters.length" class="rp-pending-list">
                Waiting for: {{ selectedResult.pendingRaters.join(', ') }}
              </div>
            </div>
            <template v-else>
              <div :class="['rp-score-hero', descriptorClass(selectedResult.descriptor)]">
                <div class="rp-score-big">{{ selectedResult.overallScore ?? '—' }}</div>
                <div v-if="selectedResult.descriptor" class="rp-score-desc">{{ selectedResult.descriptor }}</div>
              </div>
              <div class="rp-score-grid">
                <div class="rp-score-block"><div class="rp-score-lbl">CBC</div><div class="rp-score-val">{{ selectedResult.cbcScore ?? '—' }}</div><div class="rp-score-pct">30%</div></div>
                <div class="rp-score-block"><div class="rp-score-lbl">FPO</div><div class="rp-score-val">{{ selectedResult.fpoScore ?? '—' }}</div><div class="rp-score-pct">55%</div></div>
                <div class="rp-score-block"><div class="rp-score-lbl">JF</div><div class="rp-score-val">{{ selectedResult.jfScore ?? '—' }}</div><div class="rp-score-pct">15%</div></div>
              </div>
            </template>
          </div>
        </template>

      </div>
      <!-- /eval-tp-right -->

    </div>
    <!-- /eval-tp-shell -->


    </div>
    <!-- /Content card -->

    <!-- ══════════════════════ CREATE MODAL ══════════════════════ -->
    <teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal" style="max-width:500px">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">New IPAT Assessment</h3>
              <p class="modal-sub">Innovations Performance Assessment Tool</p>
            </div>
            <button class="modal-close" @click="showCreateModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div v-if="canSelectRatee" class="field full">
                <label class="field-label">Employee (Ratee) <span class="req">*</span></label>
                <select v-model="createForm.rateeId" class="field-input" :disabled="loadingUsers">
                  <option value="">{{ loadingUsers ? 'Loading employees…' : 'Select employee…' }}</option>
                  <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.fullName }}{{ u.divisionName ? ' · ' + u.divisionName : '' }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="createForm.semester" class="field-input">
                  <option value="1">1st Semester (Jan–Jun)</option>
                  <option value="2">2nd Semester (Jul–Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year</label>
                <input v-model.number="createForm.year" type="number" class="field-input"/>
              </div>
              <div class="field full">
                <label class="field-label">FPO Score — IPCRF Final Numerical Rating</label>
                <div class="fpo-auto-note">
                  Pulled automatically from the ratee's own rated IPCRF/CCEF for this same period — no manual entry needed.
                  If their IPCRF/CCEF isn't rated yet, you can sync it later from the assessment detail view.
                </div>
              </div>
              <div class="field full">
                <label class="field-label">Does the ratee have subordinates?</label>
                <div class="toggle-row">
                  <button :class="['toggle-btn', createForm.hasSubordinate === true && 'active']" @click="createForm.hasSubordinate = true">Yes — Peer weight: 15%</button>
                  <button :class="['toggle-btn', createForm.hasSubordinate === false && 'active']" @click="createForm.hasSubordinate = false">No — Peer weight: 30%</button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCreateModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="creating" @click="createRecord">
              <span v-if="creating" class="spinner-sm"></span>
              {{ creating ? 'Creating…' : 'Create Assessment' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════ GENERATE ASSIGNMENTS MODAL ══════════════════════ -->
    <teleport to="body">
      <div v-if="showGenerateModal" class="modal-overlay" @click.self="showGenerateModal = false">
        <div class="modal" style="max-width:480px">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9 5v4.5l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Generate Rater Assignments</h3>
              <p class="modal-sub">Automatically assigns peer, subordinate, supervisor, and skip-supervisor raters</p>
            </div>
            <button class="modal-close" @click="showGenerateModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div v-if="generateResult" class="gen-result">
              <div class="gen-result-title">Assignments Generated</div>
              <div class="gen-result-stat">{{ generateResult.generated }} assignments · {{ generateResult.ratees }} employees</div>
              <div class="gen-result-breakdown">
                <span v-for="(count, type) in generateResult.breakdown" :key="type" class="gen-chip">
                  {{ type }}: {{ count }}
                </span>
              </div>
              <p class="gen-result-note">Users can now open the Evaluation module to view and submit their assigned ratings.</p>
            </div>
            <div v-else class="form-grid">
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="generateForm.semester" class="field-input">
                  <option value="1">1st Semester (Jan–Jun)</option>
                  <option value="2">2nd Semester (Jul–Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year <span class="req">*</span></label>
                <input v-model.number="generateForm.year" type="number" class="field-input" min="2020" max="2099"/>
              </div>
              <div class="field full">
                <div class="gen-info-box">
                  <strong>What this does:</strong>
                  <ul style="margin:6px 0 0 18px;padding:0;font-size:12px;line-height:1.7">
                    <li>Creates IPAT records for all active employees</li>
                    <li>Assigns Self, Peer1/Peer2 (or Peer+Subordinate), Supervisor, and Skip Supervisor raters based on position and section</li>
                    <li>Avoids repeating same Peer/Subordinate from the previous cycle</li>
                    <li>Employees will see their assigned ratees in <em>My Rating Tasks</em></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showGenerateModal = false; generateResult = null">{{ generateResult ? 'Close' : 'Cancel' }}</button>
            <button v-if="!generateResult" class="btn btn-primary" :disabled="generating" @click="generateAssignments">
              <span v-if="generating" class="spinner-sm"></span>
              {{ generating ? 'Generating…' : 'Generate Assignments' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>


    <!-- Toast -->
    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ipatApi, ipatAssignmentsApi, usersApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// ── HEARTWORK Themes (exact per IPAT document) ──
const HEARTWORK_THEMES = [
  {
    id: 'makatao', label: 'Makatao',
    description: 'Human worth, dignity, inclusivity, equity, and human rights in social work and public service',
    indicators: [
      'Championing Equality and Social Justice: actively leads efforts to embed equity and social justice principles into program designs and practices, ensuring that every output serves as a meaningful protection and empowerment mechanism for the most vulnerable sectors',
      'Embodying Compassion and Respect: consistently models and promotes a culture of compassion and respect in all professional interactions and outputs; actively ensures that program designs and workplace practices honor the diverse identities, backgrounds, and lived experiences of clients and colleagues',
      'Promoting Cultural Competence: demonstrates awareness, understanding, and respect for diverse cultural identities, beliefs, values, and practices; integrates culturally responsive approaches in communication, service delivery, and decision-making',
      'Driving Inclusive Practices: actively promotes and integrates inclusive principles into programs, policies, services, and workplace practices; ensures equitable access to opportunities, resources, and participation for individuals of diverse backgrounds',
      'Empowering Communities: consistently places community well-being and voice at the center of all program development and innovation work; designs and champions meaningful participation mechanisms that position communities as active decision-makers'
    ]
  },
  {
    id: 'mapagpalaya', label: 'Mapagpalaya',
    description: 'Empowerment, advocacy, liberation, and transformative social work through innovative programs',
    indicators: [
      'Foster Client Autonomy: promotes client self-determination by ensuring that programs, services, and interventions respect individual choice, encourage informed decision-making, and reduce dependency; creates opportunities for beneficiaries to actively participate in shaping solutions',
      'Build Resilience and Independence: strengthens the capacity of individuals, families, and communities to overcome challenges, adapt to changing circumstances, and sustain positive outcomes beyond program support',
      'Collaborate for Change: encourages meaningful partnerships with clients, communities, stakeholders, and colleagues in the design, implementation, and improvement of programs; fosters inclusive participation to drive sustainable social transformation',
      'Advocate for Freedom from Oppression: promotes the identification and removal of systemic, institutional, and social barriers that hinder equity, inclusion, and access to opportunities; challenges discriminatory practices and advances social justice',
      'Promote Sustainable Empowerment: ensures that interventions build lasting capacities, local ownership, and self-sustaining systems that continue to generate positive impact over time'
    ]
  },
  {
    id: 'marangal', label: 'Marangal',
    description: 'Ethical excellence, accountability, integrity, and continuous professional development',
    indicators: [
      'Demonstrates honesty, integrity, and fairness in all official transactions and work-related dealings including but not limited to accomplishment of Daily Time Records (DTR), accomplishment reports, and feedback reports',
      'Practices established policies, guidelines, procedures, and ethical standards in tasks, decisions, outputs, and individual actions that enhance personnel credibility in pursuit of ethical excellence and integrity',
      'Proper usage of government resources and information; performs effectively during work hours; and uses authority responsibly and only for official purposes',
      'Demonstrates professionalism and accountability in all interactions with colleagues, clients, and stakeholders by maintaining respectful, ethical, and confidential relationships, promoting transparency, and strengthening public trust',
      'Demonstrates a commitment to continuous learning and professional growth by actively seeking opportunities to develop knowledge, skills, and competencies'
    ]
  },
  {
    id: 'marunong', label: 'Marunong',
    description: 'Technical knowledge, critical thinking, continuous learning, and innovation in performance of duties',
    indicators: [
      'Demonstrates technical mastery and functional expertise essential to the office\'s mandates',
      'Delivers high-quality outputs characterized by precision, thoroughness, and adherence to technical standards',
      'Exhibits adaptability and openness to emerging methodologies and evolving organizational needs',
      'Proactively identifies operational bottlenecks and proposes creative, viable solutions within their scope of authority',
      'Navigates uncertainty with composure, adapting quickly to risks with a solution-oriented mindset'
    ]
  },
  {
    id: 'mapagpabago', label: 'Mapagpabago',
    description: 'Transformational leadership, innovation, and pursuit of systemic change for sustainable social development',
    indicators: [
      'Demonstrates Visionary and Purpose-Driven Leadership: aligns actions, decisions, and work outputs with the organization\'s mission, long-term goals, and the broader objective of sustainable social development',
      'Champions Systemic and Sustainable Reforms: proactively identifies opportunities for improvement and advocates for policies, programs, or practices that address root causes and promote lasting positive change',
      'Empowers and Inspires Others toward Shared Goals: encourages and motivates colleagues, partners, stakeholders, and communities to actively participate, collaborate, and contribute toward common objectives',
      'Integrates Inclusive and Sustainable Development Principles in Work: promotes inclusive, client-centered, equitable, and sustainable approaches in planning, decision-making, and service delivery',
      'Initiates and Supports Innovation and Continuous Improvement: demonstrates openness to new ideas and technologies, proposes innovative solutions, and actively supports continuous learning and organizational improvement'
    ]
  }
]

// ── Job Fitness Indicators (7) ──
// Raters: Self + Immediate Supervisor + Skip Supervisor ÷ 3
const JF_INDICATORS = [
  'Educational Qualification Fit: possesses academic qualifications that meet or exceed the minimum requirements of the position and are relevant to assigned functions',
  'Relevant Work Experience Alignment: demonstrates prior experience that directly supports the competencies and technical requirements of the current role',
  'Training and Skills Applicability: has completed relevant training or learning interventions that are directly applicable to job tasks and improve work performance',
  'Workplace Conduct Suitability: demonstrates behavior consistent with organizational standards, including respect for policies, colleagues, and institutional protocols',
  'Attendance and Punctuality Compliance: maintains regular attendance and adheres to prescribed work schedules, with minimal unexcused absences or tardiness',
  'Commitment to Organizational Objectives: demonstrates alignment with program goals through consistent work engagement and support for organizational priorities',
  'Physical and Cognitive Work Capacity: maintains sufficient physical stamina and mental focus to perform job duties consistently and safely under normal work conditions'
]

// ── State ──
const records      = ref([])
const loading      = ref(false)
const creating     = ref(false)
const activeStatus = ref('All')
const search       = ref('')
const filterDiv    = ref('')

// View toggle
const ADMIN_ROLES = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief']
const canAdmin    = computed(() => ADMIN_ROLES.includes(authStore.role))
const activeView  = ref('my-tasks')

// My Tasks state
const myTasks         = ref([])
const loadingTasks    = ref(false)
const activeAssignment = ref(null)  // set when a task card is clicked
const selectedTask   = ref(null)
const selectedResult = ref(null)
const selectedRecord = ref(null)
const currentYear = new Date().getFullYear()
const tasksSemester = ref(String(new Date().getMonth() < 6 ? 1 : 2))
const tasksYear     = ref(currentYear)
const yearOptions   = computed(() => {
  const years = []
  for (let y = currentYear + 1; y >= 2023; y--) years.push(y)
  return years
})
const pendingTaskCount = computed(() => myTasks.value.filter(t => t.status === 'Pending').length)

// My Results (ratee views own Final records)
const myResults     = ref([])
const loadingResults = ref(false)

// Generate Assignments
const showGenerateModal = ref(false)
const generateForm  = ref({ semester: String(new Date().getMonth() < 6 ? 1 : 2), year: currentYear })
const generating    = ref(false)
const generateResult = ref(null)

const showCreateModal = ref(false)
const activeRecord    = ref(null)
const activeTab       = ref('cbc')

const loadedRec     = ref(null)   // full record from get() — carries cbcRatings + jfRatings
const loadingDetail = ref(false)
const allUsers      = ref([])
const loadingUsers  = ref(false)

const cbcRaterType = ref('Self')
const cbcRatings   = ref({})
const savingCBC    = ref(false)
const computingCBC = ref(false)

const fpoSource  = ref(null)
const syncingFPO = ref(false)

const jfRaterType = ref('Self')
const jfRatings   = ref({})
const jfEvidence  = ref({})
const savingJF    = ref(false)
const computingJF = ref(false)

const computingOverall  = ref(false)
const showValidation    = ref(false)
const submittingRating  = ref(false)

// EDAP state
const EDAP_STATUSES = [
  { val: 'not-started', label: 'Not Started', cls: 'gray' },
  { val: 'on-track',    label: 'On Track',    cls: 'green' },
  { val: 'delayed',     label: 'Delayed',     cls: 'orange' },
  { val: 'completed',   label: 'Completed',   cls: 'blue' }
]
const defaultEdapRow = () => ({ area: '', targetLevel: '3', targetDate: '', interventions: '', successIndicators: '' })
const edapRows     = ref([defaultEdapRow()])
const edapSem1Status = ref('not-started')
const edapSem2Status = ref('not-started')
const edapSem1Notes  = ref('')
const edapSem2Notes  = ref('')
const savingEdap     = ref(false)

const edapRequired = computed(() => {
  const rec = activeRecord.value
  if (!rec) return false
  const scores = [Number(rec.cbcScore), Number(rec.jfScore)].filter(s => s > 0)
  return scores.some(s => s < 2.50)
})

const toast = ref({ show: false, msg: '', type: 'success' })

const createForm = ref({
  semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(),
  hasSubordinate: false
})

const statusTabs = [
  { label: 'All',      value: 'All'      },
  { label: 'Draft',    value: 'Draft'    },
  { label: 'Computed', value: 'Computed' },
  { label: 'Final',    value: 'Final'    }
]

// ── Computed ──
const canCreate = computed(() => canAdmin.value)
const canSelectRatee = computed(() => canAdmin.value)

// JF tab visible when admin view or when assignment rater type can rate JF (Self / Supervisor)
const showJFTab = computed(() => {
  if (!activeAssignment.value) return true
  return ['Self', 'Supervisor'].includes(activeAssignment.value.raterType)
})

const availableDivisions = computed(() => {
  const seen = new Map()
  records.value.forEach(r => {
    if (r.divisionId && !seen.has(r.divisionId)) seen.set(r.divisionId, r.divisionName || r.divisionId)
  })
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredRecords = computed(() => {
  let r = records.value
  if (activeStatus.value !== 'All') r = r.filter(x => x.status === activeStatus.value)
  if (filterDiv.value) r = r.filter(x => x.divisionId === filterDiv.value)
  if (search.value) { const q = search.value.toLowerCase(); r = r.filter(x => (x.rateeName || '').toLowerCase().includes(q)) }
  return r
})

// Rater progress computeds
const cbcTotalCount    = computed(() => HEARTWORK_THEMES.reduce((s, t) => s + t.indicators.length, 0))
const cbcAnsweredCount = computed(() => Object.keys(cbcRatings.value).length)
const cbcProgress      = computed(() => Math.round(cbcAnsweredCount.value / cbcTotalCount.value * 100))
const jfAnsweredCount  = computed(() => JF_INDICATORS.filter((_, idx) => getJFRating(idx) !== null).length)
// Combined rater progress across the tabs the current rater must answer (CBC + JF when applicable)
const raterTotal        = computed(() => cbcTotalCount.value + (showJFTab.value ? JF_INDICATORS.length : 0))
const raterAnsweredTotal = computed(() => cbcAnsweredCount.value + (showJFTab.value ? jfAnsweredCount.value : 0))
const allRaterAnswered  = computed(() => raterAnsweredTotal.value >= raterTotal.value)
function themeAnsweredCount(theme) {
  return theme.indicators.filter((_, idx) => getCBCRating(theme.id, idx) !== null).length
}

// ── Helpers ──
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function statusClass(s) { return { Draft: 'st-draft', Computed: 'st-blue', Final: 'st-green' }[s] || 'st-draft' }
function descriptorClass(d) {
  if (!d) return ''
  if (d.includes('Excellent'))    return 'desc-excellent'
  if (d.includes('Satisfactory')) return 'desc-satisfactory'
  if (d.includes('Needs'))        return 'desc-needs'
  return 'desc-immediate'
}
function convertFPO(score) { return Math.round(((Number(score) - 1) / 4 * 3 + 1) * 100) / 100 }
function round2(v) { return Math.round(v * 100) / 100 }

// CBC helpers
function cbcKey(themeId, idx) { return `${themeId}_${idx}` }
function getCBCRating(themeId, idx) { return cbcRatings.value[cbcKey(themeId, idx)] || null }
function setCBCRating(themeId, idx, n) { cbcRatings.value[cbcKey(themeId, idx)] = n }
function themeAvg(themeId) {
  const theme = HEARTWORK_THEMES.find(t => t.id === themeId)
  if (!theme) return null
  const scores = theme.indicators.map((_, idx) => getCBCRating(themeId, idx)).filter(v => v !== null)
  if (!scores.length) return null
  return round2(scores.reduce((s, x) => s + x, 0) / scores.length)
}

// JF helpers
function getJFRating(idx) { return jfRatings.value[idx] || null }
function setJFRating(idx, n) { jfRatings.value[idx] = n }

// Rating population from server data
function _populateCBCRatings(raterType, ratings) {
  const map = {}
  ;(ratings || []).filter(r => r.raterType === raterType).forEach(r => {
    map[cbcKey(r.themeId, r.indicatorIdx)] = Number(r.rating)
  })
  cbcRatings.value = map
}

function _populateJFRatings(raterType, ratings) {
  const rmap = {}, emap = {}
  ;(ratings || []).filter(r => r.raterType === raterType).forEach(r => {
    rmap[Number(r.indicatorIdx)] = Number(r.rating)
    emap[Number(r.indicatorIdx)] = r.evidence || ''
  })
  jfRatings.value  = rmap
  jfEvidence.value = emap
}

// Re-populate when the user switches which rater type they're editing
watch(cbcRaterType, (type) => { if (loadedRec.value) _populateCBCRatings(type, loadedRec.value.cbcRatings) })
watch(jfRaterType,  (type) => { if (loadedRec.value) _populateJFRatings(type,  loadedRec.value.jfRatings) })

onMounted(() => { loadMyTasks() })

// ── My Tasks ──
async function loadMyTasks() {
  loadingTasks.value = true
  myTasks.value = []
  try {
    const data = await ipatAssignmentsApi.getMyRatees({ semester: tasksSemester.value, year: tasksYear.value })
    myTasks.value = Array.isArray(data) ? data : (data?.items || [])
  } catch (e) {
    if (String(e.message || '').includes('Route not found: ipat-assignments/my-ratees')) {
      myTasks.value = []
      return
    }
    showToast(`Could not load tasks: ${e.message}`, 'error')
  }
  finally { loadingTasks.value = false }
}

async function switchToMyResults() {
  activeView.value = 'my-results'
  if (!myResults.value.length) loadMyResults()
}

async function loadMyResults() {
  loadingResults.value = true
  try {
    const data = await ipatAssignmentsApi.getMyResults({ semester: tasksSemester.value, year: tasksYear.value })
    myResults.value = data || []
  } catch (e) {
    showToast(`Could not load results: ${e.message}`, 'error')
  } finally {
    loadingResults.value = false
  }
}

async function switchToAll() {
  activeView.value = 'all'
  if (!records.value.length) loadRecords()
}

// ── Inline selection: clicking a card loads its form directly in the right panel ──
function selectTask(task) {
  selectedResult.value = null
  selectedRecord.value = null
  selectedTask.value   = task
  openFromAssignment(task)
}

function selectRecord(rec) {
  selectedTask.value   = null
  selectedResult.value = null
  selectedRecord.value = rec
  activeAssignment.value = null   // admin view — not a rater assignment
  openDetailModal(rec)
}

function selectResult(res) {
  selectedTask.value   = null
  selectedRecord.value = null
  selectedResult.value = res
  activeRecord.value   = null
  activeAssignment.value = null
}

async function openFromAssignment(task) {
  // Reset any previously loaded record so a task without its own IPAT record
  // never shows a stale form from the last selection.
  activeRecord.value     = null
  loadedRec.value        = null
  activeAssignment.value = task
  cbcRaterType.value     = task.raterType
  jfRaterType.value      = ['Self', 'Supervisor'].includes(task.raterType) ? task.raterType : 'Self'
  showValidation.value   = false
  activeTab.value        = 'cbc'
  if (task.ipatRecordId) {
    await openDetailModal({ id: task.ipatRecordId, rateeName: task.rateeName, semester: task.semester, year: task.year })
  }
}

// Clears the loaded form and returns the right panel to its empty state.
function closeDetailModal() {
  activeRecord.value     = null
  activeAssignment.value = null
  selectedTask.value     = null
  selectedRecord.value   = null
  showValidation.value   = false
}

async function submitRatings() {
  const assignment = activeAssignment.value
  if (!assignment) return

  const cbcOk = cbcAnsweredCount.value >= cbcTotalCount.value
  const jfOk  = !showJFTab.value || jfAnsweredCount.value >= JF_INDICATORS.length

  if (!cbcOk || !jfOk) {
    showValidation.value = true
    if (!cbcOk) { activeTab.value = 'cbc' }
    else if (!jfOk) { activeTab.value = 'jf' }
    const missing = (!cbcOk ? cbcTotalCount.value - cbcAnsweredCount.value : 0) +
                    (!jfOk  ? JF_INDICATORS.length - jfAnsweredCount.value : 0)
    showToast(`Please answer all ${missing} remaining question${missing !== 1 ? 's' : ''} before submitting.`, 'error')
    return
  }

  submittingRating.value = true
  try {
    // Save CBC ratings
    const cbcPayload = []
    HEARTWORK_THEMES.forEach(theme => {
      theme.indicators.forEach((_, idx) => {
        const rating = getCBCRating(theme.id, idx)
        if (rating !== null) cbcPayload.push({ themeId: theme.id, themeName: theme.label, indicatorIdx: idx, rating, raterType: assignment.raterType })
      })
    })
    await ipatApi.saveCBCRatings(activeRecord.value.id, cbcPayload)

    // Save JF ratings if applicable
    if (showJFTab.value) {
      const jfPayload = JF_INDICATORS.map((_, idx) => ({
        indicatorIdx: idx, rating: getJFRating(idx), evidence: jfEvidence.value[idx] || '', raterType: assignment.raterType
      })).filter(r => r.rating !== null)
      await ipatApi.saveJFRatings(activeRecord.value.id, jfPayload)
    }

    await ipatAssignmentsApi.markCompleted(assignment.id)
    showToast('Ratings submitted successfully!')
    closeDetailModal()
    loadMyTasks()
  } catch (e) {
    showToast(e.message || 'Failed to submit ratings. Please try again.', 'error')
  } finally {
    submittingRating.value = false
  }
}

// ── Generate Assignments ──
function openGenerateModal() {
  generateResult.value = null
  generateForm.value   = { semester: String(new Date().getMonth() < 6 ? 1 : 2), year: currentYear }
  showGenerateModal.value = true
}

async function generateAssignments() {
  if (!generateForm.value.semester || !generateForm.value.year) { showToast('Semester and year required', 'error'); return }
  generating.value = true
  try {
    const result = await ipatAssignmentsApi.generate(generateForm.value)
    generateResult.value = result
    showToast(`Generated ${result.generated} assignments`)
  } catch (e) { showToast(e.message, 'error') }
  finally { generating.value = false }
}

// ── Rater type helpers ──
function raterTypeLabel(type) {
  const labels = {
    Self:          'Self',
    Peer:          'Peer',
    Peer1:         'Peer 1',
    Peer2:         'Peer 2',
    Subordinate:   'Subordinate',
    Supervisor:    'Supervisor',
    SkipSupervisor:'Skip Supervisor'
  }
  return labels[type] || type
}

function raterRoleDesc(type) {
  const desc = {
    Self:          'You are rating yourself',
    Peer:          'You are their same-level peer',
    Peer1:         'You are their same-level peer',
    Peer2:         'You are their same-level peer',
    Subordinate:   'You report to this person',
    Supervisor:    'You are the immediate supervisor of this staff',
    SkipSupervisor:'You are their skip-level supervisor'
  }
  return desc[type] || ''
}

function rterTypeCls(type) {
  const cls = {
    Self:          'rt-self',
    Peer:          'rt-peer',
    Peer1:         'rt-peer',
    Peer2:         'rt-peer',
    Subordinate:   'rt-sub',
    Supervisor:    'rt-sup',
    SkipSupervisor:'rt-skip'
  }
  return cls[type] || ''
}

async function loadRecords() {
  loading.value = true
  try {
    const r = await ipatApi.list()
    records.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { showToast(`Could not load assessments: ${e.message}`, 'error') }
  finally { loading.value = false }
}

async function openCreateModal() {
  createForm.value = {
    semester: String(new Date().getMonth() < 6 ? 1 : 2),
    year: new Date().getFullYear(),
    hasSubordinate: false,
    rateeId: '',
    rateeName: ''
  }
  showCreateModal.value = true
  if (canSelectRatee.value && !allUsers.value.length) {
    loadingUsers.value = true
    try {
      const r = await usersApi.list({ pageSize: 200 })
      allUsers.value = (r?.items || (Array.isArray(r) ? r : [])).filter(u => u.active !== false && u.active !== 'false')
    } catch { /* silent */ } finally { loadingUsers.value = false }
  }
}

async function createRecord() {
  if (!createForm.value.semester) { showToast('Semester is required', 'error'); return }
  if (canSelectRatee.value && !createForm.value.rateeId) { showToast('Please select an employee', 'error'); return }
  creating.value = true
  try {
    const selectedUser = allUsers.value.find(u => u.id === createForm.value.rateeId)
    const payload = {
      ...createForm.value,
      rateeName:    selectedUser?.fullName    || '',
      divisionId:   selectedUser?.divisionId  || '',
      divisionName: selectedUser?.divisionName || '',
      position:     selectedUser?.position    || ''
    }
    const rec = await ipatApi.create(payload)
    records.value.unshift(rec)
    showCreateModal.value = false
    showToast('Assessment record created')
    selectRecord(rec)
  } catch (e) { showToast(e.message, 'error') }
  finally { creating.value = false }
}

async function openDetailModal(rec) {
  activeRecord.value    = rec
  activeTab.value       = 'cbc'
  cbcRatings.value      = {}
  jfRatings.value       = {}
  jfEvidence.value      = {}
  fpoSource.value       = null
  loadedRec.value       = null
  loadingDetail.value   = true
  _resetEdap()
  try {
    const full = await ipatApi.get(rec.id)
    loadedRec.value = full
    activeRecord.value = { ...rec, ...full }
    _populateCBCRatings(cbcRaterType.value, full.cbcRatings)
    _populateJFRatings(jfRaterType.value,   full.jfRatings)
    // Load existing EDAP if any
    try {
      const edap = await ipatApi.getEdap(rec.id)
      if (edap) {
        edapRows.value       = edap.rows?.length ? edap.rows : [defaultEdapRow()]
        edapSem1Status.value = edap.sem1Status || 'not-started'
        edapSem1Notes.value  = edap.sem1Notes  || ''
        edapSem2Status.value = edap.sem2Status || 'not-started'
        edapSem2Notes.value  = edap.sem2Notes  || ''
      }
    } catch { /* no edap yet */ }
  } catch (e) {
    showToast(`Could not load full record: ${e.message}`, 'error')
  } finally {
    loadingDetail.value = false
  }
}

function _syncRecord(updated) {
  activeRecord.value = { ...activeRecord.value, ...updated }
  const i = records.value.findIndex(r => r.id === activeRecord.value.id)
  if (i !== -1) records.value[i] = activeRecord.value
}

// ── CBC ──
async function saveCBCRatings() {
  const ratings = []
  HEARTWORK_THEMES.forEach(theme => {
    theme.indicators.forEach((_, idx) => {
      const rating = getCBCRating(theme.id, idx)
      if (rating !== null) {
        // Only send minimal fields — full indicator text causes URL to exceed GAS limits
        const effectiveType = activeAssignment.value?.raterType || cbcRaterType.value
        ratings.push({ themeId: theme.id, themeName: theme.label, indicatorIdx: idx, rating, raterType: effectiveType })
      }
    })
  })
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingCBC.value = true
  try {
    await ipatApi.saveCBCRatings(activeRecord.value.id, ratings)
    showToast(`${ratings.length} CBC ratings saved`)
    const full = await ipatApi.get(activeRecord.value.id)
    if (full) loadedRec.value = full
  } catch (e) { showToast(e.message, 'error') }
  finally { savingCBC.value = false }
}

async function computeCBC() {
  computingCBC.value = true
  try {
    const r = await ipatApi.computeCBC(activeRecord.value.id)
    _syncRecord({ cbcScore: r.cbcScore })
    showToast(`CBC Score: ${r.cbcScore}`)
  } catch (e) { showToast(e.message, 'error') }
  finally { computingCBC.value = false }
}

// ── FPO ──
async function syncFPOScore() {
  syncingFPO.value = true
  try {
    const r = await ipatApi.syncFPO(activeRecord.value.id)
    _syncRecord({ fpoScore: r.fpoScore })
    fpoSource.value = r.source
    showToast(`FPO score pulled from ${r.source.type}: ${r.fpoScore}`)
  } catch (e) { showToast(e.message, 'error') }
  finally { syncingFPO.value = false }
}

// ── JF ──
async function saveJFRatings() {
  const ratings = JF_INDICATORS.map((_, idx) => ({
    // Only send minimal fields — full indicator text causes URL to exceed GAS limits
    indicatorIdx: idx,
    rating: getJFRating(idx) || 1,
    evidence: jfEvidence.value[idx] || '',
    raterType: activeAssignment.value?.raterType || jfRaterType.value
  })).filter((_, idx) => getJFRating(idx) !== null)
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingJF.value = true
  try {
    await ipatApi.saveJFRatings(activeRecord.value.id, ratings)
    showToast(`${ratings.length} Job Fitness ratings saved`)
    const full = await ipatApi.get(activeRecord.value.id)
    if (full) loadedRec.value = full
  } catch (e) { showToast(e.message, 'error') }
  finally { savingJF.value = false }
}

async function computeJF() {
  computingJF.value = true
  try {
    const r = await ipatApi.computeJF(activeRecord.value.id)
    _syncRecord({ jfScore: r.jfScore })
    showToast(`Job Fitness Score: ${r.jfScore}`)
  } catch (e) { showToast(e.message, 'error') }
  finally { computingJF.value = false }
}

// ── Overall ──
async function computeOverall() {
  computingOverall.value = true
  try {
    const r = await ipatApi.computeOverall(activeRecord.value.id)
    _syncRecord({ overallScore: r.overallScore, descriptor: r.descriptor, cbcScore: r.cbcScore, fpoScore: r.fpoScore, jfScore: r.jfScore, status: 'Computed' })
    showToast(`Overall: ${r.overallScore} — ${r.descriptor}`)
  } catch (e) { showToast(e.message, 'error') }
  finally { computingOverall.value = false }
}

async function finalizeRecord() {
  try {
    await ipatApi.updateStatus(activeRecord.value.id, 'Final')
    _syncRecord({ status: 'Final' })
    showToast('Assessment finalized')
  } catch (e) { showToast(e.message, 'error') }
}

// ── EDAP ──
async function saveEdap() {
  const filled = edapRows.value.filter(r => r.area.trim())
  if (!filled.length) { showToast('Enter at least one development area', 'error'); return }
  savingEdap.value = true
  try {
    await ipatApi.saveEdap(activeRecord.value.id, {
      rows:      JSON.stringify(filled),
      sem1Status: edapSem1Status.value,
      sem1Notes:  edapSem1Notes.value,
      sem2Status: edapSem2Status.value,
      sem2Notes:  edapSem2Notes.value
    })
    showToast('EDAP saved')
  } catch (e) { showToast(e.message, 'error') }
  finally { savingEdap.value = false }
}

function _resetEdap() {
  edapRows.value       = [defaultEdapRow()]
  edapSem1Status.value = 'not-started'
  edapSem2Status.value = 'not-started'
  edapSem1Notes.value  = ''
  edapSem2Notes.value  = ''
}
</script>

<style scoped>
.eval-page{padding:0;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;color:#1A2332;min-height:100%;}

/* ── Two-panel shell ── */
.eval-tp-shell{display:flex;min-height:520px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#fff;margin-top:12px;}
.eval-tp-left{width:520px;flex-shrink:0;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;overflow-y:auto;max-height:82vh;scrollbar-width:thin;scrollbar-color:#E2E8F0 transparent;}
.eval-tp-left .tasks-period-bar,.eval-tp-left .filter-bar{border-bottom:1px solid #F1F5F9;padding:14px 18px;flex-shrink:0;}
.eval-tp-right{flex:1;min-width:0;display:flex;flex-direction:column;overflow-y:auto;max-height:82vh;scrollbar-width:thin;scrollbar-color:#E2E8F0 transparent;}

/* ── List items ── */
.eli-list{flex:1;overflow-y:auto;}
.eli{padding:13px 16px;border-bottom:1px solid #F1F5F9;cursor:pointer;transition:background .12s;display:flex;flex-direction:column;gap:8px;}
.eli:hover{background:#F8FAFC;}
.eli-active{background:#EFF6FF !important;border-left:3px solid #3B82F6;padding-left:13px;}
.eli-sk{pointer-events:none;}
.eli-row{display:flex;align-items:center;gap:10px;}
.eli-av{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
.eli-av-res{background:#F0FDF4;color:#15803D;}
.eli-av-rec{background:#F1F5F9;color:#475569;}
.eli-info{flex:1;min-width:0;}
.eli-name{font-size:13.5px;font-weight:700;color:#1E293B;line-height:1.25;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eli-meta{font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eli-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.eli-dot-done{background:#22C55E;box-shadow:0 0 0 2px #DCFCE7;}
.eli-dot-pend{background:#F59E0B;box-shadow:0 0 0 2px #FEF3C7;}
.eli-chips{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.eli-period-pill{font-size:10px;font-weight:700;background:#F1F5F9;color:#475569;border-radius:20px;padding:2px 8px;}
.eli-score-big{font-size:18px;font-weight:800;color:#1E293B;}
.eli-desc-chip{font-size:10px;font-weight:700;border-radius:20px;padding:2px 9px;}
.eli-final{display:flex;align-items:center;gap:4px;font-size:10px;color:#15803D;font-weight:600;}

/* ── Left empty state ── */
.eval-lp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:8px;color:#94A3B8;text-align:center;}
.eval-lp-empty p{margin:0;font-size:13px;font-weight:600;color:#64748B;}
.eval-lp-empty span{font-size:12px;color:#94A3B8;}

/* ── Right panel ── */
.eval-rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:#94A3B8;text-align:center;padding:40px;}
.eval-rp-empty-title{margin:0;font-size:14px;font-weight:600;color:#64748B;}
.eval-rp-empty-sub{margin:0;font-size:12px;color:#94A3B8;}
.eval-rp-hd{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 28px 16px;border-bottom:1px solid #E8EDF3;flex-shrink:0;background:linear-gradient(to bottom,#FAFBFF,#F7F9FF);}
.eval-rp-hd-info{flex:1;min-width:0;}
.eval-rp-title{font-size:17px;font-weight:700;color:#1E293B;margin-bottom:4px;letter-spacing:-.3px;}
.eval-rp-sub{font-size:12.5px;color:#64748B;}
.eval-rp-body{padding:20px 28px 28px;display:flex;flex-direction:column;gap:18px;}
.btn-open-form{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;font-size:13.5px;font-weight:600;margin-top:4px;align-self:flex-start;}

/* ── Right panel cards ── */
.rp-role-card{display:flex;align-items:center;background:#F8FAFC;border:1px solid #E8EDF3;border-radius:10px;padding:14px 16px;gap:12px;}
.rp-final-note{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#15803D;font-weight:500;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:11px 15px;}
.rp-what-happens{background:#F8FAFC;border:1px solid #E8EDF3;border-radius:10px;padding:15px 18px;}
.rp-wh-title{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:11px;}
.rp-wh-items{display:flex;flex-direction:column;gap:9px;}
.rp-wh-item{display:flex;align-items:center;gap:10px;font-size:12.5px;color:#475569;}
.rp-wh-badge{font-size:10px;font-weight:700;border-radius:5px;padding:3px 8px;flex-shrink:0;}
.rp-wh-cbc{background:#DBEAFE;color:#1D4ED8;}
.rp-wh-jf{background:#F3E8FF;color:#7C3AED;}

/* ── Progress bar (results) ── */
.rp-progress-wrap{background:#F8FAFC;border-radius:8px;padding:14px;}
.rp-progress-meta{display:flex;justify-content:space-between;margin-bottom:8px;}
.rp-progress-label{font-size:12px;font-weight:600;color:#374151;}
.rp-progress-count{font-size:12px;color:#6B7280;}
.rp-progress-bar{height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden;}
.rp-progress-fill{height:100%;background:#3B82F6;border-radius:4px;transition:width .3s;}
.rp-pending-list{font-size:11px;color:#6B7280;margin-top:8px;}

/* ── Score hero ── */
.rp-score-hero{text-align:center;padding:24px 20px;border-radius:12px;background:#F8FAFC;border:1px solid #E8EDF3;}
.rp-score-big{font-size:48px;font-weight:800;color:#1E293B;line-height:1;}
.rp-score-desc{font-size:13px;font-weight:600;margin-top:8px;}
.rp-score-grid{display:flex;gap:12px;}
.rp-score-grid-4{flex-wrap:wrap;}
.rp-score-block{flex:1;background:#F8FAFC;border:1px solid #E8EDF3;border-radius:10px;padding:14px 10px;text-align:center;min-width:80px;}
.rp-score-lbl{font-size:11px;color:#64748B;font-weight:600;margin-bottom:6px;}
.rp-score-val{font-size:22px;font-weight:800;color:#94A3B8;}
.rp-sv-has{color:#1E293B;}
.rp-score-pct{font-size:10.5px;color:#94A3B8;margin-top:3px;}
.rp-score-overall{background:#EFF6FF;border-color:#BFDBFE;}
.rp-desc-badge{display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;border-radius:20px;padding:5px 16px;}
.rp-desc-badge.desc-excellent{background:#DCFCE7;color:#15803D;}
.rp-desc-badge.desc-satisfactory{background:#DBEAFE;color:#1D4ED8;}
.rp-desc-badge.desc-needs{background:#FEF3C7;color:#B45309;}
.rp-desc-badge.desc-immediate{background:#FEE2E2;color:#B91C1C;}
.page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
.page-title{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 3px;}
.page-sub{font-size:12px;color:#94A3B8;margin:0;}

/* Content card */
.content-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:20px;}

/* Domain bar */
.domain-bar{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;margin-bottom:16px;flex-wrap:wrap;}
.domain-item{flex:1;min-width:130px;}
.domain-pct{font-size:22px;font-weight:800;line-height:1;}
.domain-label{font-size:11px;font-weight:600;color:#374151;margin:3px 0 2px;}
.domain-sub{font-size:10px;color:#94A3B8;}
.d-cbc .domain-pct{color:#1A56B0;}
.d-fpo .domain-pct{color:#15803D;}
.d-jf .domain-pct{color:#6B3FA0;}
.d-overall .domain-pct{color:#0F172A;}
.domain-sep{font-size:20px;font-weight:700;color:#CBD5E1;flex-shrink:0;}

/* Filters */
.filter-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
.status-tabs{display:flex;gap:4px;}
.status-tab{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.filter-right{display:flex;gap:8px;align-items:center;}
.srch-wrap{position:relative;}
.srch-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;}
.srch-inp{padding:7px 11px 7px 28px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;outline:none;width:200px;background:#fff;}
.filter-select{padding:7px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;color:#374151;background:#fff;outline:none;cursor:pointer;}

/* Records grid */
.records-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:16px;}
.record-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;}
.record-card:hover{border-color:#CBD5E1;box-shadow:0 4px 12px rgba(0,0,0,.07);transform:translateY(-1px);}
.rc-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.rc-name{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:3px;}
.rc-div{font-size:11px;color:#94A3B8;margin-bottom:12px;}
.rc-period{font-size:11px;color:#64748B;}
.rc-scores{display:flex;gap:8px;margin-bottom:8px;}
.score-block{flex:1;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:8px;text-align:center;}
.score-block-overall{background:#EBF4FF;border-color:#BFDBFE;}
.score-lbl{font-size:9px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
.score-val{font-size:16px;font-weight:700;color:#CBD5E1;}
.score-val.has-score{color:#0F172A;}
.score-val-overall{font-size:18px;}
.rc-descriptor{font-size:10px;font-weight:600;padding:3px 8px;border-radius:12px;text-align:center;}

/* Status & descriptor badges */
.status-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.period-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}
.st-draft{background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}
.st-blue{background:#EBF4FF;color:#1A56B0;}
.st-green{background:#F0FDF4;color:#15803D;}
.desc-excellent{background:#F0FDF4;color:#15803D;}
.desc-satisfactory{background:#EBF4FF;color:#1A56B0;}
.desc-needs{background:#FEF9C3;color:#92400E;}
.desc-immediate{background:#FEF2F2;color:#B91C1C;}


/* Empty */
.empty-state{display:flex;flex-direction:column;align-items:center;padding:60px 0;gap:8px;}
.empty-title{font-size:15px;font-weight:600;color:#374151;margin:4px 0 0;}
.empty-sub{font-size:13px;color:#94A3B8;margin:0;}

/* Skeleton */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line,.sk-badge{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;display:block;height:12px;}
.sk-badge{width:50px;height:20px;border-radius:6px;}
.sk-card{display:flex;flex-direction:column;gap:10px;}
.sk-hd{display:flex;justify-content:space-between;align-items:center;}
.sk-scores{display:flex;gap:8px;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-weight:500;}
.btn:hover{border-color:#CBD5E1;background:#F8FAFC;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover:not(:disabled){background:#1e3f61;}
.btn-xs{padding:4px 9px;font-size:11px;}
.req{color:#EF4444;}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;backdrop-filter:blur(4px);}
.modal{background:#fff;border-radius:16px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;}
.modal-detail{max-width:820px;}
.modal-hd{display:flex;align-items:flex-start;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;flex-shrink:0;}
.modal-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin:0 0 2px;}
.modal-sub{font-size:12px;color:#94A3B8;margin:0;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;}
.modal-close:hover{background:#F1F5F9;color:#374151;}
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}
.modal-body-scroll{flex:1;overflow-y:auto;padding:16px 24px 20px;}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;flex-shrink:0;}

/* Score summary bar */
.score-summary-bar{display:flex;align-items:center;gap:10px;padding:14px 24px;background:#F8FAFC;border-bottom:1px solid #F1F5F9;flex-shrink:0;flex-wrap:wrap;}
.sscore{text-align:center;flex:1;min-width:80px;}
.sscore-lbl{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
.sscore-val{font-size:20px;font-weight:800;color:#CBD5E1;}
.sscore-val.has-val{color:#0F172A;}
.sscore-desc{font-size:10px;font-weight:600;margin-top:4px;padding:2px 6px;border-radius:8px;}
.sscore-op{font-size:18px;font-weight:700;color:#CBD5E1;flex-shrink:0;}

/* Tabs */
.dtabs{display:flex;padding:0 24px;border-bottom:1px solid #E8EDF3;flex-shrink:0;overflow-x:auto;scrollbar-width:none;}
.dtabs::-webkit-scrollbar{display:none;}
.dtab{padding:10px 14px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap;}
.dtab.active{color:#1A56B0;border-bottom-color:#1A56B0;font-weight:600;}

/* Tab content */
.tab-intro{font-size:12px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 14px;margin-bottom:16px;line-height:1.6;}
.scale-hint{display:block;font-size:11px;color:#94A3B8;margin-top:3px;}
.rater-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.rater-selector{display:flex;align-items:center;gap:10px;}
.rater-label{font-size:12px;font-weight:600;color:#374151;flex-shrink:0;}
.has-sub-note{font-size:11px;color:#64748B;background:#FEF9C3;padding:4px 10px;border-radius:6px;}

/* HEARTWORK themes */
.theme-section{margin-bottom:20px;}
.theme-hd{display:flex;align-items:center;justify-content:space-between;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 14px;margin-bottom:8px;gap:10px;}
.theme-hd-left{display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap;}
.theme-badge{font-size:13px;font-weight:700;color:#1A56B0;background:#EBF4FF;padding:3px 10px;border-radius:8px;flex-shrink:0;}
.theme-desc{font-size:11px;color:#64748B;flex:1;}
.theme-avg{font-size:12px;font-weight:700;color:#0F172A;background:#F0FDF4;border:1px solid #BBF7D0;padding:2px 10px;border-radius:20px;flex-shrink:0;}
.indicator-list{display:flex;flex-direction:column;gap:4px;}
.indicator-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #F1F5F9;border-radius:7px;background:#fff;}
.indicator-row:hover{border-color:#E2E8F0;background:#FAFBFF;}
.ind-num{width:22px;height:22px;border-radius:50%;background:#F1F5F9;color:#64748B;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ind-text{flex:1;font-size:12px;color:#374151;line-height:1.5;}
.ind-rating{display:flex;gap:4px;flex-shrink:0;}
.rating-btn{min-width:38px;height:38px;padding:0 10px;border-radius:8px;border:1.5px solid #E2E8F0;background:#fff;font-size:13px;font-weight:700;color:#64748B;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;}
.rating-btn:hover:not(.selected){background:#EFF6FF;border-color:#93C5FD;color:#1A56B0;}
.rating-btn.selected{background:#1A56B0;border-color:#1A56B0;color:#fff;box-shadow:0 2px 8px rgba(26,86,176,.25);}

/* Rater mode progress */
.rating-progress-wrap{padding:14px 16px 10px;background:#F8FAFC;border-bottom:1px solid #F1F5F9;margin:-16px -24px 16px;}
.rating-progress-label{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#374151;margin-bottom:7px;}
.rating-progress-count{font-size:12px;font-weight:500;color:#64748B;}
.rating-progress-count.all-done{color:#16A34A;font-weight:600;}
.rating-progress-bar{height:5px;background:#E2E8F0;border-radius:99px;overflow:hidden;}
.rating-progress-fill{height:100%;background:linear-gradient(90deg,#1A56B0,#3B82F6);border-radius:99px;transition:width .3s ease;}

/* Scale legend */
.scale-legend{display:flex;gap:8px;margin-bottom:16px;}
.scale-pill{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 12px;border-radius:10px;background:#F1F5F9;font-size:12px;color:#475569;text-align:center;border:1px solid #E2E8F0;}
.scale-pill strong{color:#0F172A;font-size:14px;}

/* Theme progress chip */
.theme-progress-chip{font-size:11px;font-weight:600;color:#64748B;background:#F1F5F9;padding:2px 8px;border-radius:10px;flex-shrink:0;}
.theme-progress-chip.chip-done{color:#16A34A;background:#F0FDF4;}

/* Validation */
.validation-banner{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;font-size:12px;color:#DC2626;margin-bottom:14px;}
.indicator-row.unanswered{background:#FFF5F5;border-left:3px solid #FCA5A5;padding-left:calc(12px - 3px);}
.jf-row.unanswered{background:#FFF5F5;border-left:3px solid #FCA5A5;padding-left:calc(12px - 3px);}

/* Submit button */
.btn-submit-rating{display:inline-flex;align-items:center;gap:7px;padding:9px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;box-shadow:0 2px 8px rgba(22,163,74,.3);}
.btn-submit-rating:hover:not(:disabled){background:linear-gradient(135deg,#15803D,#166534);box-shadow:0 4px 12px rgba(22,163,74,.4);}
.btn-submit-rating:disabled{opacity:.6;cursor:not-allowed;}
.action-bar{display:flex;gap:8px;padding-top:14px;border-top:1px solid #F1F5F9;margin-top:8px;}

/* FPO tab */
.fpo-panel{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;}
.fpo-current{background:#F8FAFC;border:1px solid #F1F5F9;border-radius:10px;padding:16px;text-align:center;}
.fpo-label{font-size:11px;font-weight:600;color:#94A3B8;margin-bottom:8px;}
.fpo-score{font-size:36px;font-weight:800;color:#0F172A;line-height:1;}
.fpo-converted{font-size:11px;color:#64748B;margin-top:6px;}
.fpo-update{display:flex;flex-direction:column;}
.fpo-auto-note{font-size:11px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 12px;line-height:1.5;}
.fpo-formula{background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:12px 14px;}
.formula-label{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}
.formula-text{font-size:12px;color:#374151;font-family:'SF Mono','Fira Mono',monospace;margin-bottom:8px;}
.formula-examples{display:flex;gap:10px;flex-wrap:wrap;}
.formula-examples span{font-size:11px;color:#64748B;background:#fff;border:1px solid #E2E8F0;padding:2px 8px;border-radius:6px;}

/* JF tab */
.jf-list{display:flex;flex-direction:column;gap:6px;}
.jf-row{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #F1F5F9;border-radius:7px;background:#fff;}
.jf-row:hover{border-color:#E2E8F0;}
.jf-num{width:22px;height:22px;border-radius:50%;background:#F3EEFF;color:#6B3FA0;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.jf-info{flex:1;min-width:0;}
.jf-label{font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;line-height:1.4;}
.jf-evidence{width:100%;padding:5px 9px;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;color:#64748B;outline:none;}
.jf-evidence:focus{border-color:#6B3FA0;}

/* Form fields */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.field-input{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;color:#0F172A;background:#fff;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.toggle-row{display:flex;gap:8px;}
.toggle-btn{flex:1;padding:10px;border:1.5px solid #E2E8F0;border-radius:9px;cursor:pointer;font-size:12px;background:#fff;color:#374151;transition:all .15s;}
.toggle-btn.active{border-color:#3B82F6;background:#EBF4FF;color:#1A56B0;font-weight:600;}

/* Detail loading */
.detail-loading{display:flex;align-items:center;gap:8px;padding:10px 24px;font-size:12px;color:#64748B;background:#FAFBFF;border-bottom:1px solid #F1F5F9;flex-shrink:0;}

/* EDAP tab alert */
.dtab-alert{color:#B45309 !important;background:#FFFBEB;}
.dtab-alert.active{background:#FEF3C7 !important;color:#92400E !important;border-bottom-color:#F59E0B !important;}

/* EDAP panel */
.edap-ok{display:flex;align-items:center;gap:10px;padding:20px 24px;font-size:13px;color:#15803D;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;margin:16px 24px;}
.edap-section-title{font-size:12px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:.04em;padding:0 24px;margin-top:16px;margin-bottom:6px;}
.edap-hint{font-size:12px;color:#64748B;padding:0 24px;margin-bottom:12px;}
.edap-row{border:1px solid #E2E8F0;border-radius:10px;margin:0 24px 12px;overflow:hidden;}
.edap-row-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;}
.edap-row-num{font-size:11px;font-weight:700;color:#475569;}
.edap-row-remove{background:none;border:none;cursor:pointer;color:#94A3B8;font-size:16px;line-height:1;padding:0 2px;}
.edap-row-remove:hover{color:#EF4444;}
.edap-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;}
.edap-field{display:flex;flex-direction:column;gap:5px;}
.edap-field.full{grid-column:span 2;}
.edap-field textarea.field-input{resize:vertical;min-height:52px;}
.edap-framework-hint{font-size:10px;color:#94A3B8;font-weight:400;margin-left:4px;}
.edap-add-btn{margin:4px 24px 8px;font-size:12px;color:#1A56B0;background:#EFF6FF;border-color:#BFDBFE;}
.edap-add-btn:hover{background:#DBEAFE;}
.edap-commit-box{margin:8px 24px;padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;}
.edap-commit-label{font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;}
.edap-commit-text{font-size:12px;color:#64748B;font-style:italic;}
.edap-tracker{margin:0 24px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;}
.edap-tracker-row{padding:12px;border-bottom:1px solid #F1F5F9;}
.edap-tracker-row:last-child{border-bottom:none;}
.edap-tracker-sem{font-size:12px;font-weight:700;color:#0F172A;margin-bottom:8px;}
.edap-status-group{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.edap-status-opt{display:inline-flex;align-items:center;gap:5px;cursor:pointer;}
.edap-status-opt input[type=radio]{display:none;}
.edap-status-chip{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;border:1.5px solid transparent;cursor:pointer;transition:all .12s;}
.edap-status-opt input:checked + .edap-status-chip{border-color:currentColor;}
.chip-gray{background:#F1F5F9;color:#64748B;}
.chip-green{background:#F0FDF4;color:#15803D;}
.chip-orange{background:#FFFBEB;color:#B45309;}
.chip-blue{background:#EFF6FF;color:#1D4ED8;}
.edap-notes{margin-top:4px;resize:vertical;min-height:52px;}

/* Finalize */
.btn-finalize{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;font-weight:600;}
.btn-finalize:hover:not(:disabled){background:#DCFCE7;border-color:#86EFAC;}
.finalized-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#15803D;background:#F0FDF4;border:1px solid #BBF7D0;padding:6px 12px;border-radius:8px;}

/* Spinner */
.spinner-sm{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999;pointer-events:none;}
.toast-error{background:#EB5757;}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}

/* View tabs */
.view-tabs{display:flex;gap:4px;margin-bottom:16px;}
.view-tab{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;}
.view-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.view-tab-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#EF4444;color:#fff;font-size:10px;font-weight:700;}

/* My Tasks */
.tasks-period-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tasks-period-label{font-size:12px;font-weight:600;color:#374151;}
.tasks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px;}
.task-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;}
.task-card:hover{border-color:#CBD5E1;box-shadow:0 4px 12px rgba(0,0,0,.07);transform:translateY(-1px);}
.tc-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.tc-name{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:2px;}
.tc-role-desc{font-size:11px;color:#64748B;margin-bottom:4px;font-style:italic;}
.tc-meta{font-size:11px;color:#94A3B8;margin-bottom:8px;}
.banner-desc{font-weight:400;opacity:.85;}
.tc-final{display:flex;align-items:center;gap:4px;font-size:11px;color:#15803D;font-weight:500;}
.rtype-badge{padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;}
.rt-self{background:#F0F9FF;color:#0369A1;}
.rt-peer{background:#F5F3FF;color:#6D28D9;}
.rt-sub{background:#FEF9C3;color:#92400E;}
.rt-sup{background:#F0FDF4;color:#15803D;}
.rt-skip{background:#FFF7ED;color:#C2410C;}

/* Generate modal */
.gen-info-box{background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:12px 14px;font-size:12px;color:#0369A1;}
.gen-result{text-align:center;padding:20px 0;}
.gen-result-title{font-size:16px;font-weight:700;color:#15803D;margin-bottom:6px;}
.gen-result-stat{font-size:13px;color:#374151;margin-bottom:12px;}
.gen-result-breakdown{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:12px;}
.gen-chip{background:#EBF4FF;color:#1A56B0;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;}
.gen-result-note{font-size:12px;color:#64748B;max-width:320px;margin:0 auto;}

/* Assignment context */
.assignment-banner{display:flex;align-items:center;gap:8px;background:#EBF4FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 14px;margin:12px 0 0;font-size:12px;color:#1A56B0;flex-shrink:0;}
.assignment-rtype-chip{display:inline-block;background:#EBF4FF;color:#1A56B0;border:1px solid #BFDBFE;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;}

/* Outline button */
.btn-outline{border-color:#CBD5E1;color:#374151;}
.btn-outline:hover{background:#F8FAFC;}
.btn-sm{padding:5px 10px;font-size:11px;}

/* My Results */
.results-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:16px;}
.result-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;}
.rc-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.rc-period{font-size:11px;font-weight:600;color:#64748B;}
.rc-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.rc-done{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}
.rc-pending{background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;}
.rc-name{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:2px;}
.rc-division{font-size:11px;color:#94A3B8;margin-bottom:12px;}
.rc-progress-wrap{margin-bottom:4px;}
.rc-progress-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.rc-progress-label{font-size:11px;font-weight:600;color:#64748B;}
.rc-progress-count{font-size:11px;font-weight:700;color:#0F172A;}
.rc-progress-bar{height:6px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin-bottom:6px;}
.rc-progress-fill{height:100%;background:linear-gradient(90deg,#3B82F6,#2563EB);border-radius:99px;transition:width .4s ease;}
.rc-pending-list{font-size:10px;color:#94A3B8;font-style:italic;}
.rc-scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
.rc-score-item{background:#F8FAFC;border-radius:8px;padding:8px;text-align:center;}
.rc-score-label{display:block;font-size:10px;font-weight:600;color:#64748B;margin-bottom:2px;}
.rc-score-val{display:block;font-size:18px;font-weight:700;color:#0F172A;}
.rc-score-pct{display:block;font-size:10px;color:#94A3B8;}
.rc-overall{display:flex;align-items:center;gap:8px;padding:10px;background:#EBF4FF;border-radius:8px;}
.rc-overall-label{font-size:11px;font-weight:600;color:#1A56B0;}
.rc-overall-score{font-size:20px;font-weight:800;color:#1A56B0;}
.rc-descriptor{font-size:11px;color:#1A56B0;font-style:italic;}

/* JF Variance flag (Section 11) */
.variance-banner{display:flex;align-items:flex-start;gap:10px;background:#FEFCE8;border:1px solid #FDE047;border-radius:8px;padding:10px 14px;font-size:12px;color:#713F12;margin-bottom:16px;line-height:1.5;}
.variance-banner strong{color:#92400E;}

/* ════════════ INLINE ASSESSMENT FORM (right panel) ════════════ */
.eval-form-hd{position:sticky;top:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:16px 24px;border-bottom:1px solid #E8EDF3;background:linear-gradient(180deg,#FFFFFF,#F8FAFF);flex-shrink:0;}
.eval-form-hd-main{display:flex;align-items:center;gap:12px;min-width:0;}
.eval-form-av{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;flex-shrink:0;}
.eval-form-hd-info{min-width:0;}
.eval-form-title{font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-.3px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eval-form-sub{font-size:12px;color:#64748B;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eval-form-hd-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.eval-form-close{width:30px;height:30px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
.eval-form-close:hover{background:#FEF2F2;border-color:#FECACA;color:#EF4444;}
.eval-form-scroll{display:block;}
/* Neutralize the modal-era scroll wrappers so the whole panel scrolls as one */
.eval-form-scroll .modal-body-scroll{flex:none;overflow:visible;padding:18px 24px 22px;}
.eval-form-scroll .dtabs{position:sticky;top:74px;z-index:5;background:#fff;}
.eval-form-scroll .score-summary-bar,.eval-form-scroll .assignment-banner{margin:0;}
.eval-form-scroll .assignment-banner{margin:14px 24px 0;}

/* Sticky footer with the primary action */
.eval-form-footer{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;justify-content:flex-end;gap:14px;
  padding:12px 24px;border-top:1px solid #E8EDF3;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);flex-shrink:0;}
.eval-footer-progress{margin-right:auto;}
.eval-footer-count{font-size:12px;font-weight:700;color:#B45309;background:#FEF3E2;padding:5px 12px;border-radius:20px;}
.eval-footer-count.done{color:#047857;background:#ECFDF5;}

/* ════════════ LEFT PANEL — card polish ════════════ */
.eval-tp-left{width:430px;background:#FBFCFE;}
.eli-list{padding:8px;display:flex;flex-direction:column;gap:8px;}
.eli{border:1px solid #EAF0F7;border-bottom:1px solid #EAF0F7;border-radius:12px;background:#fff;padding:12px 13px;
  box-shadow:0 1px 2px rgba(15,23,42,.04);transition:box-shadow .15s,border-color .15s,transform .08s;}
.eli:hover{border-color:#C7DBF5;box-shadow:0 3px 10px rgba(15,23,42,.07);}
.eli:active{transform:translateY(1px);}
.eli-active{background:#F5F9FF !important;border-color:#3B82F6 !important;border-left:3px solid #3B82F6;padding-left:11px;box-shadow:0 3px 12px rgba(59,130,246,.14);}
.eli-av{border-radius:11px;box-shadow:inset 0 0 0 1px rgba(15,23,42,.04);}
.eli-chips{padding-top:2px;border-top:1px dashed #EEF2F7;margin-top:2px;}
.eli-active .eli-chips{border-top-color:#DBEAFE;}
</style>
