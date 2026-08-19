<template>
  <div class="ipcrf-page">

    <div class="tp-shell">

      <!-- ═══ LEFT PANEL ═══ -->
      <div class="tp-left">
        <div class="ipcrf-left-inner">

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
              <label class="field-label">Year</label>
              <input v-model.number="periodYear" type="number" class="filter-select" style="width:80px"/>
            </div>
            <div class="generate-actions">
              <a
                v-if="periodStatusInfo?.docFileUrl"
                :href="periodStatusInfo.docFileUrl"
                target="_blank"
                class="btn btn-sm btn-active-ok">
                Open Spreadsheet
              </a>
              <span v-if="periodStatusInfo?.docMissing" class="generate-hint generate-hint--warn">
                File was deleted from Drive. Regenerate to create a new one.
              </span>
              <div class="generate-item">
                <template v-if="periodStatusInfo?.hasTargetsDoc">
                  <span class="generate-label">Targets:</span>
                  <button class="btn btn-xs btn-regenerate" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('targets')">
                    {{ periodBusy === 'targets' ? 'Regenerating...' : 'Regenerate' }}
                  </button>
                </template>
                <button v-else class="btn btn-sm" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('targets')">
                  {{ periodStatusLoading ? 'Checking...' : periodBusy === 'targets' ? 'Generating...' : `Generate ${myFormType} Targets` }}
                </button>
              </div>
              <div class="generate-item">
                <span class="generate-label">Ratings:</span>
                <template v-if="periodStatusInfo?.hasS1RatingsDoc">
                  <button class="btn btn-xs btn-regenerate" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('ratings', 1)">
                    {{ periodBusy === 'ratings-1' ? 'Regenerating...' : 'Regen S1' }}
                  </button>
                </template>
                <button v-else class="btn btn-sm" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('ratings', 1)">
                  {{ periodStatusLoading ? 'Checking...' : periodBusy === 'ratings-1' ? 'Generating...' : 'S1 Ratings' }}
                </button>
                <template v-if="periodStatusInfo?.hasS2RatingsDoc">
                  <button class="btn btn-xs btn-regenerate" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('ratings', 2)">
                    {{ periodBusy === 'ratings-2' ? 'Regenerating...' : 'Regen S2' }}
                  </button>
                </template>
                <button v-else class="btn btn-primary btn-sm" :disabled="!!periodBusy || periodStatusLoading" @click="doPeriodGenerate('ratings', 2)">
                  {{ periodStatusLoading ? 'Checking...' : periodBusy === 'ratings-2' ? 'Generating...' : 'S2 Ratings' }}
                </button>
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
            </div>
          </div>

          <!-- Skeleton loading -->
          <div v-if="loading" class="forms-list">
            <div v-for="i in 4" :key="'sk'+i" class="fli fli-sk">
              <div class="fli-sk-top"><div class="sk-badge"></div><div class="sk-line" style="width:55px"></div></div>
              <div class="sk-line" style="width:75%;margin-bottom:5px"></div>
              <div class="sk-line" style="width:50%"></div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!filteredForms.length" class="empty-state">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
              <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p class="empty-title">{{ activeStatus !== 'All' ? `No ${activeStatus.toLowerCase()} forms` : 'No forms yet' }}</p>
            <p class="empty-sub">{{ activeStatus !== 'All' ? 'Try a different filter.' : 'Create your first IPCRF or CCEF form.' }}</p>
            <button v-if="activeStatus === 'All' && canSelfServe" class="btn btn-primary" @click="showNewFormModal = true">Create New Form</button>
          </div>

          <!-- Forms list -->
          <div v-else class="forms-list">
            <div
              v-for="form in filteredForms" :key="form.id"
              :class="['fli', activeForm?.id === form.id && showFormModal && 'fli-active']"
              @click="openFormModal(form)"
            >
              <div class="fli-top">
                <span :class="['type-badge', form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">{{ form.type }}</span>
                <span class="fli-period">{{ form.year }}</span>
                <span :class="['status-badge', statusClass(form.status)]">{{ form.status }}</span>
              </div>
              <div class="fli-name">{{ form.employeeName }}</div>
              <div class="fli-sub">{{ form.divisionName || '-' }}</div>
              <div v-if="form.finalNumericalRating" class="fli-score">
                <span class="fli-score-val">{{ form.finalNumericalRating }}</span>
                <span class="fli-score-lbl">{{ form.adjectivalRating }}</span>
              </div>
              <div class="fli-foot" @click.stop>
                <span class="fli-date">{{ fmtDate(form.updatedAt || form.createdAt) }}</span>
                <div class="fli-actions">
                  <button v-if="canReviewForm(form)" :disabled="quickBusyId === form.id"
                    class="btn btn-xs btn-success" @click.stop="quickApprove(form)">{{ quickBusyId === form.id ? 'Approving...' : 'Approve' }}</button>
                  <button v-if="canReviewForm(form)" :disabled="quickBusyId === form.id"
                    class="btn btn-xs btn-warn" @click.stop="quickReturn(form)">{{ quickBusyId === form.id ? 'Returning...' : 'Return' }}</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ═══ RIGHT PANEL ═══ -->
      <div class="tp-right">

        <!-- Empty state -->
        <div v-if="!showFormModal || !activeForm" class="rp-empty">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
            <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p class="rp-empty-title">Select a form</p>
          <p class="rp-empty-sub">Click any form from the list to view indicators and details</p>
        </div>

        <!-- Form detail (inline, was modal-xl) -->
        <div v-else class="rp-detail-wrap">

          <!-- Header -->
          <div class="dh">
            <div class="dh-info">
              <div class="dh-badges">
                <span :class="['type-badge', activeForm?.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">{{ activeForm?.type }}</span>
                <span :class="['status-badge', statusClass(activeForm?.status)]">{{ activeForm?.status }}</span>
              </div>
              <div class="dh-name">{{ activeForm?.employeeName }}</div>
              <div class="dh-sub">{{ activeForm?.year }} | {{ activeForm?.divisionName }}</div>
            </div>
            <button class="readiness-trigger" @click="showReadinessModal = true">
              <span :class="['readiness-dot', readinessSummary.ready ? 'ok' : 'warn']"></span>
              Readiness
              <strong>{{ readinessSummary.title }}</strong>
            </button>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Returned-for-revision banner -->
          <div v-if="activeForm?.status === 'Returned'" class="ret-banner">
            <div class="ret-banner-hd">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.7" stroke="currentColor" stroke-width="1.4"/>
                <path d="M7 4.4v3.2M7 9.8v.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <span>Returned for revision</span>
              <span v-if="activeForm?.returnedBy" class="ret-by">
                by {{ activeForm.returnedBy }}<template v-if="activeForm?.returnedAt"> · {{ fmtDate(activeForm.returnedAt) }}</template>
              </span>
            </div>
            <div v-if="activeForm?.returnRemarks" class="ret-reason">{{ activeForm.returnRemarks }}</div>
            <div v-else class="ret-reason ret-reason-muted">No reason was provided. Check the reviewer notes on each indicator below, or coordinate with your reviewer.</div>
          </div>

          <!-- Tabs -->
          <div class="dtabs">
            <button :class="['dtab', activeTab === 'indicators' && 'active']" @click="activeTab = 'indicators'">
              Indicators <span v-if="allEntries.length" class="dtab-cnt">{{ allEntries.length }}</span>
            </button>
            <button :class="['dtab', activeTab === 'details' && 'active']" @click="activeTab = 'details'">Details</button>
            <button :class="['dtab', activeTab === 'score' && 'active']" @click="activeTab = 'score'">Score</button>
          </div>

          <!-- Body (scrollable) -->
          <div class="rp-detail-body">

            <!-- Loading -->
            <div v-if="entriesLoading" class="loading-state">
              <div class="spinner-sm2"></div>
              <span class="muted-text">Loading indicators...</span>
            </div>

            <!-- INDICATORS TAB -->
            <div v-else-if="activeTab === 'indicators'" class="rp-tab-content">

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
                      <span v-if="entryAverage(e)" class="etag etag-green">Avg {{ entryAverage(e) }}</span>
                    </div>
                    <div v-if="e.meansOfVerification" class="ind-mov">
                      <span class="ind-mov-lbl">MOV:</span> {{ e.meansOfVerification }}
                    </div>
                    <div v-if="reviewNotes[e.id]" class="ind-note">
                      <span class="ind-note-lbl">Reviewer note:</span> {{ reviewNotes[e.id] }}
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
                      <span v-if="entryAverage(e)" class="etag etag-green">Avg {{ entryAverage(e) }}</span>
                    </div>
                    <div v-if="e.meansOfVerification" class="ind-mov">
                      <span class="ind-mov-lbl">MOV:</span> {{ e.meansOfVerification }}
                    </div>
                    <div v-if="reviewNotes[e.id]" class="ind-note">
                      <span class="ind-note-lbl">Reviewer note:</span> {{ reviewNotes[e.id] }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Workflow bar -->
              <div v-if="['Draft', 'Returned'].includes(activeForm?.status) && activeForm?.userId === authStore.profileId" class="wf-bar">
                <span class="wf-info">{{ allEntries.length }} indicator{{ allEntries.length !== 1 ? 's' : '' }}</span>
                <button class="btn btn-primary btn-sm" :disabled="wfBusy" @click="doSubmit">{{ wfBusy ? 'Submitting...' : 'Submit for Review' }}</button>
              </div>
              <div v-else-if="['Draft', 'Returned'].includes(activeForm?.status)" class="wf-bar">
                <span class="wf-info muted-text">Waiting on {{ activeForm?.employeeName }} to submit this for review.</span>
              </div>
              <div v-else-if="activeForm?.status === 'Submitted'" class="wf-bar">
                <span class="wf-info">Pending review</span>
                <div v-if="canReviewActiveForm" style="display:flex;gap:8px">
                  <button class="btn btn-success btn-sm" :disabled="wfBusy" @click="doApprove">{{ wfBusy ? 'Approving...' : 'Approve' }}</button>
                  <button class="btn btn-warn btn-sm" :disabled="wfBusy" @click="doReturn">{{ wfBusy ? 'Returning...' : 'Return' }}</button>
                </div>
              </div>
              <div v-else-if="activeForm?.status === 'Approved' && activeForm?.userId === authStore.profileId" class="wf-bar">
                <span class="wf-info">Targets approved - complete your accomplishments, then submit ratings for Division Chief review.</span>
                <button class="btn btn-primary btn-sm" :disabled="ratingBusy" @click="doSubmitRatings">
                  {{ ratingBusy ? 'Submitting...' : 'Submit Ratings for Review' }}
                </button>
              </div>
              <div v-else-if="activeForm?.status === 'Approved'" class="wf-bar">
                <span class="wf-info muted-text">Waiting for {{ activeForm?.employeeName }} to submit their ratings.</span>
              </div>
            </div>

            <!-- DETAILS TAB -->
            <div v-else-if="activeTab === 'details'" class="rp-tab-content">
              <div class="det-2col">
                <div>
                  <div class="det-st">Period & Role</div>
                  <div class="det-row"><span class="dk">Form Type</span><span class="dv">{{ activeForm?.type }}</span></div>
                  <div class="det-row"><span class="dk">Year</span><span class="dv">{{ activeForm?.year }}</span></div>
                  <div class="det-row"><span class="dk">Division</span><span class="dv">{{ activeForm?.divisionName || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Section</span><span class="dv">{{ activeForm?.sectionName || '-' }}</span></div>
                  <div class="det-st" style="margin-top:16px">Weights</div>
                  <div class="weights-bar">
                    <div class="wb-c" :style="{ width: activeForm?.coreFunctionWeight + '%' }">Core {{ activeForm?.coreFunctionWeight }}%</div>
                    <div class="wb-s" :style="{ width: activeForm?.supportFunctionWeight + '%' }">Support {{ activeForm?.supportFunctionWeight }}%</div>
                  </div>
                  <div class="det-st" style="margin-top:16px">Timeline</div>
                  <div class="det-row"><span class="dk">Created</span><span class="dv">{{ fmtDate(activeForm?.createdAt) || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Submitted</span><span class="dv">{{ fmtDate(activeForm?.submittedAt) || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Approved</span><span class="dv">{{ fmtDate(activeForm?.approvedAt) || '-' }}</span></div>
                </div>
                <div>
                  <div class="det-st">Signatories</div>
                  <div class="det-row"><span class="dk">Supervisor</span><span class="dv">{{ activeForm?.immediateSupervisor || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Supervisor Position</span><span class="dv">{{ activeForm?.supervisorPosition || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Approving Authority</span><span class="dv">{{ activeForm?.approvingAuthority || '-' }}</span></div>
                  <div class="det-row"><span class="dk">Authority Position</span><span class="dv">{{ activeForm?.authorityPosition || '-' }}</span></div>
                </div>
              </div>
            </div>

            <!-- SCORE TAB -->
            <div v-else-if="activeTab === 'score'" class="rp-tab-content">
              <div v-if="scoreBusy && !displayScore" class="score-empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="16" stroke="#E2E8F0" stroke-width="2"/>
                  <path d="M20 12v8l5 3" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p class="muted-text">Updating score...</p>
              </div>
              <div v-else-if="!displayScore" class="score-empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="16" stroke="#E2E8F0" stroke-width="2"/>
                  <path d="M20 12v8l5 3" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p class="muted-text">No ratings entered yet</p>
                <p class="muted-text score-help">Enter ratings in the accomplishments/ratings entries and the final score will appear automatically.</p>
              </div>
              <div v-else class="score-view">
                <div :class="['score-hero', scoreColorClass]">
                  <span class="score-big">{{ displayScore }}</span>
                  <span class="score-denom">/ 5.0</span>
                </div>
                <div class="score-adj">{{ displayAdjectivalRating }}</div>
                <div class="score-auto">{{ scoreBusy ? 'Syncing latest ratings...' : 'Score updates automatically from the latest ratings.' }}</div>
                <div class="score-table">
                  <div class="st-hd"><span>Indicator</span><span>Avg</span></div>
                  <div v-for="e in allEntries" :key="e.id" class="st-row">
                    <div class="st-l">
                      <span :class="['st-fn', e.functionType === 'Core' ? 'fn-c' : 'fn-s']">{{ e.functionType[0] }}</span>
                      <span class="st-name">{{ e.kraName }}</span>
                    </div>
                    <span :class="['st-val', entryAverage(e) ? '' : 'muted-text']">{{ entryAverage(e) || '-' }}</span>
                  </div>
                </div>

                <!-- Rate / Finalize workflow -->
                <div v-if="activeForm?.status === 'Approved'" class="rate-panel">
                  <div class="det-st" style="text-align:left">Feedback (Part II)</div>
                  <div class="form-grid" style="text-align:left">
                    <div class="field full">
                      <label class="field-label">Strengths</label>
                      <textarea v-model="feedbackForm.feedbackStrengths" class="field-input" rows="2" placeholder="What the ratee does well..."></textarea>
                    </div>
                    <div class="field full">
                      <label class="field-label">Rater's Comments &amp; Recommendations</label>
                      <textarea v-model="feedbackForm.feedbackComments" class="field-input" rows="2" placeholder="Comments, recommendations, commendations..."></textarea>
                    </div>
                    <div class="field full">
                      <label class="field-label">Areas for Improvement</label>
                      <textarea v-model="feedbackForm.feedbackAreasForImprovement" class="field-input" rows="2" placeholder="Development needs..."></textarea>
                    </div>
                  </div>
                  <button v-if="canApprove" class="btn btn-primary btn-sm" style="margin-top:10px" :disabled="ratingBusy" @click="doMarkRated">
                    {{ ratingBusy ? 'Saving...' : 'Mark as Rated' }}
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
                    {{ ratingBusy ? 'Saving...' : 'Finalize' }}
                  </button>
                  <p v-else class="muted-text" style="margin-top:10px;font-size:11px">Only an Administrator/Director can finalize this form.</p>
                </div>
              </div>
            </div>

          </div>
          <!-- /rp-detail-body -->

        </div>
        <!-- /rp-detail-wrap -->

      </div>
      <!-- /tp-right -->

    </div>
    <!-- /tp-shell -->

    <!-- ==================================
         KRA LIBRARY MODAL
    ================================== -->
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
              <input v-model="libSearch" type="text" class="srch-inp" placeholder="Search KRA or indicator..."/>
            </div>
            <select v-if="currentFnType === 'Core'" v-model="libPhase" class="field-input" style="width:140px">
              <option value="">All Phases</option>
              <option v-for="p in PHASES" :key="p" :value="p">{{ p.replace(/_/g, ' ') }}</option>
            </select>
            <select v-model="libClass" class="field-input" style="width:170px">
              <option value="">All Classifications</option>
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

    <!-- ==================================
         CONFIRM SELECTION MODAL
    ================================== -->
    <teleport to="body">
      <div v-if="showLibConfirm" class="modal-overlay">
        <div class="modal modal-confirm">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">Confirm - {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}</h3>
              <p class="modal-sub">Review carefully. Click Back to adjust.</p>
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
                <div class="ci-control-row">
                  <div class="ci-period">
                    <div class="ci-period-head">
                      <label class="ci-label">Applicable Rating Period</label>
                      <div class="ci-period-control">
                        <select v-model="item.applicableRatingPeriod" class="field-input ci-period-select">
                          <option value="Both semesters">Both semesters</option>
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                        </select>
                        <button class="ci-rm" @click="libSelected.splice(idx, 1)" title="Remove indicator">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="item.meansOfVerification" class="ci-mov-wrap">
                  <div class="ci-label">Means of Verification</div>
                  <div class="ci-mov">{{ item.meansOfVerification }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showLibConfirm = false">Back to Library</button>
            <button class="btn btn-primary" :disabled="!libSelected.length" @click="commitSelection">
              Confirm & Add {{ libSelected.length }} Indicator{{ libSelected.length !== 1 ? 's' : '' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ==================================
         FULLSCREEN PROGRESS LOCK
    ================================== -->
    <teleport to="body">
      <div v-if="addProg.active" class="fullscreen-lock">
        <div class="lock-box">
          <div class="lock-spin"></div>
          <div class="lock-title">Saving Indicators...</div>
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
          <div class="lock-hint">{{ addProg.current }} of {{ addProg.total }} saved - please wait</div>
        </div>
      </div>
    </teleport>

    <!-- ==================================
         NEW FORM MODAL
    ================================== -->
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
              <p class="modal-sub">IPCRF or CCEF for the year</p>
            </div>
            <button class="modal-close" @click="showNewFormModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <template v-if="showFormRecreateWarning">
            <div class="modal-body">
              <div class="regen-warning">
                <div style="text-align:center;margin-bottom:12px">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#EF4444" stroke-width="2.5" fill="#FEF2F2"/>
                    <path d="M20 13v9" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
                    <circle cx="20" cy="27" r="1.5" fill="#EF4444"/>
                  </svg>
                </div>
                <p style="font-weight:600;font-size:14px;color:#DC2626;text-align:center;margin-bottom:8px">
                  A {{ newForm.type }} form for {{ newForm.year }} already exists
                </p>
                <p style="font-size:13px;color:#64748B;text-align:center;margin-bottom:14px">
                  Creating a new form will permanently delete the existing form and all its related data:
                </p>
                <ul style="font-size:12px;color:#64748B;margin:0 0 0 18px;padding:0;line-height:1.8">
                  <li>All form entries (KRAs &amp; Success Indicators)</li>
                  <li>All revision history</li>
                  <li>All review comments</li>
                  <li>Generated documents for this form</li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="showFormRecreateWarning = false; existingFormForYear = null">Go Back</button>
              <button class="btn btn-danger" :disabled="creating" @click="createForm">
                <span v-if="creating" class="spinner-sm"></span>
                {{ deletingOldForm ? 'Deleting old form...' : creating ? 'Creating...' : 'Delete & Create New' }}
              </button>
            </div>
          </template>
          <template v-else>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Form Type <span class="req">*</span></label>
                <div class="type-toggle type-toggle-single">
                  <div v-if="myFormType === 'IPCRF'" class="type-opt active type-opt-locked">
                    <strong>IPCRF</strong>
                    <span>Individual Performance Commitment &amp; Review</span>
                  </div>
                  <div v-else class="type-opt active type-opt-locked">
                    <strong>CCEF</strong>
                    <span>Core Competency Evaluation Form</span>
                  </div>
                </div>
                <p class="type-auto-hint">Set automatically based on your Employment Type ({{ authStore.employmentType || 'Regular' }})</p>
              </div>
              <div class="field full">
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
              {{ creating ? 'Creating...' : 'Create Form' }}
            </button>
          </div>
          </template>
        </div>
      </div>
    </teleport>

    <!-- ==================================
         CUSTOM / EDIT ENTRY MODAL
    ================================== -->
    <teleport to="body">
      <div v-if="showReadinessModal" class="modal-overlay" @click.self="showReadinessModal = false">
        <div class="modal modal-readiness">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">Smart Readiness</h3>
              <p class="modal-sub">{{ activeForm?.employeeName }} · {{ activeForm?.type }} {{ activeForm?.year }}</p>
            </div>
            <span :class="['smart-pill', readinessSummary.ready ? 'smart-pill-ok' : 'smart-pill-warn']">
              {{ readinessSummary.ready ? 'Ready' : 'Needs attention' }}
            </span>
            <button class="modal-close" @click="showReadinessModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="readiness-summary-card">
              <div class="smart-eyebrow">Current status</div>
              <div class="smart-title">{{ readinessSummary.title }}</div>
              <p class="readiness-summary-copy">These checks update from the latest form details, ratings, and generated Google Sheet status.</p>
            </div>
            <div class="smart-grid smart-grid-modal">
              <div v-for="item in readinessItems" :key="item.key" :class="['smart-item', item.ok ? 'smart-ok' : 'smart-warn']">
                <span class="smart-dot"></span>
                <div>
                  <div class="smart-item-title">{{ item.title }}</div>
                  <div class="smart-item-copy">{{ item.copy }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="showReadinessModal = false">Done</button>
          </div>
        </div>
      </div>
    </teleport>

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
                <textarea v-model="entryForm.successIndicator" class="field-input" rows="3" placeholder="Describe the specific target output..."></textarea>
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
                  <label class="field-label">Efficiency <span class="muted-text">(0-5)</span></label>
                  <input :value="entryForm.ratingEfficiency" type="text" inputmode="decimal" class="field-input rating-field" placeholder="0-5 or N/A" @input="onRatingInput('ratingEfficiency', $event)" @blur="onRatingBlur('ratingEfficiency', $event)"/>
                </div>
                <div class="field">
                  <label class="field-label">Quality <span class="muted-text">(0-5)</span></label>
                  <input :value="entryForm.ratingQuality" type="text" inputmode="decimal" class="field-input rating-field" placeholder="0-5 or N/A" @input="onRatingInput('ratingQuality', $event)" @blur="onRatingBlur('ratingQuality', $event)"/>
                </div>
                <div class="field">
                  <label class="field-label">Timeliness <span class="muted-text">(0-5)</span></label>
                  <input :value="entryForm.ratingTimeliness" type="text" inputmode="decimal" class="field-input rating-field" placeholder="0-5 or N/A" @input="onRatingInput('ratingTimeliness', $event)" @blur="onRatingBlur('ratingTimeliness', $event)"/>
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
              {{ savingEntry ? 'Saving...' : (editingEntry ? 'Save Changes' : 'Add Indicator') }}
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
            <button class="btn btn-danger" :disabled="deletingEntry" @click="doDelete">{{ deletingEntry ? 'Removing...' : 'Remove' }}</button>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi, docGenApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { useAuthStore } from '@/stores/auth'
import { useConfirm, CONFIRMS } from '@/composables/useConfirm'
import { normalizeEmploymentType } from '@/utils/employmentTypes'

const router    = useRouter()
const authStore = useAuthStore()
const { confirm, confirmState } = useConfirm()

const PHASES = ['ANALYSIS', 'DESIGN', 'TESTING', 'EVALUATION', 'PROMOTION', 'PORTFOLIO', 'SOCIAL_MARKETING', 'STRATEGIC']

// ── State ──
const forms          = ref([])
const loading        = ref(false)
const entriesLoading = ref(false)
const creating       = ref(false)
const activeStatus   = ref('All')
const filterType     = ref('')

const activeForm     = ref(null)
const reviewNotes    = ref({})   // entryId → reviewer comment, shown when a form is Returned

// Review comments live under two reviewType buckets; fetch both and merge so the
// owner sees the notes regardless of which review phase the return happened in.
async function loadReviewNotes(formId) {
  const [targets, ratings] = await Promise.all([
    ipcrfApi.reviewComments(formId, 'targets').catch(() => []),
    ipcrfApi.reviewComments(formId, 'ratings').catch(() => [])
  ])
  const map = {}
  ;[...(Array.isArray(targets) ? targets : []), ...(Array.isArray(ratings) ? ratings : [])]
    .forEach(c => { if (c.comment) map[c.entryId] = c.comment })
  reviewNotes.value = map
}
const activeTab      = ref('indicators')
const allEntries     = ref([])
const showFormModal    = ref(false)
const showNewFormModal = ref(false)
const showFormRecreateWarning = ref(false)
const existingFormForYear = ref(null)
const deletingOldForm = ref(false)
const showReadinessModal = ref(false)

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
const docGen = ref({ printing: false })

// Rate / Finalize workflow (Approved -> Rated -> Finalized)
const feedbackForm = ref({ feedbackStrengths: '', feedbackComments: '', feedbackRecommendations: '', feedbackAreasForImprovement: '' })
const finalizeForm = ref({ dateSignedRatee: '', dateSignedSupervisor: '', dateSignedAuthority: '' })
const ratingBusy   = ref(false)
const scoreBusy    = ref(false)
const wfBusy       = ref(false)
const quickBusyId  = ref('')
const lastAutoScoreKey = ref('')
let autoScoreTimer = null

const newForm = ref({
  type: 'IPCRF',

  year: new Date().getFullYear(),
  immediateSupervisor: '', supervisorPosition: '',
  approvingAuthority: '', authorityPosition: ''
})

watch(showNewFormModal, (open) => {
  if (open) {
    newForm.value.type = myFormType.value
  } else {
    showFormRecreateWarning.value = false
    existingFormForYear.value = null
  }
})

watch(
  () => [
    activeTab.value,
    activeForm.value?.id || '',
    entriesLoading.value,
    allEntries.value.map(e => `${e.id}:${entryAverage(e) ?? ''}`).join('|')
  ],
  () => {
    if (activeTab.value === 'score') queueAutoComputeScore()
  },
  { flush: 'post' }
)

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

  return f.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
})

const coreEntries    = computed(() => allEntries.value.filter(e => e.functionType === 'Core'))
const supportEntries = computed(() => allEntries.value.filter(e => e.functionType === 'Support'))

const filteredLibrary = computed(() => {
  const addedIds = new Set(allEntries.value.filter(e => e.masterKRAId).map(e => e.masterKRAId))
  let items = libraryItems.value.filter(i => i.functionType === currentFnType.value && !addedIds.has(i.id))
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

function onRatingInput(field, event) {
  const el = event.target
  const upper = el.value.toUpperCase()
  if (upper === 'N' || upper === 'N/' || upper === 'N/A') { el.classList.remove('rating-invalid'); return }
  const raw = el.value.replace(/[^0-9.]/g, '')
  if (raw !== el.value) el.value = raw
  if (raw === '' || raw === '.') { entryForm.value[field] = ''; el.classList.remove('rating-invalid'); return }
  const n = parseFloat(raw)
  if (isNaN(n) || n < 0 || n > 5) {
    el.classList.add('rating-invalid')
    setTimeout(() => { el.value = ''; el.classList.remove('rating-invalid'); entryForm.value[field] = '' }, 400)
  } else {
    el.classList.remove('rating-invalid')
    entryForm.value[field] = n
  }
}
function onRatingBlur(field, event) {
  const el = event.target
  if (el.value.toUpperCase() === 'N/A') { entryForm.value[field] = 'N/A'; el.value = 'N/A'; el.classList.remove('rating-invalid'); return }
  const n = parseFloat(el.value)
  if (!el.value) { el.value = ''; entryForm.value[field] = ''; el.classList.remove('rating-invalid') }
  else if (isNaN(n) || n < 0 || n > 5) { el.value = ''; entryForm.value[field] = ''; el.classList.remove('rating-invalid') }
  else { entryForm.value[field] = Math.round(n * 100) / 100; el.value = entryForm.value[field] }
}

const computedAvg = computed(() => {
  const e = Number(entryForm.value.ratingEfficiency)
  const q = Number(entryForm.value.ratingQuality)
  const t = Number(entryForm.value.ratingTimeliness)
  return (e && q && t) ? Math.round((e + q + t) / 3 * 100) / 100 : null
})

const liveScore = computed(() => calculateScoreFromEntries(allEntries.value, activeForm.value))
const displayScore = computed(() => {
  if (liveScore.value?.score) return liveScore.value.score
  const saved = Number(activeForm.value?.finalNumericalRating)
  if (saved > 0) return saved
  return null
})
const displayAdjectivalRating = computed(() =>
  liveScore.value?.label || activeForm.value?.adjectivalRating || (displayScore.value ? ratingLabel(displayScore.value) : '')
)

const scoreColorClass = computed(() => {
  const s = Number(displayScore.value)
  if (s >= 4.5) return 'score-out'
  if (s >= 3.5) return 'score-vs'
  if (s >= 2.5) return 'score-sat'
  return 'score-low'
})

const readinessItems = computed(() => {
  if (!activeForm.value) return []
  const rows = allEntries.value
  const selectedStatus = activePeriodStatus.value
  const missingPeriod = rows.filter(e => !e.applicableRatingPeriod).length
  const missingMov = rows.filter(e => !e.meansOfVerification).length
  const missingAccomplishment = rows.filter(e => !e.accomplishment).length
  const missingRating = rows.filter(e => !entryAverage(e)).length
  const hasTargetsDoc = !!(selectedStatus?.hasTargetsDoc || activeForm.value.targetsGeneratedAt)
  const hasRatingsDoc = !!(
    selectedStatus?.hasRatingsDoc ||
    selectedStatus?.hasS1RatingsDoc ||
    selectedStatus?.hasS2RatingsDoc ||
    activeForm.value.s1RatingsGeneratedAt ||
    activeForm.value.s2RatingsGeneratedAt
  )
  const feedbackDone = !!(
    activeForm.value.feedbackStrengths ||
    activeForm.value.feedbackComments ||
    activeForm.value.feedbackRecommendations ||
    activeForm.value.feedbackAreasForImprovement
  )

  return [
    {
      key: 'indicators',
      ok: rows.length > 0,
      title: 'Indicators',
      copy: rows.length ? `${rows.length} indicator${rows.length !== 1 ? 's' : ''} selected.` : 'Add at least one KRA / success indicator.'
    },
    {
      key: 'periods',
      ok: rows.length > 0 && missingPeriod === 0,
      title: 'Applicable periods',
      copy: missingPeriod ? `${missingPeriod} indicator${missingPeriod !== 1 ? 's' : ''} missing applicable rating period.` : 'All indicators have rating periods.'
    },
    {
      key: 'mov',
      ok: rows.length > 0 && missingMov === 0,
      title: 'Means of verification',
      copy: missingMov ? `${missingMov} indicator${missingMov !== 1 ? 's' : ''} missing MOV.` : 'All indicators have MOV basis.'
    },
    {
      key: 'targets-sheet',
      ok: hasTargetsDoc && !selectedStatus?.docMissing,
      title: 'Targets sheet',
      copy: selectedStatus?.docMissing ? 'Generated spreadsheet was deleted from Drive.' : hasTargetsDoc ? 'Targets sheet is available.' : 'Targets sheet not generated yet.'
    },
    {
      key: 'ratings',
      ok: rows.length > 0 && missingAccomplishment === 0 && missingRating === 0,
      title: 'Ratings entries',
      copy: missingAccomplishment || missingRating
        ? `${missingAccomplishment} accomplishment${missingAccomplishment !== 1 ? 's' : ''} and ${missingRating} rating${missingRating !== 1 ? 's' : ''} still incomplete.`
        : 'Accomplishments and ratings are complete.'
    },
    {
      key: 'ratings-sheet',
      ok: hasRatingsDoc && !selectedStatus?.docMissing,
      title: 'Ratings sheet',
      copy: selectedStatus?.docMissing ? 'Generated spreadsheet was deleted from Drive.' : hasRatingsDoc ? 'Ratings sheet is available.' : 'Ratings sheet not generated yet.'
    },
    {
      key: 'part-ii',
      ok: activeForm.value.status !== 'Rated' || feedbackDone,
      title: 'Part II feedback',
      copy: feedbackDone ? 'Feedback/proposed intervention has entries.' : 'Division Chief feedback is still pending.'
    }
  ]
})

const readinessSummary = computed(() => {
  const items = readinessItems.value
  const readyCount = items.filter(item => item.ok).length
  const ready = items.length > 0 && readyCount === items.length
  return {
    ready,
    title: ready ? 'Everything looks ready.' : `${readyCount}/${items.length} checks complete`
  }
})

const activePeriodStatus = computed(() => {
  if (!activeForm.value || !periodStatusInfo.value) return null
  if (String(periodStatusInfo.value.formId || '') !== String(activeForm.value.id || '')) return null
  return periodStatusInfo.value
})

const { canApprove, isAdmin, isDirector, isAsstDir } = usePermissions()
const canFinalize  = computed(() => isAdmin.value || isDirector.value || isAsstDir.value)
const canSelfServe = computed(() => !isDirector.value && !isAsstDir.value)
const canReviewActiveForm = computed(() =>
  activeForm.value &&
  (activeForm.value.canReview === true || activeForm.value.canReview === 'true' || canApprove.value) &&
  String(activeForm.value.userId || '') !== String(authStore.profileId || '')
)
/**
 * Only Contract of Service personnel are assessed with the CCEF. Everyone else
 * - Regular, Co-Terminus and Contractual - uses the IPCRF.
 *
 * This matched on the substring 'contract', which also caught 'Contractual'.
 * That is a different appointment status and belongs on the IPCRF, so the test
 * is exact rather than a substring. Normalising first means the legacy
 * spellings ('COS', 'cos', 'Contract of Service') still resolve correctly.
 */
function isCosEmploymentType(value) {
  return normalizeEmploymentType(value) === 'Contract of Service (COS)'
}

const myFormType   = computed(() => isCosEmploymentType(authStore.employmentType) ? 'CCEF' : 'IPCRF')

// Period-level Generate Targets/Ratings (self-service, list-page entry point)

const periodYear     = ref(new Date().getFullYear())
const periodBusy     = ref('')
const periodStatusInfo    = ref(null)
const periodStatusLoading = ref(false)
let periodStatusRefreshTimer = null

// ── Helpers ──
function countByStatus(s)   { return forms.value.filter(f => f.status === s).length }
function posWeight(item)    {
  const l = activeForm.value?.positionLevel || 'III'
  return Number(item[`weight${l}`] || item.weight || 0)
}
function fmtDate(iso)       { return iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function isSelected(item)   { return libSelected.value.some(s => s.id === item.id) }
function entryAverage(entry) {
  const e = Number(entry?.ratingEfficiency)
  const q = Number(entry?.ratingQuality)
  const t = Number(entry?.ratingTimeliness)
  if ([e, q, t].every(v => Number.isFinite(v) && v > 0)) {
    return Math.round(((e + q + t) / 3) * 100) / 100
  }

  const saved = Number(entry?.ratingAverage)
  if (Number.isFinite(saved) && saved > 0) return Math.round(saved * 100) / 100
  return null
}
function ratingLabel(score) {
  const s = Number(score)
  if (s >= 4.5) return 'Outstanding'
  if (s >= 3.5) return 'Very Satisfactory'
  if (s >= 2.5) return 'Satisfactory'
  if (s >= 1.5) return 'Unsatisfactory'
  return 'Poor'
}
function calculateScoreFromEntries(entries, form) {
  const rows = Array.isArray(entries) ? entries : []
  const rated = rows.filter(e => entryAverage(e))
  if (!rated.length) return null

  const coreRows = rows.filter(e => e.functionType === 'Core')
  const supportRows = rows.filter(e => e.functionType === 'Support')
  const average = (list) => {
    const listRated = list.filter(e => entryAverage(e))
    if (!listRated.length) return 0
    return listRated.reduce((sum, e) => sum + Number(entryAverage(e)), 0) / listRated.length
  }

  const coreAvg = average(coreRows)
  const supportAvg = average(supportRows)
  const coreWeight = Number(form?.coreFunctionWeight) || 70
  const supportWeight = Number(form?.supportFunctionWeight) || 30

  let score = 0
  if (coreRows.length && supportRows.length) score = (coreAvg * coreWeight + supportAvg * supportWeight) / 100
  else if (coreRows.length) score = coreAvg
  else score = supportAvg

  score = Math.round(score * 100) / 100
  return { score, label: ratingLabel(score), ratedCount: rated.length, entryCount: rows.length }
}
function autoScoreKey() {
  const score = liveScore.value
  if (!activeForm.value?.id || !score) return ''
  const ratings = allEntries.value
    .map(e => `${e.id}:${entryAverage(e) ?? ''}`)
    .join('|')
  return `${activeForm.value.id}:${score.score}:${ratings}`
}
function queueAutoComputeScore() {
  if (autoScoreTimer) clearTimeout(autoScoreTimer)
  autoScoreTimer = setTimeout(() => {
    autoScoreTimer = null
    autoComputeScore()
  }, 450)
}
async function autoComputeScore() {
  const score = liveScore.value
  if (!activeForm.value?.id || !score || entriesLoading.value || scoreBusy.value) return

  const savedScore = Number(activeForm.value.finalNumericalRating)
  const savedLabel = activeForm.value.adjectivalRating || ''
  const currentKey = autoScoreKey()
  if (lastAutoScoreKey.value === currentKey && savedScore === score.score && savedLabel === score.label) return

  lastAutoScoreKey.value = currentKey
  scoreBusy.value = true
  try {
    const updated = await ipcrfApi.computeScore(activeForm.value.id)
    _sync(updated)
  } catch {
    lastAutoScoreKey.value = ''
  } finally {
    scoreBusy.value = false
  }
}
function toggleSelect(item) {
  const i = libSelected.value.findIndex(s => s.id === item.id)
  if (i !== -1) libSelected.value.splice(i, 1)
  else libSelected.value.push({
    ...item,
    applicableRatingPeriod: defaultApplicablePeriod(item)
  })
}
function defaultApplicablePeriod(item) {
  const value = String(item.applicableTo || '').toLowerCase()
  if (value.includes('1')) return '1st Semester'
  if (value.includes('2')) return '2nd Semester'
  return 'Both semesters'
}
function cancelLibrary()  { showLibrary.value = false; showLibConfirm.value = false; libSelected.value = [] }
function closeEntry()     { showEntryModal.value = false; editingEntry.value = null }
function closeFormModal() {
  showFormModal.value = false
  activeForm.value = null
  allEntries.value = []
  libSelected.value = []
  showLibrary.value = false
  showLibConfirm.value = false
}

function statusClass(status) {
  const map = { Draft: 'st-draft', Submitted: 'st-submitted', Returned: 'st-returned', Approved: 'st-approved', Rated: 'st-rated', Finalized: 'st-finalized' }
  return map[status] || 'st-draft'
}

onMounted(() => {
  loadForms()
  loadPeriodStatus()
  startPeriodStatusRefresh()
})
onUnmounted(() => {
  if (periodWatchTimer) clearTimeout(periodWatchTimer)
  if (periodStatusRefreshTimer) clearInterval(periodStatusRefreshTimer)
  if (autoScoreTimer) clearTimeout(autoScoreTimer)
  window.removeEventListener('focus', refreshPeriodStatusOnFocus)
  document.removeEventListener('visibilitychange', refreshPeriodStatusOnFocus)
})

let periodWatchTimer = null
watch(periodYear, () => {
  clearTimeout(periodWatchTimer)
  periodWatchTimer = setTimeout(loadPeriodStatus, 400)
})

async function loadPeriodStatus() {
  if (!canSelfServe.value) return
  periodStatusLoading.value = true
  try {
    periodStatusInfo.value = await ipcrfApi.periodStatus(periodYear.value)
  } catch (e) {
    periodStatusInfo.value = null
  } finally {
    periodStatusLoading.value = false
  }
}

function startPeriodStatusRefresh() {
  if (!canSelfServe.value) return
  if (periodStatusRefreshTimer) clearInterval(periodStatusRefreshTimer)
  periodStatusRefreshTimer = setInterval(() => {
    if (!document.hidden && !periodBusy.value) loadPeriodStatus()
  }, 60000)
  window.addEventListener('focus', refreshPeriodStatusOnFocus)
  document.addEventListener('visibilitychange', refreshPeriodStatusOnFocus)
}

function refreshPeriodStatusOnFocus() {
  if (!document.hidden && !periodBusy.value) loadPeriodStatus()
}

// ── API ──
async function loadForms() {
  loading.value = true
  try {
    const r = await ipcrfApi.listForms(authStore.profileId ? { userId: authStore.profileId } : {})
    forms.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) {
    console.error(e); showToast('Could not load forms. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

function canReviewForm(form) {
  return !!(
    form &&
    form.status === 'Submitted' &&
    (form.canReview === true || form.canReview === 'true' || canApprove.value) &&
    String(form.userId || '') !== String(authStore.profileId || '')
  )
}

async function openFormModal(form) {
  activeForm.value   = form
  activeTab.value    = 'indicators'
  allEntries.value   = []
  docGen.value.printing = false
  reviewNotes.value  = {}
  lastAutoScoreKey.value = ''
  if (form.status === 'Returned') loadReviewNotes(form.id)
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
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    entriesLoading.value = false
  }
  if (activeTab.value === 'score') queueAutoComputeScore()
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

  const existing = forms.value.find(f =>
    f.year === newForm.value.year &&
    f.type === newForm.value.type &&
    f.employeeEmail === authStore.email
  )

  if (existing && !showFormRecreateWarning.value) {
    existingFormForYear.value = existing
    showFormRecreateWarning.value = true
    return
  }

  if (!showFormRecreateWarning.value) {
    const ok = await confirm(CONFIRMS.createForm(newForm.value.type, newForm.value.year))
    if (!ok) return
  }

  creating.value = true
  try {
    if (existingFormForYear.value) {
      deletingOldForm.value = true
      await ipcrfApi.deleteForm(existingFormForYear.value.id)
      forms.value = forms.value.filter(f => f.id !== existingFormForYear.value.id)
      deletingOldForm.value = false
    }

    const f = await ipcrfApi.createForm(newForm.value)
    forms.value.unshift(f)
    showNewFormModal.value = false
    showFormRecreateWarning.value = false
    existingFormForYear.value = null
    showToast('Form created successfully.')
    await openFormModal(f)
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    creating.value = false
    deletingOldForm.value = false
  }
}

// Quick actions from list item
async function quickSubmit(form)  {
  const ok = await confirm(CONFIRMS.submitForm(form.type, form.year))
  if (!ok) return
  try { const u = await ipcrfApi.submitForm(form.id);  _syncList(form.id, u); showToast('Submitted') } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
}
async function quickApprove(form) {
  if (!canReviewForm(form) || quickBusyId.value) return
  const ok = await confirm(CONFIRMS.approveForm(form.employeeName, form.type))
  if (!ok) return
  quickBusyId.value = form.id
  try { const u = await ipcrfApi.approveForm(form.id); _syncList(form.id, u); showToast('Approved') } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { quickBusyId.value = '' }
}
async function quickReturn(form)  {
  if (!canReviewForm(form) || quickBusyId.value) return
  const ok = await confirm(CONFIRMS.returnForm(form.employeeName))
  if (!ok) return
  quickBusyId.value = form.id
  try { const u = await ipcrfApi.returnForm(form.id, { remarks: confirmState.inputValue });  _syncList(form.id, u); showToast('Returned') } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { quickBusyId.value = '' }
}
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
  const ok = await confirm({
    type: 'info',
    title: 'Add Selected Indicators',
    message: `${items.length} selected indicator${items.length !== 1 ? 's' : ''} will be added to this ${activeForm.value?.type || 'form'}.`,
    note: 'You can still edit the indicator details before submitting the form.',
    confirmLabel: 'Add Indicators',
    cancelLabel: 'Review Again'
  })
  if (!ok) return
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
        applicableRatingPeriod: item.applicableRatingPeriod || defaultApplicablePeriod(item),
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
  const ok = await confirm(CONFIRMS.saveEntry(!!editingEntry.value))
  if (!ok) return
  savingEntry.value = true
  try {
    if (editingEntry.value) {
      const u = await ipcrfApi.updateEntry(activeForm.value.id, editingEntry.value.id, { ...entryForm.value, ratingAverage: computedAvg.value || entryForm.value.ratingAverage || '' })
      const i = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (i !== -1) allEntries.value[i] = { ...allEntries.value[i], ...u }
      showToast('Indicator updated')
      queueAutoComputeScore()
    } else {
      const e = await ipcrfApi.addEntry(activeForm.value.id, { ...entryForm.value, functionType: currentFnType.value, isCustom: true })
      allEntries.value.push(e)
      showToast('Indicator added')
      queueAutoComputeScore()
    }
    closeEntry()
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
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
    queueAutoComputeScore()
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { deletingEntry.value = false }
}

async function doSubmit()  {
  if (wfBusy.value) return
  const ok = await confirm(CONFIRMS.submitForm(activeForm.value.type, activeForm.value.year))
  if (!ok) return
  wfBusy.value = true
  try { const u = await ipcrfApi.submitForm(activeForm.value.id);  _sync(u); showToast('Submitted') }       catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { wfBusy.value = false }
}
async function doApprove() {
  if (!canReviewActiveForm.value || wfBusy.value) return
  const ok = await confirm(CONFIRMS.approveForm(activeForm.value.employeeName, activeForm.value.type))
  if (!ok) return
  wfBusy.value = true
  try { const u = await ipcrfApi.approveForm(activeForm.value.id); _sync(u); showToast('Approved') }       catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { wfBusy.value = false }
}
async function doReturn()  {
  if (!canReviewActiveForm.value || wfBusy.value) return
  const ok = await confirm(CONFIRMS.returnForm(activeForm.value.employeeName))
  if (!ok) return
  wfBusy.value = true
  try { const u = await ipcrfApi.returnForm(activeForm.value.id, { remarks: confirmState.inputValue });  _sync(u); showToast('Returned for revision') } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { wfBusy.value = false }
}
async function doCompute() {
  if (wfBusy.value) return
  const ok = await confirm(CONFIRMS.computeScore(activeForm.value.employeeName))
  if (!ok) return
  wfBusy.value = true
  try { const u = await ipcrfApi.computeScore(activeForm.value.id); _sync(u); showToast(`${u.finalNumericalRating} - ${u.adjectivalRating}`) } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') } finally { wfBusy.value = false }
}

async function doMarkRated() {
  if (ratingBusy.value) return
  const ok = await confirm({
    type: 'approve',
    title: `Mark ${activeForm.value?.type || 'Form'} as Rated`,
    message: `This will save the final rating and move ${activeForm.value?.employeeName || 'this form'} to Rated status.`,
    confirmLabel: 'Mark as Rated',
    cancelLabel: 'Cancel'
  })
  if (!ok) return
  ratingBusy.value = true
  try {
    const u = await ipcrfApi.rateForm(activeForm.value.id, {
      finalNumericalRating: activeForm.value.finalNumericalRating,
      adjectivalRating:     activeForm.value.adjectivalRating,
      ...feedbackForm.value
    })
    _sync(u)
    showToast('Form marked as Rated')
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { ratingBusy.value = false }
}

async function doSubmitRatings() {
  if (ratingBusy.value) return
  const ok = await confirm({
    type: 'submit',
    title: 'Submit Ratings for Review',
    message: `This will submit your ${activeForm.value?.type || 'form'} ratings to the Division Chief for review.`,
    note: 'Make sure your accomplishments and ratings are complete before submitting.',
    confirmLabel: 'Submit Ratings',
    cancelLabel: 'Cancel'
  })
  if (!ok) return
  ratingBusy.value = true
  try {
    const u = await ipcrfApi.submitRatings(activeForm.value.id)
    _sync(u)
    showToast('Ratings submitted for Division Chief review.')
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { ratingBusy.value = false }
}

async function doFinalize() {
  if (ratingBusy.value) return
  const ok = await confirm({
    type: 'approve',
    title: 'Finalize Form',
    message: `This will finalize ${activeForm.value?.employeeName || 'this'} ${activeForm.value?.type || 'form'}.`,
    note: 'Finalized forms are treated as completed records.',
    confirmLabel: 'Finalize',
    cancelLabel: 'Cancel'
  })
  if (!ok) return
  ratingBusy.value = true
  try {
    const u = await ipcrfApi.finalizeForm(activeForm.value.id, finalizeForm.value)
    _sync(u)
    showToast('Form finalized')
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { ratingBusy.value = false }
}

// ── Self-service period Generate (list-page entry point) ──
async function doPeriodGenerate(kind, sem) {
  if (periodBusy.value) return
  const isRatings = kind === 'ratings'
  const semLabel  = sem === 1 ? '1st Semester' : '2nd Semester'
  const docName   = isRatings ? `${semLabel} Ratings Sheet` : 'Targets Sheet'
  const busyKey   = isRatings ? `ratings-${sem}` : 'targets'

  const ok = await confirm({
    type: 'submit',
    title: `Generate ${myFormType.value} ${docName}`,
    message: `This will generate or regenerate the ${docName.toLowerCase()} for ${periodYear.value}.`,
    details: [
      { label: 'Form Type', value: myFormType.value },
      { label: 'Period',    value: isRatings ? `${semLabel} ${periodYear.value}` : `${periodYear.value}` }
    ],
    note: 'If a generated sheet already exists, it will be replaced in the same file.',
    confirmLabel: `Generate ${docName}`,
    cancelLabel: 'Cancel'
  })
  if (!ok) return
  periodBusy.value = busyKey
  try {
    const status = await ipcrfApi.periodStatus(periodYear.value)

    if (!status.hasForm) {
      if (!isRatings) {
        showToast(`No ${status.type} Targets form yet for ${periodYear.value} - create one below.`, 'error')
        newForm.value = { ...newForm.value, type: status.type, year: Number(periodYear.value) }
        showNewFormModal.value = true
      } else {
        showToast(`Create your ${status.type} form for ${periodYear.value} first.`, 'error')
      }
      return
    }

    if (!isRatings) {
      const r = await docGenApi.generateTargets(status.formId)
      _syncList(status.formId, { docFileId: r.fileId, targetsGeneratedAt: new Date().toISOString() })
      periodStatusInfo.value = {
        ...periodStatusInfo.value,
        docFileId:     r.fileId,
        docFileUrl:    `https://docs.google.com/spreadsheets/d/${r.fileId}/edit`,
        hasTargetsDoc: true,
        docMissing:    false
      }
      showToast('Targets document generated')
      return
    }

    if (status.totalEntries === 0) {
      showToast('Add indicators to this form before generating Ratings.', 'error')
      return
    }
    if (!status.hasTargetsDoc) {
      showToast('Generate the Targets sheet first so Ratings can be added to the same file.', 'error')
      return
    }
    const r = await docGenApi.generateRatings(status.formId, sem)
    const ratingsField = sem === 2 ? 's2RatingsGeneratedAt' : 's1RatingsGeneratedAt'
    _syncList(status.formId, { docFileId: r.fileId, [ratingsField]: new Date().toISOString() })
    periodStatusInfo.value = {
      ...periodStatusInfo.value,
      docFileId:        r.fileId,
      docFileUrl:       `https://docs.google.com/spreadsheets/d/${r.fileId}/edit`,
      hasRatingsDoc:    true,
      ...(sem === 2 ? { hasS2RatingsDoc: true } : { hasS1RatingsDoc: true }),
      docMissing:       false
    }
    showToast(`${semLabel} Ratings document generated`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { periodBusy.value = ''; loadPeriodStatus() }
}

function _sync(u) {
  activeForm.value = { ...activeForm.value, ...u }
  const i = forms.value.findIndex(f => f.id === activeForm.value.id)
  if (i !== -1) forms.value[i] = activeForm.value
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
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { docGen.value.printing = false }
}
</script>

<style scoped>
*{box-sizing:border-box;}
.ipcrf-page { padding: 0; font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;color:#1A2332;background: transparent; min-height: 100%; }
.muted-text{color:#94A3B8;}
.req{color:#EF4444;font-size:11px;}
.ml6{margin-left:6px;}

/* Two-panel shell */
.tp-shell { display: flex; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; min-height: 560px; }
.tp-left { width: 650px; flex-shrink: 0; border-right: 1px solid #E2E8F0; display: flex; flex-direction: column; overflow-y: auto; max-height: 84vh; scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }
.tp-left::-webkit-scrollbar { width: 4px; }
.tp-left::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
.tp-right { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; max-height: 84vh; }
.ipcrf-left-inner { padding: 20px; display: flex; flex-direction: column; flex: 1; }

/* Right panel states */
.rp-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #94A3B8; padding: 40px 20px; }
.rp-empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.rp-empty-sub { font-size: 12px; color: #94A3B8; text-align: center; }

/* Right panel detail */
.rp-detail-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.rp-detail-body { flex: 1; overflow-y: auto; min-height: 0; padding: 20px 28px 24px; scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }
.rp-detail-body::-webkit-scrollbar { width: 4px; }
.rp-detail-body::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
.rp-tab-content { display: flex; flex-direction: column; gap: 0; }

/* Header */
.page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:10px;}
.page-title{font-size:18px;font-weight:700;color:#0F172A;margin:0 0 3px;letter-spacing:-.3px;}
.page-sub{font-size:11px;color:#94A3B8;margin:0;}

/* Filters */
.filter-bar{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;}

/* Self-service period generate bar */
.generate-bar{display:flex;flex-direction:column;gap:9px;padding:10px 14px;margin-bottom:14px;background:#F5F9FF;border:1px solid #DCE9FB;border-radius:10px;}
.generate-period{display:flex;align-items:center;gap:7px;}
.generate-period .field-label{margin:0;font-size:11px;}
.generate-period .filter-select:first-of-type{flex:1;min-width:0;}
.generate-actions{display:flex;gap:7px;}
.generate-actions>*{flex:1;min-width:0;text-align:center;justify-content:center;}
.generate-item{display:flex;align-items:center;justify-content:center;gap:6px;}
.generate-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;}
.generate-hint{font-size:10px;color:#94A3B8;font-weight:500;line-height:1.2;}
.generate-hint--warn{color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:3px 8px;}
.btn-regenerate{padding:4px 9px;border-color:#CBD5E1;background:#fff;color:#334155;font-size:11px;font-weight:600;}
.btn-regenerate:hover:not(:disabled){border-color:#3B82F6;background:#EFF6FF;color:#1D4ED8;}
.btn-active-ok{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.btn-active-ok:hover{background:#DCFCE7;}

.status-tabs{display:flex;gap:4px;flex-wrap:wrap;width:100%;}
.status-tab{padding:4px 8px;border-radius:20px;font-size:11px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;flex:1;text-align:center;white-space:nowrap;}
.status-tab:hover{border-color:#CBD5E1;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.tab-badge{background:#3B82F6;color:#fff;border-radius:10px;font-size:10px;padding:1px 5px;margin-left:3px;}
.filter-selects{display:flex;gap:6px;width:100%;}
.filter-selects .filter-select{flex:1 1 0;min-width:0;width:0;}
.filter-select{padding:6px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;color:#374151;background:#fff;outline:none;cursor:pointer;}
.filter-select:focus{border-color:#3B82F6;}

/* Forms list */
.forms-list { display: flex; flex-direction: column; }
.fli { padding: 14px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; display: flex; flex-direction: column; gap: 6px; }
.fli:last-child { border-bottom: none; }
.fli:hover { background: #F8FBFF; }
.fli-active { background: #EFF6FF !important; border-left: 3px solid #1A56B0; padding-left: 15px; }
.fli-sk { pointer-events: none; }
.fli-sk-top { display: flex; gap: 8px; margin-bottom: 6px; }
.fli-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fli-period { font-size: 11px; color: #64748B; }
.fli-name { font-size: 14px; font-weight: 700; color: #0F172A; }
.fli-sub { font-size: 11.5px; color: #64748B; }
.fli-score { display: flex; align-items: baseline; gap: 4px; }
.fli-score-val { font-size: 17px; font-weight: 800; color: #1A56B0; }
.fli-score-lbl { font-size: 10px; color: #64748B; }
.fli-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #F1F5F9; margin-top: 2px; }
.fli-date { font-size: 10.5px; color: #94A3B8; }
.fli-actions { display: flex; align-items: center; gap: 4px; }

/* Type badges */
.type-badge{display:inline-flex;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.3px;}
.type-ipcrf{background:#EBF4FF;color:#1A56B0;}
.type-ccef{background:#F3EEFF;color:#6B3FA0;}

/* Status badges */
.status-badge{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.st-draft{background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}
.st-submitted{background:#FEF3E2;color:#B45309;}
.st-returned{background:#FEF2F2;color:#B91C1C;}
.st-approved{background:#EBF4FF;color:#1A56B0;}
.st-rated{background:#F3EEFF;color:#6B3FA0;}
.st-finalized{background:#F0FDF4;color:#15803D;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-weight:500;}
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
.regen-warning{background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:18px 16px;}
.btn-sm{padding:5px 12px;font-size:11px;}
.btn-xs{padding:4px 7px;font-size:10.5px;border-radius:6px;white-space:nowrap;}
.btn-icon-only{padding:5px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;}
.btn-outline{border-color:#CBD5E1;}
.btn-info { background: #EBF4FF; color: #1A56B0; border-color: #BFDBFE; }
.btn-info:hover { background: #DBEAFE; }

/* Empty */
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 16px;gap:8px;color:#94A3B8;text-align:center;}
.empty-title{font-size:14px;font-weight:600;color:#374151;margin-top:4px;}
.empty-sub{font-size:12px;margin-bottom:8px;color:#94A3B8;}

/* Skeleton */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;height:12px;display:block;}
.sk-badge{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.4s infinite;border-radius:6px;width:50px;height:20px;display:inline-block;}

/* Modal overlay */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;backdrop-filter:blur(4px);}

/* Modal base */
.modal{background:#fff;border-radius:16px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;}
.modal-lib{max-width:740px;}
.modal-confirm{max-width:620px;}

/* Modal header */
.modal-hd{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;flex-shrink:0;}
.modal-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin:0 0 2px;}
.modal-sub{font-size:12px;color:#94A3B8;margin:0;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;transition:all .15s;flex-shrink:0;}
.modal-close:hover{background:#F1F5F9;color:#374151;}
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;flex-shrink:0;}

/* Form detail header (right panel) */
.dh{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 28px 16px;border-bottom:1px solid #E8EDF3;flex-shrink:0;gap:12px;background:linear-gradient(to bottom,#FAFBFF,#F7F9FF);}
.dh-info{flex:1;min-width:0;}
.dh-badges{display:flex;gap:6px;margin-bottom:8px;}
.dh-name{font-size:17px;font-weight:700;color:#0F172A;letter-spacing:-.4px;}
.dh-sub{font-size:12px;color:#64748B;margin-top:3px;}

/* Smart readiness */
.readiness-trigger{margin-left:auto;margin-right:10px;display:flex;align-items:center;gap:7px;height:34px;padding:0 11px;border:1px solid #DCE7F5;border-radius:10px;background:#FFFFFF;color:#475569;font-size:11px;font-weight:700;cursor:pointer;}
.readiness-trigger:hover{background:#F5F9FF;border-color:#BFDBFE;color:#1A56B0;}
.readiness-trigger strong{color:#0F172A;font-size:10.5px;font-weight:800;}
.readiness-dot{width:7px;height:7px;border-radius:50%;background:#F59E0B;flex-shrink:0;}
.readiness-dot.ok{background:#22C55E;}
.readiness-dot.warn{background:#F59E0B;}
.modal-readiness{max-width:620px;}
.readiness-summary-card{padding:12px;border:1px solid #DCE7F5;border-radius:12px;background:#F8FBFF;margin-bottom:12px;}
.readiness-summary-copy{margin-top:5px;color:#64748B;font-size:11.5px;line-height:1.45;}
.smart-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
.smart-eyebrow{color:#1A56B0;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;}
.smart-title{margin-top:2px;color:#0F172A;font-size:13px;font-weight:800;}
.smart-pill{flex-shrink:0;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:800;}
.smart-pill-ok{background:#DCFCE7;color:#15803D;}
.smart-pill-warn{background:#FEF3C7;color:#B45309;}
.smart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.smart-grid-modal{grid-template-columns:1fr;}
.smart-item{display:flex;gap:8px;min-width:0;padding:9px;border-radius:10px;background:#FFFFFF;border:1px solid #E5EEF9;}
.smart-dot{width:8px;height:8px;flex-shrink:0;margin-top:4px;border-radius:50%;background:#F59E0B;}
.smart-ok .smart-dot{background:#22C55E;}
.smart-item-title{color:#0F172A;font-size:11px;font-weight:800;}
.smart-item-copy{margin-top:2px;color:#64748B;font-size:10.5px;line-height:1.35;}

/* Tabs */
.dtabs{display:flex;padding:0 24px;border-bottom:1px solid #E8EDF3;flex-shrink:0;background:#fff;}
.dtab{flex:1 1 0;padding:13px 14px;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;border-bottom:3px solid transparent;margin-bottom:-1px;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:6px;}
.dtab:hover{color:#374151;background:#FAFBFF;}
.dtab.active{color:#1A56B0;border-bottom-color:#1A56B0;font-weight:700;background:#F5F9FF;}
.dtab-cnt{background:#EBF4FF;color:#1A56B0;border-radius:9px;font-size:10px;padding:1px 6px;font-weight:600;}

/* Loading */
.loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px 0;}
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
.add-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 11px;border-radius:12px;font-size:10px;font-weight:600;border:1px solid #BFDBFE;background:#EFF6FF;color:#1A56B0;cursor:pointer;transition:all .12s;}
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
.ind-note{font-size:11px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:5px 8px;line-height:1.5;margin-top:5px;}
.ind-note-lbl{font-weight:700;}

/* Returned-for-revision banner */
.ret-banner{margin:12px 20px 0;padding:11px 14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;}
.ret-banner-hd{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#B45309;}
.ret-by{font-size:11px;font-weight:500;color:#92400E;}
.ret-reason{margin-top:6px;font-size:12px;color:#78350F;line-height:1.6;white-space:pre-wrap;}
.ret-reason-muted{color:#A16207;font-style:italic;}

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
.score-help{max-width:380px;text-align:center;line-height:1.5;}
.score-view{text-align:center;}
.score-hero{display:inline-flex;align-items:baseline;gap:5px;padding:14px 24px;border-radius:14px;margin-bottom:8px;}
.score-out{background:#DCFCE7;}
.score-vs{background:#DBEAFE;}
.score-sat{background:#FEF9C3;}
.score-low{background:#FEE2E2;}
.score-big{font-size:52px;font-weight:800;color:#0F172A;line-height:1;letter-spacing:-2px;}
.score-denom{font-size:16px;color:#94A3B8;}
.score-adj{font-size:15px;font-weight:600;color:#374151;}
.score-auto{margin-top:6px;font-size:11px;color:#64748B;}
.score-table{margin-top:20px;border:1px solid #F1F5F9;border-radius:9px;overflow:hidden;}
.st-hd{display:flex;justify-content:space-between;padding:8px 14px;background:#F8FAFC;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;}
.st-row{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-top:1px solid #F8FAFC;}
.st-l{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.st-fn{width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;}
.fn-c{background:#EBF4FF;color:#1A56B0;}
.fn-s{background:#F3EEFF;color:#6B3FA0;}
.st-name{font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.st-val{font-size:12px;font-weight:600;color:#0F172A;flex-shrink:0;}
.rate-panel{margin-top:18px;padding:14px;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:9px;text-align:left;}

/* Library modal */
.lib-filters{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid #F1F5F9;flex-shrink:0;flex-wrap:wrap;}
.srch-wrap{flex:1;position:relative;min-width:160px;}
.srch-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;}
.srch-inp{width:100%;padding:8px 11px 8px 30px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12px;color:#0F172A;outline:none;}
.srch-inp:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.sel-strip{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;background:#EBF4FF;border-bottom:1px solid #BFDBFE;flex-shrink:0;}
.sel-cnt{font-size:12px;font-weight:600;color:#1A56B0;}
.sel-clr{font-size:11px;color:#64748B;background:none;border:none;cursor:pointer;text-decoration:underline;}
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
.ci-control-row{display:flex;align-items:flex-start;justify-content:flex-start;margin-top:10px;width:100%;}
.ci-period{width:100%;flex:1 1 auto;}
.ci-period-head{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;}
.ci-period-head .ci-label{margin:0;white-space:nowrap;flex-shrink:0;}
.ci-period-control{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.ci-period-control .ci-period-select{height:32px;padding:6px 10px;font-size:12px;font-weight:500;width:152px;border-radius:7px;background:#F8FAFC;color:#334155;cursor:pointer;}
.ci-period-control .ci-period-select:hover{border-color:#CBD5E1;background:#F1F5F9;}
.ci-mov-wrap{margin-top:8px;}
.ci-mov{font-size:12px;color:#64748B;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:6px;padding:6px 10px;line-height:1.55;}
.ci-rm{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;border:1px solid transparent;background:transparent;cursor:pointer;color:#94A3B8;flex-shrink:0;padding:0;}
.ci-rm:hover{background:#FEF2F2;color:#EF4444;}

/* Fullscreen lock */
.fullscreen-lock{position:fixed;inset:0;background:rgba(15,23,42,.9);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);}
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
.field-input{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;color:#0F172A;background:#fff;outline:none;transition:border-color .15s;resize:vertical;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.field-input::placeholder{color:#CBD5E1;}
.avg-box{background:#F0FDF4;color:#15803D;font-weight:600;cursor:default;pointer-events:none;}
.rating-field{text-align:center;font-weight:700;font-size:16px;transition:background .15s,border-color .15s,color .15s;}
.rating-invalid{background:#FEE2E2 !important;border-color:#EF4444 !important;color:#DC2626 !important;}

/* Type toggle */
.type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.type-toggle-single{grid-template-columns:1fr;}
.type-opt-locked{cursor:default;}
.type-opt-locked:hover{border-color:#3B82F6;}
.type-auto-hint{font-size:10.5px;color:#94A3B8;margin:6px 0 0;}
.type-opt{padding:12px;border:1.5px solid #E2E8F0;border-radius:10px;cursor:pointer;text-align:left;background:#fff;transition:all .15s;}
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

@media (max-width: 900px) {
  .dh{align-items:stretch;flex-wrap:wrap;}
  .readiness-trigger{order:3;width:100%;margin:4px 0 0;justify-content:space-between;}
  .smart-grid{grid-template-columns:1fr;}
}
</style>
