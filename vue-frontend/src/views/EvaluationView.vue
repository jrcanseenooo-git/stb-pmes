<template>
  <div class="eval-page">

    <!-- Content card -->
    <div class="content-card">

    <!-- Page header removed: the title moved to the app bar, the domain-weight
         bar was retired, and Generate Assignments now sits in the view-tab row.
         An empty .page-hd cost 12px of dead space above the panel. -->

    <!-- View toggle -->
    <!-- <div class="view-tabs">
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
    </div> -->

    <!-- ══ TWO-PANEL BODY ══ -->
    <div class="eval-tp-shell">

      <!-- LEFT PANEL -->
      <div class="eval-tp-left">

        <!-- Period bar (Tasks & Results) -->
        <div v-if="activeView !== 'all'" class="tasks-period-bar">
          <label class="tasks-period-label">Period:</label>
          <select v-model="tasksSemester" class="filter-select" style="width:175px">
            <option value="1">1st Semester (Jan-Jun)</option>
            <option value="2">2nd Semester (Jul-Dec)</option>
          </select>
          <select v-model="tasksYear" class="filter-select" style="width:80px">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <!-- Data is already fresh on load and on every period change (see
               onMounted and the tasksSemester/tasksYear watcher below) - the
               one real gap is someone else generating a new assignment while
               you stay on this exact screen, same period, without navigating
               away. Rather than show a permanent button for a rare case, a
               quiet check on window focus (see checkForNewData below) only
               reveals it when there is actually something new to pull in. -->
          <span v-if="tasksLastUpdatedLabel" class="tasks-last-updated">
            Updated {{ tasksLastUpdatedLabel }}
            <button v-if="hasNewTaskData" type="button" class="tasks-refresh-btn"
                    :disabled="loadingTasks || loadingResults"
                    @click="activeView === 'my-tasks' ? loadMyTasks() : loadMyResults()">
              <svg class="tasks-refresh-icon" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ (loadingTasks || loadingResults) ? 'Refreshing…' : 'New data · Refresh' }}
            </button>
          </span>
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
              <option v-for="d in availableDivisions" :key="d.key" :value="d.key">{{ d.name }}</option>
            </select>
            <!-- loadRecords() filters by tasksSemester/tasksYear, but this bar had no
                 period control - so on All Assessments an administrator was locked to
                 the current period and could not reach an earlier one. -->
            <select v-model="tasksSemester" class="filter-select filter-select-period">
              <option value="1">1st Semester (Jan-Jun)</option>
              <option value="2">2nd Semester (Jul-Dec)</option>
            </select>
            <select v-model="tasksYear" class="filter-select filter-select-year">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </div>

        <div class="view-tabs">
          <template v-if="showPersonalTabs">
            <button :class="['view-tab', activeView === 'my-tasks' && 'active']" @click="switchToMyTasks">
              <span class="view-tab-label">My Rating Tasks</span>
              <span v-if="pendingTaskCount > 0" class="view-tab-badge">{{ pendingTaskCount }}</span>
            </button>
            <button :class="['view-tab', activeView === 'my-results' && 'active']" @click="switchToMyResults">
              <span class="view-tab-label">My Results</span>
            </button>
          </template>
          <!-- The action is available to the STB system administrator and to an
               assigned office administrator, with its server-enforced scope. -->
          <button v-if="canGenerate" class="view-tab view-tab-action" @click="openGenerateModal">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M6.5 3.5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <!-- Wrapped like the My Rating Tasks label: now that this button is
                 the same width as the others rather than double, the longest
                 label in the row needs somewhere to ellipsis on a narrow panel
                 instead of being clipped mid-word by the button's overflow. -->
            <span class="view-tab-label">Generate Assignments</span>
          </button>
          <button v-if="canAdmin" :class="['view-tab', activeView === 'all' && 'active']" @click="switchToAll">
            <span class="view-tab-label">All Assessments</span>
          </button>
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
            <span>{{ canGenerate ? 'Use Generate Assignments to create rater assignments.' : 'You have no assigned evaluations for this period.' }}</span>
          </div>
          <div v-else class="eli-list">
            <div v-for="task in myTasks" :key="task.id"
              :class="['eli', selectedTask && selectedTask.id === task.id ? 'eli-active' : '']"
              @click="selectTask(task)">
              <span class="eli-accent" :style="{ background: raterAccent(task.raterType) }"></span>
              <div class="eli-row">
                <!-- <div :class="['eli-av', rterTypeCls(task.raterType)]">{{ task.rateeName?.charAt(0)?.toUpperCase() || '?' }}</div> -->
                <div class="eli-info">
                  <div class="eli-name-row">
                    <span class="eli-name">{{ task.rateeName }}</span>
                  </div>
                  <div class="eli-meta">S{{ task.semester }} {{ task.year }}{{ taskDivisionLabel(task) ? ' · ' + taskDivisionLabel(task) : '' }}</div>
                </div>
                <div class="eli-right">
                  <!-- <span :class="['rtype-badge', rterTypeCls(task.raterType)]">{{ raterTypeLabel(task.raterType) }}</span> -->
                  <span :class="['eli-status-label', task.status === 'Completed' ? 'eli-sl-done' : 'eli-sl-pend']">{{ task.status }}</span>
                  <span v-if="task.ipatStatus === 'Final'" class="eli-final">
                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1 3.25V6c0 2.3 1.67 4.35 4.5 4.75 2.83-.4 4.5-2.45 4.5-4.75V3.25L5.5 1z" fill="#15803D" stroke="#15803D" stroke-width=".4"/><path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Finalized
                  </span>
                </div>
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
                <div class="eli-av eli-av-res">{{ initials(res.rateeName) }}</div>
                <div class="eli-info">
                  <div class="eli-name">{{ res.rateeName }}</div>
                  <div class="eli-meta">{{ res.divisionName }}</div>
                </div>
                <span v-if="res.allComplete && res.overallScore" class="rc-status-badge rc-done" style="font-size:10px">Computed</span>
                <span v-if="scoreIsPartial(res)" class="rc-status-badge rc-partial" style="font-size:10px" title="A component is missing - this is not a complete score">Incomplete</span>
                <span v-else class="rc-status-badge rc-pending" style="font-size:10px">In Progress</span>
              </div>
              <div class="eli-chips">
                <span class="eli-period-pill">S{{ res.semester }} {{ res.year }}</span>
                <template v-if="displayOverallScore(res)">
                  <span class="eli-score-big">{{ displayOverallScore(res) }}</span>
                  <span class="eli-score-percent">{{ scoreEquivalentPct(displayOverallScore(res)) }}</span>
                  <span v-if="displayDescriptor(res)" :class="['eli-desc-chip', descriptorClass(displayDescriptor(res))]">{{ displayDescriptor(res) }}</span>
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
            <span>{{ records.length === 0 ? (canGenerate ? 'Generate assignments to start.' : 'No assessments for this period yet.') : 'Try adjusting your filters.' }}</span>
            <small v-if="recordsLoadState.message" class="load-state-note">{{ recordsLoadState.message }}</small>
          </div>
          <div v-else class="eli-list all-records-list">
            <div v-for="rec in filteredRecords" :key="rec.id"
              :class="['eli', 'all-record-card', selectedRecord && selectedRecord.id === rec.id ? 'eli-active' : '']"
              @click="selectRecord(rec)">
              <div class="eli-row">
                <div class="eli-av eli-av-rec">{{ initials(rec.rateeName) }}</div>
                <div class="eli-info">
                  <div class="eli-name">{{ rec.rateeName }}</div>
                  <div class="eli-meta">{{ rec.divisionName || '-' }}</div>
                </div>
                <span :class="['status-badge', statusClass(rec.status)]">{{ statusLabel(rec.status) }}</span>
              </div>
              <!-- Uses the same displayOverallScore/displayDescriptor helpers as the
                   ratee's My Results list rather than the raw record fields, so an
                   administrator and the employee always read identical figures. -->
              <div class="eli-chips">
                <span class="eli-period-pill">S{{ rec.semester }} {{ rec.year }}</span>
                <template v-if="displayOverallScore(rec)">
                  <span class="eli-score-big">{{ displayOverallScore(rec) }}</span>
                  <span class="eli-score-percent">{{ scoreEquivalentPct(displayOverallScore(rec)) }}</span>
                  <span v-if="displayDescriptor(rec)" :class="['eli-desc-chip', descriptorClass(displayDescriptor(rec))]">{{ displayDescriptor(rec) }}</span>
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
            <div class="assessment-layout">
              <aside class="assessment-sidebar">
                <div class="sidebar-employee">
                  <div :class="['sidebar-avatar', activeAssignment ? rterTypeCls(activeAssignment.raterType) : 'eli-av-rec']">
                    {{ initials((activeRecord || selectedTask || selectedRecord).rateeName) }}
                  </div>
                  <div class="sidebar-employee-info">
                    <div class="sidebar-employee-name">{{ (activeRecord || selectedTask || selectedRecord).rateeName }}</div>
                    <div class="sidebar-employee-desc" v-if="activeAssignment">{{ raterRoleDesc(activeAssignment.raterType) }}</div>
                    <div class="sidebar-employee-desc" v-else>
                      {{ activeRecord?.divisionName || selectedRecord?.divisionName || '-' }}
                      <template v-if="activeRecord?.position"> · {{ activeRecord.position }}</template>
                    </div>
                    <div class="sidebar-badges">
                      <span v-if="activeAssignment" :class="['rtype-badge', rterTypeCls(activeAssignment.raterType)]">{{ raterTypeLabel(activeAssignment.raterType) }}</span>
                      <span v-else-if="activeRecord" :class="['status-badge', statusClass(activeRecord.status)]">{{ statusLabel(activeRecord.status) }}</span>
                      <span class="period-badge">S{{ (activeRecord || selectedTask || selectedRecord).semester }} {{ (activeRecord || selectedTask || selectedRecord).year }}</span>
                    </div>
                  </div>
                </div>

                <nav class="sidebar-domains" aria-label="Assessment domains">
                  <button v-if="showCBCTab" :class="['sidebar-domain', activeTab === 'cbc' && 'active']" @click="activeTab = 'cbc'">
                    <span class="sidebar-domain-top">
                      <span class="sidebar-domain-title">Core Behavioral Competencies</span>
                      <span class="sidebar-domain-arrow">›</span>
                    </span>
                    <span class="sidebar-domain-progress">{{ cbcAnsweredCount }} / {{ cbcTotalCount }}</span>
                    <span class="sidebar-domain-bar">
                      <span class="sidebar-domain-fill" :style="{ width: cbcProgress + '%' }"></span>
                    </span>
                  </button>
                  <button v-if="!activeAssignment" :class="['sidebar-domain', activeTab === 'fpo' && 'active']" @click="activeTab = 'fpo'">
                    <span class="sidebar-domain-top">
                      <span class="sidebar-domain-title">Functional Performance Output</span>
                      <span class="sidebar-domain-arrow">›</span>
                    </span>
                    <span class="sidebar-domain-progress">{{ activeRecord?.fpoScore ? 'Synced' : 'Needs sync' }}</span>
                    <span class="sidebar-domain-bar">
                      <span class="sidebar-domain-fill" :style="{ width: (activeRecord?.fpoScore ? 100 : 0) + '%' }"></span>
                    </span>
                  </button>
                  <button v-if="showJFTab" :class="['sidebar-domain', activeTab === 'jf' && 'active']" @click="activeTab = 'jf'">
                    <span class="sidebar-domain-top">
                      <span class="sidebar-domain-title">Job Fitness</span>
                      <span class="sidebar-domain-arrow">›</span>
                    </span>
                    <span class="sidebar-domain-progress">{{ jfAnsweredCount }} / {{ JF_INDICATORS.length }}</span>
                    <span class="sidebar-domain-bar">
                      <span class="sidebar-domain-fill" :style="{ width: (JF_INDICATORS.length ? Math.round(jfAnsweredCount / JF_INDICATORS.length * 100) : 0) + '%' }"></span>
                    </span>
                  </button>
                </nav>

                <div class="sidebar-card">
                  <div class="sidebar-card-title">Rating Scale</div>
                  <div class="sidebar-scale-item">
                    <span class="sidebar-scale-number">1</span>
                    <div><strong>Never</strong><small>The behavior is never demonstrated.</small></div>
                  </div>
                  <div class="sidebar-scale-item">
                    <span class="sidebar-scale-number">2</span>
                    <div><strong>Rarely</strong><small>The behavior is rarely demonstrated.</small></div>
                  </div>
                  <div class="sidebar-scale-item">
                    <span class="sidebar-scale-number">3</span>
                    <div><strong>Frequently</strong><small>The behavior is frequently demonstrated.</small></div>
                  </div>
                  <div class="sidebar-scale-item">
                    <span class="sidebar-scale-number">4</span>
                    <div><strong>Always</strong><small>The behavior is consistently demonstrated.</small></div>
                  </div>
                </div>
              </aside>

              <main class="assessment-content">
                <div class="assessment-content-header">
                  <div class="assessment-content-title">
                    <h3>{{ activeDomainTitle }}</h3>
                    <p>{{ activeDomainDescription }}</p>
                  </div>
                  <div class="assessment-content-actions">
                    <!-- This header is sticky and renders on every domain tab, so the
                         deduction control stays reachable from FPO and Job Fitness
                         too. Putting it inside the CBC tab hid it everywhere else. -->
                    <button v-if="!activeAssignment && canEditCbcDeduction(activeRecord)"
                            class="conduct-deduction-btn" @click="openCbcDeductionModal">
                      Conduct Deduction
                      <span v-if="hasCbcDeduction(activeRecord)" class="conduct-dot"></span>
                    </button>
                    <button class="eval-form-close" @click="closeDetailModal" title="Back to list">
                      <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                </div>

              <!-- Finalized note (rater) -->
              <div v-if="activeAssignment && selectedTask && selectedTask.ipatStatus === 'Final'" class="rp-final-note" style="margin-bottom:14px">
                <svg width="14" height="14" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1 3.25V6c0 2.3 1.67 4.35 4.5 4.75 2.83-.4 4.5-2.45 4.5-4.75V3.25L5.5 1z" fill="#15803D" stroke="#15803D" stroke-width=".4"/><path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
                This assessment has been finalized.
              </div>
              <div v-if="activeAssignment && (loadingAssessment || assessmentLoadError || !assessmentReadyForAssignment)" class="validation-banner" style="margin-bottom:14px">
                <template v-if="loadingAssessment">Loading assessment questions…</template>
                <template v-else>{{ assessmentLoadError || 'No active assessment questions are configured for this assignment.' }}<button class="btn" style="margin-left:10px" @click="loadAssessmentContent(true)">Retry</button></template>
              </div>

              <!-- Score summary (admin/self view only) -->
              <div v-if="!activeAssignment" class="score-summary-bar">
                <!-- Percentage equivalents mirror the ratee's My Results panel so an
                     administrator reads the same figures the employee sees. The large
                     number is the weighted contribution; the equivalent is derived from
                     the RAW domain score (score ÷ 4), which is why each uses a different
                     source. FPO passes the isFpo flag because it is normalised from the
                     IPCRF 1-5 scale before conversion. -->
                <div class="sscore">
                  <div class="sscore-lbl">CBC (30%)</div>
                  <div :class="['sscore-val', activeRecord?.cbcScore ? 'has-val' : '']">{{ cbcWeighted }}</div>
                  <div v-if="activeRecord?.cbcScore" class="sscore-eq">{{ scoreEquivalentPct(activeRecord.cbcScore) }} equivalent</div>
                </div>
                <div class="sscore-op">+</div>
                <div class="sscore">
                  <div class="sscore-lbl">FPO (55%)</div>
                  <div :class="['sscore-val', activeRecord?.fpoScore ? 'has-val' : '']">{{ fpoWeighted }}</div>
                  <div v-if="activeRecord?.fpoScore" class="sscore-eq">{{ scoreEquivalentPct(activeRecord.fpoScore, true) }} equivalent</div>
                </div>
                <div class="sscore-op">+</div>
                <div class="sscore">
                  <div class="sscore-lbl">JF (15%)</div>
                  <div :class="['sscore-val', activeRecord?.jfScore ? 'has-val' : '']">{{ jfWeighted }}</div>
                  <div v-if="activeRecord?.jfScore" class="sscore-eq">{{ scoreEquivalentPct(activeRecord.jfScore) }} equivalent</div>
                </div>
                <div class="sscore-op">=</div>
                <div class="sscore sscore-overall">
                  <div class="sscore-lbl">Overall</div>
                  <div v-if="displayOverallScore(activeRecord)" :class="['sscore-val', descriptorClass(displayDescriptor(activeRecord))]" style="font-size:22px;font-weight:800">{{ displayOverallScore(activeRecord) }}</div>
                  <div v-else class="sscore-val">-</div>
                  <div v-if="displayOverallScore(activeRecord)" class="sscore-eq sscore-eq-strong">{{ scoreEquivalentPct(displayOverallScore(activeRecord)) }} equivalent</div>
                  <div v-if="displayDescriptor(activeRecord)" :class="['sscore-desc', descriptorClass(displayDescriptor(activeRecord))]">{{ displayDescriptor(activeRecord) }}</div>
                </div>
                <!-- Conduct Deduction lives in the CBC tab intro row below. It was
                     here, but it cost ~150px of the summary bar and forced the four
                     score cards to scroll sideways. It is also a CBC-domain action
                     (NTE / offence level), so it belongs beside the CBC ratings. -->
              </div>
              <div v-if="!activeAssignment && scoreIsPartial(activeRecord)" class="rp-partial-note" style="margin:0 0 14px">
                <strong>Incomplete score.</strong> {{ partialScoreNote(activeRecord) }}
              </div>

              <!-- ── CBC TAB ── -->
              <div v-if="activeTab === 'cbc'" class="modal-body-scroll">
                <template v-if="activeAssignment">
                  <div v-if="showValidation && cbcAnsweredCount < cbcTotalCount" class="validation-banner">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FEF2F2" stroke="#EF4444" stroke-width="1.2"/><path d="M7 4v4M7 9.5v.5" stroke="#EF4444" stroke-width="1.3" stroke-linecap="round"/></svg>
                    Please answer all <strong>{{ cbcTotalCount - cbcAnsweredCount }}</strong> remaining question{{ cbcTotalCount - cbcAnsweredCount !== 1 ? 's' : '' }} before submitting.
                  </div>
                </template>
                <template v-else>
                  <div class="tab-intro">
                    <template v-if="canAdmin">
                      Viewing submitted ratings for each HEARTWORK behavioral indicator.
                      <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                    </template>
                    <template v-else>
                      Rate each behavioral indicator using the <strong>1-4 Likert scale</strong>:
                      <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                    </template>
                  </div>
                  <div class="rater-row">
                    <div class="rater-selector">
                      <span class="rater-label">{{ canAdmin ? 'Viewing ratings from:' : 'Rating as:' }}</span>
                      <select v-model="cbcRaterType" class="field-input rater-select">
                        <option v-if="!cbcRaterOptions.length" value="" disabled>No submitted ratings</option>
                        <option v-for="option in cbcRaterOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                    </div>
                    <div class="has-sub-note">
                      Subordinates: <strong>{{ activeRecord?.hasSubordinate ? 'Yes' : 'No' }}</strong>
                      {{ !activeRecord?.hasSubordinate ? '- Peer1 + Peer2 each 15%' : '' }}
                    </div>
                    <!-- Admins review submitted ratings; only the assigned rater can
                         change them. Saying so stops people hunting for a Save button
                         that intentionally does not exist on this screen. -->
                    <div v-if="canAdmin && !activeAssignment" class="readonly-note">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/>
                        <path d="M4.2 5.5V4a1.8 1.8 0 0 1 3.6 0v1.5" stroke="currentColor" stroke-width="1.1"/>
                      </svg>
                      Read-only - submitted by the rater
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
                        <template v-if="!activeAssignment && canAdmin">
                          <span v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getCBCRating(theme.id, idx) === n && 'selected', 'rating-readonly']">{{ n }}</span>
                        </template>
                        <template v-else>
                          <button v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getCBCRating(theme.id, idx) === n && 'selected']" :title="['Never','Rarely','Frequently','Always'][n-1]" @click="setCBCRating(theme.id, idx, n)">{{ n }}</button>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="!activeAssignment && !canAdmin" class="action-bar">
                  <button class="btn btn-primary" :disabled="savingCBC" @click="saveCBCRatings"><span v-if="savingCBC" class="spinner-sm"></span>{{ savingCBC ? 'Saving…' : 'Save CBC Ratings' }}</button>
                  <button class="btn" :disabled="computingCBC" @click="computeCBC">{{ computingCBC ? 'Computing…' : 'Compute CBC Score' }}</button>
                </div>
              </div>

              <!-- ── FPO TAB ── -->
              <div v-if="activeTab === 'fpo'" class="modal-body-scroll">
                <!--
                  The protocol defines a different Functional Performance Output
                  instrument per office: STB uses the DSPMS IPCRF/DPCR, while
                  Pag-abot, Walang Gutom and Tara-Basa each adopted their own.
                  Only STB's instrument lives in this system, so only STB can
                  auto-sync. Every other office records the figure its own
                  instrument produced, and the IPCRF sync control is hidden
                  rather than shown-and-failing.
                -->
                <div class="tab-intro">
                  <template v-if="usesIpcrfForFpo">
                    The <strong>Functional Performance Output</strong> domain uses the employee's <strong>IPCRF/DPCR Final Numerical Rating</strong> (1-5 scale) as the basis. It constitutes <strong>55%</strong> of the overall IPAT score.
                  </template>
                  <template v-else>
                    The <strong>Functional Performance Output</strong> domain uses this office's own approved performance instrument, as provided for in the assessment protocol. Enter the resulting rating (1-5 scale) below. It constitutes <strong>55%</strong> of the overall assessment score.
                  </template>
                </div>
                <div class="fpo-panel">
                  <div class="fpo-current">
                    <div class="fpo-label">FPO Weighted Score</div>
                    <div class="fpo-score">{{ fpoWeighted }}</div>
                    <div v-if="activeRecord?.fpoScore" class="fpo-converted">
                      Raw {{ usesIpcrfForFpo ? 'IPCRF' : 'FPO' }} score: <strong>{{ activeRecord.fpoScore }}</strong> × 0.55
                    </div>
                  </div>
                  <div v-if="usesIpcrfForFpo" class="fpo-update">
                    <label class="field-label">Auto-sync from IPCRF/CCEF</label>
                    <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                      <button class="btn btn-primary" :disabled="syncingFPO" @click="syncFPOScore"><span v-if="syncingFPO" class="spinner-sm"></span>{{ syncingFPO ? 'Syncing…' : (activeRecord?.fpoScore ? 'Re-sync Score' : 'Sync Score') }}</button>
                    </div>
                    <span v-if="fpoSource" style="font-size:10px;color:#16A34A;margin-top:6px;display:block">Pulled from {{ fpoSource.type }} ({{ fpoSource.status }}) - S{{ fpoSource.semester }} {{ fpoSource.year }}{{ fpoSource.adjectivalRating ? ' · ' + fpoSource.adjectivalRating : '' }}</span>
                    <span v-else style="font-size:10px;color:#94A3B8;margin-top:4px;display:block">Pulls automatically from the employee's IPCRF/CCEF for this period.</span>
                  </div>
                </div>
                <div v-if="canAdmin" class="fpo-manual-panel">
                  <div class="fpo-manual-title">{{ usesIpcrfForFpo ? 'Manual FPO Entry' : 'FPO Entry' }}</div>
                  <p class="fpo-manual-hint">
                    {{ usesIpcrfForFpo
                      ? 'For periods where IPCRF/CCEF is unavailable (e.g. 1st Semester), enter the FPO score manually.'
                      : 'Enter the rating produced by this office\'s approved performance instrument for this period.' }}
                  </p>
                  <div class="fpo-manual-row">
                    <div class="fpo-manual-input-group">
                      <label class="fpo-manual-label" for="fpoManualInput">
                        {{ usesIpcrfForFpo ? 'IPCRF Final Rating' : 'FPO Rating' }}
                        <span class="fpo-manual-range">1.00 - 5.00</span>
                      </label>
                      <div class="fpo-input-shell">
                        <input id="fpoManualInput" v-model="fpoManualInput" type="number" step="0.01" min="1" max="5"
                               class="fpo-manual-field" placeholder="0.00" inputmode="decimal"
                               @blur="onFpoManualBlur" @keyup.enter="$event.target.blur()"/>
                        <span class="fpo-input-affix">/ 5</span>
                      </div>
                      <span class="fpo-manual-help">Type the rating, then press Enter or click away to save.</span>
                    </div>
                    <div v-if="fpoManualInput && Number(fpoManualInput) >= 1 && Number(fpoManualInput) <= 5" class="fpo-manual-result">
                      <span class="fpo-calc-formula">{{ fpoManualInput }} × 0.55</span>
                      <span class="fpo-calc-eq">=</span>
                      <span class="fpo-calc-value">{{ fpoManualWeighted }}</span>
                      <span class="fpo-calc-caption">weighted FPO</span>
                    </div>
                    <div v-else-if="fpoManualInput" class="fpo-manual-invalid">
                      Enter a value between 1.00 and 5.00.
                    </div>
                    <div class="fpo-manual-status">
                      <span v-if="savingFpoManual" class="fpo-saving-indicator"><span class="spinner-sm"></span> Saving…</span>
                      <span v-else-if="fpoManualSaved" class="fpo-saved-indicator">✓ Saved</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── JF TAB ── -->
              <div v-if="activeTab === 'jf'" class="modal-body-scroll">
                <template v-if="activeAssignment">
                  <div v-if="showValidation && jfAnsweredCount < JF_INDICATORS.length" class="validation-banner">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FEF2F2" stroke="#EF4444" stroke-width="1.2"/><path d="M7 4v4M7 9.5v.5" stroke="#EF4444" stroke-width="1.3" stroke-linecap="round"/></svg>
                    Please answer all <strong>{{ JF_INDICATORS.length - jfAnsweredCount }}</strong> remaining question{{ JF_INDICATORS.length - jfAnsweredCount !== 1 ? 's' : '' }} before submitting.
                  </div>
                </template>
                <template v-else>
                  <div class="tab-intro">
                    <template v-if="canAdmin">
                      Viewing submitted Job Fitness ratings. JF Indicator Score = (Self + Supervisor) ÷ 2
                      <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                    </template>
                    <template v-else>
                      <strong>Job Fitness</strong> is rated by the Ratee (Self) and Immediate Supervisor only. JF Indicator Score = (Self + Supervisor) ÷ 2
                      <span class="scale-hint">1 = Never · 2 = Rarely · 3 = Frequently · 4 = Always</span>
                    </template>
                  </div>
                  <div class="rater-selector" style="margin-bottom:16px">
                    <span class="rater-label">{{ canAdmin ? 'Viewing ratings from:' : 'Rating as:' }}</span>
                    <select v-model="jfRaterType" class="field-input rater-select">
                      <option v-if="!jfRaterOptions.length" value="" disabled>No submitted ratings</option>
                      <option v-for="option in jfRaterOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                  </div>
                </template>
                <div v-if="!activeAssignment && loadedRec?.jfVarianceFlagged" class="variance-banner">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 14h14L8 1z" fill="#FEF9C3" stroke="#CA8A04" stroke-width="1.2"/><path d="M8 6v4M8 11.5v.5" stroke="#CA8A04" stroke-width="1.4" stroke-linecap="round"/></svg>
                  <div><strong>Significant variance detected</strong> - the Self-rating and Supervisor rating differ by {{ loadedRec.jfVarianceGap }} points. This record is flagged for Skip Supervisor review per Section 11 of the evaluation guidelines.</div>
                </div>
                <div class="jf-list">
                  <div v-for="(ind, idx) in JF_INDICATORS" :key="idx" :class="['jf-row', showValidation && getJFRating(idx) === null ? 'unanswered' : '']">
                    <div class="jf-num">{{ idx + 1 }}</div>
                    <div class="jf-info">
                      <div class="jf-label">{{ ind }}</div>
                      <input v-if="!canAdmin || activeAssignment" v-model="jfEvidence[idx]" type="text" class="jf-evidence" placeholder="Supporting evidence / document reference (optional)"/>
                      <div v-else-if="jfEvidence[idx]" class="jf-evidence-readonly">{{ jfEvidence[idx] }}</div>
                    </div>
                    <div class="ind-rating">
                      <template v-if="!activeAssignment && canAdmin">
                        <span v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getJFRating(idx) === n && 'selected', 'rating-readonly']">{{ n }}</span>
                      </template>
                      <template v-else>
                        <button v-for="n in [1,2,3,4]" :key="n" :class="['rating-btn', getJFRating(idx) === n && 'selected']" :title="['Never','Rarely','Frequently','Always'][n-1]" @click="setJFRating(idx, n)">{{ n }}</button>
                      </template>
                    </div>
                  </div>
                </div>
                <div v-if="!activeAssignment && !canAdmin" class="action-bar">
                  <button class="btn btn-primary" :disabled="savingJF" @click="saveJFRatings"><span v-if="savingJF" class="spinner-sm"></span>{{ savingJF ? 'Saving…' : 'Save Job Fitness Ratings' }}</button>
                  <button class="btn" :disabled="computingJF" @click="computeJF">{{ computingJF ? 'Computing…' : 'Compute JF Score' }}</button>
                </div>
              </div>

            <!-- Sticky footer actions.
                 Every branch below requires either an active rating assignment or
                 a non-admin viewer, so for an administrator the bar rendered with
                 nothing in it - an empty strip pinned to the bottom of the screen.
                 Render it only when it actually has an action. -->
            <div v-if="hasFooterActions" class="eval-form-footer">
              <template v-if="activeAssignment">
                <div class="eval-footer-progress">
                  <span :class="['eval-footer-count', allRaterAnswered ? 'done' : '']">{{ raterAnsweredTotal }} / {{ raterTotal }} answered</span>
                </div>
                <button class="btn btn-submit-rating" :disabled="submittingRating || selectedAssignmentCompleted || !assessmentReadyForAssignment" @click="submitRatings">
                  <span v-if="submittingRating" class="spinner-sm" style="border-top-color:#fff"></span>
                  {{ submittingRating ? 'Submitting...' : (selectedAssignmentCompleted ? 'Submitted' : 'Submit Ratings') }}
                </button>
              </template>
              <template v-else-if="!canAdmin && activeRecord?.status !== 'Final'">
                <button v-if="activeRecord?.status === 'Computed'" class="btn btn-finalize" :disabled="finalizing" @click="finalizeRecord">
                  <span v-if="finalizing" class="spinner-sm" style="border-top-color:#fff"></span>
                  <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L2 3.5V6.5c0 2.76 2 5.15 4.5 5.5C9 11.65 11 9.26 11 6.5V3.5L6.5 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  {{ finalizing ? 'Finalizing...' : 'Finalize Assessment' }}
                </button>
                <button class="btn btn-primary" :disabled="computingOverall" @click="computeOverall"><span v-if="computingOverall" class="spinner-sm"></span>{{ computingOverall ? 'Computing…' : 'Compute Overall Score' }}</button>
              </template>
              <span v-else-if="!canAdmin" class="finalized-badge">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1.5 3.25V6c0 2.5 1.8 4.65 4.5 5 2.7-.35 4.5-2.5 4.5-5V3.25L6 1z" fill="#15803D" stroke="#15803D" stroke-width=".5" stroke-linejoin="round"/><path d="M3.75 6l1.5 1.5L9 4.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Finalized
              </span>
            </div>
              </main>
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
              <div :class="['rp-score-hero', descriptorClass(displayDescriptor(selectedResult))]">
                <div class="rp-score-big">{{ displayOverallScore(selectedResult) ?? '-' }}</div>
                <div v-if="displayOverallScore(selectedResult)" class="rp-score-equivalent">{{ scoreEquivalentPct(displayOverallScore(selectedResult)) }} equivalent</div>
                <div v-if="displayDescriptor(selectedResult)" class="rp-score-desc">{{ displayDescriptor(selectedResult) }}</div>
                <div v-if="scoreIsPartial(selectedResult)" class="rp-partial-badge">Incomplete score</div>
              </div>
              <div v-if="scoreIsPartial(selectedResult)" class="rp-partial-note">
                <strong>This score is not final.</strong> {{ partialScoreNote(selectedResult) }}
              </div>
              <div class="rp-score-grid">
                <div class="rp-score-block">
                  <div class="rp-score-lbl">CBC</div>
                  <div class="rp-score-val">{{ cbcWeightedScore(selectedResult) }}</div>
                  <div class="rp-score-pct">30% weight</div>
                  <div v-if="selectedResult.cbcScore" class="rp-score-equivalent-sm">{{ scoreEquivalentPct(selectedResult.cbcScore) }} equivalent</div>
                </div>
                <div class="rp-score-block">
                  <div class="rp-score-lbl">FPO</div>
                  <div class="rp-score-val">{{ weightedDomainScore(selectedResult.fpoScore, 0.55, true) }}</div>
                  <div class="rp-score-pct">55% weight</div>
                  <div v-if="selectedResult.fpoScore" class="rp-score-equivalent-sm">{{ scoreEquivalentPct(selectedResult.fpoScore, true) }} equivalent</div>
                </div>
                <div class="rp-score-block">
                  <div class="rp-score-lbl">JF</div>
                  <div class="rp-score-val">{{ weightedDomainScore(selectedResult.jfScore, 0.15) }}</div>
                  <div class="rp-score-pct">15% weight</div>
                  <div v-if="selectedResult.jfScore" class="rp-score-equivalent-sm">{{ scoreEquivalentPct(selectedResult.jfScore) }} equivalent</div>
                </div>
              </div>
              <div v-if="hasCbcDeduction(selectedResult)" class="private-deduction-note">
                <div class="private-deduction-title">Offenses deduction applied</div>
                <div>{{ cbcDeductionText(selectedResult) }}</div>
                <small>This notice is shown only to you and authorized reviewers.</small>
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
                  <option value="1">1st Semester (Jan-Jun)</option>
                  <option value="2">2nd Semester (Jul-Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year</label>
                <input v-model.number="createForm.year" type="number" class="field-input"/>
              </div>
              <div class="field full">
                <label class="field-label">FPO Score - IPCRF Final Numerical Rating</label>
                <div class="fpo-auto-note">
                  Pulled automatically from the ratee's own rated IPCRF/CCEF for this same period - no manual entry needed.
                  If their IPCRF/CCEF isn't rated yet, you can sync it later from the assessment detail view.
                </div>
              </div>
              <div class="field full">
                <label class="field-label">Does the ratee have subordinates?</label>
                <div class="toggle-row">
                  <button :class="['toggle-btn', createForm.hasSubordinate === true && 'active']" @click="createForm.hasSubordinate = true">Yes - Peer weight: 15%</button>
                  <button :class="['toggle-btn', createForm.hasSubordinate === false && 'active']" @click="createForm.hasSubordinate = false">No - Peer weight: 30%</button>
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
      <!-- While a generation is running the modal is sealed: no overlay click, no
           close button, no Cancel. It rewrites an entire office's assignments and
           can delete submitted responses, so a half-finished run is the one state
           worth preventing outright - and closing the dialog would not stop the
           request anyway, it would only hide it. -->
      <div v-if="showGenerateModal" class="modal-overlay" @click.self="!generating && (showGenerateModal = false)">
        <div class="modal" style="max-width:480px">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9 5v4.5l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Generate / Backfill Rater Assignments</h3>
              <p class="modal-sub">Creates missing rater assignments for {{ assignmentScopeLabel }} without changing completed ratings</p>
            </div>
            <button v-if="!generating" class="modal-close" @click="showGenerateModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div v-if="generateResult" class="gen-result">
              <div class="gen-result-title">Backfill Complete</div>
              <div class="gen-result-stat">{{ generateResult.generated }} missing assignment/s · {{ generateResult.ratees }} employee/s checked</div>
              <div class="gen-result-breakdown">
                <span v-for="(count, type) in generateResult.breakdown" :key="type" class="gen-chip">
                  {{ type }}: {{ count }}
                </span>
              </div>
              <p class="gen-result-note">Existing ratings were preserved. Users with newly added assignments can now open Evaluation to complete them.</p>
            </div>
            <div v-else class="form-grid">
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="generateForm.semester" class="field-input">
                  <option value="1">1st Semester (Jan-Jun)</option>
                  <option value="2">2nd Semester (Jul-Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year <span class="req">*</span></label>
                <input v-model.number="generateForm.year" type="number" class="field-input" min="2020" max="2099"/>
              </div>
              <div class="field full">
                <div class="gen-info-box">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:800;color:#1d4ed8;">Scope: {{ assignmentScopeLabel }}</p>
                  <strong>What this does:</strong>
                  <ul style="margin:6px 0 0 18px;padding:0;font-size:12px;line-height:1.7">
                    <li>Creates missing IPAT records for active employees</li>
                    <li>Backfills missing Self, CBC Peer, Supervisor, and Skip Supervisor assignments</li>
                    <li>Preserves existing assignments, submitted ratings, and computed scores</li>
                    <li>Avoids repeating same Peer/Subordinate from the previous cycle</li>
                    <li>Employees will see their assigned ratees in <em>My Rating Tasks</em></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" :disabled="generating" @click="showGenerateModal = false; generateResult = null">{{ generateResult ? 'Close' : 'Cancel' }}</button>
            <button v-if="!generateResult" class="btn btn-primary" :disabled="generating" @click="generateAssignments">
              <span v-if="generating" class="spinner-sm"></span>
              {{ generating ? generateProgressLabel : 'Generate / Backfill Assignments' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════ CBC CONDUCT DEDUCTION MODAL ══════════════════════ -->
    <teleport to="body">
      <div v-if="showCbcDeductionModal" class="modal-overlay" @click.self="closeCbcDeductionModal">
        <div class="modal conduct-modal">
          <div class="modal-hd">
            <div class="modal-icon warning-icon">!</div>
            <div>
              <h3 class="modal-title">Offenses Deduction</h3>
              <p class="modal-sub">Confidential adjustment for NTE and actual commission of offense</p>
            </div>
            <button class="modal-close" @click="closeCbcDeductionModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body conduct-modal-body">
            <div class="conduct-ratee-card">
              <strong>{{ activeRecord?.rateeName }}</strong>
              <span>S{{ activeRecord?.semester }} {{ activeRecord?.year }} · {{ activeRecord?.divisionName }}</span>
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">NTE Offense Level</label>
                <select v-model="cbcDeductionForm.cbcNteLevel" class="field-input">
                  <option value="none">None</option>
                  <option value="light">Light offense (-5%)</option>
                  <option value="less_grave">Less grave offense (-10%)</option>
                  <option value="serious_grave">Serious/Grave offense (-15%)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Actual Commission Offense Level</label>
                <select v-model="cbcDeductionForm.cbcOffenseLevel" class="field-input">
                  <option value="none">None</option>
                  <option value="light">Light offense (-0.25)</option>
                  <option value="less_grave">Less grave offense (-0.50)</option>
                  <option value="serious_grave">Serious/Grave offense (-1.00)</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Confidential Basis / Notes</label>
                <textarea v-model="cbcDeductionForm.cbcDeductionNote" class="field-input" rows="4" placeholder="Optional confidential reference for authorized reviewers only"></textarea>
              </div>
            </div>
            <div class="conduct-preview">
              <div>
                <span>CBC percentage raw score</span>
                <strong>{{ cbcDeductionPreview.basePct !== null ? `${cbcDeductionPreview.basePct}%` : '-' }}</strong>
              </div>
              <div>
                <span>NTE deduction</span>
                <strong>{{ cbcDeductionPreview.ntePct ? `-${cbcDeductionPreview.ntePct}%` : 'None' }}</strong>
              </div>
              <div>
                <span>Final score offense deduction</span>
                <strong>{{ cbcDeductionPreview.offenseDeduction ? `-${cbcDeductionPreview.offenseDeduction}` : 'None' }}</strong>
              </div>
              <div class="conduct-preview-final">
                <span>CBC contribution to overall</span>
                <strong>{{ cbcDeductionPreview.cbcWeightedScore ?? '-' }}</strong>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeCbcDeductionModal">Cancel</button>
            <button class="btn btn-primary" :disabled="savingCbcDeduction" @click="saveCbcDeduction">
              <span v-if="savingCbcDeduction" class="spinner-sm"></span>
              {{ savingCbcDeduction ? 'Saving…' : 'Save Deduction' }}
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ipatApi, ipatAssignmentsApi, usersApi, assessmentContentApi, assessmentCategoryApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { useBranding } from '@/composables/useBranding'
import { useConfirm } from '@/composables/useConfirm'
import { useOrgOptions } from '@/composables/useOrgOptions'
import { useAuthStore } from '@/stores/auth'

const { confirm } = useConfirm()
const route = useRoute()
const authStore = useAuthStore()
const { hasPermission, isAdmin, canGenerateAssignments } = usePermissions()
const { isClusterPortal, portalSubtitle } = useBranding()
const canViewBureauMonitoring = hasPermission('view_bureau_monitoring')
const canViewDivisionMonitoring = hasPermission('view_division_monitoring')
const { loadOrgOptions, currentDivisions } = useOrgOptions()

// Only STB's Functional Performance Output instrument (the DSPMS IPCRF/DPCR)
// exists in this system. Participating offices adopted their own instruments
// under the protocol, so for them the FPO figure is recorded manually and the
// IPCRF auto-sync control is hidden rather than offered and then failing.
const usesIpcrfForFpo = computed(() => !isClusterPortal.value)

// ── Assessment content fetched from backend ──
const assessmentQuestions  = ref([])
const assessmentCategories = ref([])
const loadingAssessment    = ref(false)
const assessmentLoadError  = ref('')

const categoryLookup = computed(() => {
  const map = {}
  assessmentCategories.value.forEach(c => { map[c.categoryId] = c })
  return map
})

function canonicalAssessmentRater(type) {
  return ({ Peer1: 'Peer', Peer2: 'Peer', Subordinate: 'Upward', SkipSupervisor: 'Skip Supervisor' })[type] || type
}
function canonicalAssessmentLevel(role) {
  const key = String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ')
  if (key === 'staff' || key === 'technical staff') return 'Technical Staff'
  if (['oic dc', 'oic division chief', 'officer in charge division chief'].includes(key)) return 'Division Chief'
  return String(role || '').trim()
}
// Mirrors AssessmentContentService.levelApplies_ exactly. An empty list means
// every role - the default for a new question. A non-empty list is an explicit
// choice made from the office's own roles, so it is honoured as written.
// Compared case- and spacing-insensitively because the list is ticked in the
// content editor while the role is copied onto the assignment from the
// personnel record. A ratee with no role recorded still sees the questions:
// an unassessable person is worse than an over-broad form.
// Keep this in step with the server rule - the server gates the submission
// against its own count, so a divergence means a rater answers everything
// shown and is still rejected.
function levelKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}
function levelAppliesToAssignment(levels, level) {
  if (!levels.length) return true
  const key = levelKey(level)
  if (!key) return true
  return levels.some(item => levelKey(item) === key)
}
function questionAppliesToAssignment(question) {
  if (!activeAssignment.value) return true
  const raters = Array.isArray(question.applicableRaters) ? question.applicableRaters : []
  const levels = Array.isArray(question.applicableLevels) ? question.applicableLevels : []
  return (!raters.length || raters.includes(canonicalAssessmentRater(activeAssignment.value.raterType))) &&
    levelAppliesToAssignment(levels, canonicalAssessmentLevel(activeAssignment.value.rateeRole))
}
const applicableAssessmentQuestions = computed(() => assessmentQuestions.value.filter(question => String(question.status || '').trim().toLowerCase() === 'active' && questionAppliesToAssignment(question)))
const HEARTWORK_THEMES = computed(() => {
  const cbcQuestions = applicableAssessmentQuestions.value.filter(q => String(q.domain || '').trim().toLowerCase() === 'cbc')
  const grouped = {}
  cbcQuestions.forEach(q => {
    if (!grouped[q.category]) {
      const cat = categoryLookup.value[q.category]
      grouped[q.category] = {
        id: q.category,
        label: cat?.categoryName || q.category,
        description: cat?.description || q.guidanceText || '',
        sequence: cat?.sequence || 0,
        indicators: []
      }
    }
    grouped[q.category].indicators.push(q.questionText)
  })
  return Object.values(grouped).sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
})

const JF_INDICATORS = computed(() =>
  applicableAssessmentQuestions.value
    .filter(q => String(q.domain || '').trim().toLowerCase() === 'jf')
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    .map(q => q.questionText)
)

async function loadAssessmentContent(force = false) {
  if (assessmentQuestions.value.length && !force) return

  // Paint the question set from the last visit so the form appears at once,
  // then fetch and replace it. The questions are the slowest thing on this
  // screen for a rater, and they change perhaps once a semester.
  //
  // The fetch is never skipped, so the cached copy is only ever on screen for
  // the second or two before the fresh one lands - far less time than it takes
  // to answer anything. That matters, because the server counts the questions
  // it expects when validating a submission: answering a stale set would be
  // rejected. Showing it briefly is safe; trusting it is not.
  const cachedContent = readSnapshot('content', 'all', 'all')
  if (cachedContent && !assessmentQuestions.value.length) {
    assessmentQuestions.value = cachedContent.rows
    const cachedCategories = readSnapshot('categories', 'all', 'all')
    if (cachedCategories) assessmentCategories.value = cachedCategories.rows
  }

  loadingAssessment.value = !assessmentQuestions.value.length
  assessmentLoadError.value = ''
  try {
    // Settled, not all: categories only supply the display label and blurb for
    // a competency group. Under Promise.all a failed categories call rejected
    // the pair and threw the successfully fetched QUESTIONS away, leaving the
    // rater an empty form over a purely cosmetic lookup. Questions decide
    // whether the form can be answered at all, so only they may fail it.
    const [qRes, cRes] = await Promise.allSettled([
      assessmentContentApi.list({ status: 'Active', pageSize: 500 }),
      assessmentCategoryApi.list({ status: 'Active', pageSize: 200 })
    ])
    if (qRes.status === 'rejected') throw qRes.reason
    const qData = qRes.value
    const cData = cRes.status === 'fulfilled' ? cRes.value : []
    if (cRes.status === 'rejected') {
      // Groups fall back to their raw category id as the heading.
      console.error('[Evaluation] Category labels unavailable', cRes.reason)
    }
    const questions = qData?.items || (Array.isArray(qData) ? qData : [])
    // An empty list is a real answer, not a failure: the office has no active
    // questions yet. Leave assessmentLoadError unset so the banner shows its
    // "not configured" text, which is the accurate advice in that case.
    assessmentQuestions.value  = questions
    assessmentCategories.value = cData?.items || (Array.isArray(cData) ? cData : [])
    writeSnapshot('content', 'all', 'all', assessmentQuestions.value)
    writeSnapshot('categories', 'all', 'all', assessmentCategories.value)
  } catch (e) {
    // The request itself failed - expired session, network drop, server error.
    // Surfacing it matters: without this the banner fell back to "no active
    // assessment questions are configured", sending users to an administrator
    // over a problem that Retry or a fresh sign-in would have solved.
    console.error(e)
    assessmentLoadError.value = e?.message || 'Assessment questions could not be loaded. Please retry.'
  } finally {
    loadingAssessment.value = false
  }
}

// ── State ──
const records      = ref([])
const loading      = ref(false)
const creating     = ref(false)
const activeStatus = ref('All')
const search       = ref('')
const filterDiv    = ref('')
const divisionOptions = ref([])
const recordsLoadState = ref({ status: 'idle', message: '' })

function divisionKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// View toggle
// "Can administer assessments" gates the All Assessments view and the
// administrative detail panel. Assignment generation is separately scoped:
// STB's System Administrator generates STB assignments, while an office admin
// generates only assignments in their own office workbook.
const canAdmin = hasPermission('manage_ipat_scores')

// A pure System Administrator maintains the system but is not assessed by it, so
// "My Rating Tasks" and "My Results" are always empty for them and only take up
// space. They get Generate Assignments in that row instead.
//
// Office administrators can be ratees too, so they retain their personal tabs
// and receive the scoped generation action alongside them.
const isSystemAdmin  = isAdmin
const showPersonalTabs = computed(() => !isSystemAdmin.value)
const canGenerate      = canGenerateAssignments
const assignmentScopeLabel = computed(() =>
  isClusterPortal.value ? (portalSubtitle.value || 'your assigned office') : 'the Social Technology Bureau'
)
// A System Administrator has no personal tabs, so landing on 'my-tasks' would
// strand them on a permanently empty view with no control to leave it.
const activeView  = ref(isSystemAdmin.value ? 'all' : 'my-tasks')

// My Tasks state
const myTasks         = ref([])
const loadingTasks    = ref(false)
const activeAssignment = ref(null)  // set when a task card is clicked
const selectedTask   = ref(null)
const selectedResult = ref(null)
const selectedRecord = ref(null)
const currentYear = new Date().getFullYear()
const requestedSemester = String(route.query.semester || '')
const requestedYear = Number(route.query.year || 0)
const tasksSemester = ref(['1', '2'].includes(requestedSemester)
  ? requestedSemester
  : String(new Date().getMonth() < 6 ? 1 : 2))
const tasksYear = ref(Number.isInteger(requestedYear) && requestedYear >= 2023 && requestedYear <= currentYear + 1
  ? requestedYear
  : currentYear)
// Set on every successful loadMyTasks/loadMyResults - whichever list is
// currently shown - so "Refresh" always reports how fresh the visible data
// actually is, not just whichever tab last loaded.
const tasksLastUpdatedAt = ref(null)
// True only once a background check (see checkForNewData) finds the server
// has something this screen does not. Never true on first load - there is
// nothing to compare against yet.
const hasNewTaskData = ref(false)
const checkingForNewData = ref(false)
const tasksLastUpdatedLabel = computed(() =>
  tasksLastUpdatedAt.value ? tasksLastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)
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
const generateProgressLabel = ref('Checking and backfilling…')
const generateForm  = ref({ semester: String(new Date().getMonth() < 6 ? 1 : 2), year: currentYear })
const generating    = ref(false)
const generateResult = ref(null)

const showCreateModal = ref(false)
const activeRecord    = ref(null)
const activeTab       = ref('cbc')

const loadedRec     = ref(null)   // full record from get() - carries cbcRatings + jfRatings
const loadingDetail = ref(false)
const allUsers      = ref([])
const loadingUsers  = ref(false)

const cbcRaterType = ref('Self')
const cbcRatings   = ref({})
const savingCBC    = ref(false)
const computingCBC = ref(false)
const showCbcDeductionModal = ref(false)
const savingCbcDeduction = ref(false)
const cbcDeductionForm = ref({
  cbcNteLevel: 'none',
  cbcOffenseLevel: 'none',
  cbcDeductionNote: ''
})

const fpoSource  = ref(null)
const syncingFPO = ref(false)
const fpoManualInput  = ref('')
const savingFpoManual = ref(false)
const fpoManualSaved  = ref(false)

const cbcWeighted = computed(() => {
  return cbcWeightedScore(activeRecord.value)
})
const fpoWeighted = computed(() => {
  let s = Number(activeRecord.value?.fpoScore)
  if (!s) return '-'
  if (s > 4) s = Math.round(((s - 1) / 4 * 3 + 1) * 100) / 100
  return (Math.round(s * 0.55 * 100) / 100).toFixed(2)
})
const jfWeighted = computed(() => {
  const s = Number(activeRecord.value?.jfScore)
  if (!s) return '-'
  return (Math.round(s * 0.15 * 100) / 100).toFixed(2)
})
const fpoManualWeighted = computed(() => {
  let s = Number(fpoManualInput.value)
  if (!s || s < 1 || s > 5) return ''
  if (s > 4) s = Math.round(((s - 1) / 4 * 3 + 1) * 100) / 100
  return (Math.round(s * 0.55 * 100) / 100).toFixed(2)
})

function normalizedFourPointScore(value, isFpo = false) {
  let score = Number(value)
  if (!Number.isFinite(score) || score <= 0) return null
  if (isFpo && score > 4) score = ((score - 1) / 4) * 3 + 1
  return Math.max(0, Math.min(4, score))
}

function weightedDomainScore(value, weight, isFpo = false) {
  const score = normalizedFourPointScore(value, isFpo)
  if (score === null) return '-'
  return (Math.round(score * weight * 100) / 100).toFixed(2)
}

function cbcWeightedScore(record) {
  const score = normalizedFourPointScore(record?.cbcScore)
  if (score === null) return '-'
  const weighted = score * 0.30
  return (Math.round(weighted * 100) / 100).toFixed(2)
}

function scoreEquivalentPct(value, isFpo = false) {
  const score = normalizedFourPointScore(value, isFpo)
  if (score === null) return '-'
  const pct = Math.max(0, Math.min(100, (score / 4) * 100))
  return `${Number(pct.toFixed(1)).toLocaleString()}%`
}

const CONDUCT_LEVELS = {
  none: { label: 'None', ntePct: 0, offenseDeduction: 0 },
  light: { label: 'Light offense', ntePct: 5, offenseDeduction: 0.25 },
  less_grave: { label: 'Less grave offense', ntePct: 10, offenseDeduction: 0.5 },
  serious_grave: { label: 'Serious/Grave offense', ntePct: 15, offenseDeduction: 1 }
}

function normalizeConductLevel(level) {
  return CONDUCT_LEVELS[level] ? level : 'none'
}

function cbcDeductionValues(record) {
  const nteLevel = normalizeConductLevel(record?.cbcNteLevel || record?.cbcDeductionSummary?.nteLevel || 'none')
  const offenseLevel = normalizeConductLevel(record?.cbcOffenseLevel || record?.cbcDeductionSummary?.offenseLevel || 'none')
  const ntePct = Number(record?.cbcNteDeductionPct ?? record?.cbcDeductionSummary?.ntePct ?? CONDUCT_LEVELS[nteLevel].ntePct) || 0
  const offenseDeduction = Number(record?.cbcOffenseDeduction ?? record?.cbcDeductionSummary?.offenseDeduction ?? CONDUCT_LEVELS[offenseLevel].offenseDeduction) || 0
  return { nteLevel, offenseLevel, ntePct, offenseDeduction }
}

function applyCbcDeductionPreview(baseScore, data) {
  const base = Number(baseScore)
  const nteLevel = normalizeConductLevel(data?.cbcNteLevel || 'none')
  const offenseLevel = normalizeConductLevel(data?.cbcOffenseLevel || 'none')
  const ntePct = CONDUCT_LEVELS[nteLevel].ntePct
  const offenseDeduction = CONDUCT_LEVELS[offenseLevel].offenseDeduction
  if (!Number.isFinite(base) || base <= 0) {
    return { baseScore: null, basePct: null, ntePct, offenseDeduction, adjustedScore: null, cbcWeightedScore: null, finalOverallDeduction: offenseDeduction }
  }
  const basePct = Math.max(0, Math.min(100, (base / 4) * 100))
  const afterNtePct = Math.max(0, basePct - ntePct)
  const adjustedScore = Math.max(0, Math.min(4, (afterNtePct / 100) * 4))
  const cbcWeightedScore = adjustedScore * 0.30
  return { baseScore: round2(base), basePct: round2(basePct), ntePct, offenseDeduction, adjustedScore: round2(adjustedScore), cbcWeightedScore: round2(cbcWeightedScore), finalOverallDeduction: offenseDeduction }
}

const cbcDeductionPreview = computed(() =>
  applyCbcDeductionPreview(activeRecord.value?.cbcBaseScore || activeRecord.value?.cbcScore, cbcDeductionForm.value)
)

function canEditCbcDeduction(record) {
  // canAdmin is a ComputedRef - without .value this expression was always truthy,
  // so the Conduct Deduction control (NTE / administrative-offence data) rendered
  // for every user. The backend already refused the write with a 403; this makes
  // the UI agree with it.
  return Boolean(record?.cbcDeductionCanEdit || canAdmin.value)
}

function hasCbcDeduction(record) {
  const v = cbcDeductionValues(record)
  return Boolean(record?.cbcDeductionHasDeduction || v.ntePct || v.offenseDeduction)
}

function cbcDeductionText(record) {
  const v = cbcDeductionValues(record)
  const parts = []
  if (v.ntePct) parts.push(`NTE ${CONDUCT_LEVELS[v.nteLevel]?.label || 'offense'} deducted ${v.ntePct}% from the CBC raw percentage score`)
  if (v.offenseDeduction) parts.push(`Actual commission offense level ${CONDUCT_LEVELS[v.offenseLevel]?.label || 'offense'} deducted ${v.offenseDeduction} point${v.offenseDeduction === 1 ? '' : 's'} from the final overall score`)
  return parts.length ? `${parts.join('. ')}.` : 'No conduct deduction is applied.'
}

function openCbcDeductionModal() {
  if (!activeRecord.value) return
  cbcDeductionForm.value = {
    cbcNteLevel: normalizeConductLevel(activeRecord.value.cbcNteLevel),
    cbcOffenseLevel: normalizeConductLevel(activeRecord.value.cbcOffenseLevel),
    cbcDeductionNote: activeRecord.value.cbcDeductionNote || ''
  }
  showCbcDeductionModal.value = true
}

function closeCbcDeductionModal() {
  showCbcDeductionModal.value = false
}

function derivedOverallScore(record) {
  if (!record) return null
  const cbc = normalizedFourPointScore(record.cbcScore)
  const fpo = normalizedFourPointScore(record.fpoScore, true)
  const jf = normalizedFourPointScore(record.jfScore)

  let weightedSum = 0
  let totalWeight = 0
  if (cbc !== null) {
    weightedSum += cbc * 0.30
    totalWeight += 0.30
  }
  if (fpo !== null) { weightedSum += fpo * 0.55; totalWeight += 0.55 }
  if (jf !== null) { weightedSum += jf * 0.15; totalWeight += 0.15 }
  if (!totalWeight) return null

  const v = cbcDeductionValues(record)
  return round2(Math.max(0, (weightedSum / totalWeight) - v.offenseDeduction))
}

function descriptorForScore(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return ''
  if (s >= 4.00) return 'Outstanding'
  if (s >= 3.50) return 'Very Satisfactory'
  if (s >= 2.75) return 'Satisfactory'
  if (s >= 2.00) return 'Needs Improvement'
  return 'Requires Immediate Intervention'
}

function displayOverallScore(record) {
  const derived = derivedOverallScore(record)
  if (derived !== null) return derived
  const stored = Number(record?.overallScore)
  return Number.isFinite(stored) && stored > 0 ? stored : null
}

function displayDescriptor(record) {
  const score = displayOverallScore(record)
  return descriptorForScore(score) || record?.descriptor || ''
}

// A score with a component missing is NOT a partial score - calculateOverall
// renormalises the weights of whatever is present so the total is always 1.0.
// That is deliberate, but it means a score built from CBC and JF alone (45% of
// the intended weight) renders identically to a complete one, and FPO alone is
// 55%. The backend already reports appliedComponents/missingComponents; nothing
// ever showed them to a user, so someone reading "3.47 Satisfactory" had no way
// to know the largest component was never included. Derived here from the
// record's own component fields so it works on list reads too, not just the
// compute response.
const SCORE_COMPONENTS = [
  { key: 'cbcScore', label: 'CBC', weight: 30 },
  { key: 'fpoScore', label: 'FPO', weight: 55 },
  { key: 'jfScore',  label: 'JF',  weight: 15 }
]
function missingScoreComponents(record) {
  if (!record) return []
  return SCORE_COMPONENTS.filter(c => {
    const v = record[c.key]
    return v === '' || v === null || v === undefined || !Number.isFinite(Number(v))
  })
}
function scoreIsPartial(record) {
  return !!displayOverallScore(record) && missingScoreComponents(record).length > 0
}
function partialScoreNote(record) {
  const missing = missingScoreComponents(record)
  if (!missing.length) return ''
  const names = missing.map(c => c.label).join(' and ')
  const weight = missing.reduce((sum, c) => sum + c.weight, 0)
  const present = SCORE_COMPONENTS.filter(c => !missing.includes(c)).map(c => c.label).join(' and ')
  return `Computed without ${names} (${weight}% of the total weight). ` +
    `${present} ${missing.length === 2 ? 'was' : 'were'} rescaled to fill 100%, so this is not a complete score.`
}

async function onFpoManualBlur() {
  const val = Number(fpoManualInput.value)
  if (!val || val < 1 || val > 5 || !activeRecord.value) return
  savingFpoManual.value = true
  fpoManualSaved.value = false
  try {
    const r = await ipatApi.setFPO(activeRecord.value.id, val)
    _syncRecord({
      fpoScore: r.fpoScore ?? val,
      cbcScore: r.cbcScore,
      jfScore: r.jfScore,
      overallScore: r.overallScore,
      descriptor: r.descriptor,
      status: 'Computed'
    })
    fpoManualSaved.value = true
    setTimeout(() => { fpoManualSaved.value = false }, 2500)
  } catch (e) { console.error(e); showToast('Failed to save FPO score', 'error') }
  finally { savingFpoManual.value = false }
}

const jfRaterType = ref('Self')
const jfRatings   = ref({})
const jfEvidence  = ref({})
const savingJF    = ref(false)
const computingJF = ref(false)

const CBC_RATER_OPTIONS = [
  { value: 'Self', label: 'Self (15%)' },
  { value: 'Peer', label: 'Peer (15%)' },
  { value: 'Peer1', label: 'Peer 1 (15%)' },
  { value: 'Peer2', label: 'Peer 2 (15%)' },
  { value: 'Subordinate', label: 'Subordinate (15%)' },
  { value: 'Supervisor', label: 'Immediate Supervisor (30%)' },
  { value: 'SkipSupervisor', label: 'Skip Supervisor (25%)' }
]

const JF_RATER_OPTIONS = [
  { value: 'Self', label: 'Self (Ratee)' },
  { value: 'Supervisor', label: 'Immediate Supervisor' }
]

const computingOverall  = ref(false)
const showValidation    = ref(false)
const submittingRating  = ref(false)
const finalizing        = ref(false)

const toast = ref({ show: false, msg: '', type: 'success' })

const createForm = ref({
  semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(),
  hasSubordinate: false
})

// The stored status value stays 'Draft' - renaming it in the sheet would break
// every existing record and the backend's own transitions. Only the label the
// user reads changes. 'Final' is no longer offered as a filter; those records
// remain visible under 'All'.
const statusTabs = [
  { label: 'All',      value: 'All'      },
  { label: 'Pending',  value: 'Draft'    },
  { label: 'Computed', value: 'Computed' }
]

// The footer holds: the rater's Submit/Update button (needs activeAssignment),
// or the ratee's Finalize / Compute / "Finalized" badge (needs !canAdmin).
// With neither, it has no content and should not occupy the screen.
const hasFooterActions = computed(() => !!activeAssignment.value || !canAdmin.value)
const selectedAssignmentCompleted = computed(() => {
  const status = activeAssignment.value?.status || selectedTask.value?.status || ''
  return String(status) === 'Completed'
})

// ── Computed ──
const canCreate = computed(() => canAdmin.value)
const canSelectRatee = computed(() => canAdmin.value)

function isJobFitnessOnlyAssignment(assignment) {
  const type = String(assignment?.raterType || '').toLowerCase()
  return type.includes('job fitness')
}

function defaultTabForCurrentContext() {
  return isJobFitnessOnlyAssignment(activeAssignment.value) ? 'jf' : 'cbc'
}

// JF tab visible when admin view or when assignment rater type can rate JF (Self / Supervisor)
const showJFTab = computed(() => {
  if (!activeAssignment.value) return true
  return ['Self', 'Supervisor'].includes(activeAssignment.value.raterType) || isJobFitnessOnlyAssignment(activeAssignment.value)
})

// CBC tab hidden for explicit Job Fitness-only assignments.
const showCBCTab = computed(() => {
  if (!activeAssignment.value) return true
  return !isJobFitnessOnlyAssignment(activeAssignment.value)
})

const availableDivisions = computed(() => {
  const byName = new Map()
  const addDivision = (division) => {
    const id = division.id || division.divisionId
    const name = division.name || division.divisionName
    const key = divisionKey(name)
    if (!id || !name || !key) return
    if (!byName.has(key)) byName.set(key, { id, name, key })
  }

  divisionOptions.value.forEach(d => addDivision(d))
  records.value.forEach(r => addDivision({ id: r.divisionId, name: r.divisionName || r.divisionId }))

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredRecords = computed(() => {
  let r = records.value
  if (activeStatus.value !== 'All') r = r.filter(x => x.status === activeStatus.value)
  if (filterDiv.value) {
    r = r.filter(x => {
      const nameKey = divisionKey(x.divisionName || x.divisionId)
      const idKey = divisionKey(x.divisionId)
      return nameKey === filterDiv.value || idKey === filterDiv.value
    })
  }
  if (search.value) { const q = search.value.toLowerCase(); r = r.filter(x => (x.rateeName || '').toLowerCase().includes(q)) }
  return r
})

function submittedRaterOptions(ratings, options) {
  const presentTypes = new Set((ratings || [])
    .map(rating => String(rating?.raterType || '').trim())
    .filter(Boolean))
  return options.filter(option => presentTypes.has(option.value))
}

function assignmentRaterOption(type, options) {
  const value = String(type || '').trim()
  if (!value) return []
  return [options.find(option => option.value === value) || { value, label: raterTypeLabel(value) }]
}

const cbcRaterOptions = computed(() => {
  if (activeAssignment.value) {
    return assignmentRaterOption(activeAssignment.value.raterType, CBC_RATER_OPTIONS)
  }
  if (canAdmin.value) {
    return submittedRaterOptions(loadedRec.value?.cbcRatings, CBC_RATER_OPTIONS)
  }
  return CBC_RATER_OPTIONS
})

const jfRaterOptions = computed(() => {
  if (activeAssignment.value) {
    return assignmentRaterOption(
      ['Self', 'Supervisor'].includes(activeAssignment.value.raterType) ? activeAssignment.value.raterType : 'Self',
      JF_RATER_OPTIONS
    )
  }
  if (canAdmin.value) {
    return submittedRaterOptions(loadedRec.value?.jfRatings, JF_RATER_OPTIONS)
  }
  return JF_RATER_OPTIONS
})

function alignRaterType(selection, options) {
  if (!options.length) {
    selection.value = ''
    return
  }
  if (!options.some(option => option.value === selection.value)) {
    selection.value = options[0].value
  }
}

// Rater progress computeds
const cbcTotalCount    = computed(() => HEARTWORK_THEMES.value.reduce((s, t) => s + t.indicators.length, 0))
const cbcAnsweredCount = computed(() => Object.keys(cbcRatings.value).length)
const cbcProgress      = computed(() => cbcTotalCount.value ? Math.round(cbcAnsweredCount.value / cbcTotalCount.value * 100) : 0)
const jfAnsweredCount  = computed(() => JF_INDICATORS.value.filter((_, idx) => getJFRating(idx) !== null).length)
// Combined rater progress across the tabs the current rater must answer (CBC + JF when applicable)
const raterTotal        = computed(() => (showCBCTab.value ? cbcTotalCount.value : 0) + (showJFTab.value ? JF_INDICATORS.value.length : 0))
const raterAnsweredTotal = computed(() => (showCBCTab.value ? cbcAnsweredCount.value : 0) + (showJFTab.value ? jfAnsweredCount.value : 0))
const allRaterAnswered  = computed(() => raterAnsweredTotal.value >= raterTotal.value)
const assessmentReadyForAssignment = computed(() => {
  if (!activeAssignment.value) return true
  if (loadingAssessment.value || assessmentLoadError.value) return false
  return (!showCBCTab.value || cbcTotalCount.value > 0) && (!showJFTab.value || JF_INDICATORS.value.length > 0)
})
const activeDomainTitle = computed(() => {
  const labels = {
    cbc: 'Core Behavioral Competencies',
    fpo: 'Functional Performance and Output',
    jf: 'Job Fitness'
  }
  return labels[activeTab.value] || ''
})
const activeDomainDescription = computed(() => {
  const desc = {
    cbc: 'Rate each HEARTWORK behavior using the 1-4 scale.',
    fpo: 'Review the synced IPCRF/CCEF final numerical rating.',
    jf: 'Rate job fitness indicators and optional supporting evidence.'
  }
  return desc[activeTab.value] || ''
})
const activeProgressAnswered = computed(() => {
  if (activeTab.value === 'jf') return jfAnsweredCount.value
  if (activeTab.value === 'fpo') return activeRecord.value?.fpoScore ? 1 : 0
  return cbcAnsweredCount.value
})
const activeProgressTotal = computed(() => {
  if (activeTab.value === 'jf') return JF_INDICATORS.value.length
  if (activeTab.value === 'fpo') return 1
  return cbcTotalCount.value
})
const activeProgressPercent = computed(() => {
  if (!activeProgressTotal.value) return 0
  return Math.round((activeProgressAnswered.value / activeProgressTotal.value) * 100)
})
function themeAnsweredCount(theme) {
  return theme.indicators.filter((_, idx) => getCBCRating(theme.id, idx) !== null).length
}

// ── Helpers ──
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.map(p => p[0]).join('').toUpperCase()
}
function taskDivisionLabel(task) {
  const raw = task?.rateeDivisionName || task?.divisionName || task?.rateeDivisionId || ''
  const normalized = String(raw).trim()
  if (!normalized) return ''
  const divisionNames = {
    dfd: 'Design Formulation Division',
    pid: 'Pilot Implementation Division',
    staed: 'Social Technology Analysis and Evaluation Division',
    ap: 'Admin Pool'
  }
  return divisionNames[normalized.toLowerCase()] || normalized.toUpperCase()
}
function statusClass(s) { return { Draft: 'st-draft', Computed: 'st-blue', Final: 'st-green' }[s] || 'st-draft' }
// Display-only mapping. 'Draft' remains the stored value everywhere - in the
// sheet, in the API and in IPCRFService's status transitions - so this changes
// what the user reads without touching a single record.
function statusLabel(s) { return s === 'Draft' ? 'Pending' : (s || '') }
function descriptorClass(d) {
  if (!d) return ''
  if (d.includes('Outstanding'))  return 'desc-excellent'
  if (d.includes('Satisfactory')) return 'desc-satisfactory'
  if (d.includes('Needs'))        return 'desc-needs'
  return 'desc-immediate'
}
function round2(v) { return Math.round(v * 100) / 100 }

// CBC helpers
function cbcKey(themeId, idx) { return `${themeId}_${idx}` }
function getCBCRating(themeId, idx) { return cbcRatings.value[cbcKey(themeId, idx)] || null }
function setCBCRating(themeId, idx, n) { cbcRatings.value[cbcKey(themeId, idx)] = n }
function themeAvg(themeId) {
  const theme = HEARTWORK_THEMES.value.find(t => t.id === themeId)
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

function mergeLoadedRatings(kind, incoming) {
  if (!loadedRec.value) return
  const field = kind === 'jf' ? 'jfRatings' : 'cbcRatings'
  const existing = Array.isArray(loadedRec.value[field]) ? loadedRec.value[field] : []
  const keyFor = kind === 'jf'
    ? row => `${row.raterType || ''}|${Number(row.indicatorIdx) || 0}`
    : row => `${row.raterType || ''}|${row.themeId || ''}|${Number(row.indicatorIdx) || 0}`
  const byKey = new Map(existing.map(row => [keyFor(row), row]))
  incoming.forEach(row => {
    byKey.set(keyFor(row), {
      ...(byKey.get(keyFor(row)) || {}),
      ...row,
      rating: Number(row.rating)
    })
  })
  loadedRec.value = {
    ...loadedRec.value,
    [field]: Array.from(byKey.values())
  }
}

// Re-populate when the user switches which rater type they're editing/viewing.
watch(cbcRaterType, (type) => { if (loadedRec.value) _populateCBCRatings(type, loadedRec.value.cbcRatings) })
watch(jfRaterType,  (type) => { if (loadedRec.value) _populateJFRatings(type,  loadedRec.value.jfRatings) })
watch(cbcRaterOptions, (options) => { alignRaterType(cbcRaterType, options) })
watch(jfRaterOptions,  (options) => { alignRaterType(jfRaterType, options) })
watch([tasksSemester, tasksYear], handlePeriodChange)
watch([canAdmin, isSystemAdmin], ([admin, sysAdmin]) => {
  if (!admin) return
  if (sysAdmin && activeView.value !== 'all') {
    activeView.value = 'all'
  }
  if (activeView.value === 'all') {
    loadRecords()
  }
}, { immediate: true, flush: 'post' })
watch(activeView, (view) => {
  if (view === 'all' && canAdmin.value) loadRecords()
  // A "new data" flag from the tab just left says nothing about the tab just
  // entered - it has not been checked yet.
  hasNewTaskData.value = false
})

// Checking always means asking the backend something - IPATRaterAssignments/
// IPATRecords are transactional and deliberately not cross-execution cached
// (see DataCacheService), so this genuinely costs a Sheets read every time,
// same as a real fetch. Firing it on a timer would add background load to a
// screen that has none today. Window focus only fires when the user actually
// comes back to the tab, which is the one moment this is worth paying for.
async function checkForNewData() {
  if (checkingForNewData.value || loadingTasks.value || loadingResults.value) return
  if (activeView.value !== 'my-tasks' && activeView.value !== 'my-results') return
  checkingForNewData.value = true
  try {
    const semester = String(tasksSemester.value)
    const year = String(tasksYear.value)
    if (activeView.value === 'my-tasks') {
      const data = await ipatAssignmentsApi.getMyRatees({ semester, year })
      if (semester !== String(tasksSemester.value) || year !== String(tasksYear.value)) return
      const fresh = Array.isArray(data) ? data : (data?.items || [])
      hasNewTaskData.value = !sameAssignmentIds_(fresh, myTasks.value)
    } else {
      const data = await ipatAssignmentsApi.getMyResults({ semester, year })
      if (semester !== String(tasksSemester.value) || year !== String(tasksYear.value)) return
      hasNewTaskData.value = !sameAssignmentIds_(data || [], myResults.value)
    }
  } catch (e) {
    // A failed background check should never surface an error to the user -
    // worst case the Refresh button just does not appear this time.
    console.warn('[Evaluation] Background new-data check failed:', e.message)
  } finally {
    checkingForNewData.value = false
  }
}
// Comparing ids is enough for what this detects: a new assignment appearing.
// It deliberately does not chase every field an existing row might have
// changed in place, which would make an ordinary status update on someone
// else's screen surface a "new data" prompt here too.
function sameAssignmentIds_(a, b) {
  const idsA = new Set((a || []).map(r => String(r.id)))
  const idsB = new Set((b || []).map(r => String(r.id)))
  if (idsA.size !== idsB.size) return false
  for (const id of idsA) if (!idsB.has(id)) return false
  return true
}

function handleWindowFocusForNewData() {
  checkForNewData()
}

onMounted(() => {
  loadAssessmentContent()
  loadDivisionOptions()
  // Load the list that matches the landing view rather than always fetching the
  // administrator's (always empty) personal rating tasks.
  if (canAdmin.value || activeView.value === 'all') loadRecords()
  else loadMyTasks()
  window.addEventListener('focus', handleWindowFocusForNewData)
})

// Closing the tab does not cancel the request - Apps Script carries on and the
// office is left with whatever the run had reached. The browser's own "leave
// site?" prompt is the only thing that can stop that, so arm it while a
// generation is in flight and disarm it the moment the run ends.
function warnIfGenerating(event) {
  if (!generating.value) return
  event.preventDefault()
  event.returnValue = ''
  return ''
}

onMounted(() => window.addEventListener('beforeunload', warnIfGenerating))

onUnmounted(() => {
  window.removeEventListener('focus', handleWindowFocusForNewData)
  window.removeEventListener('beforeunload', warnIfGenerating)
})

async function handlePeriodChange() {
  selectedTask.value = null
  selectedRecord.value = null
  selectedResult.value = null
  activeRecord.value = null
  loadedRec.value = null
  activeAssignment.value = null
  showValidation.value = false

  if (activeView.value === 'my-tasks') await loadMyTasks()
  else if (activeView.value === 'my-results') await loadMyResults()
  else if (activeView.value === 'all') await loadRecords()
}

// ── My Tasks ──
// Last-known task and result lists, kept so a return to this screen paints
// immediately instead of waiting on a request whose floor is ~1.6s.
//
// sessionStorage, not localStorage: it is scoped to the tab and cleared when
// that tab closes, so a shared workstation does not keep one person's ratee
// names and scores around for the next. The key carries the signed-in user's id
// as well, so a different account in the same tab cannot read the previous
// one's snapshot even before the tab is closed.
//
// Every read is wrapped: private windows and browsers with site data blocked
// throw on access rather than returning null, and a failure here must never
// stop the page rendering - it just means no head start.
const SNAPSHOT_VERSION = 'v1'

function snapshotKey(kind, semester, year) {
  const uid = authStore.profile?.id || authStore.profile?.email || 'anon'
  return `pmes.eval.${SNAPSHOT_VERSION}.${kind}.${uid}.${semester}.${year}`
}

function readSnapshot(kind, semester, year) {
  try {
    const raw = sessionStorage.getItem(snapshotKey(kind, semester, year))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.rows) && parsed.rows.length ? parsed : null
  } catch (e) {
    return null
  }
}

function writeSnapshot(kind, semester, year, rows) {
  try {
    sessionStorage.setItem(
      snapshotKey(kind, semester, year),
      JSON.stringify({ at: new Date().toISOString(), rows })
    )
  } catch (e) {
    // Quota exceeded, or storage unavailable. The screen works without it.
  }
}

async function loadMyTasks() {
  const requestedSemester = String(tasksSemester.value)
  const requestedYear = String(tasksYear.value)
  // Show the previous answer immediately, then replace it when the fresh one
  // lands. A request that reads no data at all still costs ~1.6s here - Apps
  // Script parses the whole project on every execution - so the wait is a floor
  // the backend cannot optimise away. The list was almost always identical to
  // last time, and staring at a spinner to be told so is what reads as lag.
  const cached = readSnapshot('tasks', requestedSemester, requestedYear)
  if (cached && !myTasks.value.length) {
    myTasks.value = cached.rows
    tasksLastUpdatedAt.value = cached.at ? new Date(cached.at) : null
  }
  // Only occupy the screen with a spinner when there is genuinely nothing to
  // show; otherwise the refresh happens quietly behind the visible list.
  loadingTasks.value = !myTasks.value.length
  try {
    const data = await ipatAssignmentsApi.getMyRatees({ semester: requestedSemester, year: requestedYear })
    if (requestedSemester !== String(tasksSemester.value) || requestedYear !== String(tasksYear.value)) return
    myTasks.value = Array.isArray(data) ? data : (data?.items || [])
    tasksLastUpdatedAt.value = new Date()
    hasNewTaskData.value = false
    writeSnapshot('tasks', requestedSemester, requestedYear, myTasks.value)
    // Deep link from My Rating Tasks: ?assignment=<id> opens that exact task so
    // the portal list can hand off directly into the form the user clicked.
    const requestedAssignment = String(route.query.assignment || '')
    const deepLinked = requestedAssignment
      ? myTasks.value.find(t => String(t.id) === requestedAssignment)
      : null
    if (deepLinked) {
      selectTask(deepLinked)
      return
    }
    // Auto-open the first pending task so the rating form is front-and-center
    // on arrival instead of an empty panel - rating is the module's main job.
    if (activeView.value === 'my-tasks' && !selectedTask.value && myTasks.value.length) {
      selectTask(myTasks.value.find(t => t.status !== 'Completed') || myTasks.value[0])
    }
  } catch (e) {
    if (String(e.message || '').includes('Route not found: ipat-assignments/my-ratees')) {
      myTasks.value = []
      return
    }
    console.error(e); showToast('Could not load tasks. Please try again.', 'error')
  }
  finally { loadingTasks.value = false }
}

async function switchToMyResults() {
  activeView.value = 'my-results'
  selectedTask.value = null
  selectedRecord.value = null
  activeRecord.value = null
  activeAssignment.value = null
  showValidation.value = false

  if (!myResults.value.length) {
    await loadMyResults()
  } else if (!selectedResult.value && myResults.value.length) {
    selectResult(myResults.value[0])
  }
}

async function loadMyResults() {
  const requestedSemester = String(tasksSemester.value)
  const requestedYear = String(tasksYear.value)
  const cached = readSnapshot('results', requestedSemester, requestedYear)
  if (cached && !myResults.value.length) {
    myResults.value = cached.rows
    tasksLastUpdatedAt.value = cached.at ? new Date(cached.at) : null
    if (activeView.value === 'my-results' && !selectedResult.value) {
      selectedResult.value = myResults.value[0] || null
    }
  }
  loadingResults.value = !myResults.value.length
  try {
    const data = await ipatAssignmentsApi.getMyResults({ semester: requestedSemester, year: requestedYear })
    if (requestedSemester !== String(tasksSemester.value) || requestedYear !== String(tasksYear.value)) return
    myResults.value = data || []
    tasksLastUpdatedAt.value = new Date()
    hasNewTaskData.value = false
    writeSnapshot('results', requestedSemester, requestedYear, myResults.value)
    if (activeView.value === 'my-results') {
      selectedResult.value = myResults.value[0] || null
    }
  } catch (e) {
    console.error(e); showToast('Could not load results. Please try again.', 'error')
  } finally {
    loadingResults.value = false
  }
}

function switchToMyTasks() {
  activeView.value = 'my-tasks'
  selectedResult.value = null
  selectedRecord.value = null

  if (selectedTask.value) return
  const nextTask = myTasks.value.find(t => t.status !== 'Completed') || myTasks.value[0]
  if (nextTask) selectTask(nextTask)
  else {
    activeRecord.value = null
    activeAssignment.value = null
    showValidation.value = false
  }
}

async function switchToAll() {
  activeView.value = 'all'
  selectedTask.value = null
  selectedResult.value = null
  activeAssignment.value = null
  activeRecord.value = null
  showValidation.value = false
  await loadRecords()
}

async function loadDivisionOptions() {
  if (!canAdmin.value && !canViewBureauMonitoring.value && !canViewDivisionMonitoring.value) {
    divisionOptions.value = []
    return
  }
  try {
    await loadOrgOptions()
    divisionOptions.value = currentDivisions.value
      .map(d => ({
        id: d.id || d.divisionId,
        name: d.name || d.divisionName
      }))
      .filter(d => d.id && d.name)
  } catch (e) {
    console.warn('[Evaluation] Could not load division options:', e?.message || e)
  }
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
  activeAssignment.value = null   // admin view - not a rater assignment
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
  activeTab.value        = isJobFitnessOnlyAssignment(task) ? 'jf' : 'cbc'
  if (!assessmentQuestions.value.length || assessmentLoadError.value) await loadAssessmentContent(true)
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
  if (String(assignment.status || '') === 'Completed') {
    showToast('This rating assignment has already been submitted and is locked.', 'error')
    return
  }
  if (!assessmentReadyForAssignment.value) {
    showToast(assessmentLoadError.value || 'Assessment questions are not ready. Please retry loading the form.', 'error')
    return
  }

  const isJobFitnessOnly = isJobFitnessOnlyAssignment(assignment)
  const cbcOk = isJobFitnessOnly || cbcAnsweredCount.value >= cbcTotalCount.value
  const jfOk  = !showJFTab.value || jfAnsweredCount.value >= JF_INDICATORS.value.length

  if (!cbcOk || !jfOk) {
    showValidation.value = true
    if (!cbcOk) { activeTab.value = 'cbc' }
    else if (!jfOk) { activeTab.value = 'jf' }
    const missing = (!cbcOk ? cbcTotalCount.value - cbcAnsweredCount.value : 0) +
                    (!jfOk  ? JF_INDICATORS.value.length - jfAnsweredCount.value : 0)
    showToast(`Please answer all ${missing} remaining question${missing !== 1 ? 's' : ''} before submitting.`, 'error')
    return
  }

  const confirmed = await confirm({
    title: 'Submit Ratings',
    message: `Submit your completed rating for ${assignment.rateeName}? Once submitted, this rating is final and can no longer be edited.`,
    confirmLabel: 'Submit Ratings'
  })
  if (!confirmed) return

  submittingRating.value = true
  try {
    let cbcPayload = []
    let jfPayload = []
    if (!isJobFitnessOnly) {
      HEARTWORK_THEMES.value.forEach(theme => {
        theme.indicators.forEach((_, idx) => {
          const rating = getCBCRating(theme.id, idx)
          if (rating !== null) cbcPayload.push({ themeId: theme.id, themeName: theme.label, indicatorIdx: idx, rating, raterType: assignment.raterType })
        })
      })
    }
    if (showJFTab.value) {
      const jfRaterType = ['Self', 'Supervisor'].includes(assignment.raterType) ? assignment.raterType : 'Self'
      jfPayload = JF_INDICATORS.value.map((_, idx) => ({
        indicatorIdx: idx, rating: getJFRating(idx), evidence: jfEvidence.value[idx] || '', raterType: jfRaterType
      })).filter(r => r.rating !== null)
    }
    await ipatAssignmentsApi.submitRatings(assignment.id, { cbcRatings: cbcPayload, jfRatings: jfPayload })
    assignment.status = 'Completed'
    if (selectedTask.value?.id === assignment.id) selectedTask.value = { ...selectedTask.value, status: 'Completed' }
    activeAssignment.value = { ...assignment }
    myTasks.value = myTasks.value.map(t => t.id === assignment.id ? { ...t, status: 'Completed' } : t)
    // Keep the stored snapshot in step with what just happened. Without this the
    // next visit would paint this task as Pending again for a moment before the
    // refresh corrected it - and a rater seeing their submitted work listed as
    // outstanding is exactly the kind of thing that gets reported as a bug.
    writeSnapshot('tasks', String(tasksSemester.value), String(tasksYear.value), myTasks.value)
    showToast('Ratings submitted successfully!')
    closeDetailModal()
    const allDone = myTasks.value.length > 0 && myTasks.value.every(t => t.status === 'Completed')
    if (allDone) {
      selectedTask.value = null
      selectedRecord.value = null
      activeRecord.value = null
      activeView.value = 'my-results'
      showToast('All rating tasks completed! Computing results…')
      await loadMyResults()
      if (myResults.value.length) selectedResult.value = myResults.value[0]
    }
  } catch (e) {
    console.error(e)
    try {
      const data = await ipatAssignmentsApi.getMyRatees({ semester: assignment.semester, year: assignment.year })
      const tasks = Array.isArray(data) ? data : (data?.items || [])
      const saved = tasks.find(task => String(task.id) === String(assignment.id))
      if (String(saved?.status || '') === 'Completed') {
        myTasks.value = tasks
        showToast('Ratings submitted successfully!')
        closeDetailModal()
        return
      }
    } catch (reconcileError) { console.error('[Evaluation] Submission reconciliation failed', reconcileError) }
    showToast(e?.message || 'Failed to submit ratings. Your answers remain on this page; please try again.', 'error')
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
  if (generating.value) return

  // Generate/Backfill rewrites who rates whom for an entire office, can remove
  // assignments that no longer match the Rating Tagging, and takes a while. It
  // was one click with nothing in between.
  const semesterLabel = generateForm.value.semester === '1' ? '1st Semester' : '2nd Semester'
  const confirmed = await confirm({
    title: 'Generate / Backfill Rater Assignments',
    message: `This will create any missing rating tasks for ${semesterLabel} ${generateForm.value.year} in ` +
      `${assignmentScopeLabel.value}, and remove tasks that no longer match the current Rating Tagging - ` +
      `including any responses already submitted against them.\n\n` +
      `Completed ratings that are still valid are kept. This can take up to a minute, and must not be interrupted.`,
    confirmLabel: 'Generate / Backfill'
  })
  if (!confirmed) return

  // A large office can run past a minute, and the transport may retry once
  // behind the scenes after waiting for the first run to finish. Without any
  // sign of life the admin concludes it has hung and reaches for the tab close,
  // which is the one thing that can leave the office half-generated. Say what
  // is happening instead.
  generating.value = true
  generateProgressLabel.value = 'Checking and backfilling…'
  const startedAt = Date.now()
  const progressTimer = setInterval(() => {
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    generateProgressLabel.value = seconds < 30
      ? `Checking and backfilling… ${seconds}s`
      : `Still working - large offices take a while… ${seconds}s`
  }, 1000)

  try {
    // The backend processes the roster in slices so no single request can
    // outlive the 60-second gateway or Apps Script's six-minute ceiling. Drive
    // it to completion here, accumulating the per-slice counters, so the admin
    // still performs one action and sees one result.
    let offset = 0
    let done = false
    let guard = 0
    let result = null
    const totals = {
      generated: 0, replaced: 0, removedAssignments: 0, removedResponses: 0,
      recomputedRecords: 0, recordsCreated: 0
    }
    const rateesTouched = new Set()
    const incomplete = []
    const unmapped = []

    while (!done && guard < 100) {
      guard += 1
      const slice = await ipatAssignmentsApi.generate({ ...generateForm.value, offset })
      result = slice
      Object.keys(totals).forEach(k => { totals[k] += Number(slice?.[k] || 0) })
      ;(slice?.incomplete || []).forEach(i => incomplete.push(i))
      ;(slice?.unmapped || []).forEach(u => unmapped.push(u))
      if (Number(slice?.ratees || 0)) rateesTouched.add(offset)
      const total = Number(slice?.totalRatees || 0)
      const through = Number(slice?.nextOffset || 0)
      if (total) {
        generateProgressLabel.value = `Processing ${Math.min(through, total)} of ${total} employees…`
      }
      done = slice?.done !== false && (slice?.done === true || !total || through >= total)
      if (Number(slice?.nextOffset || 0) <= offset) done = true
      offset = through
    }

    result = { ...result, ...totals, incomplete, unmapped }
    generateResult.value = result
    const generated = Number(result.generated || 0)
    const total = Number(result.totalRatees || 0)
    const removed = Number(result.removedAssignments || 0)
    showToast(generated || removed
      ? `Reconciled assignments: ${generated} added, ${removed} invalid removed across ${total} employee(s) in ${result.scopeLabel || assignmentScopeLabel.value}`
      : `Assignments are already complete for this period in ${result.scopeLabel || assignmentScopeLabel.value}`)
    await loadRecords()
  } catch (e) {
    console.error('[Evaluation] Could not generate assignments', e)
    showToast(e?.message || 'Could not generate assignments. Please try again or contact the system administrator.', 'error')
  }
  finally { clearInterval(progressTimer); generating.value = false }
}

// ── Rater type helpers ──
function raterTypeLabel(type) {
  const labels = {
    Self:           'Self-Rating',
    Peer:           'Peer Rating',
    Peer1:          'Peer Rating 1',
    Peer2:          'Peer Rating (subtitute to subordinate)',
    Subordinate:    'Immediate Supervisor Rating',
    Supervisor:     'Subordinate Rating',
    SkipSupervisor: 'Skip Supervisor Rating'
  }
  return labels[type] || type
}

function raterRoleDesc(type) {
  const desc = {
    Self:           "You are completing your self-assessment.",
    Peer:           "You are rating a colleague at the same organizational level.",
    Peer1:          "You are assigned as the employee’s first peer rater.",
    Peer2:          "You are assigned as the employee’s second peer rater.",
    Subordinate:    "You are rating your immediate supervisor.",
    Supervisor:     "You are rating an employee under your direct supervision.",
    SkipSupervisor: "You are rating an employee supervised by one of your direct subordinates."
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

// Strong accent color per rater type - drives the colored spine on each task card
function raterAccent(type) {
  const map = {
    Self:          '#3B82F6',
    Peer:          '#8B5CF6',
    Peer1:         '#8B5CF6',
    Peer2:         '#8B5CF6',
    Subordinate:   '#F59E0B',
    Supervisor:    '#22C55E',
    SkipSupervisor:'#F97316'
  }
  return map[type] || '#94A3B8'
}

async function loadRecords() {
  const requestedSemester = String(tasksSemester.value)
  const requestedYear = String(tasksYear.value)
  loading.value = true
  recordsLoadState.value = { status: 'loading', message: 'Loading assessments…' }
  try {
    const r = await ipatApi.list({ pageSize: 500, semester: requestedSemester, year: requestedYear })
    if (requestedSemester !== String(tasksSemester.value) || requestedYear !== String(tasksYear.value)) return
    const freshRecords = Array.isArray(r) ? r : (Array.isArray(r?.items) ? r.items : [])
    records.value = freshRecords
    const total = Number(r?.total)
    recordsLoadState.value = {
      status: 'loaded',
      message: freshRecords.length
        ? `Loaded ${freshRecords.length}${Number.isFinite(total) ? ` of ${total}` : ''} assessment record(s).`
        : ''
    }
    if (activeView.value === 'all') {
      const selectedId = selectedRecord.value?.id || activeRecord.value?.id
      const refreshed = selectedId ? records.value.find(row => row.id === selectedId) : null
      if (refreshed) {
        selectedRecord.value = refreshed
        activeRecord.value = { ...activeRecord.value, ...refreshed }
      } else {
        selectedRecord.value = null
        activeRecord.value = null
        loadedRec.value = null
      }
    }
  } catch (e) {
    console.error(e)
    recordsLoadState.value = {
      status: 'error',
      message: `Could not load assessments: ${e?.message || 'request failed'}`
    }
    showToast(records.value.length
      ? 'Could not refresh assessments. Showing the last loaded data.'
      : 'Could not load assessments. Please try again.', 'error')
  }
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
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { creating.value = false }
}

async function openDetailModal(rec) {
  activeRecord.value    = rec
  activeTab.value       = defaultTabForCurrentContext()
  cbcRatings.value      = {}
  jfRatings.value       = {}
  jfEvidence.value      = {}
  fpoSource.value       = null
  fpoManualInput.value  = ''
  fpoManualSaved.value  = false
  loadedRec.value       = null
  loadingDetail.value   = true
  try {
    const full = await ipatApi.get(rec.id)
    loadedRec.value = full
    activeRecord.value = { ...rec, ...full }
    fpoManualInput.value = full.fpoScore ? String(full.fpoScore) : ''
    alignRaterType(cbcRaterType, cbcRaterOptions.value)
    alignRaterType(jfRaterType, jfRaterOptions.value)
    _populateCBCRatings(cbcRaterType.value, full.cbcRatings)
    _populateJFRatings(jfRaterType.value,   full.jfRatings)
  } catch (e) {
    console.error(e); showToast('Could not load record. Please try again.', 'error')
  } finally {
    loadingDetail.value = false
  }
}

function _syncRecord(updated) {
  activeRecord.value = { ...activeRecord.value, ...updated }
  const i = records.value.findIndex(r => r.id === activeRecord.value.id)
  if (i !== -1) records.value[i] = activeRecord.value
  if (selectedRecord.value?.id === activeRecord.value.id) {
    selectedRecord.value = { ...selectedRecord.value, ...updated }
  }
  if (selectedResult.value?.id === activeRecord.value.id) {
    selectedResult.value = { ...selectedResult.value, ...updated }
  }
  myResults.value = myResults.value.map(r => r.id === activeRecord.value.id ? { ...r, ...updated } : r)
}

// ── CBC ──
async function saveCBCRatings() {
  const ratings = []
  HEARTWORK_THEMES.value.forEach(theme => {
    theme.indicators.forEach((_, idx) => {
      const rating = getCBCRating(theme.id, idx)
      if (rating !== null) {
        const effectiveType = activeAssignment.value?.raterType || cbcRaterType.value
        ratings.push({ themeId: theme.id, themeName: theme.label, indicatorIdx: idx, rating, raterType: effectiveType })
      }
    })
  })
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingCBC.value = true
  try {
    await ipatApi.saveCBCRatings(activeRecord.value.id, ratings)
    mergeLoadedRatings('cbc', ratings)
    showToast(`${ratings.length} CBC ratings saved`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { savingCBC.value = false }
}

async function computeCBC() {
  computingCBC.value = true
  try {
    const r = await ipatApi.computeCBC(activeRecord.value.id)
    _syncRecord({
      cbcScore: r.cbcScore,
      cbcBaseScore: r.cbcBaseScore,
      cbcDeductionSummary: r.cbcDeductionSummary,
      overallScore: r.overallScore || activeRecord.value?.overallScore || '',
      descriptor: r.descriptor || activeRecord.value?.descriptor || '',
      status: r.overallScore ? 'Computed' : activeRecord.value?.status
    })
    showToast(`CBC Score: ${r.cbcScore}`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { computingCBC.value = false }
}

async function saveCbcDeduction() {
  if (!activeRecord.value?.id) return
  const preview = cbcDeductionPreview.value
  const nteLevel = normalizeConductLevel(cbcDeductionForm.value.cbcNteLevel)
  const offenseLevel = normalizeConductLevel(cbcDeductionForm.value.cbcOffenseLevel)
  const ok = await confirm({
    type:         'warning',
    title:        'Save Offenses Deduction',
    message:      `This will apply the confidential offenses deduction for ${activeRecord.value.rateeName || 'this assessment'}.`,
    details: [
      { label: 'Employee', value: activeRecord.value.rateeName || '-' },
      { label: 'NTE deduction', value: preview.ntePct ? `${CONDUCT_LEVELS[nteLevel].label} (-${preview.ntePct}%)` : 'None' },
      { label: 'Final score deduction', value: preview.offenseDeduction ? `${CONDUCT_LEVELS[offenseLevel].label} (-${preview.offenseDeduction})` : 'None' },
      { label: 'CBC contribution', value: preview.cbcWeightedScore ?? '-' }
    ],
    note:         'This adjustment is confidential and affects the computed CBC and overall assessment score.',
    confirmLabel: 'Save Deduction',
    cancelLabel:  'Review Again'
  })
  if (!ok) return
  savingCbcDeduction.value = true
  try {
    const updated = await ipatApi.setCbcDeduction(activeRecord.value.id, cbcDeductionForm.value)
    _syncRecord(updated)
    showCbcDeductionModal.value = false
    showToast('Offenses deduction saved')
  } catch (e) {
    console.error(e)
    assessmentLoadError.value = e?.message || 'Assessment questions could not be loaded. Please retry.'
    if (force) assessmentQuestions.value = []
    showToast(e?.message || 'Could not save the offenses deduction. Please try again.', 'error')
  } finally {
    savingCbcDeduction.value = false
  }
}

// ── FPO ──
async function syncFPOScore() {
  syncingFPO.value = true
  try {
    const r = await ipatApi.syncFPO(activeRecord.value.id)
    _syncRecord({
      fpoScore: r.fpoScore,
      cbcScore: r.cbcScore,
      jfScore: r.jfScore,
      overallScore: r.overallScore,
      descriptor: r.descriptor,
      status: 'Computed'
    })
    fpoSource.value = r.source
    showToast(`FPO score pulled from ${r.source.type}: ${r.fpoScore}`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { syncingFPO.value = false }
}

// ── JF ──
async function saveJFRatings() {
  const ratings = JF_INDICATORS.value.map((_, idx) => ({
    // Only send minimal fields - full indicator text causes URL to exceed GAS limits
    indicatorIdx: idx,
    rating: getJFRating(idx) || 1,
    evidence: jfEvidence.value[idx] || '',
    raterType: ['Self', 'Supervisor'].includes(activeAssignment.value?.raterType) ? activeAssignment.value.raterType : jfRaterType.value
  })).filter((_, idx) => getJFRating(idx) !== null)
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingJF.value = true
  try {
    await ipatApi.saveJFRatings(activeRecord.value.id, ratings)
    mergeLoadedRatings('jf', ratings)
    showToast(`${ratings.length} Job Fitness ratings saved`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { savingJF.value = false }
}

async function computeJF() {
  computingJF.value = true
  try {
    const r = await ipatApi.computeJF(activeRecord.value.id)
    _syncRecord({
      jfScore: r.jfScore,
      overallScore: r.overallScore || activeRecord.value?.overallScore || '',
      descriptor: r.descriptor || activeRecord.value?.descriptor || '',
      status: r.overallScore ? 'Computed' : activeRecord.value?.status
    })
    showToast(`Job Fitness Score: ${r.jfScore}`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { computingJF.value = false }
}

// ── Overall ──
async function computeOverall() {
  computingOverall.value = true
  try {
    const r = await ipatApi.computeOverall(activeRecord.value.id)
    _syncRecord({ overallScore: r.overallScore, descriptor: r.descriptor, cbcScore: r.cbcScore, fpoScore: r.fpoScore, jfScore: r.jfScore, status: 'Computed' })
    showToast(`Overall: ${r.overallScore} - ${r.descriptor}`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { computingOverall.value = false }
}

async function recomputeOverallAfterComponentChange() {
  if (!activeRecord.value?.id) return
  try {
    const r = await ipatApi.computeOverall(activeRecord.value.id)
    _syncRecord({ overallScore: r.overallScore, descriptor: r.descriptor, cbcScore: r.cbcScore, fpoScore: r.fpoScore, jfScore: r.jfScore, status: 'Computed' })
  } catch (e) {
    const fallbackScore = displayOverallScore(activeRecord.value)
    _syncRecord({
      overallScore: fallbackScore || '',
      descriptor: fallbackScore ? descriptorForScore(fallbackScore) : '',
      status: fallbackScore ? 'Computed' : activeRecord.value.status
    })
  }
}

async function finalizeRecord() {
  if (finalizing.value) return
  const ok = await confirm({
    type:         'approve',
    title:        'Finalize Assessment',
    message:      `This locks ${activeRecord.value?.employeeName || 'this'} assessment as Final. Scores and ratings can no longer be changed after this.`,
    note:         'Only do this once you are sure every rating and computed score is correct.',
    confirmLabel: 'Yes, Finalize',
    cancelLabel:  'Not yet'
  })
  if (!ok) return
  finalizing.value = true
  try {
    await ipatApi.updateStatus(activeRecord.value.id, 'Final')
    _syncRecord({ status: 'Final' })
    showToast('Assessment finalized')
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { finalizing.value = false }
}

</script>

<style scoped>
.eval-page{padding:0;font-size:13px;color:#1A2332;min-height:100%;}

/* ── Two-panel shell ── */
.eval-tp-shell{display:flex;height:86vh;border:1px solid #DDE7F3;border-radius:14px;overflow:hidden;background:#fff;margin-top:4px;box-shadow:0 10px 28px rgba(15,23,42,.05);}
.eval-tp-left{width:450px;flex-shrink:0;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#CBD5E1 transparent;background:#FBFDFF;}
.eval-tp-left .tasks-period-bar,.eval-tp-left .filter-bar{border-bottom:1px solid #E8EEF7;padding:14px 18px;flex-shrink:0;background:#FFFFFF;}
.eval-tp-right{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;scrollbar-width:thin;scrollbar-color:#E2E8F0 transparent;}

/* ── List items ── */
.eli-list{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:9px;}
.eli{padding:13px;border:1px solid #E7EEF8;border-radius:12px;background:#FFFFFF;cursor:pointer;transition:background .12s,border-color .12s,box-shadow .12s,transform .12s;display:flex;flex-direction:column;gap:8px;}
.eli:hover{background:#F8FBFF;border-color:#C9DAF2;box-shadow:0 8px 18px rgba(15,23,42,.06);transform:translateY(-1px);}
.eli-active{background:#F2F7FF !important;border-color:#3B82F6 !important;border-left:3px solid #3B82F6;padding-left:11px;box-shadow:0 8px 20px rgba(59,130,246,.12);}
.eli-sk{pointer-events:none;}
.eli-row{display:flex;align-items:center;gap:10px;}
.eli-av{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;letter-spacing:-.02em;}
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
.eli-score-percent{font-size:10px;font-weight:800;color:#0F766E;background:#ECFDF5;border:1px solid #BBF7D0;border-radius:20px;padding:2px 8px;}
.eli-desc-chip{font-size:10px;font-weight:700;border-radius:20px;padding:2px 9px;}
.eli-final{display:flex;align-items:center;gap:4px;font-size:10px;color:#15803D;font-weight:600;}

/* ── Left empty state ── */
.eval-lp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:8px;color:#94A3B8;text-align:center;}
.eval-lp-empty p{margin:0;font-size:13px;font-weight:600;color:#64748B;}
.eval-lp-empty span{font-size:12px;color:#94A3B8;}
.eval-lp-empty .load-state-note{display:block;max-width:280px;margin-top:4px;font-size:11px;line-height:1.4;color:#64748B;}

/* ── Right panel ── */
.eval-rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:#94A3B8;text-align:center;padding:40px;}
.eval-rp-empty-title{margin:0;font-size:14px;font-weight:600;color:#64748B;}
.eval-rp-empty-sub{margin:0;font-size:12px;color:#94A3B8;}
.eval-rp-hd{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 26px;border-bottom:1px solid #E8EDF3;flex-shrink:0;background:linear-gradient(to bottom,#FAFBFF,#F7F9FF);}
.eval-rp-hd-info{flex:1;min-width:0;}
.eval-rp-title{font-size:17px;font-weight:700;color:#1E293B;margin-bottom:4px;letter-spacing:-.3px;}
.eval-rp-sub{font-size:12.5px;color:#64748B;}
.eval-rp-body{padding:20px 26px 28px;display:flex;flex-direction:column;gap:18px;}
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
.rp-score-equivalent{display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.25);font-size:12px;font-weight:700;color:#0F766E;}
.rp-score-desc{font-size:13px;font-weight:600;margin-top:8px;}
.rp-score-grid{display:flex;gap:12px;}
.rp-score-grid-4{flex-wrap:wrap;}
.rp-score-block{flex:1;background:#F8FAFC;border:1px solid #E8EDF3;border-radius:10px;padding:14px 10px;text-align:center;min-width:80px;}
.rp-score-lbl{font-size:11px;color:#64748B;font-weight:600;margin-bottom:6px;}
.rp-score-val{font-size:22px;font-weight:800;color:#94A3B8;}
.rp-sv-has{color:#1E293B;}
.rp-score-pct{font-size:10.5px;color:#94A3B8;margin-top:3px;}
.rp-score-equivalent-sm{font-size:11px;font-weight:700;color:#0F766E;margin-top:5px;}
.private-deduction-note{margin-top:14px;border:1px solid #FED7AA;background:#FFFBEB;color:#92400E;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.5;}
.private-deduction-title{font-size:13px;font-weight:900;color:#7C2D12;margin-bottom:4px;}
.private-deduction-note small{display:block;margin-top:4px;color:#B45309;}
.rp-score-overall{background:#EFF6FF;border-color:#BFDBFE;}
.rp-desc-badge{display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;border-radius:20px;padding:5px 16px;}
.rp-desc-badge.desc-excellent{background:#DCFCE7;color:#15803D;}
.rp-desc-badge.desc-satisfactory{background:#DBEAFE;color:#1D4ED8;}
.rp-desc-badge.desc-needs{background:#FEF3C7;color:#B45309;}
.rp-desc-badge.desc-immediate{background:#FEE2E2;color:#B91C1C;}
.page-hd{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:22px;margin-bottom:12px;padding:0;}
.page-title-block{min-width:0;padding-top:0;flex-shrink:0;}
.page-title{font-size:19px;font-weight:800;color:#0F172A;margin:0 0 2px;letter-spacing:-.4px;line-height:1.1;}
.page-sub{font-size:11.5px;color:#64748B;margin:0;white-space:nowrap;}
.page-hd-side{display:flex;align-items:stretch;gap:10px;justify-content:flex-end;min-width:0;}
.page-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;}

/* Content card */
.content-card{background:rgba(255,255,255,.92);border:1px solid #DDE7F3;border-radius:16px;padding:14px 16px;box-shadow:0 12px 34px rgba(15,23,42,.055);}

/* Domain bar */
.domain-bar{flex:1;display:flex;align-items:center;gap:6px;background:#F8FBFF;border:1px solid #DCE7F5;border-radius:12px;padding:6px;flex-wrap:nowrap;min-width:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.85);}
.domain-item{flex:1;width:auto;min-width:0;display:flex;align-items:center;gap:9px;padding:7px 11px;border-radius:9px;background:#FFFFFF;border:1px solid #E8EEF7;box-shadow:0 1px 2px rgba(15,23,42,.04);}
.domain-pct{font-size:18px;font-weight:900;line-height:1;flex-shrink:0;}
.domain-text{min-width:0;}
.domain-label{font-size:10px;font-weight:800;color:#334155;margin:0;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.domain-sub{font-size:9.5px;color:#94A3B8;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.d-cbc .domain-pct{color:#1A56B0;}
.d-fpo .domain-pct{color:#15803D;}
.d-jf .domain-pct{color:#6B3FA0;}
.d-overall .domain-pct{color:#0F172A;}
.domain-sep{display:flex;align-items:center;font-size:17px;font-weight:800;color:#CBD5E1;flex-shrink:0;}

/* Filters */
/* The left panel is narrow, so every control here must be able to shrink and
   wrap rather than overflow. Fixed pixel widths previously forced the period
   selects onto their own row and truncated "1st Semester (Jan-Jun)". */
.filter-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
.status-tabs{display:flex;flex-wrap:nowrap;gap:6px;flex:1 1 auto;}
/* flex:1 1 0 makes the three tabs share the row evenly and consume the full
   width - previously they were content-sized and left dead space to the right. */
.status-tab{flex:1 1 0;min-width:0;text-align:center;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;white-space:nowrap;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.filter-right{display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:1 1 300px;justify-content:flex-end;min-width:0;}
.srch-wrap{position:relative;flex:1 1 190px;min-width:170px;}
.srch-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;}
.srch-inp{padding:7px 11px 7px 28px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;outline:none;width:100%;box-sizing:border-box;background:#fff;}
/* min-width:0 lets a flex select shrink below its intrinsic content width, which
   is what stops the row from overflowing when the panel narrows. */
.filter-select{padding:7px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;color:#374151;background:#fff;outline:none;cursor:pointer;flex:1 1 140px;min-width:0;max-width:100%;box-sizing:border-box;text-overflow:ellipsis;}
/* max-width stops the period select absorbing all the slack on its row and
   rendering at 340px next to a 92px year select. */
.filter-select-period{flex:1 1 160px;max-width:210px;}
.filter-select-year{flex:0 1 92px;min-width:78px;max-width:110px;}
.filter-select:not(.filter-select-period):not(.filter-select-year){max-width:230px;}

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
.btn-danger{background:#DC2626;color:#fff;border-color:#DC2626;}
.btn-danger:hover:not(:disabled){background:#B91C1C;}
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
/* align-items:stretch keeps the cards the same height once the equivalent
   percentages and the descriptor made their content uneven.
   Always one horizontal row - CBC + FPO + JF = Overall reads as a formula, and
   stacking it vertically breaks that. flex-wrap:nowrap holds the line at every
   zoom level; the cards shrink instead, and if the pane is genuinely too narrow
   the bar scrolls sideways rather than reflowing into a column. */
.score-summary-bar{container-type:inline-size;display:flex;align-items:stretch;flex-wrap:nowrap;overflow-x:auto;gap:8px;padding:14px 20px;background:linear-gradient(180deg,#FBFDFF,#F6FAFF);border-bottom:1px solid #E6EEF8;flex-shrink:0;}
/* flex:1 1 0 shares the row proportionally; min-width is the floor that stops
   the cards collapsing to unreadable slivers (they hit 19px without it). Once
   the four cards plus the button no longer fit at that floor, the bar scrolls
   sideways - it never reflows into a column. */
.sscore{text-align:center;flex:1 1 0;min-width:82px;padding:9px 7px;border-radius:10px;background:#FFFFFF;border:1px solid #EAF0F7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}
.sscore-lbl{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;}
.sscore-val{font-size:20px;font-weight:800;color:#CBD5E1;line-height:1.15;}
.sscore-val.has-val{color:#0F172A;}
.sscore-desc{font-size:10px;font-weight:600;margin-top:4px;padding:2px 6px;border-radius:8px;}
.sscore-eq{font-size:10px;font-weight:700;color:#0F766E;margin-top:3px;line-height:1.2;}
.sscore-eq-strong{font-size:11px;background:#ECFDF5;border:1px solid #BBF7D0;border-radius:999px;padding:2px 8px;display:inline-block;margin-top:5px;}
.sscore-op{font-size:18px;font-weight:700;color:#CBD5E1;flex:0 0 auto;display:flex;align-items:center;justify-content:center;}
/* The Overall card carries an extra pill and the descriptor, so give it a little
   more of the row than the three domain cards. */
.sscore-overall{flex:1.3 1 0;}
/* The score itself must stay on one line; the "equivalent" caption may wrap.
   Keeping nowrap on the caption pinned each card's min-content near 114px, which
   is what forced the bar to scroll on narrow panes. */
.sscore-val{white-space:nowrap;}
.sscore-eq{white-space:normal;overflow-wrap:anywhere;}

/* Progressive compaction, keyed on the bar's OWN width (it sits in a split pane,
   so a viewport media query would be wrong). The aim is that the four cards
   always fit - the bar never scrolls and never stacks. */
@container (max-width: 620px) {
  .score-summary-bar{gap:6px;padding:12px 12px;}
  .sscore-op{display:none;}          /* decorative once space is tight */
  .sscore{min-width:72px;padding:8px 5px;}
  .sscore-lbl{font-size:9px;letter-spacing:0;margin-bottom:1px;}
  .sscore-val{font-size:17px;}
  .sscore-eq{font-size:9px;margin-top:2px;}
  .sscore-eq-strong{font-size:9.5px;padding:1px 6px;margin-top:3px;}
  .sscore-desc{font-size:9px;padding:1px 5px;margin-top:3px;}
}
@container (max-width: 420px) {
  .score-summary-bar{gap:5px;padding:10px 8px;}
  .sscore{min-width:62px;padding:7px 4px;}
  .sscore-val{font-size:15px;}
  .sscore-lbl{font-size:8.5px;}
  /* Below this the caption costs more than it explains - the weighted value and
     the descriptor still carry the meaning. */
  .sscore-eq:not(.sscore-eq-strong){display:none;}
}
/* Now sits in the CBC tab intro row rather than the score bar. flex-shrink:0
   keeps the label on one line; align-self:center holds it beside the intro text
   instead of stretching to the block's height. */
.conduct-deduction-btn{align-self:center;flex:0 0 auto;border:1px solid #FCD34D;background:#FFFBEB;color:#92400E;border-radius:10px;padding:9px 14px;font-size:12px;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap;}
.conduct-deduction-btn:hover{border-color:#F59E0B;background:#FEF3C7;}
.conduct-dot{width:8px;height:8px;border-radius:999px;background:#F59E0B;box-shadow:0 0 0 3px rgba(245,158,11,.16);}
.conduct-modal{max-width:620px;}
.warning-icon{background:#FFFBEB!important;color:#D97706!important;border:1px solid #FCD34D;font-weight:900;}
.conduct-modal-body{display:flex;flex-direction:column;gap:14px;}
.conduct-ratee-card{display:flex;flex-direction:column;gap:2px;border:1px solid #E1E9F3;border-radius:10px;background:#F8FAFC;padding:12px 14px;color:#0B1F36;}
.conduct-ratee-card span{font-size:12px;color:#64748B;}
.conduct-preview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;border:1px solid #E1E9F3;border-radius:12px;background:#F8FAFC;padding:12px;}
.conduct-preview div{background:#fff;border:1px solid #E8EDF3;border-radius:10px;padding:10px;text-align:center;}
.conduct-preview span{display:block;font-size:10px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;}
.conduct-preview strong{font-size:18px;color:#0B1F36;}
.conduct-preview-final{border-color:#BFDBFE!important;background:#EFF6FF!important;}
.conduct-preview-final strong{color:#0046B8;}

/* Tabs */
.dtabs{display:flex;padding:0 24px;border-bottom:1px solid #E8EDF3;flex-shrink:0;overflow-x:auto;scrollbar-width:none;background:#FFFFFF;}
.dtabs::-webkit-scrollbar{display:none;}
.dtab{padding:11px 18px;font-size:12px;font-weight:700;cursor:pointer;border:none;background:transparent;color:#64748B;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap;}
.dtab:hover{color:#1A56B0;background:#F8FBFF;}
.dtab.active{color:#1A56B0;border-bottom-color:#1A56B0;font-weight:800;background:#F8FBFF;}

/* Tab content */
.tab-intro{font-size:12px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 14px;margin-bottom:16px;line-height:1.6;}
.scale-hint{display:block;font-size:11px;color:#94A3B8;margin-top:3px;}
/* Intro text on the left, Conduct Deduction on the right. The button wraps below
   the text only if the pane is genuinely too narrow for both. */
.tab-intro-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 14px;}
.tab-intro-text{flex:1 1 260px;min-width:0;}
/* justify-content was space-between, which stranded the subordinates badge
   against the far right edge - several hundred pixels from the select whose
   weighting it explains. Grouping them reads as one statement, and the badge
   still drops to its own line when the pane is too narrow. */
.rater-row{display:flex;align-items:center;justify-content:flex-start;gap:10px 12px;margin-bottom:16px;flex-wrap:wrap;}
.rater-selector{display:flex;align-items:center;gap:10px;flex:0 1 auto;min-width:0;}
.rater-label{font-size:12px;font-weight:600;color:#374151;flex-shrink:0;}
/* Was a fixed inline width:220px on the select, which could not shrink. */
.rater-select{flex:0 1 220px;min-width:150px;max-width:220px;}
/* align-self:center pins the badge to the select's optical centre rather than
   letting it stretch; the border and line-height stop it reading as loose text
   and let it wrap cleanly instead of overflowing. */
.has-sub-note{align-self:center;font-size:11px;color:#854D0E;background:#FEF9C3;border:1px solid #FDE68A;padding:5px 10px;border-radius:6px;line-height:1.35;max-width:100%;}

/* HEARTWORK themes */
.theme-section{margin-bottom:20px;}
.theme-hd{display:flex;align-items:center;justify-content:space-between;background:#F8FAFC;border:1px solid #E8EEF7;border-radius:12px;padding:11px 14px;margin-bottom:9px;gap:10px;}
.theme-hd-left{display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap;}
.theme-badge{font-size:13px;font-weight:700;color:#1A56B0;background:#EBF4FF;padding:3px 10px;border-radius:8px;flex-shrink:0;}
.theme-desc{font-size:11px;color:#64748B;flex:1;}
.theme-avg{font-size:12px;font-weight:700;color:#0F172A;background:#F0FDF4;border:1px solid #BBF7D0;padding:2px 10px;border-radius:20px;flex-shrink:0;}
.indicator-list{display:flex;flex-direction:column;gap:7px;}
.indicator-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid #EAF0F7;border-radius:10px;background:#fff;transition:border-color .12s,background .12s,box-shadow .12s;}
.indicator-row:hover{border-color:#C7DBF5;background:#FAFCFF;box-shadow:0 4px 12px rgba(15,23,42,.045);}
.ind-num{width:22px;height:22px;border-radius:50%;background:#F1F5F9;color:#64748B;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ind-text{flex:1;font-size:12px;color:#374151;line-height:1.5;}
.ind-rating{display:grid;grid-template-columns:repeat(4,36px);gap:6px;justify-content:end;flex-shrink:0;}
.rating-btn{min-width:0;width:36px;height:36px;padding:0;border-radius:9px;border:1.5px solid #D8E3F0;background:#fff;font-size:13px;font-weight:800;color:#475569;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;}
.rating-btn:hover:not(.selected){background:#EFF6FF;border-color:#93C5FD;color:#1A56B0;}
.rating-btn.selected{background:#1A56B0;border-color:#1A56B0;color:#fff;box-shadow:0 2px 8px rgba(26,86,176,.25);}

/* Rater mode progress */
.rating-progress-wrap{padding:14px 16px 12px;background:#F8FAFC;border:1px solid #E8EEF7;border-radius:12px;margin:0 0 16px;}
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
/* auto-fit collapses the two columns to one when the detail pane is narrow,
   instead of squeezing the 36px score and the sync button side by side. */
.fpo-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:16px;align-items:stretch;}
.fpo-current{background:#F8FAFC;border:1px solid #F1F5F9;border-radius:10px;padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.fpo-label{font-size:11px;font-weight:600;color:#94A3B8;margin-bottom:8px;}
.fpo-score{font-size:36px;font-weight:800;color:#0F172A;line-height:1;}
.fpo-converted{font-size:11px;color:#64748B;margin-top:6px;}
.fpo-update{display:flex;flex-direction:column;}
.fpo-auto-note{font-size:11px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:10px 12px;line-height:1.5;}

.fpo-manual-panel{container-type:inline-size;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:16px;margin-bottom:16px;}
.fpo-manual-title{font-size:13px;font-weight:700;color:#92400E;margin-bottom:4px;}
.fpo-manual-hint{font-size:11px;color:#A16207;line-height:1.5;margin-bottom:12px;}
.fpo-manual-row{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(240px,1fr);grid-template-areas:"label label" "input result" "help status";align-items:start;column-gap:14px;row-gap:5px;}
.fpo-manual-input-group{display:contents;}
.fpo-manual-label{grid-area:label;display:flex;align-items:baseline;gap:8px;font-size:11.5px;font-weight:700;color:#92400E;}
.fpo-manual-range{font-size:10px;font-weight:600;color:#A16207;background:#FEF3C7;border-radius:999px;padding:1px 7px;}
/* The bare number input read as static text. A white shell with a clear border,
   a visible focus ring and a "/ 5" affix makes it obviously editable. */
.fpo-input-shell{grid-area:input;display:flex;align-items:center;gap:6px;min-height:45px;background:#FFFFFF;border:1.5px solid #FCD34D;border-radius:9px;padding:0 12px;transition:border-color .15s,box-shadow .15s;}
.fpo-input-shell:focus-within{border-color:#F59E0B;box-shadow:0 0 0 3px rgba(245,158,11,.18);}
.fpo-manual-field{flex:1 1 auto;width:100%;min-width:0;box-sizing:border-box;font-size:20px;font-weight:800;color:#0F172A;text-align:left;padding:9px 0;border:0;outline:none;background:transparent;}
.fpo-input-affix{font-size:13px;font-weight:700;color:#A16207;flex-shrink:0;}
.fpo-manual-help{grid-area:help;font-size:10.5px;color:#A16207;line-height:1.35;}
.fpo-manual-invalid{grid-area:result;align-self:start;font-size:11px;font-weight:700;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:7px 12px;}
.fpo-calc-caption{font-size:10px;font-weight:700;color:#A16207;text-transform:uppercase;letter-spacing:.04em;width:100%;}
.fpo-manual-result{grid-area:result;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;min-height:45px;padding:9px 14px;background:#FFFFFF;border:1px solid #FDE68A;border-radius:9px;}
.fpo-calc-formula{font-size:13px;color:#64748B;white-space:nowrap;}
.fpo-calc-eq{font-size:15px;color:#94A3B8;font-weight:600;}
.fpo-calc-value{font-size:24px;font-weight:800;color:#0F172A;line-height:1;}
.fpo-manual-status{grid-area:status;display:flex;align-items:center;min-height:16px;justify-content:flex-start;}
@container (max-width:420px){
  .fpo-manual-row{grid-template-columns:1fr;grid-template-areas:"label" "input" "help" "result" "status";}
  .fpo-manual-result{justify-content:center;}
  .fpo-manual-status{justify-content:center;}
}
.fpo-saving-indicator{font-size:11px;color:#94A3B8;display:flex;align-items:center;gap:4px;}
.fpo-saved-indicator{font-size:11px;font-weight:700;color:#16A34A;}
/* An administrator sees submitted ratings, and cannot change them - only the
   assigned rater can. The selected chip used to render in the same solid
   interactive blue as a clickable button, so the panel looked editable and
   people went looking for a Save button that does not exist. Read-only state now
   reads as a record, not a control: no hover, no pointer, muted fill. */
.rating-readonly{cursor:default;opacity:.45;background:#F8FAFC;border-style:dashed;}
.rating-readonly.selected{opacity:1;background:#EAF1FC;color:#1E3A8A;border-color:#BFD3F0;border-style:solid;font-weight:800;box-shadow:none;}
.rating-readonly:hover{background:#F8FAFC;border-color:#D8E3F0;color:#475569;}
.rating-readonly.selected:hover{background:#EAF1FC;border-color:#BFD3F0;color:#1E3A8A;}
/* States plainly why nothing here can be edited. */
.readonly-note{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#475569;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;padding:5px 10px;}
.jf-evidence-readonly{font-size:11px;color:#64748B;margin-top:2px;font-style:italic;}

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

/* Domain tab alert */
.dtab-alert{color:#B45309 !important;background:#FFFBEB;}
.dtab-alert.active{background:#FEF3C7 !important;color:#92400E !important;border-bottom-color:#F59E0B !important;}

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
.view-tabs {display:flex;flex-wrap:wrap;align-items:center;width:100%;gap:8px;margin-top:8px;margin-bottom:5px;padding:0 12px;box-sizing:border-box;}
.view-tab {flex:1 0 150px;min-width:0;max-width:100%;height:36px;padding:6px 10px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #dbe4f0;border-radius:18px;background:#ffffff;color:#52627a;font-size:13px;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap;overflow:hidden;}
.view-tab.active {background: #071d36;border-color: #071d36;color: #ffffff;}
.view-tab-label{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.view-tab-badge {display: inline-flex;align-items: center;justify-content: center;flex:0 0 auto;min-width: 18px;height: 18px;padding: 0 5px;border:1px solid rgba(255,255,255,.75);border-radius: 999px;background: #ef4444;color: #ffffff;font-size: 10px;font-weight: 800;line-height: 1;box-shadow:0 1px 3px rgba(127,29,29,.28);}
/* Sits in the tab row but performs an action rather than switching views, so it
   is styled as a distinct control and never takes the .active treatment. */
/* Inherits .view-tab's flex:1 0 150px deliberately. It used to override with
   flex:2 1 188px, which made it claim double the spare space in its row - so
   "Generate Assignments" rendered visibly wider than "All Assessments" beside
   it, and wider than the My Rating Tasks / My Results pair above. All four are
   one grid now; only the dashed outline marks this one as an action. */
.view-tab-action {border-style: dashed;border-color: #b9c8dc;color: #1e3f61;background: #f8fbff;}
.view-tab-action:hover {background: #eef5ff;border-color: #8fa9c9;}

/* My Tasks */
.tasks-period-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tasks-period-label{font-size:12px;font-weight:600;color:#374151;}
/* Left-aligned, sitting under "Period:" on the row it wraps onto - no
   special alignment needed, this is .tasks-period-bar's own default
   flex-start behaviour. Right-alignment was tried and reverted per
   feedback. */
.tasks-last-updated{font-size:11px;color:#94A3B8;}
/* Reuses .btn's own shape (padding, radius, border colour) so it reads as
   the same scale of control as everything else on this screen, just
   recoloured to the accent blue with a permanent icon instead of text-only. */
.tasks-refresh-btn{
  display:inline-flex;align-items:center;gap:5px;
  margin-left:6px;padding:5px 11px;border-radius:8px;
  border:1px solid #E2E8F0;background:#fff;
  color:#1D4ED8;font-size:12px;font-weight:600;
  cursor:pointer;vertical-align:-4px;
}
.tasks-refresh-btn:hover:not(:disabled){border-color:#CBD5E1;background:#F8FAFC;}
.tasks-refresh-btn:disabled{opacity:.55;cursor:not-allowed;}
.tasks-refresh-icon{width:13px;height:13px;flex-shrink:0;}
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
.regen-warning{text-align:center;padding:12px 0;}
.regen-warning-icon{margin-bottom:12px;}
.regen-warning-title{font-size:16px;font-weight:700;color:#DC2626;margin:0 0 8px;}
.regen-warning-text{font-size:13px;color:#374151;margin:0 0 10px;line-height:1.6;}
.regen-warning-list{text-align:left;margin:0 auto 14px;padding:0 0 0 22px;font-size:12px;line-height:1.8;color:#6B7280;max-width:340px;}
.regen-warning-list li::marker{color:#EF4444;}
.gen-result{text-align:center;padding:20px 0;}
.gen-result-title{font-size:16px;font-weight:700;color:#15803D;margin-bottom:6px;}
.gen-result-stat{font-size:13px;color:#374151;margin-bottom:12px;}
.gen-result-breakdown{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:12px;}
.gen-chip{background:#EBF4FF;color:#1A56B0;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;}
.gen-result-note{font-size:12px;color:#64748B;max-width:320px;margin:0 auto;}

/* Assignment context */
.assignment-banner{display:flex;align-items:center;gap:9px;background:#EBF4FF;border:1px solid #BFDBFE;border-radius:10px;padding:9px 14px;margin:12px 0 0;font-size:12px;color:#1A56B0;flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.7);}
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
/* Amber, not red: an incomplete score is a caveat on a real number, not an error. */
.rc-partial{background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;margin-left:6px;}
.rp-partial-badge{display:inline-block;margin-top:10px;padding:3px 12px;border-radius:20px;background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;font-size:11px;font-weight:700;}
.rp-partial-note{margin:12px 0 0;padding:11px 14px;border-radius:9px;background:#FFFBEB;border:1px solid #FDE68A;color:#78350F;font-size:12px;line-height:1.55;}
.rp-partial-note strong{color:#92400E;}
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
.assessment-layout{display:grid;grid-template-columns:380px minmax(0,1fr);flex:1;min-height:0;overflow:hidden;background:#fff;height:100%;}
.assessment-sidebar{min-width:0;overflow-y:auto;border-right:1px solid #E2E8F0;background:#FFFFFF;padding:18px 14px;scrollbar-width:thin;scrollbar-color:#CBD5E1 transparent;}
.sidebar-employee{display:flex;align-items:flex-start;gap:11px;padding-bottom:16px;margin-bottom:14px;border-bottom:1px solid #E8EEF7;}
.sidebar-avatar{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;letter-spacing:-.04em;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(15,23,42,.05);}
.sidebar-employee-info{min-width:0;flex:1;}
.sidebar-employee-name{font-size:14px;font-weight:800;color:#0F172A;line-height:1.25;overflow-wrap:anywhere;margin-bottom:4px;}
.sidebar-employee-desc{font-size:11.5px;color:#64748B;line-height:1.45;margin-bottom:8px;}
.sidebar-badges{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.sidebar-domains{display:flex;flex-direction:column;gap:9px;margin-bottom:14px;}
.sidebar-domain{width:100%;display:flex;flex-direction:column;align-items:stretch;gap:7px;padding:12px;border:1px solid #E5EDF7;border-radius:12px;background:#FBFDFF;color:#475569;text-align:left;cursor:pointer;transition:background .14s,border-color .14s,color .14s,box-shadow .14s,transform .14s;}
.sidebar-domain:hover{background:#F8FBFF;color:#1A56B0;border-color:#BFDBFE;box-shadow:0 5px 14px rgba(15,23,42,.06);transform:translateY(-1px);}
.sidebar-domain.active{background:#EFF6FF;color:#1A56B0;border-color:#BFDBFE;border-left:4px solid #1A56B0;padding-left:9px;box-shadow:0 5px 14px rgba(26,86,176,.08);}
.sidebar-domain.needs-action:not(.active){background:#FFFBEB;color:#92400E;border-color:#FDE68A;}
.sidebar-domain-top{display:grid;grid-template-columns:minmax(0,1fr) 18px;align-items:center;gap:8px;}
.sidebar-domain-title{font-size:11.5px;font-weight:800;line-height:1.25;}
.sidebar-domain-arrow{width:18px;height:18px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#94A3B8;background:#F1F5F9;font-size:18px;font-weight:800;line-height:1;transition:background .14s,color .14s,transform .14s;}
.sidebar-domain:hover .sidebar-domain-arrow,.sidebar-domain.active .sidebar-domain-arrow{background:#DBEAFE;color:#1A56B0;transform:translateX(1px);}
.sidebar-domain-progress{align-self:flex-start;font-size:10.5px;font-weight:700;color:#64748B;background:#F1F5F9;border-radius:999px;padding:2px 7px;}
.sidebar-domain.active .sidebar-domain-progress{background:#DBEAFE;color:#1A56B0;}
.sidebar-domain-bar{display:block;width:100%;height:5px;border-radius:999px;background:#E2E8F0;overflow:hidden;}
.sidebar-domain-fill{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#1A56B0,#3B82F6);transition:width .25s ease;}
.sidebar-card{border:1px solid #E5EDF7;border-radius:12px;background:#FBFDFF;padding:12px;margin-bottom:12px;}
.sidebar-card-title{font-size:10px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
.sidebar-scale-item{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-top:1px solid #EDF2F8;}
.sidebar-scale-item:first-of-type{border-top:0;padding-top:0;}
.sidebar-scale-item:last-child{padding-bottom:0;}
.sidebar-scale-number{width:24px;height:24px;border-radius:8px;background:#EFF6FF;color:#1A56B0;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sidebar-scale-item strong{display:block;font-size:11.5px;color:#0F172A;line-height:1.2;}
.sidebar-scale-item small{display:block;font-size:10.5px;color:#64748B;line-height:1.3;margin-top:2px;}
.assessment-content{min-width:0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;background:#FBFDFF;scrollbar-width:thin;scrollbar-color:#CBD5E1 transparent;}
.assessment-content-header{position:sticky;top:0;z-index:5;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid #E2E8F0;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);}
.assessment-content-title{min-width:0;}
.assessment-content-title h3{font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-.02em;margin:0 0 3px;line-height:1.2;}
.assessment-content-title p{font-size:11.5px;color:#64748B;margin:0;line-height:1.4;}
.assessment-content .rp-final-note{margin:14px 20px 0 !important;}
.assessment-content .score-summary-bar{margin:0;border-bottom:1px solid #E6EEF8;}
.eval-form-hd{position:sticky;top:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:16px 24px;border-bottom:1px solid #E8EDF3;background:linear-gradient(180deg,#FFFFFF,#F8FAFF);flex-shrink:0;}
.eval-form-hd-main{display:flex;align-items:center;gap:12px;min-width:0;}
.eval-form-av{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;letter-spacing:-.02em;}
.eval-form-hd-info{min-width:0;}
.eval-form-title{font-size:16px;font-weight:800;color:#0F172A;letter-spacing:-.3px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eval-form-sub{font-size:12px;color:#64748B;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eval-form-hd-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
/* Keeps Conduct Deduction and the close button together at the top-right of the
   sticky header, so the deduction control is reachable from every domain tab. */
.assessment-content-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}
.eval-form-close{width:30px;height:30px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
.eval-form-close:hover{background:#FEF2F2;border-color:#FECACA;color:#EF4444;}
.eval-form-scroll{display:block;}
/* Neutralize the modal-era scroll wrappers so the whole panel scrolls as one */
.assessment-content .modal-body-scroll{flex:none;overflow:visible;padding:18px 20px 22px;}
.assessment-content .assignment-banner{margin:14px 20px 0;}

/* Sticky footer with the primary action */
.eval-form-footer{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;justify-content:flex-end;gap:14px;
  margin-top:auto;padding:12px 20px;border-top:1px solid #E2E8F0;background:rgba(255,255,255,.97);backdrop-filter:blur(6px);flex-shrink:0;}
.eval-footer-progress{margin-right:auto;}
.eval-footer-count{font-size:12px;font-weight:700;color:#B45309;background:#FEF3E2;padding:5px 12px;border-radius:20px;}
.eval-footer-count.done{color:#047857;background:#ECFDF5;}

/* ════════════ LEFT PANEL - card polish ════════════ */
/* Fluid rather than a fixed 560px stepped down at breakpoints. The percentage
   basis resolves against the shell's own width, so the list gives space back to
   the assessment content continuously as the window narrows, instead of holding
   a fixed width until the next breakpoint fires. */
/* The list gives width back to the assessment content first. A lower floor
   (216px) and a smaller share (30%) mean the right column keeps enough room for
   the four score cards, so that bar never has to scroll. */
.eval-tp-left{width:auto;flex:0 1 clamp(216px, 30%, 560px);min-width:0;background:#FBFDFF;}
.eli-list{padding:12px;display:flex;flex-direction:column;gap:10px;align-items:stretch;}
.eli{position:relative;overflow:visible;border:1px solid #E6EDF6;border-radius:12px;background:#fff;padding:11px 14px 11px 16px;
  min-height:56px;flex:0 0 auto;box-shadow:0 1px 3px rgba(15,23,42,.04);transition:box-shadow .16s,border-color .16s,transform .09s;}
.eli:hover{border-color:#BFD6F5;box-shadow:0 4px 12px rgba(15,23,42,.08);transform:translateY(-1px);}
.eli:active{transform:translateY(0);}
.eli-active{background:#F4F9FF !important;border-color:#93C5FD !important;box-shadow:0 4px 14px rgba(59,130,246,.14);}
.eli-accent{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 4px 4px 0;}
.eli-row{display:flex;align-items:center;gap:10px;}
.eli-av{width:36px;height:36px;border-radius:10px;font-size:11px;box-shadow:inset 0 0 0 1px rgba(15,23,42,.05);}
.eli-info{flex:1;min-width:0;}
.eli-name-row{display:flex;align-items:center;gap:6px;}
.eli-name{font-size:13.5px;font-weight:700;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.eli-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.eli-dot-done{background:#22C55E;box-shadow:0 0 0 2px #DCFCE7;}
.eli-dot-pend{background:#F59E0B;box-shadow:0 0 0 2px #FEF3C7;}
.eli-meta{font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
.eli-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;}
.eli-status-label{font-size:10px;font-weight:600;}
.eli-sl-done{color:#15803D;}
.eli-sl-pend{color:#94A3B8;}
.all-records-list{gap:8px;}
.all-record-card{display:flex;flex-direction:column;justify-content:center;gap:6px;min-height:58px;padding-top:10px;padding-bottom:10px;overflow:hidden;}
.all-record-card .eli-row{align-items:center;min-height:34px;}
.all-record-card .eli-av{width:32px;height:32px;margin-top:0;flex:0 0 32px;font-size:10px;}
.all-record-card .status-badge{flex-shrink:0;margin-top:2px;}
.all-record-card .eli-chips{margin-left:46px;min-height:22px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.all-record-card .eli-period-pill{line-height:1.2;}
.all-record-card .eli-score-big{line-height:1;}

@media (min-width: 2200px) {
  .eval-page{font-size:14px;}
  .page-title{font-size:22px;}
  .page-sub{font-size:12.5px;}
  .content-card{padding:18px 20px;border-radius:18px;}
  .eval-tp-shell{height:calc(100vh - 170px);min-height:780px;border-radius:16px;}
  .eval-tp-left{flex-basis:clamp(268px, 34%, 640px);}
  .eval-tp-left .tasks-period-bar,
  .eval-tp-left .filter-bar{padding:18px 22px;}
  .view-tabs{padding:0 16px;gap:10px;}
  .view-tab{height:42px;font-size:14px;border-radius:22px;}
  .eli-list{padding:16px;gap:12px;}
  .eli{min-height:72px;padding:15px 18px 15px 20px;border-radius:14px;}
  .eli-av{width:40px;height:40px;border-radius:11px;font-size:12px;}
  .eli-name{font-size:14.5px;}
  .eli-meta{font-size:12px;}
  .all-record-card .eli-row{min-height:40px;}
  .all-record-card .eli-av{width:36px;height:36px;flex-basis:36px;}
  .all-record-card .eli-chips{margin-left:50px;}
  .assessment-layout{grid-template-columns:440px minmax(0,1fr);}
  .assessment-sidebar{padding:22px 18px;}
  .sidebar-avatar,
  .eval-form-av{width:48px;height:48px;border-radius:14px;font-size:13px;}
  .sidebar-employee-name{font-size:15.5px;}
  .sidebar-employee-desc{font-size:12.5px;}
  .sidebar-domain{padding:15px;border-radius:14px;}
  .sidebar-domain.active{padding-left:12px;}
  .sidebar-domain-title{font-size:12.5px;}
  .sidebar-domain-progress{font-size:11.5px;}
  .sidebar-card{padding:15px;border-radius:14px;}
  .sidebar-card-title{font-size:11px;}
  .sidebar-scale-item strong{font-size:12.5px;}
  .sidebar-scale-item small{font-size:11.5px;}
  .assessment-content-header{padding:20px 26px;}
  .assessment-content-title h3{font-size:18px;}
  .assessment-content-title p{font-size:12.5px;}
  .assessment-content .modal-body-scroll{padding:22px 26px 26px;}
  .theme-hd{padding:14px 18px;border-radius:14px;}
  .theme-badge{font-size:14px;}
  .theme-desc{font-size:12.5px;}
  .indicator-list{gap:10px;}
  .indicator-row{grid-template-columns:28px minmax(0,1fr) auto;gap:16px;padding:15px 18px;border-radius:12px;}
  .ind-num{width:26px;height:26px;font-size:11px;}
  .ind-text{font-size:13.5px;}
  .ind-rating{grid-template-columns:repeat(4,42px);gap:8px;}
  .rating-btn{width:42px;height:42px;border-radius:11px;font-size:14px;}
  .eval-form-footer{padding:14px 26px;}
}

@media (min-width: 2800px) {
  .eval-page{font-size:15px;}
  .eval-tp-shell{height:calc(100vh - 190px);min-height:900px;}
  .eval-tp-left{flex-basis:clamp(268px, 34%, 720px);}
  .assessment-layout{grid-template-columns:500px minmax(0,1fr);}
  .eli{min-height:78px;}
  .eli-name{font-size:15.5px;}
  .eli-meta{font-size:13px;}
  .assessment-content-title h3{font-size:20px;}
  .assessment-content-title p{font-size:13px;}
  .ind-text{font-size:14.5px;}
  .ind-rating{grid-template-columns:repeat(4,46px);}
  .rating-btn{width:46px;height:46px;font-size:15px;}
}

@media (max-width: 1440px) {
  .assessment-layout{grid-template-columns:300px minmax(0,1fr);}
}

@media (max-width: 1280px) {
  .page-hd{grid-template-columns:1fr;}
  .page-hd-side{justify-content:flex-start;flex-wrap:wrap;}
  .domain-bar{overflow-x:auto;max-width:100%;}
  .assessment-layout{grid-template-columns:260px minmax(0,1fr);}
}

@media (max-width: 1120px) {
  .domain-item{width:118px;}
  .domain-label{font-size:9.5px;}
  .eval-form-hd{align-items:flex-start;}
  .eval-form-hd-main{min-width:0;}
  .eli-name{font-size:12.5px;}
  .eli-meta{font-size:10.5px;}
  .assessment-layout{grid-template-columns:1fr;overflow:visible;}
  .assessment-sidebar{border-right:0;border-bottom:1px solid #E2E8F0;overflow:visible;}
  .sidebar-domains{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
  .assessment-content{overflow-y:visible;}
  .eval-tp-right{max-height:none;overflow:visible;}
}

@media (max-width: 980px) {
  .eval-page{min-height:auto;}
  .content-card{overflow:visible;}
  .eval-tp-shell{flex-direction:column;height:auto;min-height:0;overflow:visible;}
  /* Shell is flex-direction:column here, so a flex-basis would be read as a
     HEIGHT. Reset to auto so the panel sizes to its content when stacked. */
  .eval-tp-left{flex:0 0 auto;width:100%;max-height:none;border-right:0;border-bottom:1px solid #E2E8F0;overflow:visible;}
  .eval-tp-right{max-height:none;overflow:visible;}
  .eli-list{flex:none;overflow:visible;}
  .assessment-layout{height:auto;min-height:0;overflow:visible;}
  .assessment-content{overflow:visible;}
  .assessment-content .modal-body-scroll{overflow:visible;}
  .conduct-preview{grid-template-columns:repeat(2,minmax(0,1fr));}
  /* .jf-row is flex so this works; .indicator-row is a GRID, where
     flex-direction is inert - it is handled in the 640px block below. */
  .jf-row{align-items:stretch;flex-direction:column;}
  .ind-rating{align-self:flex-end;}
}

@media (max-width: 720px) {
  .sidebar-domains{grid-template-columns:1fr;}
  .indicator-row{grid-template-columns:24px minmax(0,1fr);}
  .ind-rating{grid-column:2;justify-content:start;margin-top:6px;align-self:auto;}
  .jf-row{display:grid;grid-template-columns:24px minmax(0,1fr);align-items:start;}
  .jf-row .jf-info{grid-column:2;}
  .jf-row .ind-rating{grid-column:2;}
  .eval-form-footer{align-items:stretch;flex-direction:column;}
  .eval-footer-progress{margin-right:0;}
}

/* ── Mobile: keep the Submit Ratings button reachable ──
   position:sticky needs a scrolling ancestor with a definite height. At <=980px
   the shell, the right column and the scroll body are all set to height:auto /
   overflow:visible, so sticky had nothing to stick to and the footer fell to the
   very bottom of a very long document - a rater had to scroll past all 25
   questions to find Submit. Pin it to the viewport instead. */
@media (max-width: 980px) {
  .eval-form-footer{
    position:fixed;left:0;right:0;bottom:0;
    z-index:60;border-top:1px solid #E2E8F0;
    padding:10px 14px calc(10px + env(safe-area-inset-bottom));
    background:rgba(255,255,255,.98);
    box-shadow:0 -4px 18px rgba(15,23,42,.12);
    flex-direction:row;align-items:center;gap:10px;
  }
  .eval-footer-progress{margin-right:auto;}
  .eval-form-footer .btn{flex:1 1 auto;min-height:44px;justify-content:center;}
  .eval-footer-count{white-space:nowrap;}
  /* Clearance so the last question is not hidden behind the fixed bar. */
  .assessment-content .modal-body-scroll{padding-bottom:88px;}
}

/* Fix All Assessments filters overflowing the left panel */
.eval-tp-left {
  overflow-x: hidden;
}

/* Arrange the status tabs and filters in separate rows */
.eval-tp-left .filter-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  gap: 10px;
  box-sizing: border-box;
}

/* Status buttons */
.eval-tp-left .status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  width: 100%;
  min-width: 0;
}

/* Search and division filter row.
   flex:0 0 auto is load-bearing: .filter-bar is a COLUMN here, so the base
   rule's `flex:1 1 300px` would be read as a 300px height basis with grow -
   which stretched this grid to 300px and pushed its two rows 153px apart.
   align-content:start then keeps the rows packed at their natural height. */
.eval-tp-left .filter-right {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  align-content: start;
  flex: 0 0 auto;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

/* Prevent the search wrapper from forcing extra width */
.eval-tp-left .srch-wrap {
  width: 100%;
  min-width: 0;
}

/* Search input fills only its available grid space */
.eval-tp-left .srch-inp {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* Division select stays inside the left panel */
.eval-tp-left .filter-right .filter-select {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .eval-tp-left .filter-right {
    grid-template-columns: 1fr;
  }
}

/* ════════════════════════ PHONE ════════════════════════
   Below 640px the four rating buttons cannot sit beside the question text -
   they would leave roughly 150px for a two-line sentence. The row becomes a
   two-line grid instead, with the buttons on their own full-width line and
   sized to a 44px touch target. */
@media (max-width: 640px) {
  .content-card{padding:10px 8px;}
  .eval-tp-shell{border-radius:12px;}

  .assessment-content-header{padding:12px 14px;flex-wrap:wrap;gap:10px;}
  .assessment-content-title h3{font-size:15px;}
  .assessment-content-title p{font-size:11.5px;}
  .assessment-content-actions{width:100%;justify-content:space-between;}

  .score-summary-bar{padding:12px 12px;gap:6px;}
  /* The bottom value is clearance for the fixed footer. It must be repeated here
     because this shorthand comes later in the file than the <=980px rule and
     would otherwise reset padding-bottom, letting the bar cover the last
     question. */
  .assessment-content .modal-body-scroll{padding:14px 12px 104px;}

  /* Question number and text on line 1, ratings full-width on line 2. */
  .indicator-row{
    grid-template-columns:24px minmax(0,1fr);
    grid-template-areas:"num text" "rating rating";
    row-gap:12px;padding:14px 12px;
  }
  .ind-num{grid-area:num;}
  .ind-text{grid-area:text;font-size:13px;}
  .ind-rating{grid-area:rating;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;justify-content:stretch;width:100%;}
  .rating-btn{width:100%;height:44px;font-size:15px;}

  .jf-row{padding:14px 12px;}
  .jf-row .ind-rating{width:100%;}

  /* Manual FPO entry stacks; the input keeps a comfortable tap height. */
  .fpo-manual-panel{padding:14px 12px;}
  .fpo-manual-row{grid-template-columns:1fr;grid-template-areas:"label" "input" "help" "result" "status";}
  .fpo-manual-result{justify-content:flex-start;}
  .fpo-manual-status{justify-content:flex-start;}
  .fpo-manual-field{font-size:18px;padding:11px 0;}
  .fpo-panel{grid-template-columns:1fr;}

  .rater-row{gap:10px;}
  .rater-select{flex:1 1 100%;max-width:none;}
  .has-sub-note{flex:1 1 100%;}

  .theme-hd{flex-wrap:wrap;gap:8px;}
  .view-tabs{padding:0 8px;gap:6px;}
  .view-tab{height:38px;font-size:12px;}
  /* No flex-basis override here. It used to force the action button onto a row
     of its own on small screens, which paired with its old flex:2 to make it
     the odd one out. All four tabs are the same width now at every breakpoint. */
  .eli-list{padding:8px;gap:8px;}
  .eval-tp-left .tasks-period-bar,
  .eval-tp-left .filter-bar{padding:12px 10px;}
}
</style>
