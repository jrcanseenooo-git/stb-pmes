<template>
  <div class="ipcrf-page">

    <!-- Content card -->
    <div class="content-card">

    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">IPCRF / CCEF Forms</h2>
        <p class="page-sub">Individual Performance Commitment and Review Forms</p>
      </div>
      <button v-if="canSelfServe" class="btn btn-primary" @click="showNewFormModal = true">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        New Form
      </button>
    </div>

    <!-- Self-service Generate Targets/Ratings -->
    <div v-if="canSelfServe" class="generate-bar">
      <div class="generate-period">
        <label class="field-label">Semester</label>
        <select v-model="periodSemester" class="filter-select">
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
        </select>
        <label class="field-label">Year</label>
        <input v-model.number="periodYear" type="number" class="filter-select" style="width:80px"/>
      </div>
      <div class="generate-actions">
        <div class="generate-item">
          <template v-if="periodStatusInfo?.hasTargetsDoc">
            <a :href="periodStatusInfo.docFileUrl" target="_blank" class="btn btn-sm btn-active-ok">Open Targets Sheet</a>
          </template>
          <button v-else class="btn btn-sm" :disabled="!!periodBusy" @click="doPeriodGenerate('targets')">
            {{ periodBusy === 'targets' ? 'Checking…' : `Generate ${myFormType} Targets` }}
          </button>
          <span v-if="periodStatusLoading" class="generate-hint">Checking…</span>
          <span v-else-if="periodStatusInfo?.hasTargetsDoc" class="generate-hint generate-hint-ok">✓ Generated — {{ periodStatusInfo.formStatus }}</span>
          <span v-else-if="periodStatusInfo?.hasForm" class="generate-hint">Form exists — doc not generated yet</span>
          <span v-else-if="periodStatusInfo" class="generate-hint">Not created yet for this period</span>
        </div>
        <div class="generate-item">
          <template v-if="periodStatusInfo?.hasRatingsDoc">
            <a :href="periodStatusInfo.docFileUrl" target="_blank" class="btn btn-sm btn-active-ok">Open Ratings Sheet</a>
          </template>
          <button v-else class="btn btn-primary btn-sm" :disabled="!!periodBusy" @click="doPeriodGenerate('ratings')">
            {{ periodBusy === 'ratings' ? 'Checking…' : `Generate ${myFormType} Ratings` }}
          </button>
          <span v-if="periodStatusLoading" class="generate-hint">Checking…</span>
          <span v-else-if="periodStatusInfo?.hasRatingsDoc" class="generate-hint generate-hint-ok">✓ Generated</span>
          <span v-else-if="periodStatusInfo?.hasForm && periodStatusInfo.ratingsReady" class="generate-hint generate-hint-ok">Ready — accomplishments approved</span>
          <span v-else-if="periodStatusInfo?.hasForm && periodStatusInfo.totalEntries > 0" class="generate-hint generate-hint-warn">{{ periodStatusInfo.readyEntries }}/{{ periodStatusInfo.totalEntries }} accomplishments approved</span>
          <span v-else-if="periodStatusInfo?.hasForm" class="generate-hint">No indicators added yet</span>
          <span v-else-if="periodStatusInfo" class="generate-hint">Create Targets first</span>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="status-tabs">
        <button v-for="t in statusTabs" :key="t.value"
          :class="['status-tab', activeStatus === t.value && 'active']"
          @click="activeStatus = t.value">
          {{ t.label }}
          <span v-if="t.value !== 'All' && countByStatus(t.value)" class="tab-badge">{{ countByStatus(t.value) }}</span>
        </button>
      </div>
      <div class="filter-selects">
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="IPCRF">IPCRF</option>
          <option value="CCEF">CCEF</option>
        </select>
        <select v-model="filterSemester" class="filter-select">
          <option value="">All Semesters</option>
          <option value="1">Semester 1</option>
          <option value="2">Semester 2</option>
        </select>
      </div>
    </div>

    <!-- Skeleton loading -->
    <div v-if="loading" class="forms-grid">
      <div v-for="i in 4" :key="'sk'+i" class="fc fc-sk">
        <div class="fc-hd"><div class="sk-badge"></div><div class="sk-line" style="width:55px"></div></div>
        <div class="sk-line" style="width:75%;margin-bottom:5px"></div>
        <div class="sk-line" style="width:50%;margin-bottom:14px"></div>
        <div class="sk-line" style="width:100%;height:30px;border-radius:8px"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!filteredForms.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">{{ activeStatus !== 'All' ? `No ${activeStatus.toLowerCase()} forms` : 'No forms yet' }}</p>
      <p class="empty-sub">{{ activeStatus !== 'All' ? 'Try a different filter.' : 'Create your first IPCRF or CCEF form.' }}</p>
      <button v-if="activeStatus === 'All' && canSelfServe" class="btn btn-primary" @click="showNewFormModal = true">Create New Form</button>
    </div>

    <!-- Forms grid -->
    <div v-else class="forms-grid">
      <div
        v-for="form in filteredForms" :key="form.id"
        class="fc"
        @click="openFormModal(form)"
      >
        <!-- Header: type badge + period -->
        <div class="fc-hd">
          <span :class="['type-badge', form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">{{ form.type }}</span>
          <span class="fc-period">S{{ form.semester }} {{ form.year }}</span>
        </div>

        <!-- Employee -->
        <div class="fc-name">{{ form.employeeName }}</div>
        <div class="fc-sub">{{ form.divisionName || '—' }}</div>
        <!-- <div class="fc-sub">{{ form.divisionName || '—' }}<span v-if="form.sectionName"> · {{ form.sectionName }}</span></div> -->

        <!-- Status + rating -->
        <div class="fc-mid">
          <span :class="['status-badge', statusClass(form.status)]">{{ form.status }}</span>
          <div v-if="form.finalNumericalRating" class="fc-score">
            <span class="fc-score-val">{{ form.finalNumericalRating }}</span>
            <span class="fc-score-lbl">{{ form.adjectivalRating }}</span>
          </div>
        </div>

        <!-- Footer: date + actions -->
        <div class="fc-foot" @click.stop>
          <span class="fc-date">{{ fmtDate(form.updatedAt || form.createdAt) }}</span>
          <div class="fc-actions">
            <button v-if="form.status === 'Draft' || form.status === 'Returned'"
              class="btn btn-xs btn-outline" @click.stop="quickSubmit(form)">Submit</button>
            <button v-if="form.status === 'Submitted' && canApprove"
              class="btn btn-xs btn-success" @click.stop="quickApprove(form)">Approve</button>
            <button v-if="form.status === 'Submitted' && canApprove"
              class="btn btn-xs btn-warn" @click.stop="quickReturn(form)">Return</button>
            <button v-if="form.status === 'Submitted' && canApprove"
              class="btn btn-xs btn-info" @click.stop="openFormModal(form)" title="Open" aria-label="Open">View</button>
          </div>
        </div>
      </div>
    </div>

    </div>
    <!-- /Content card -->

    <!-- ══════════════════════════════════
         FORM DETAIL MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal-xl">

          <!-- Header -->
          <div class="dh">
            <div class="dh-info">
              <div class="dh-badges">
                <span :class="['type-badge', activeForm?.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">{{ activeForm?.type }}</span>
                <span :class="['status-badge', statusClass(activeForm?.status)]">{{ activeForm?.status }}</span>
              </div>
              <div class="dh-name">{{ activeForm?.employeeName }}</div>
              <div class="dh-sub">S{{ activeForm?.semester }} {{ activeForm?.year }} · {{ activeForm?.divisionName }}</div>
            </div>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="dtabs">
            <button :class="['dtab', activeTab === 'indicators' && 'active']" @click="activeTab = 'indicators'">
              Indicators <span v-if="allEntries.length" class="dtab-cnt">{{ allEntries.length }}</span>
            </button>
            <button :class="['dtab', activeTab === 'details' && 'active']" @click="activeTab = 'details'">Details</button>
            <button :class="['dtab', activeTab === 'score' && 'active']" @click="activeTab = 'score'">Score</button>
          </div>

          <!-- Loading -->
          <div v-if="entriesLoading" class="loading-state">
            <div class="spinner-sm2"></div>
            <span class="muted-text">Loading indicators…</span>
          </div>

          <!-- INDICATORS TAB -->
          <div v-else-if="activeTab === 'indicators'" class="modal-body-scroll">

            <!-- Core Functions -->
            <div class="fn-section fn-core">
              <div class="fn-hd">
                <div class="fn-hd-l">
                  <span class="fn-label">Core Functions</span>
                  <span class="fn-wt fn-wt-core">{{ activeForm?.coreFunctionWeight }}%</span>
                  <span class="fn-cnt">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="fn-hd-r">
                  <button class="add-pill" @click="openLibrary('Core')">+ From Library</button>
                  <button class="add-pill add-pill-ghost" @click="openCustomEntry('Core')">+ Custom</button>
                </div>
              </div>
              <div v-if="!coreEntries.length" class="fn-empty">No core indicators added yet</div>
              <div v-else class="ind-list">
                <div v-for="e in coreEntries" :key="e.id" class="ind-card ind-card-core">
                  <div class="ind-card-hd">
                    <span class="ind-kra ind-kra-core">{{ e.kraName }}</span>
                    <div class="ind-acts">
                      <button class="act" @click.stop="openEditEntry(e)" title="Edit">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <button class="act act-del" @click.stop="askDelete(e)" title="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="ind-si">{{ e.successIndicator }}</div>
                  <div class="ind-tags">
                    <span class="etag">Wt: {{ e.weight }}%</span>
                    <span class="etag">{{ e.applicableRatingPeriod }}</span>
                    <span class="etag">{{ e.classification }}</span>
                    <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                    <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                  </div>
                  <div v-if="e.meansOfVerification" class="ind-mov">
                    <span class="ind-mov-lbl">MOV:</span> {{ e.meansOfVerification }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Support Functions -->
            <div class="fn-section fn-support">
              <div class="fn-hd">
                <div class="fn-hd-l">
                  <span class="fn-label">Support Functions</span>
                  <span class="fn-wt fn-wt-support">{{ activeForm?.supportFunctionWeight }}%</span>
                  <span class="fn-cnt">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="fn-hd-r">
                  <button class="add-pill" @click="openLibrary('Support')">+ From Library</button>
                  <button class="add-pill add-pill-ghost" @click="openCustomEntry('Support')">+ Custom</button>
                </div>
              </div>
              <div v-if="!supportEntries.length" class="fn-empty">No support indicators added yet</div>
              <div v-else class="ind-list">
                <div v-for="e in supportEntries" :key="e.id" class="ind-card ind-card-support">
                  <div class="ind-card-hd">
                    <span class="ind-kra ind-kra-support">{{ e.kraName }}</span>
                    <div class="ind-acts">
                      <button class="act" @click.stop="openEditEntry(e)" title="Edit">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <button class="act act-del" @click.stop="askDelete(e)" title="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="ind-si">{{ e.successIndicator }}</div>
                  <div class="ind-tags">
                    <span class="etag">Wt: {{ e.weight }}%</span>
                    <span class="etag">{{ e.applicableRatingPeriod }}</span>
                    <span class="etag">{{ e.classification }}</span>
                    <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                    <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                  </div>
                  <div v-if="e.meansOfVerification" class="ind-mov">
                    <span class="ind-mov-lbl">MOV:</span> {{ e.meansOfVerification }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Workflow bar -->
            <div v-if="['Draft', 'Returned'].includes(activeForm?.status)" class="wf-bar">
              <span class="wf-info">{{ allEntries.length }} indicator{{ allEntries.length !== 1 ? 's' : '' }}</span>
              <button class="btn btn-primary btn-sm" @click="doSubmit">Submit for Review</button>
            </div>
            <div v-else-if="activeForm?.status === 'Submitted'" class="wf-bar">
              <span class="wf-info">Pending review</span>
              <div style="display:flex;gap:8px">
                <button class="btn btn-success btn-sm" @click="doApprove">Approve</button>
                <button class="btn btn-warn btn-sm" @click="doReturn">Return</button>
              </div>
            </div>

            <!-- Targets document generation -->
            <div class="docgen-bar">
              <div class="docgen-info">
                <span class="docgen-label">Targets Document</span>
                <span class="docgen-sub">Generates the official Annex F.1 form from these indicators</span>
              </div>
              <div class="docgen-actions">
                <template v-if="docGen.targets">
                  <a :href="docGen.targets.fileUrl" target="_blank" class="btn btn-sm btn-outline">Open Targets Sheet</a>
                  <button class="btn btn-sm" :disabled="docGen.printing" @click="doPrint(docGen.targets.fileId, 'Targets')">{{ docGen.printing ? 'Preparing…' : 'Print' }}</button>
                  <button class="btn-link" :disabled="docGen.generating === 'targets'" @click="doGenerateTargets">{{ docGen.generating === 'targets' ? 'Regenerating…' : 'Regenerate' }}</button>
                </template>
                <button v-else class="btn btn-primary btn-sm" :disabled="docGen.generating === 'targets'" @click="doGenerateTargets">
                  {{ docGen.generating === 'targets' ? 'Generating…' : 'Generate Targets Doc' }}
                </button>
              </div>
            </div>
          </div>

          <!-- DETAILS TAB -->
          <div v-else-if="activeTab === 'details'" class="modal-body-scroll">
            <div class="det-2col">
              <div>
                <div class="det-st">Period & Role</div>
                <div class="det-row"><span class="dk">Form Type</span><span class="dv">{{ activeForm?.type }}</span></div>
                <div class="det-row"><span class="dk">Semester / Year</span><span class="dv">S{{ activeForm?.semester }}, {{ activeForm?.year }}</span></div>
                <!-- <div class="det-row"><span class="dk">Position Level</span><span class="dv">{{ activeForm?.positionLevel || '—' }}</span></div> -->
                <div class="det-row"><span class="dk">Division</span><span class="dv">{{ activeForm?.divisionName || '—' }}</span></div>
                <div class="det-row"><span class="dk">Section</span><span class="dv">{{ activeForm?.sectionName || '—' }}</span></div>
                <div class="det-st" style="margin-top:16px">Weights</div>
                <div class="weights-bar">
                  <div class="wb-c" :style="{ width: activeForm?.coreFunctionWeight + '%' }">Core {{ activeForm?.coreFunctionWeight }}%</div>
                  <div class="wb-s" :style="{ width: activeForm?.supportFunctionWeight + '%' }">Support {{ activeForm?.supportFunctionWeight }}%</div>
                </div>
                <div class="det-st" style="margin-top:16px">Timeline</div>
                <div class="det-row"><span class="dk">Created</span><span class="dv">{{ fmtDate(activeForm?.createdAt) || '—' }}</span></div>
                <div class="det-row"><span class="dk">Submitted</span><span class="dv">{{ fmtDate(activeForm?.submittedAt) || '—' }}</span></div>
                <div class="det-row"><span class="dk">Approved</span><span class="dv">{{ fmtDate(activeForm?.approvedAt) || '—' }}</span></div>
              </div>
              <div>
                <div class="det-st">Signatories</div>
                <div class="det-row"><span class="dk">Supervisor</span><span class="dv">{{ activeForm?.immediateSupervisor || '—' }}</span></div>
                <div class="det-row"><span class="dk">Supervisor Position</span><span class="dv">{{ activeForm?.supervisorPosition || '—' }}</span></div>
                <div class="det-row"><span class="dk">Approving Authority</span><span class="dv">{{ activeForm?.approvingAuthority || '—' }}</span></div>
                <div class="det-row"><span class="dk">Authority Position</span><span class="dv">{{ activeForm?.authorityPosition || '—' }}</span></div>
              </div>
            </div>
          </div>

          <!-- SCORE TAB -->
          <div v-else-if="activeTab === 'score'" class="modal-body-scroll">
            <div v-if="!activeForm?.finalNumericalRating" class="score-empty">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="#E2E8F0" stroke-width="2"/>
                <path d="M20 12v8l5 3" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <p class="muted-text">Score not yet computed</p>
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
                    <span :class="['st-fn', e.functionType === 'Core' ? 'fn-c' : 'fn-s']">{{ e.functionType[0] }}</span>
                    <span class="st-name">{{ e.kraName }}</span>
                  </div>
                  <span :class="['st-val', e.ratingAverage ? '' : 'muted-text']">{{ e.ratingAverage || '—' }}</span>
                </div>
              </div>
              <button class="btn btn-sm" style="margin-top:14px" @click="doCompute">Recompute</button>

              <!-- Rate / Finalize workflow -->
              <div v-if="activeForm?.status === 'Approved'" class="rate-panel">
                <div class="det-st" style="text-align:left">Feedback (Part II)</div>
                <div class="form-grid" style="text-align:left">
                  <div class="field full">
                    <label class="field-label">Strengths</label>
                    <textarea v-model="feedbackForm.feedbackStrengths" class="field-input" rows="2" placeholder="What the ratee does well…"></textarea>
                  </div>
                  <div class="field full">
                    <label class="field-label">Rater's Comments &amp; Recommendations</label>
                    <textarea v-model="feedbackForm.feedbackComments" class="field-input" rows="2" placeholder="Comments, recommendations, commendations…"></textarea>
                  </div>
                  <div class="field full">
                    <label class="field-label">Areas for Improvement</label>
                    <textarea v-model="feedbackForm.feedbackAreasForImprovement" class="field-input" rows="2" placeholder="Development needs…"></textarea>
                  </div>
                </div>
                <button v-if="canApprove" class="btn btn-primary btn-sm" style="margin-top:10px" :disabled="ratingBusy" @click="doMarkRated">
                  {{ ratingBusy ? 'Saving…' : 'Mark as Rated' }}
                </button>
                <p v-else class="muted-text" style="margin-top:10px;font-size:11px">Only the rater/approver can mark this form as Rated.</p>
              </div>

              <div v-else-if="activeForm?.status === 'Rated'" class="rate-panel">
                <div class="det-st" style="text-align:left">Sign-off Dates</div>
                <div class="form-grid" style="text-align:left">
                  <div class="field">
                    <label class="field-label">Ratee Signed</label>
                    <input v-model="finalizeForm.dateSignedRatee" type="text" class="field-input" placeholder="e.g. 17 March 2026"/>
                  </div>
                  <div class="field">
                    <label class="field-label">Supervisor Signed</label>
                    <input v-model="finalizeForm.dateSignedSupervisor" type="text" class="field-input" placeholder="e.g. 17 March 2026"/>
                  </div>
                  <div class="field">
                    <label class="field-label">Authority Signed</label>
                    <input v-model="finalizeForm.dateSignedAuthority" type="text" class="field-input" placeholder="e.g. 17 March 2026"/>
                  </div>
                </div>
                <button v-if="canFinalize" class="btn btn-primary btn-sm" style="margin-top:10px" :disabled="ratingBusy" @click="doFinalize">
                  {{ ratingBusy ? 'Saving…' : 'Finalize' }}
                </button>
                <p v-else class="muted-text" style="margin-top:10px;font-size:11px">Only an Administrator/Director can finalize this form.</p>
              </div>

              <!-- Ratings document generation -->
              <div class="docgen-bar" style="margin-top:18px;text-align:left">
                <div class="docgen-info">
                  <span class="docgen-label">Ratings Document</span>
                  <span class="docgen-sub">Adds the official Annex F.2 tab to the same Targets file</span>
                </div>
                <div class="docgen-actions">
                  <template v-if="docGen.ratings">
                    <a :href="docGen.ratings.fileUrl" target="_blank" class="btn btn-sm btn-outline">Open Ratings Sheet</a>
                    <button class="btn btn-sm" :disabled="docGen.printing" @click="doPrint(docGen.ratings.fileId, 'Ratings')">{{ docGen.printing ? 'Preparing…' : 'Print' }}</button>
                    <button class="btn-link" :disabled="docGen.generating === 'ratings'" @click="doGenerateRatings">{{ docGen.generating === 'ratings' ? 'Regenerating…' : 'Regenerate' }}</button>
                  </template>
                  <button v-else class="btn btn-primary btn-sm" :disabled="docGen.generating === 'ratings'" @click="doGenerateRatings">
                    {{ docGen.generating === 'ratings' ? 'Generating…' : 'Generate Ratings Doc' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         KRA LIBRARY MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibrary" class="modal-overlay" @click.self="cancelLibrary">
        <div class="modal modal-lib">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">KRA Library
                <span :class="['type-badge ml6', currentFnType === 'Core' ? 'type-ipcrf' : 'type-ccef']" style="font-size:10px">{{ currentFnType }}</span>
              </h3>
              <p class="modal-sub">Select indicators then click <strong>Review Selection</strong></p>
            </div>
            <button class="modal-close" @click="cancelLibrary">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="lib-filters">
            <div class="srch-wrap">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon">
                <circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/>
                <path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <input v-model="libSearch" type="text" class="srch-inp" placeholder="Search KRA or indicator…"/>
            </div>
            <select v-model="libPhase" class="field-input" style="width:140px">
              <option value="">All Phases</option>
              <option v-for="p in PHASES" :key="p" :value="p">{{ p }}</option>
            </select>
            <select v-model="libClass" class="field-input" style="width:140px">
              <option value="">All Types</option>
              <option value="Simple">Simple</option>
              <option value="Complex">Complex</option>
              <option value="Highly Technical">Highly Technical</option>
              <option value="Exempted">Exempted</option>
            </select>
          </div>
          <div v-if="libSelected.length" class="sel-strip">
            <span class="sel-cnt">{{ libSelected.length }} selected</span>
            <button class="sel-clr" @click="libSelected = []">Clear all</button>
          </div>
          <div class="lib-scroll">
            <div v-if="libLoading" class="state-wrap"><div class="spinner"></div></div>
            <div v-else-if="!filteredLibrary.length" class="state-wrap"><p class="muted-text">No matching indicators</p></div>
            <div v-else class="lib-list">
              <div v-for="item in filteredLibrary" :key="item.id"
                :class="['lib-item', isSelected(item) && 'lib-sel']"
                @click="toggleSelect(item)">
                <div :class="['chk', isSelected(item) && 'chk-on']">
                  <svg v-if="isSelected(item)" width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5l2 2L7.5 2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
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
                  <div v-if="item.meansOfVerification" class="lib-mov">
                    <span class="lib-mov-lbl">MOV:</span> {{ item.meansOfVerification }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="justify-content:space-between">
            <span class="muted-text" style="font-size:11px">{{ filteredLibrary.length }} result{{ filteredLibrary.length !== 1 ? 's' : '' }}</span>
            <div style="display:flex;gap:8px">
              <button class="btn" @click="cancelLibrary">Cancel</button>
              <button class="btn btn-primary" :disabled="!libSelected.length" @click="showLibConfirm = true">
                Review Selection ({{ libSelected.length }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         CONFIRM SELECTION MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibConfirm" class="modal-overlay">
        <div class="modal modal-confirm">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">Confirm — {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}</h3>
              <p class="modal-sub">Review carefully. Click ← Back to adjust.</p>
            </div>
          </div>
          <div class="confirm-scroll">
            <div v-for="(item, idx) in libSelected" :key="item.id" class="ci">
              <div class="ci-num">{{ idx + 1 }}</div>
              <div class="ci-body">
                <div class="ci-header">
                  <span class="ci-kra">{{ item.kraName }}</span>
                  <div class="ci-tags">
                    <span class="etag">{{ item.phase }}</span>
                    <span class="etag">Weight: {{ posWeight(item) }}%</span>
                    <span :class="['etag', item.classification !== 'Simple' ? 'etag-blue' : '']">{{ item.classification }}</span>
                    <span :class="['type-badge', currentFnType === 'Core' ? 'type-ipcrf' : 'type-ccef']" style="font-size:9px;padding:1px 6px">{{ currentFnType }}</span>
                  </div>
                </div>
                <div class="ci-label">Performance Indicator</div>
                <div class="ci-pi">{{ item.performanceIndicator || item.successIndicator || '' }}</div>
                <div v-if="item.meansOfVerification" class="ci-mov-wrap">
                  <div class="ci-label">Means of Verification</div>
                  <div class="ci-mov">{{ item.meansOfVerification }}</div>
                </div>
              </div>
              <button class="ci-rm" @click="libSelected.splice(idx, 1)">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1 1l11 11M12 1L1 12" stroke="#94A3B8" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showLibConfirm = false">← Back to Library</button>
            <button class="btn btn-primary" :disabled="!libSelected.length" @click="commitSelection">
              Confirm & Add {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         FULLSCREEN PROGRESS LOCK
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="addProg.active" class="fullscreen-lock">
        <div class="lock-box">
          <div class="lock-spin"></div>
          <div class="lock-title">Saving Indicators…</div>
          <div class="lock-items">
            <div v-for="(item, i) in addProg.items" :key="i"
              :class="['lock-item', addProg.current > i ? 'done' : addProg.current === i ? 'active' : '']">
              <span :class="['lock-item-icon', addProg.current > i ? 'icon-done' : addProg.current === i ? 'icon-active' : 'icon-wait']">
                <svg v-if="addProg.current > i" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div v-else-if="addProg.current === i" class="mini-spin"></div>
                <span v-else class="dot-wait"></span>
              </span>
              <span class="lock-item-name">{{ item.kraName }}</span>
            </div>
          </div>
          <div class="prog-track"><div class="prog-fill" :style="{ width: addProg.pct + '%' }"></div></div>
          <div class="lock-hint">{{ addProg.current }} of {{ addProg.total }} saved — please wait</div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         NEW FORM MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showNewFormModal" class="modal-overlay" @click.self="showNewFormModal = false">
        <div class="modal" style="max-width:500px">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <path d="M13 1v4M15 3h-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">New Performance Form</h3>
              <p class="modal-sub">IPCRF or CCEF for this semester</p>
            </div>
            <button class="modal-close" @click="showNewFormModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Form Type <span class="req">*</span></label>
                <div class="type-toggle type-toggle-single">
                  <div v-if="myFormType === 'IPCRF'" class="type-opt active type-opt-locked">
                    <strong>IPCRF</strong>
                    <span>Individual Performance Commitment &amp; Review Form</span>
                  </div>
                  <div v-else class="type-opt active type-opt-locked">
                    <strong>CCEF</strong>
                    <span>Contractor Commitment Evaluation Form</span>
                  </div>
                </div>
                <p class="type-auto-hint">Set automatically based on your Employment Type ({{ authStore.employmentType || 'Regular' }})</p>
              </div>
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="newForm.semester" class="field-input">
                  <option value="1">1st Semester (Jan–Jun)</option>
                  <option value="2">2nd Semester (Jul–Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year</label>
                <input v-model.number="newForm.year" type="number" class="field-input"/>
              </div>
            </div>
            <div class="field-label" style="margin:14px 0 10px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8">Signatories</div>
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Immediate Supervisor</label>
                <input v-model="newForm.immediateSupervisor" type="text" class="field-input" placeholder="Full name"/>
              </div>
              <div class="field full">
                <label class="field-label">Supervisor Position</label>
                <input v-model="newForm.supervisorPosition" type="text" class="field-input" placeholder="e.g. Division Chief / SWO V"/>
              </div>
              <div class="field full">
                <label class="field-label">Approving Authority</label>
                <input v-model="newForm.approvingAuthority" type="text" class="field-input" placeholder="Fullname"/>
              </div>
              <div class="field full">
                <label class="field-label">Authority Position</label>
                <input v-model="newForm.authorityPosition" type="text" class="field-input" placeholder="e.g. Director IV"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showNewFormModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="creating" @click="createForm">
              <span v-if="creating" class="spinner-sm"></span>
              {{ creating ? 'Creating…' : 'Create Form' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         CUSTOM / EDIT ENTRY MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showEntryModal" class="modal-overlay" @click.self="closeEntry">
        <div class="modal" style="max-width:480px">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">{{ editingEntry ? 'Edit Indicator' : 'Custom Indicator' }}</h3>
              <p class="modal-sub">
                <span :class="['type-badge', currentFnType === 'Core' ? 'type-ipcrf' : 'type-ccef']" style="font-size:10px">{{ currentFnType }}</span>
              </p>
            </div>
            <button class="modal-close" @click="closeEntry">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="entryForm.kraName" type="text" class="field-input" placeholder="e.g. Research"/>
              </div>
              <div class="field full">
                <label class="field-label">Success Indicator <span class="req">*</span></label>
                <textarea v-model="entryForm.successIndicator" class="field-input" rows="3" placeholder="Describe the specific target output…"></textarea>
              </div>
              <div class="field">
                <label class="field-label">Weight (%)</label>
                <input v-model.number="entryForm.weight" type="number" class="field-input" min="0" max="100"/>
              </div>
              <div class="field">
                <label class="field-label">Classification</label>
                <select v-model="entryForm.classification" class="field-input">
                  <option>Simple</option>
                  <option>Complex</option>
                  <option>Highly Technical</option>
                  <option>Exempted</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Applicable Period</label>
                <select v-model="entryForm.applicableRatingPeriod" class="field-input">
                  <option>Both semesters</option>
                  <option>1st Semester</option>
                  <option>2nd Semester</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Means of Verification</label>
                <input v-model="entryForm.meansOfVerification" type="text" class="field-input" placeholder="e.g. Approved report with memo endorsement"/>
              </div>
            </div>
            <template v-if="editingEntry">
              <div class="field-label" style="margin:14px 0 10px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8">Rating</div>
              <div class="form-grid">
                <div class="field full">
                  <label class="field-label">Accomplishment</label>
                  <textarea v-model="entryForm.accomplishment" class="field-input" rows="2"></textarea>
                </div>
                <div class="field">
                  <label class="field-label">Efficiency <span class="muted-text">(1–5)</span></label>
                  <input v-model.number="entryForm.ratingEfficiency" type="number" class="field-input" min="1" max="5" step="0.01"/>
                </div>
                <div class="field">
                  <label class="field-label">Quality <span class="muted-text">(1–5)</span></label>
                  <input v-model.number="entryForm.ratingQuality" type="number" class="field-input" min="1" max="5" step="0.01"/>
                </div>
                <div class="field">
                  <label class="field-label">Timeliness <span class="muted-text">(1–5)</span></label>
                  <input v-model.number="entryForm.ratingTimeliness" type="number" class="field-input" min="1" max="5" step="0.01"/>
                </div>
                <div v-if="computedAvg" class="field">
                  <label class="field-label">Average</label>
                  <div class="field-input avg-box">{{ computedAvg }}</div>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeEntry">Cancel</button>
            <button class="btn btn-primary" :disabled="savingEntry" @click="saveEntry">
              {{ savingEntry ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Add Indicator') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Confirm Delete -->
    <teleport to="body">
      <div v-if="confirmDel.show" class="modal-overlay">
        <div class="confirm-box">
          <div class="cb-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M8 6V4h6v2M5 6v13a2 2 0 002 2h8a2 2 0 002-2V6" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="cb-title">Remove Indicator?</div>
          <div class="cb-msg">Remove <strong>{{ confirmDel.name }}</strong>?<br><span class="muted-text" style="font-size:11px">This cannot be undone.</span></div>
          <div class="cb-btns">
            <button class="btn" @click="confirmDel.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="deletingEntry" @click="doDelete">{{ deletingEntry ? 'Removing…' : 'Remove' }}</button>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi, docGenApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { useAuthStore } from '@/stores/auth'

const router    = useRouter()
const authStore = useAuthStore()

const PHASES = ['ANALYSIS', 'DESIGN', 'TESTING', 'PILOT IMPLEMENTATION', 'EVALUATION', 'SUPPORT', 'PROMOTION']

// ── State ──
const forms          = ref([])
const loading        = ref(false)
const entriesLoading = ref(false)
const creating       = ref(false)
const activeStatus   = ref('All')
const filterType     = ref('')
const filterSemester = ref('')
const activeForm     = ref(null)
const activeTab      = ref('indicators')
const allEntries     = ref([])
const showFormModal    = ref(false)
const showNewFormModal = ref(false)

// Library
const showLibrary    = ref(false)
const showLibConfirm = ref(false)
const libSelected    = ref([])
const libraryItems   = ref([])
const libLoading     = ref(false)
const libSearch      = ref('')
const libPhase       = ref('')
const libClass       = ref('')
const currentFnType  = ref('Core')

// Progress lock
const addProg = ref({ active: false, current: 0, total: 0, pct: 0, items: [] })

// Entry modal
const showEntryModal = ref(false)
const editingEntry   = ref(null)
const savingEntry    = ref(false)
const deletingEntry  = ref(false)
const confirmDel     = ref({ show: false, entryId: null, name: '' })
const toast          = ref({ show: false, msg: '', type: 'success' })

// Document generation (Targets / Ratings official forms)
const docGen = ref({ targets: null, ratings: null, generating: '', printing: false })

// Rate / Finalize workflow (Approved -> Rated -> Finalized)
const feedbackForm = ref({ feedbackStrengths: '', feedbackComments: '', feedbackRecommendations: '', feedbackAreasForImprovement: '' })
const finalizeForm = ref({ dateSignedRatee: '', dateSignedSupervisor: '', dateSignedAuthority: '' })
const ratingBusy   = ref(false)

const newForm = ref({
  type: 'IPCRF',
  semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(),
  immediateSupervisor: '', supervisorPosition: '',
  approvingAuthority: '', authorityPosition: ''
})

// Form Type is no longer a real choice — it's locked to the employee's own
// Employment Type. Keep it in sync no matter which entry point opened the modal.
watch(showNewFormModal, (open) => {
  if (open) newForm.value.type = myFormType.value
})

const entryForm = ref({
  kraName: '', successIndicator: '', functionType: 'Core', weight: 5,
  applicableRatingPeriod: 'Both semesters', classification: 'Complex',
  meansOfVerification: '', accomplishment: '',
  ratingEfficiency: '', ratingQuality: '', ratingTimeliness: ''
})

const statusTabs = [
  { label: 'All',       value: 'All'       },
  { label: 'Draft',     value: 'Draft'     },
  { label: 'Submitted', value: 'Submitted' },
  { label: 'Approved',  value: 'Approved'  },
  { label: 'Rated',     value: 'Rated'     },
  { label: 'Finalized', value: 'Finalized' }
]

// ── Computed ──
const filteredForms = computed(() => {
  let f = forms.value
  if (activeStatus.value !== 'All') f = f.filter(x => x.status === activeStatus.value)
  if (filterType.value)     f = f.filter(x => x.type     === filterType.value)
  if (filterSemester.value) f = f.filter(x => String(x.semester) === filterSemester.value)
  return f.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
})

const coreEntries    = computed(() => allEntries.value.filter(e => e.functionType === 'Core'))
const supportEntries = computed(() => allEntries.value.filter(e => e.functionType === 'Support'))

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
  return (e && q && t) ? Math.round((e + q + t) / 3 * 100) / 100 : null
})

const scoreColorClass = computed(() => {
  const s = Number(activeForm.value?.finalNumericalRating)
  if (s >= 4.5) return 'score-out'
  if (s >= 3.5) return 'score-vs'
  if (s >= 2.5) return 'score-sat'
  return 'score-low'
})

const { canApprove, isAdmin, isDirector, isAsstDir } = usePermissions()
const canFinalize  = computed(() => isAdmin.value || isDirector.value || isAsstDir.value)
const canSelfServe = computed(() => !isDirector.value && !isAsstDir.value)
const COS_TYPE_VALUES = ['Contract of Service (COS)', 'Contractor of Service (COS)'] // tolerate the old typo'd value until existing users are re-saved
const myFormType   = computed(() => COS_TYPE_VALUES.includes(authStore.employmentType) ? 'CCEF' : 'IPCRF')

// Period-level Generate Targets/Ratings (self-service, list-page entry point)
const periodSemester = ref(String(new Date().getMonth() < 6 ? 1 : 2))
const periodYear     = ref(new Date().getFullYear())
const periodBusy     = ref('')
const periodStatusInfo    = ref(null)
const periodStatusLoading = ref(false)

// ── Helpers ──
function countByStatus(s)   { return forms.value.filter(f => f.status === s).length }
function posWeight(item)    {
  const l = activeForm.value?.positionLevel || 'III'
  return Number(item[`weight${l}`] || item.weight || 0)
}
function fmtDate(iso)       { return iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function isSelected(item)   { return libSelected.value.some(s => s.id === item.id) }
function toggleSelect(item) {
  const i = libSelected.value.findIndex(s => s.id === item.id)
  if (i !== -1) libSelected.value.splice(i, 1)
  else libSelected.value.push(item)
}
function cancelLibrary()  { showLibrary.value = false; showLibConfirm.value = false; libSelected.value = [] }
function closeEntry()     { showEntryModal.value = false; editingEntry.value = null }
function closeFormModal() { showFormModal.value = false; libSelected.value = []; showLibrary.value = false; showLibConfirm.value = false }

function statusClass(status) {
  const map = { Draft: 'st-draft', Submitted: 'st-submitted', Returned: 'st-returned', Approved: 'st-approved', Rated: 'st-rated', Finalized: 'st-finalized' }
  return map[status] || 'st-draft'
}

onMounted(loadForms)
onMounted(loadPeriodStatus)

let periodWatchTimer = null
watch([periodSemester, periodYear], () => {
  clearTimeout(periodWatchTimer)
  periodWatchTimer = setTimeout(loadPeriodStatus, 400)
})

async function loadPeriodStatus() {
  if (!canSelfServe.value) return
  periodStatusLoading.value = true
  try {
    periodStatusInfo.value = await ipcrfApi.periodStatus(periodSemester.value, periodYear.value)
  } catch (e) {
    periodStatusInfo.value = null
  } finally {
    periodStatusLoading.value = false
  }
}

// ── API ──
async function loadForms() {
  loading.value = true
  try {
    const r = await ipcrfApi.listForms()
    forms.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) {
    showToast(`Could not load forms: ${e.message}`, 'error')
  } finally {
    loading.value = false
  }
}

async function openFormModal(form) {
  activeForm.value   = form
  activeTab.value    = 'indicators'
  allEntries.value   = []
  docGen.value       = {
    targets: (form.docFileId && form.targetsGeneratedAt)
      ? { fileId: form.docFileId, fileUrl: `https://docs.google.com/spreadsheets/d/${form.docFileId}/edit` } : null,
    ratings: (form.docFileId && form.ratingsGeneratedAt)
      ? { fileId: form.docFileId, fileUrl: `https://docs.google.com/spreadsheets/d/${form.docFileId}/edit` } : null,
    generating: '', printing: false
  }
  feedbackForm.value = {
    feedbackStrengths:           form.feedbackStrengths           || '',
    feedbackComments:            form.feedbackComments            || '',
    feedbackRecommendations:     form.feedbackRecommendations     || '',
    feedbackAreasForImprovement: form.feedbackAreasForImprovement || ''
  }
  finalizeForm.value = {
    dateSignedRatee:      form.dateSignedRatee      || '',
    dateSignedSupervisor: form.dateSignedSupervisor || '',
    dateSignedAuthority:  form.dateSignedAuthority  || ''
  }
  showFormModal.value   = true
  entriesLoading.value  = true
  try {
    const r = await ipcrfApi.listEntries(form.id)
    allEntries.value = Array.isArray(r) ? r : []
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    entriesLoading.value = false
  }
  if (!libraryItems.value.length) {
    libLoading.value = true
    kraLibraryApi.list()
      .then(l => { libraryItems.value = l?.items || (Array.isArray(l) ? l : []) })
      .catch(() => {})
      .finally(() => { libLoading.value = false })
  }
}

async function createForm() {
  if (creating.value) return
  creating.value = true
  try {
    const f = await ipcrfApi.createForm(newForm.value)
    forms.value.unshift(f)
    showNewFormModal.value = false
    showToast('Form created successfully.')
    await openFormModal(f)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    creating.value = false
  }
}

// Quick actions from card
async function quickSubmit(form)  { try { const u = await ipcrfApi.submitForm(form.id);  _syncList(form.id, u); showToast('Submitted') } catch (e) { showToast(e.message, 'error') } }
async function quickApprove(form) { try { const u = await ipcrfApi.approveForm(form.id); _syncList(form.id, u); showToast('Approved') } catch (e) { showToast(e.message, 'error') } }
async function quickReturn(form)  { try { const u = await ipcrfApi.returnForm(form.id);  _syncList(form.id, u); showToast('Returned') } catch (e) { showToast(e.message, 'error') } }
function _syncList(id, u) { const i = forms.value.findIndex(f => f.id === id); if (i !== -1) forms.value[i] = { ...forms.value[i], ...u } }

function openLibrary(fnType) {
  currentFnType.value = fnType
  libSearch.value = ''; libPhase.value = ''; libClass.value = ''
  libSelected.value = []; showLibConfirm.value = false
  showLibrary.value = true
}

async function commitSelection() {
  const items = [...libSelected.value]
  if (!items.length) return
  showLibConfirm.value = false
  showLibrary.value    = false
  addProg.value = { active: true, current: 0, total: items.length, pct: 0, items: items.map(i => ({ kraName: i.kraName })) }
  let added = 0
  const errors = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    addProg.value.current = i
    addProg.value.pct = Math.round((i / items.length) * 100)
    try {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        masterKRAId: item.id, functionType: currentFnType.value,
        kraName: item.kraName,
        successIndicator: item.performanceIndicator || item.successIndicator || '',
        applicableRatingPeriod: item.applicableTo === 'BOTH' ? 'Both semesters' : (item.applicableTo || 'Both semesters'),
        weight: posWeight(item), classification: item.classification || '',
        efficiencyGuide: item.efficiencyGuide || '', qualityGuide: item.qualityGuide || '',
        timelinessGuide: item.timelinessGuide || '', meansOfVerification: item.meansOfVerification || '',
        isCustom: false
      })
      allEntries.value.push(entry)
      added++
    } catch (e) {
      console.error(`Failed to save "${item.kraName}":`, e.message)
      errors.push(item.kraName)
    }
    addProg.value.current = i + 1
    addProg.value.pct = Math.round(((i + 1) / items.length) * 100)
  }
  await new Promise(r => setTimeout(r, 600))
  addProg.value.active = false
  libSelected.value = []
  if (errors.length === 0) showToast(`${added} indicator${added !== 1 ? 's' : ''} saved successfully`)
  else showToast(`${added} saved, ${errors.length} failed: ${errors.join(', ')}`, 'error')
}

function openCustomEntry(fnType) {
  currentFnType.value = fnType
  editingEntry.value  = null
  entryForm.value = { kraName: '', successIndicator: '', functionType: fnType, weight: 5, applicableRatingPeriod: 'Both semesters', classification: 'Complex', meansOfVerification: '', accomplishment: '', ratingEfficiency: '', ratingQuality: '', ratingTimeliness: '' }
  showEntryModal.value = true
}

function openEditEntry(entry) {
  editingEntry.value  = entry
  currentFnType.value = entry.functionType
  entryForm.value = { kraName: entry.kraName, successIndicator: entry.successIndicator, functionType: entry.functionType, weight: Number(entry.weight), applicableRatingPeriod: entry.applicableRatingPeriod, classification: entry.classification, meansOfVerification: entry.meansOfVerification, accomplishment: entry.accomplishment, ratingEfficiency: entry.ratingEfficiency, ratingQuality: entry.ratingQuality, ratingTimeliness: entry.ratingTimeliness }
  showEntryModal.value = true
}

async function saveEntry() {
  if (!entryForm.value.kraName || !entryForm.value.successIndicator) { showToast('KRA name and indicator are required', 'error'); return }
  savingEntry.value = true
  try {
    if (editingEntry.value) {
      const u = await ipcrfApi.updateEntry(activeForm.value.id, editingEntry.value.id, { ...entryForm.value, ratingAverage: computedAvg.value || entryForm.value.ratingAverage || '' })
      const i = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (i !== -1) allEntries.value[i] = { ...allEntries.value[i], ...u }
      showToast('Indicator updated')
    } else {
      const e = await ipcrfApi.addEntry(activeForm.value.id, { ...entryForm.value, functionType: currentFnType.value, isCustom: true })
      allEntries.value.push(e)
      showToast('Indicator added')
    }
    closeEntry()
  } catch (e) { showToast(e.message, 'error') }
  finally { savingEntry.value = false }
}

function askDelete(entry) { confirmDel.value = { show: true, entryId: entry.id, name: entry.kraName } }

async function doDelete() {
  deletingEntry.value = true
  try {
    await ipcrfApi.deleteEntry(activeForm.value.id, confirmDel.value.entryId)
    allEntries.value = allEntries.value.filter(e => e.id !== confirmDel.value.entryId)
    showToast('Indicator removed')
    confirmDel.value.show = false
  } catch (e) { showToast(e.message, 'error') }
  finally { deletingEntry.value = false }
}

async function doSubmit()  { try { const u = await ipcrfApi.submitForm(activeForm.value.id);  _sync(u); showToast('Submitted') }       catch (e) { showToast(e.message, 'error') } }
async function doApprove() { try { const u = await ipcrfApi.approveForm(activeForm.value.id); _sync(u); showToast('Approved') }       catch (e) { showToast(e.message, 'error') } }
async function doReturn()  { try { const u = await ipcrfApi.returnForm(activeForm.value.id);  _sync(u); showToast('Returned for revision') } catch (e) { showToast(e.message, 'error') } }
async function doCompute() { try { const u = await ipcrfApi.computeScore(activeForm.value.id); _sync(u); showToast(`${u.finalNumericalRating} — ${u.adjectivalRating}`) } catch (e) { showToast(e.message, 'error') } }

async function doMarkRated() {
  if (ratingBusy.value) return
  ratingBusy.value = true
  try {
    const u = await ipcrfApi.rateForm(activeForm.value.id, {
      finalNumericalRating: activeForm.value.finalNumericalRating,
      adjectivalRating:     activeForm.value.adjectivalRating,
      ...feedbackForm.value
    })
    _sync(u)
    showToast('Form marked as Rated')
  } catch (e) { showToast(e.message, 'error') }
  finally { ratingBusy.value = false }
}

async function doFinalize() {
  if (ratingBusy.value) return
  ratingBusy.value = true
  try {
    const u = await ipcrfApi.finalizeForm(activeForm.value.id, finalizeForm.value)
    _sync(u)
    showToast('Form finalized')
  } catch (e) { showToast(e.message, 'error') }
  finally { ratingBusy.value = false }
}

// ── Self-service period Generate (list-page entry point) ──
async function doPeriodGenerate(kind) {
  if (periodBusy.value) return
  periodBusy.value = kind
  try {
    const status = await ipcrfApi.periodStatus(periodSemester.value, periodYear.value)

    if (!status.hasForm) {
      if (kind === 'targets') {
        showToast(`No ${status.type} Targets form yet for S${periodSemester.value} ${periodYear.value} — create one below.`, 'error')
        newForm.value = { ...newForm.value, type: status.type, semester: String(periodSemester.value), year: Number(periodYear.value) }
        showNewFormModal.value = true
      } else {
        showToast(`Create your ${status.type} Targets form for S${periodSemester.value} ${periodYear.value} first.`, 'error')
      }
      return
    }

    let form = forms.value.find(f => f.id === status.formId)
    if (!form) form = await ipcrfApi.get(status.formId)
    await openFormModal(form)

    if (kind === 'targets') {
      activeTab.value = 'indicators'
      await doGenerateTargets()
      return
    }

    if (status.totalEntries === 0) {
      showToast('Add indicators to this form before generating Ratings.', 'error')
      activeTab.value = 'indicators'
      return
    }
    if (!status.ratingsReady) {
      showToast(`Accomplishments aren't fully approved yet (${status.readyEntries}/${status.totalEntries}). Redirecting…`, 'error')
      closeFormModal()
      router.push({ path: '/accomplishments', query: { formId: status.formId } })
      return
    }

    activeTab.value = 'score'
    await doGenerateRatings()
  } catch (e) { showToast(e.message, 'error') }
  finally { periodBusy.value = ''; loadPeriodStatus() }
}

function _sync(u) {
  activeForm.value = { ...activeForm.value, ...u }
  const i = forms.value.findIndex(f => f.id === activeForm.value.id)
  if (i !== -1) forms.value[i] = activeForm.value
}

// ── Document generation (official Targets / Ratings forms) ──
async function doGenerateTargets() {
  docGen.value.generating = 'targets'
  try {
    const r = await docGenApi.generateTargets(activeForm.value.id)
    docGen.value.targets = r
    _sync({ docFileId: r.fileId, targetsGeneratedAt: new Date().toISOString() })
    showToast('Targets document generated')
  } catch (e) { showToast(e.message, 'error') }
  finally { docGen.value.generating = ''; loadPeriodStatus() }
}

async function doGenerateRatings() {
  docGen.value.generating = 'ratings'
  try {
    const r = await docGenApi.generateRatings(activeForm.value.id)
    docGen.value.ratings = r
    _sync({ docFileId: r.fileId, ratingsGeneratedAt: new Date().toISOString() })
    showToast('Ratings document generated')
  } catch (e) { showToast(e.message, 'error') }
  finally { docGen.value.generating = ''; loadPeriodStatus() }
}

async function doPrint(fileId, tab) {
  if (!fileId || docGen.value.printing) return
  docGen.value.printing = true
  try {
    const r = await docGenApi.printPdf(fileId, tab)
    const bytes = Uint8Array.from(atob(r.pdfBase64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'application/pdf' })
    const url   = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } catch (e) { showToast(e.message, 'error') }
  finally { docGen.value.printing = false }
}
</script>

<style>
*{box-sizing:border-box;}
.ipcrf-page { padding: 0; font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;color:#1A2332;background: transparent; min-height: 100%; }
.muted-text{color:#94A3B8;}
.req{color:#EF4444;font-size:11px;}
.ml6{margin-left:6px;}

/* Content card wrapper */
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }

/* Header */
.page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
.page-title{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 3px;letter-spacing:-.3px;}
.page-sub{font-size:12px;color:#94A3B8;margin:0;}

/* Filters */
.filter-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;}

/* Self-service period generate bar */
.generate-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;margin-bottom:16px;background:#F5F9FF;border:1px solid #DCE9FB;border-radius:10px;flex-wrap:wrap;}
.generate-period{display:flex;align-items:center;gap:8px;}
.generate-period .field-label{margin:0;}
.generate-actions{display:flex;gap:14px;flex-wrap:wrap;}
.generate-item{display:flex;flex-direction:column;gap:4px;align-items:flex-start;}
.generate-hint{font-size:10.5px;color:#94A3B8;}
.generate-hint-ok{color:#15803D;font-weight:600;}
.generate-hint-warn{color:#B45309;font-weight:600;}
.btn-active-ok{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.btn-active-ok:hover{background:#DCFCE7;}
.status-tabs{display:flex;gap:4px;flex-wrap:wrap;}
.status-tab{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;font-family:inherit;}
.status-tab:hover{border-color:#CBD5E1;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.tab-badge{background:#3B82F6;color:#fff;border-radius:10px;font-size:10px;padding:1px 5px;margin-left:3px;}
.filter-selects{display:flex;gap:8px;}
.filter-select{padding:6px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:inherit;color:#374151;background:#fff;outline:none;cursor:pointer;}
.filter-select:focus{border-color:#3B82F6;}

/* Forms grid */
.forms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

.fc {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all .15s;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.fc:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(0,0,0,.07); transform: translateY(-1px); }
.fc-sk { pointer-events: none; }

.fc-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.fc-period { font-size: 11px; color: #64748B; }

.fc-name { font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
.fc-sub { font-size: 11px; color: #94A3B8; margin-bottom: 12px; }

.fc-mid { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.fc-score { display: flex; align-items: baseline; gap: 4px; }
.fc-score-val { font-size: 16px; font-weight: 700; color: #1A56B0; }
.fc-score-lbl { font-size: 10px; color: #64748B; }

.fc-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #F1F5F9; }
.fc-date { font-size: 11px; color: #94A3B8; }
.fc-actions { display: flex; align-items: center; gap: 4px; }

.dot { color: #CBD5E1; }
.btn-info { background: #EBF4FF; color: #1A56B0; border-color: #BFDBFE; }
.btn-info:hover { background: #DBEAFE; }

/* Type badges */
.type-badge{display:inline-flex;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.3px;}
.type-ipcrf{background:#EBF4FF;color:#1A56B0;}
.type-ccef{background:#F3EEFF;color:#6B3FA0;}

/* Status badges */
.status-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.st-draft{background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}
.st-submitted{background:#FEF3E2;color:#B45309;}
.st-returned{background:#FEF2F2;color:#B91C1C;}
.st-approved{background:#EBF4FF;color:#1A56B0;}
.st-rated{background:#F3EEFF;color:#6B3FA0;}
.st-finalized{background:#F0FDF4;color:#15803D;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-family:inherit;font-weight:500;}
.btn:hover{border-color:#CBD5E1;background:#F8FAFC;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover:not(:disabled){background:#1e3f61;border-color:#1e3f61;}
.btn-success{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.btn-success:hover{background:#DCFCE7;}
.btn-warn{background:#FEF3E2;color:#B45309;border-color:#FDE68A;}
.btn-warn:hover{background:#FEF9C3;}
.btn-danger{background:#EF4444;color:#fff;border-color:#EF4444;}
.btn-danger:hover{background:#DC2626;}
.btn-sm{padding:5px 12px;font-size:11px;}
.btn-xs{padding:4px 7px;font-size:10.5px;border-radius:6px;white-space:nowrap;}
.btn-icon-only{padding:5px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;}
.btn-outline{border-color:#CBD5E1;}

/* Empty */
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 20px;gap:8px;color:#94A3B8;}
.empty-title{font-size:15px;font-weight:600;color:#374151;margin-top:4px;}
.empty-sub{font-size:13px;margin-bottom:8px;color:#94A3B8;}

/* Skeleton */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;height:12px;display:block;}

/* Modal overlay */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;backdrop-filter:blur(4px);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;}

/* Modal XL (form detail) */
.modal-xl{background:#fff;border-radius:16px;width:100%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;}

/* Modal base */
.modal{background:#fff;border-radius:16px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;}
.modal-lib{max-width:740px;}
.modal-confirm{max-width:620px;}

/* Modal header */
.modal-hd{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;flex-shrink:0;}
.modal-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin:0 0 2px;}
.modal-sub{font-size:12px;color:#94A3B8;margin:0;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;transition:all .15s;}
.modal-close:hover{background:#F1F5F9;color:#374151;}
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;flex-shrink:0;}
.modal-body-scroll{flex:1;min-height:0;overflow-y:auto;padding:20px 28px 24px;scrollbar-width:none;-ms-overflow-style:none;}
.modal-body-scroll::-webkit-scrollbar{width:0;height:0;display:none;}

/* Form detail header */
.dh{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 24px 14px;border-bottom:1px solid #F1F5F9;flex-shrink:0;gap:12px;}
.dh-info{flex:1;min-width:0;}
.dh-badges{display:flex;gap:6px;margin-bottom:6px;}
.dh-name{font-size:16px;font-weight:700;color:#0F172A;letter-spacing:-.3px;}
.dh-sub{font-size:11px;color:#94A3B8;margin-top:2px;}

/* Tabs */
.dtabs{display:flex;padding:0 24px;border-bottom:1px solid #E8EDF3;flex-shrink:0;}
.dtab{flex:1 1 0;padding:13px 14px;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;border-bottom:3px solid transparent;margin-bottom:-1px;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:6px;}
.dtab:hover{color:#374151;background:#FAFBFF;}
.dtab.active{color:#1A56B0;border-bottom-color:#1A56B0;font-weight:700;background:#F5F9FF;}
.dtab-cnt{background:#EBF4FF;color:#1A56B0;border-radius:9px;font-size:10px;padding:1px 6px;font-weight:600;}

/* Loading */
.loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px 0;flex:1;min-height:0;}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner-sm2{width:18px;height:18px;border:2px solid #E2E8F0;border-top-color:#3B82F6;border-radius:50%;animation:spin .6s linear infinite;}

/* Function sections */
.fn-section{margin-bottom:24px;}
.fn-section.fn-core .fn-hd{background:#F5F9FF;border-color:#DCE9FB;border-left:3px solid #1A56B0;}
.fn-section.fn-support .fn-hd{background:#FAF7FF;border-color:#E9DFFA;border-left:3px solid #6B3FA0;}
.ind-card-core{border-left:3px solid #BFDBFE;}
.ind-card-support{border-left:3px solid #DDD0F3;}
.fn-hd{display:flex;align-items:center;justify-content:space-between;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:8px;padding:9px 14px;margin-bottom:10px;}
.fn-hd-l{display:flex;align-items:center;gap:8px;}
.fn-label{font-size:12px;font-weight:600;color:#374151;}
.fn-wt{font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;}
.fn-wt-core{background:#EBF4FF;color:#1A56B0;}
.fn-wt-support{background:#F3EEFF;color:#6B3FA0;}
.fn-cnt{font-size:10px;color:#94A3B8;}
.fn-hd-r{display:flex;gap:5px;}
.fn-empty{text-align:center;padding:14px;font-size:11px;color:#94A3B8;border:1.5px dashed #E2E8F0;border-radius:8px;}

/* Add pills */
.add-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 11px;border-radius:12px;font-size:10px;font-weight:600;border:1px solid #BFDBFE;background:#EFF6FF;color:#1A56B0;cursor:pointer;font-family:inherit;transition:all .12s;}
.add-pill:hover{background:#1A56B0;color:#fff;border-color:#1A56B0;}
.add-pill-ghost{border-color:#E2E8F0;background:#fff;color:#475569;}
.add-pill-ghost:hover{background:#F8FAFC;border-color:#CBD5E1;color:#1A56B0;}

/* Indicator cards */
.ind-list{display:flex;flex-direction:column;gap:8px;}
.ind-card{background:#fff;border:1.5px solid #E8EDF3;border-radius:9px;padding:12px 14px;transition:border-color .12s;}
.ind-card:hover{border-color:#BFDBFE;}
.ind-card-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:7px;gap:8px;}
.ind-kra{font-size:12px;font-weight:600;padding:3px 9px;border-radius:8px;flex-shrink:0;}
.ind-kra-core{background:#EBF4FF;color:#1A56B0;}
.ind-kra-support{background:#F3EEFF;color:#6B3FA0;}
.ind-acts{display:flex;gap:3px;flex-shrink:0;}
.ind-si{font-size:12px;color:#334155;line-height:1.65;margin-bottom:8px;}
.ind-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}
.ind-mov{font-size:11px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:6px;padding:5px 8px;line-height:1.5;}
.ind-mov-lbl{font-weight:600;color:#374151;}

/* Tags */
.etag{padding:2px 7px;border-radius:9px;font-size:10px;font-weight:500;background:#F1F5F9;color:#64748B;}
.etag-blue{background:#DBEAFE;color:#1D4ED8;}
.etag-amber{background:#FEF3C7;color:#92400E;}
.etag-green{background:#DCFCE7;color:#166534;}

/* Action buttons */
.act{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;border:1px solid transparent;background:transparent;cursor:pointer;color:#94A3B8;transition:all .12s;}
.act:hover{background:#F1F5F9;border-color:#E2E8F0;color:#475569;}
.act-del:hover{background:#FEF2F2;border-color:#FCA5A5;color:#EF4444;}

/* Workflow bar */
.wf-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 0;margin-top:4px;border-top:1px solid #F1F5F9;}
.wf-info{font-size:11px;color:#64748B;}

/* Document generation bar */
.docgen-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin-top:14px;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:9px;flex-wrap:wrap;}
.docgen-info{display:flex;flex-direction:column;gap:2px;}
.docgen-label{font-size:12px;font-weight:600;color:#374151;}
.docgen-sub{font-size:10.5px;color:#94A3B8;}
.docgen-actions{display:flex;gap:6px;flex-shrink:0;align-items:center;}
.btn-link{background:none;border:none;color:#94A3B8;font-size:11px;cursor:pointer;text-decoration:underline;padding:0 4px;font-family:inherit;}
.btn-link:hover{color:#475569;}
.btn-link:disabled{opacity:.5;cursor:not-allowed;}
.rate-panel{margin-top:18px;padding:14px;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:9px;text-align:left;}

/* Details tab */
.det-2col{display:grid;grid-template-columns:1fr 1fr;gap:32px;}
.det-st{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;}
.det-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F8FAFC;gap:16px;}
.dk{font-size:11px;color:#94A3B8;font-weight:500;flex-shrink:0;min-width:110px;}
.dv{font-size:12px;color:#1A2332;text-align:right;}
.weights-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;margin-bottom:4px;}
.wb-c{background:#1A56B0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:600;}
.wb-s{background:#6B3FA0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:600;}

/* Score tab */
.score-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 0;}
.score-view{text-align:center;}
.score-hero{display:inline-flex;align-items:baseline;gap:5px;padding:14px 24px;border-radius:14px;margin-bottom:8px;}
.score-out{background:#DCFCE7;}
.score-vs{background:#DBEAFE;}
.score-sat{background:#FEF9C3;}
.score-low{background:#FEE2E2;}
.score-big{font-size:52px;font-weight:800;color:#0F172A;line-height:1;letter-spacing:-2px;}
.score-denom{font-size:16px;color:#94A3B8;}
.score-adj{font-size:15px;font-weight:600;color:#374151;}
.score-table{margin-top:20px;border:1px solid #F1F5F9;border-radius:9px;overflow:hidden;}
.st-hd{display:flex;justify-content:space-between;padding:8px 14px;background:#F8FAFC;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;}
.st-row{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-top:1px solid #F8FAFC;}
.st-l{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.st-fn{width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;}
.fn-c{background:#EBF4FF;color:#1A56B0;}
.fn-s{background:#F3EEFF;color:#6B3FA0;}
.st-name{font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.st-val{font-size:12px;font-weight:600;color:#0F172A;flex-shrink:0;}

/* Library modal */
.lib-filters{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid #F1F5F9;flex-shrink:0;flex-wrap:wrap;}
.srch-wrap{flex:1;position:relative;min-width:200px;}
.srch-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;}
.srch-inp{width:100%;padding:8px 11px 8px 30px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:inherit;color:#0F172A;outline:none;}
.srch-inp:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.sel-strip{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;background:#EBF4FF;border-bottom:1px solid #BFDBFE;flex-shrink:0;}
.sel-cnt{font-size:12px;font-weight:600;color:#1A56B0;}
.sel-clr{font-size:11px;color:#64748B;background:none;border:none;cursor:pointer;text-decoration:underline;font-family:inherit;}
.lib-scroll{flex:1;overflow-y:auto;padding:12px 24px;max-height:50vh;}
.lib-list{display:flex;flex-direction:column;gap:6px;}
.lib-item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1.5px solid #E8EDF3;border-radius:9px;cursor:pointer;transition:all .12s;user-select:none;}
.lib-item:hover{border-color:#BFDBFE;background:#F8FBFF;}
.lib-sel{border-color:#3B82F6;background:#EFF6FF;}
.chk{width:20px;height:20px;border-radius:5px;border:2px solid #CBD5E1;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .12s;}
.chk-on{background:#1A56B0;border-color:#1A56B0;}
.lib-content{flex:1;min-width:0;}
.lib-kra-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:5px;flex-wrap:wrap;}
.lib-kra{font-size:13px;font-weight:600;color:#0F172A;}
.lib-tags{display:flex;flex-wrap:wrap;gap:3px;}
.lib-pi{font-size:12px;color:#475569;line-height:1.6;margin-bottom:6px;}
.lib-mov{font-size:11px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:5px;padding:4px 8px;line-height:1.5;}
.lib-mov-lbl{font-weight:600;color:#374151;}

/* Confirm modal */
.confirm-scroll{flex:1;overflow-y:auto;padding:16px 24px;max-height:55vh;}
.ci{display:flex;align-items:flex-start;gap:12px;padding:16px 0;border-bottom:1px solid #F1F5F9;}
.ci-num{width:26px;height:26px;border-radius:50%;background:#EBF4FF;color:#1A56B0;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.ci-body{flex:1;min-width:0;}
.ci-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.ci-kra{font-size:14px;font-weight:700;color:#0F172A;letter-spacing:-.2px;}
.ci-tags{display:flex;flex-wrap:wrap;gap:4px;}
.ci-label{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;margin-top:8px;}
.ci-pi{font-size:12px;color:#334155;line-height:1.65;}
.ci-mov-wrap{margin-top:8px;}
.ci-mov{font-size:12px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:6px;padding:6px 10px;line-height:1.55;}
.ci-rm{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:5px;border:none;background:transparent;cursor:pointer;color:#CBD5E1;flex-shrink:0;margin-top:2px;}
.ci-rm:hover{background:#FEF2F2;color:#EF4444;}

/* Fullscreen lock */
.fullscreen-lock{position:fixed;inset:0;background:rgba(15,23,42,.9);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;}
.lock-box{background:#fff;border-radius:20px;padding:36px 44px;text-align:center;width:380px;max-width:calc(100vw - 32px);box-shadow:0 32px 80px rgba(0,0,0,.35);}
.lock-spin{width:48px;height:48px;border:4px solid #E2E8F0;border-top-color:#1A56B0;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 20px;}
.lock-title{font-size:17px;font-weight:700;color:#0F172A;margin-bottom:16px;letter-spacing:-.3px;}
.lock-items{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;max-height:180px;overflow-y:auto;}
.lock-item{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:7px;background:#F8FAFC;text-align:left;}
.lock-item.done{background:#F0FDF4;}
.lock-item.active{background:#EBF4FF;border:1px solid #BFDBFE;}
.lock-item-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.icon-done{color:#15803D;}
.icon-active{color:#1A56B0;}
.icon-wait{color:#CBD5E1;}
.mini-spin{width:14px;height:14px;border:2px solid #BFDBFE;border-top-color:#1A56B0;border-radius:50%;animation:spin .5s linear infinite;}
.dot-wait{width:8px;height:8px;border-radius:50%;background:#E2E8F0;display:block;}
.lock-item-name{font-size:11px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.prog-track{height:6px;background:#F1F5F9;border-radius:6px;overflow:hidden;margin-bottom:10px;}
.prog-fill{height:100%;background:linear-gradient(90deg,#1A56B0,#6B3FA0);border-radius:6px;transition:width .3s ease;}
.lock-hint{font-size:11px;color:#94A3B8;}

/* Form fields */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.field-input{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:inherit;color:#0F172A;background:#fff;outline:none;transition:border-color .15s;resize:vertical;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.field-input::placeholder{color:#CBD5E1;}
.avg-box{background:#F0FDF4;color:#15803D;font-weight:600;cursor:default;pointer-events:none;}

/* Type toggle */
.type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.type-toggle-single{grid-template-columns:1fr;}
.type-opt-locked{cursor:default;}
.type-opt-locked:hover{border-color:#3B82F6;}
.type-auto-hint{font-size:10.5px;color:#94A3B8;margin:6px 0 0;}
.type-opt{padding:12px;border:1.5px solid #E2E8F0;border-radius:10px;cursor:pointer;text-align:left;background:#fff;transition:all .15s;font-family:inherit;}
.type-opt strong{display:block;font-size:13px;font-weight:700;color:#0F172A;margin-bottom:3px;}
.type-opt span{font-size:10px;color:#94A3B8;line-height:1.4;}
.type-opt:hover{border-color:#CBD5E1;}
.type-opt.active{border-color:#3B82F6;background:#EBF4FF;}
.type-opt.active strong{color:#1A56B0;}

/* Confirm delete */
.confirm-box{background:#fff;border-radius:16px;padding:28px 26px;max-width:360px;width:calc(100% - 32px);text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.2);}
.cb-icon{width:48px;height:48px;border-radius:14px;background:#FEF2F2;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
.cb-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:7px;}
.cb-msg{font-size:12px;color:#475569;line-height:1.65;margin-bottom:20px;}
.cb-btns{display:flex;justify-content:center;gap:8px;}

/* Spinner */
.spinner,.spinner-sm{display:inline-block;border-radius:50%;animation:spin .6s linear infinite;}
.spinner{width:24px;height:24px;border:2.5px solid rgba(0,0,0,.1);border-top-color:#1A56B0;}
.spinner-sm{width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;}

/* State wrap */
.state-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0;}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999;pointer-events:none;}
.toast-error{background:#EB5757;}
.toast-warning{background:#E9A840;}

/* Transitions */
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}
</style>