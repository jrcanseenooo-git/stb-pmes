<template>
  <div class="content">

    <!-- ── Page Header ── -->
    <div class="page-header">
      <div>
        <h2 class="page-title">IPCRF / CCEF Forms</h2>
        <p class="page-sub">Individual Performance Commitment and Review Forms</p>
      </div>
      <button class="btn btn-primary" @click="showNewFormModal = true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        New Form
      </button>
    </div>

    <!-- ── Filter Bar ── -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="t in statusTabs" :key="t.value"
          :class="['ftab', activeStatus === t.value && 'active']"
          @click="activeStatus = t.value">
          {{ t.label }}
          <span v-if="t.value !== 'ALL' && countByStatus(t.value) > 0" class="ftab-count">
            {{ countByStatus(t.value) }}
          </span>
        </button>
      </div>
      <div class="filter-right">
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="IPCRF">IPCRF</option>
          <option value="CCEF">CCEF</option>
        </select>
        <select v-model="filterSemester" class="filter-select">
          <option value="">All Semesters</option>
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
        </select>
      </div>
    </div>

    <!-- ── Loading skeleton ── -->
    <div v-if="loading" class="skeleton-grid">
      <div v-for="i in 4" :key="i" class="skeleton-card">
        <div class="sk sk-row"></div>
        <div class="sk sk-title"></div>
        <div class="sk sk-sub"></div>
      </div>
    </div>

    <!-- ── Empty state ── -->
    <div v-else-if="filteredForms.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="4" width="28" height="32" rx="3" stroke="#CBD5E1" stroke-width="1.8"/>
          <path d="M13 13h14M13 19h10M13 25h7" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="empty-title">No forms found</p>
      <p class="empty-sub">
        {{ activeStatus !== 'ALL' ? `No ${activeStatus.toLowerCase()} forms.` : 'Create your first IPCRF or CCEF form to get started.' }}
      </p>
      <button v-if="activeStatus === 'ALL'" class="btn btn-primary" @click="showNewFormModal = true">
        Create New Form
      </button>
    </div>

    <!-- ── Forms Grid ── -->
    <div v-else class="forms-grid" :class="activeForm ? 'forms-grid-narrow' : ''">
      <div v-for="form in filteredForms" :key="form.id"
        :class="['form-card', activeForm?.id === form.id && 'selected']"
        @click="openForm(form)">
        <div class="fc-top">
          <span :class="['type-badge', form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">{{ form.type }}</span>
          <span :class="['status-dot', `dot-${(form.status||'').toLowerCase()}`]">
            <span class="dot-pip"></span>{{ form.status }}
          </span>
        </div>
        <div class="fc-name">{{ form.employeeName }}</div>
        <div class="fc-meta">{{ form.divisionName || '—' }}</div>
        <div class="fc-footer">
          <span class="fc-period">Sem {{ form.semester }} · {{ form.year }}</span>
          <span v-if="form.finalNumericalRating" class="fc-score">{{ form.finalNumericalRating }}</span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════
         DETAIL PANEL (right side)
    ═══════════════════════════════════ -->
    <transition name="panel-slide">
      <div v-if="activeForm" class="detail-panel">

        <!-- Panel Header -->
        <div class="panel-hd">
          <div class="panel-hd-info">
            <div class="panel-badges">
              <span :class="['type-badge', activeForm.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">
                {{ activeForm.type }}
              </span>
              <span :class="['status-dot', `dot-${(activeForm.status||'').toLowerCase()}`]">
                <span class="dot-pip"></span>{{ activeForm.status }}
              </span>
            </div>
            <div class="panel-name">{{ activeForm.employeeName }}</div>
            <div class="panel-meta">Sem {{ activeForm.semester }} · {{ activeForm.year }} · {{ activeForm.divisionName }}</div>
          </div>
          <button class="close-btn" @click="activeForm = null">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Panel Tabs -->
        <div class="panel-tabs">
          <button :class="['ptab', activeTab === 'indicators' && 'active']" @click="activeTab = 'indicators'">
            Indicators
            <span v-if="allEntries.length" class="ptab-count">{{ allEntries.length }}</span>
          </button>
          <button :class="['ptab', activeTab === 'details' && 'active']" @click="activeTab = 'details'">Details</button>
          <button :class="['ptab', activeTab === 'score' && 'active']" @click="activeTab = 'score'">Score</button>
        </div>

        <!-- Loading entries -->
        <div v-if="entriesLoading" class="panel-body entries-loading">
          <div class="spinner-sm"></div>
          <span class="muted text-xs">Loading indicators…</span>
        </div>

        <!-- ── Indicators Tab ── -->
        <div v-else-if="activeTab === 'indicators'" class="panel-body">

          <!-- Core Functions block -->
          <div class="fn-block">
            <div class="fn-header">
              <div class="fn-header-left">
                <span class="fn-label">Core Functions</span>
                <span class="fn-weight">{{ activeForm.coreFunctionWeight }}%</span>
                <span class="fn-count">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="fn-actions">
                <button class="pill-btn" @click="openLibrary('Core')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                  Library
                </button>
                <button class="pill-btn" @click="openCustomEntry('Core')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                  Custom
                </button>
              </div>
            </div>

            <div v-if="coreEntries.length === 0" class="fn-empty">
              No core indicators added yet
            </div>
            <div v-else class="entries-list">
              <div v-for="e in coreEntries" :key="e.id" class="entry-card">
                <div class="entry-card-body">
                  <div class="entry-top">
                    <span class="entry-kra-tag">{{ e.kraName }}</span>
                    <div class="entry-actions-inline">
                      <button class="action-icon" @click.stop="openEditEntry(e)" title="Edit">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7.5 1.5l2 2L3.5 10H1.5V8L7.5 1.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
                      </button>
                      <button class="action-icon danger" @click.stop="confirmDeleteEntry(e)" title="Delete">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3h8M4.5 3V2h2v1M3.5 3v5.5c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="entry-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 90) }}</div>
                  <div class="entry-footer">
                    <span class="etag">Wt: {{ e.weight }}%</span>
                    <span class="etag">{{ e.applicableRatingPeriod }}</span>
                    <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                    <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Support Functions block -->
          <div class="fn-block">
            <div class="fn-header">
              <div class="fn-header-left">
                <span class="fn-label">Support Functions</span>
                <span class="fn-weight">{{ activeForm.supportFunctionWeight }}%</span>
                <span class="fn-count">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="fn-actions">
                <button class="pill-btn" @click="openLibrary('Support')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                  Library
                </button>
                <button class="pill-btn" @click="openCustomEntry('Support')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                  Custom
                </button>
              </div>
            </div>

            <div v-if="supportEntries.length === 0" class="fn-empty">
              No support indicators added yet
            </div>
            <div v-else class="entries-list">
              <div v-for="e in supportEntries" :key="e.id" class="entry-card">
                <div class="entry-card-body">
                  <div class="entry-top">
                    <span class="entry-kra-tag">{{ e.kraName }}</span>
                    <div class="entry-actions-inline">
                      <button class="action-icon" @click.stop="openEditEntry(e)" title="Edit">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7.5 1.5l2 2L3.5 10H1.5V8L7.5 1.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
                      </button>
                      <button class="action-icon danger" @click.stop="confirmDeleteEntry(e)" title="Delete">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3h8M4.5 3V2h2v1M3.5 3v5.5c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="entry-si" :title="e.successIndicator">{{ truncate(e.successIndicator, 90) }}</div>
                  <div class="entry-footer">
                    <span class="etag">Wt: {{ e.weight }}%</span>
                    <span class="etag">{{ e.applicableRatingPeriod }}</span>
                    <span v-if="e.isCustom === true || e.isCustom === 'true'" class="etag etag-amber">Custom</span>
                    <span v-if="e.ratingAverage" class="etag etag-green">Avg {{ e.ratingAverage }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Workflow buttons -->
          <div v-if="['DRAFT','RETURNED'].includes(activeForm.status)" class="workflow-bar">
            <div class="workflow-hint">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#64748B" stroke-width="1.2"/><path d="M6.5 6v3M6.5 4v.5" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/></svg>
              {{ allEntries.length }} indicator{{ allEntries.length !== 1 ? 's' : '' }} total
            </div>
            <button class="btn btn-primary btn-sm" @click="submitForm">Submit for Review</button>
          </div>
          <div v-if="activeForm.status === 'SUBMITTED'" class="workflow-bar">
            <span class="workflow-hint">Pending DC review</span>
            <div class="btn-group">
              <button class="btn btn-success btn-sm" @click="approveForm">Approve</button>
              <button class="btn btn-outline-danger btn-sm" @click="returnForm">Return</button>
            </div>
          </div>
        </div>

        <!-- ── Details Tab ── -->
        <div v-else-if="activeTab === 'details'" class="panel-body">
          <div class="detail-section">
            <div class="detail-section-title">Period & Classification</div>
            <div class="detail-row">
              <span class="dk">Semester / Year</span>
              <span class="dv">Sem {{ activeForm.semester }}, {{ activeForm.year }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Form Type</span>
              <span class="dv">{{ activeForm.type }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Position Level</span>
              <span class="dv">{{ activeForm.positionLevel || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Division</span>
              <span class="dv">{{ activeForm.divisionName || '—' }}</span>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-section-title">Weights</div>
            <div class="weights-bar-wrap">
              <div class="weights-bar">
                <div class="wb-core" :style="{ width: activeForm.coreFunctionWeight + '%' }">
                  Core {{ activeForm.coreFunctionWeight }}%
                </div>
                <div class="wb-support" :style="{ width: activeForm.supportFunctionWeight + '%' }">
                  Support {{ activeForm.supportFunctionWeight }}%
                </div>
              </div>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-section-title">Signatories</div>
            <div class="detail-row">
              <span class="dk">Immediate Supervisor</span>
              <span class="dv">{{ activeForm.immediateSupervisor || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Supervisor Position</span>
              <span class="dv">{{ activeForm.supervisorPosition || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Approving Authority</span>
              <span class="dv">{{ activeForm.approvingAuthority || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Authority Position</span>
              <span class="dv">{{ activeForm.authorityPosition || '—' }}</span>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-section-title">Timeline</div>
            <div class="detail-row">
              <span class="dk">Created</span>
              <span class="dv">{{ fmtDate(activeForm.createdAt) || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Submitted</span>
              <span class="dv">{{ fmtDate(activeForm.submittedAt) || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="dk">Approved</span>
              <span class="dv">{{ fmtDate(activeForm.approvedAt) || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- ── Score Tab ── -->
        <div v-else-if="activeTab === 'score'" class="panel-body">
          <div v-if="!activeForm.finalNumericalRating" class="score-empty">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="15" stroke="#E2E8F0" stroke-width="2"/>
              <path d="M18 10v8l5 3" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p class="muted text-sm">Score not yet computed</p>
            <button class="btn btn-primary btn-sm" @click="computeScore">Compute Score</button>
          </div>
          <div v-else>
            <div class="score-hero">
              <div class="score-circle" :class="scoreColorClass">
                <span class="score-num">{{ activeForm.finalNumericalRating }}</span>
                <span class="score-max">/ 5.0</span>
              </div>
              <div class="score-adj">{{ activeForm.adjectivalRating }}</div>
            </div>
            <div class="score-breakdown">
              <div class="score-breakdown-title">Breakdown</div>
              <div v-for="e in allEntries" :key="e.id" class="score-row">
                <div class="sr-left">
                  <span class="sr-fn" :class="e.functionType === 'Core' ? 'sr-core' : 'sr-support'">
                    {{ e.functionType[0] }}
                  </span>
                  <span class="sr-name">{{ e.kraName }}</span>
                </div>
                <div class="sr-right">
                  <span v-if="e.ratingAverage" class="sr-val">{{ e.ratingAverage }}</span>
                  <span v-else class="sr-val muted">—</span>
                </div>
              </div>
            </div>
            <button class="btn btn-sm mt-12" @click="computeScore">Recompute</button>
          </div>
        </div>

      </div>
    </transition>

    <!-- ══════════════════════════════════
         NEW FORM MODAL
    ═══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showNewFormModal" class="modal-overlay" @click.self="showNewFormModal = false">
        <div class="modal">
          <div class="modal-hd">
            <div>
              <div class="modal-title">New Performance Form</div>
              <div class="modal-sub">Set up a new IPCRF or CCEF form</div>
            </div>
            <button class="close-btn" @click="showNewFormModal = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-section-title">Basic Info</div>
            <div class="form-grid">
              <div class="field">
                <label class="fl">Form Type</label>
                <select v-model="newForm.type" class="fi">
                  <option>IPCRF</option>
                  <option>CCEF</option>
                </select>
              </div>
              <div class="field">
                <label class="fl">Position Level</label>
                <select v-model="newForm.positionLevel" class="fi">
                  <option value="II">Level II</option>
                  <option value="III">Level III</option>
                  <option value="IV">Level IV</option>
                </select>
              </div>
              <div class="field">
                <label class="fl">Semester</label>
                <select v-model="newForm.semester" class="fi">
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                </select>
              </div>
              <div class="field">
                <label class="fl">Year</label>
                <input v-model.number="newForm.year" type="number" class="fi" />
              </div>
            </div>
            <div class="form-section-title mt-14">Signatories</div>
            <div class="form-grid">
              <div class="field full">
                <label class="fl">Immediate Supervisor</label>
                <input v-model="newForm.immediateSupervisor" type="text" class="fi" placeholder="Full name" />
              </div>
              <div class="field full">
                <label class="fl">Supervisor Position</label>
                <input v-model="newForm.supervisorPosition" type="text" class="fi" placeholder="e.g. Division Chief / SWO V" />
              </div>
              <div class="field full">
                <label class="fl">Approving Authority</label>
                <input v-model="newForm.approvingAuthority" type="text" class="fi" placeholder="e.g. Helen Y. Suzara" />
              </div>
              <div class="field full">
                <label class="fl">Authority Position</label>
                <input v-model="newForm.authorityPosition" type="text" class="fi" placeholder="e.g. Bureau Director" />
              </div>
            </div>
          </div>
          <div class="modal-ft">
            <button class="btn" @click="showNewFormModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="creating" @click="createForm">
              {{ creating ? 'Creating…' : 'Create Form' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         KRA LIBRARY MODAL
    ═══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showLibrary" class="modal-overlay" @click.self="showLibrary = false">
        <div class="modal modal-lg">
          <div class="modal-hd">
            <div>
              <div class="modal-title">KRA Library</div>
              <div class="modal-sub">
                <span :class="['type-badge', currentFnType === 'Core' ? 'type-ipcrf' : 'type-ccef']" style="font-size:10px">
                  {{ currentFnType }} Functions
                </span>
                &nbsp; Select indicators to add
              </div>
            </div>
            <button class="close-btn" @click="showLibrary = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="lib-search-bar">
            <div class="search-wrap">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="search-icon">
                <circle cx="5.5" cy="5.5" r="4.5" stroke="#94A3B8" stroke-width="1.2"/>
                <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <input v-model="libSearch" type="text" class="search-input" placeholder="Search KRA name or indicator…" autofocus />
            </div>
            <select v-model="libPhase" class="fi" style="width:130px">
              <option value="">All Phases</option>
              <option v-for="p in libPhases" :key="p">{{ p }}</option>
            </select>
            <select v-model="libClass" class="fi" style="width:130px">
              <option value="">All Types</option>
              <option>Simple</option>
              <option>Complex</option>
              <option>Highly Technical</option>
            </select>
          </div>
          <div class="modal-body lib-body">
            <div v-if="libLoading" class="state-wrap">
              <div class="spinner"></div>
            </div>
            <div v-else-if="filteredLibrary.length === 0" class="state-wrap">
              <p class="muted text-sm">No matching indicators</p>
            </div>
            <div v-else class="lib-grid">
              <div v-for="item in filteredLibrary" :key="item.id" class="lib-card">
                <div class="lib-card-body">
                  <div class="lib-kra">{{ item.kraName }}</div>
                  <div class="lib-pi">{{ truncate(item.performanceIndicator || item.successIndicator || '', 100) }}</div>
                  <div class="lib-tags">
                    <span class="etag">{{ item.phase }}</span>
                    <span class="etag">Wt: {{ posWeight(item) }}%</span>
                    <span :class="['etag', item.classification !== 'Simple' ? 'etag-blue' : '']">{{ item.classification }}</span>
                  </div>
                </div>
                <button class="lib-add-btn" @click="addFromLibrary(item)">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Add
                </button>
              </div>
            </div>
          </div>
          <div class="modal-ft">
            <span class="muted text-xs">{{ filteredLibrary.length }} indicator{{ filteredLibrary.length !== 1 ? 's' : '' }}</span>
            <button class="btn btn-primary" @click="showLibrary = false">Done</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         ENTRY MODAL (Add / Edit)
    ═══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showEntryModal" class="modal-overlay" @click.self="closeEntryModal">
        <div class="modal">
          <div class="modal-hd">
            <div>
              <div class="modal-title">{{ editingEntry ? 'Edit Indicator' : 'Custom Indicator' }}</div>
              <div class="modal-sub">
                <span :class="['type-badge', currentFnType === 'Core' ? 'type-ipcrf' : 'type-ccef']" style="font-size:10px">
                  {{ currentFnType }} Function
                </span>
              </div>
            </div>
            <button class="close-btn" @click="closeEntryModal">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-section-title">Indicator Info</div>
            <div class="form-grid">
              <div class="field full">
                <label class="fl">KRA Name <span class="req">*</span></label>
                <input v-model="entryForm.kraName" type="text" class="fi" placeholder="e.g. Research" />
              </div>
              <div class="field full">
                <label class="fl">Success Indicator <span class="req">*</span></label>
                <textarea v-model="entryForm.successIndicator" class="fi" rows="3"
                  placeholder="Describe the specific output or target…"></textarea>
              </div>
              <div class="field">
                <label class="fl">Weight (%)</label>
                <input v-model.number="entryForm.weight" type="number" class="fi" min="0" max="100" />
              </div>
              <div class="field">
                <label class="fl">Classification</label>
                <select v-model="entryForm.classification" class="fi">
                  <option>Simple</option>
                  <option>Complex</option>
                  <option>Highly Technical</option>
                </select>
              </div>
              <div class="field full">
                <label class="fl">Applicable Period</label>
                <select v-model="entryForm.applicableRatingPeriod" class="fi">
                  <option>Both semesters</option>
                  <option>1st Semester</option>
                  <option>2nd Semester</option>
                </select>
              </div>
              <div class="field full">
                <label class="fl">Means of Verification</label>
                <input v-model="entryForm.meansOfVerification" type="text" class="fi"
                  placeholder="e.g. Approved report with memo endorsement" />
              </div>
            </div>
            <template v-if="editingEntry">
              <div class="form-section-title mt-14">Rating (optional)</div>
              <div class="form-grid">
                <div class="field full">
                  <label class="fl">Accomplishment</label>
                  <textarea v-model="entryForm.accomplishment" class="fi" rows="2"
                    placeholder="Describe what was accomplished this semester…"></textarea>
                </div>
                <div class="field">
                  <label class="fl">Efficiency (E) <span class="muted">1–5</span></label>
                  <input v-model.number="entryForm.ratingEfficiency" type="number" class="fi" min="1" max="5" step="0.01" />
                </div>
                <div class="field">
                  <label class="fl">Quality (Q) <span class="muted">1–5</span></label>
                  <input v-model.number="entryForm.ratingQuality" type="number" class="fi" min="1" max="5" step="0.01" />
                </div>
                <div class="field">
                  <label class="fl">Timeliness (T) <span class="muted">1–5</span></label>
                  <input v-model.number="entryForm.ratingTimeliness" type="number" class="fi" min="1" max="5" step="0.01" />
                </div>
                <div v-if="computedAvg" class="field">
                  <label class="fl">Average (computed)</label>
                  <div class="fi avg-display">{{ computedAvg }}</div>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-ft">
            <button class="btn" @click="closeEntryModal">Cancel</button>
            <button class="btn btn-primary" :disabled="savingEntry" @click="saveEntry">
              {{ savingEntry ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Add Indicator') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         CONFIRM DELETE
    ═══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="confirmDelete.show" class="modal-overlay" @click.self="confirmDelete.show = false">
        <div class="confirm-box">
          <div class="confirm-icon-wrap danger">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M8 5V3h4v2M5 5v11a2 2 0 002 2h6a2 2 0 002-2V5" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="confirm-title">Remove Indicator</div>
          <div class="confirm-msg">
            Remove <strong>{{ confirmDelete.entryName }}</strong> from this form?
            <br><span class="muted text-xs">This action cannot be undone.</span>
          </div>
          <div class="confirm-btns">
            <button class="btn" @click="confirmDelete.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="deletingEntry" @click="doDeleteEntry">
              {{ deletingEntry ? 'Removing…' : 'Remove' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ── Toast ── -->
    <teleport to="body">
      <transition name="toast">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
          <svg v-if="toast.type === 'success'" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#16A34A" stroke-width="1.2"/>
            <path d="M4 7l2.5 2.5L10 5" stroke="#16A34A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#DC2626" stroke-width="1.2"/>
            <path d="M7 4.5v3M7 9.5v.5" stroke="#DC2626" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          {{ toast.msg }}
        </div>
      </transition>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'

// ── State ──
const forms            = ref([])
const loading          = ref(false)
const entriesLoading   = ref(false)
const creating         = ref(false)
const activeStatus     = ref('ALL')
const filterType       = ref('')
const filterSemester   = ref('')
const activeForm       = ref(null)
const activeTab        = ref('indicators')
const allEntries       = ref([])
const showNewFormModal  = ref(false)
const showLibrary      = ref(false)
const showEntryModal   = ref(false)
const editingEntry     = ref(null)
const savingEntry      = ref(false)
const deletingEntry    = ref(false)
const libraryItems     = ref([])
const libLoading       = ref(false)
const libSearch        = ref('')
const libPhase         = ref('')
const libClass         = ref('')
const currentFnType    = ref('Core')
const toast            = ref({ show: false, msg: '', type: 'success' })
const confirmDelete    = ref({ show: false, entryId: null, entryName: '' })

const newForm = ref({
  type: 'IPCRF',
  semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(),
  positionLevel: 'III',
  immediateSupervisor: '',
  supervisorPosition: '',
  approvingAuthority: '',
  authorityPosition: ''
})

const entryForm = ref({
  kraName: '', successIndicator: '', functionType: 'Core',
  weight: 5, applicableRatingPeriod: 'Both semesters',
  classification: 'Complex', meansOfVerification: '',
  accomplishment: '', ratingEfficiency: '', ratingQuality: '', ratingTimeliness: ''
})

const statusTabs = [
  { label: 'All',       value: 'ALL' },
  { label: 'Draft',     value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved',  value: 'APPROVED' },
  { label: 'Rated',     value: 'RATED' },
  { label: 'Finalized', value: 'FINALIZED' }
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
      (i.performanceIndicator || i.successIndicator || '')?.toLowerCase().includes(q)
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
  if (s >= 4.5) return 'score-outstanding'
  if (s >= 3.5) return 'score-vs'
  if (s >= 2.5) return 'score-satisfactory'
  return 'score-low'
})

// ── Helpers ──
function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}
function countByStatus(status) {
  return forms.value.filter(f => f.status === status).length
}
function posWeight(item) {
  const lvl = activeForm.value?.positionLevel || 'III'
  return Number(item[`weight${lvl}`] || item.weight || 0)
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

// ── Lifecycle ──
onMounted(loadForms)

// ── API calls ──
async function loadForms() {
  loading.value = true
  try {
    const res = await ipcrfApi.listForms()
    forms.value = Array.isArray(res) ? res : (res?.items || [])
  } catch (e) {
    showToast(`Could not load forms: ${e.message}`, 'error')
  } finally {
    loading.value = false
  }
}

async function openForm(form) {
  activeForm.value  = form
  activeTab.value   = 'indicators'
  allEntries.value  = []
  entriesLoading.value = true
  try {
    const res = await ipcrfApi.getEntries(form.id)
    allEntries.value = Array.isArray(res) ? res : []
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    entriesLoading.value = false
  }
  // Pre-load library in background
  if (libraryItems.value.length === 0) {
    libLoading.value = true
    kraLibraryApi.list().then(lib => {
      libraryItems.value = Array.isArray(lib) ? lib : []
    }).catch(() => {}).finally(() => { libLoading.value = false })
  }
}

async function createForm() {
  if (creating.value) return
  creating.value = true
  try {
    const form = await ipcrfApi.createForm(newForm.value)
    forms.value.unshift(form)
    showNewFormModal.value = false
    showToast('Form created successfully')
    await openForm(form)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    creating.value = false
  }
}

function openLibrary(fnType) {
  currentFnType.value = fnType
  libSearch.value = ''; libPhase.value = ''; libClass.value = ''
  showLibrary.value = true
}

function openCustomEntry(fnType) {
  currentFnType.value = fnType
  editingEntry.value  = null
  entryForm.value = {
    kraName: '', successIndicator: '', functionType: fnType,
    weight: 5, applicableRatingPeriod: 'Both semesters',
    classification: 'Complex', meansOfVerification: '',
    accomplishment: '', ratingEfficiency: '', ratingQuality: '', ratingTimeliness: ''
  }
  showEntryModal.value = true
}

function openEditEntry(entry) {
  editingEntry.value   = entry
  currentFnType.value  = entry.functionType
  entryForm.value = {
    kraName:                entry.kraName,
    successIndicator:       entry.successIndicator,
    functionType:           entry.functionType,
    weight:                 Number(entry.weight),
    applicableRatingPeriod: entry.applicableRatingPeriod,
    classification:         entry.classification,
    meansOfVerification:    entry.meansOfVerification,
    accomplishment:         entry.accomplishment,
    ratingEfficiency:       entry.ratingEfficiency,
    ratingQuality:          entry.ratingQuality,
    ratingTimeliness:       entry.ratingTimeliness
  }
  showEntryModal.value = true
}

function closeEntryModal() {
  showEntryModal.value = false
  editingEntry.value   = null
}

async function saveEntry() {
  if (!entryForm.value.kraName || !entryForm.value.successIndicator) {
    showToast('KRA name and Success Indicator are required', 'error'); return
  }
  savingEntry.value = true
  try {
    if (editingEntry.value) {
      const updated = await ipcrfApi.updateEntry(editingEntry.value.id, {
        ...entryForm.value,
        ratingAverage: computedAvg.value || entryForm.value.ratingAverage || ''
      })
      const idx = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (idx !== -1) allEntries.value[idx] = { ...allEntries.value[idx], ...updated }
      showToast('Indicator updated')
    } else {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        ...entryForm.value,
        functionType: currentFnType.value,
        isCustom: true
      })
      allEntries.value.push(entry)
      showToast('Indicator added')
    }
    closeEntryModal()
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    savingEntry.value = false
  }
}

async function addFromLibrary(item) {
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
    showToast(`"${item.kraName}" added`)
  } catch (e) {
    showToast(e.message, 'error')
  }
}

function confirmDeleteEntry(entry) {
  confirmDelete.value = { show: true, entryId: entry.id, entryName: entry.kraName }
}

async function doDeleteEntry() {
  deletingEntry.value = true
  try {
    await ipcrfApi.deleteEntry(confirmDelete.value.entryId)
    allEntries.value = allEntries.value.filter(e => e.id !== confirmDelete.value.entryId)
    showToast('Indicator removed')
    confirmDelete.value.show = false
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    deletingEntry.value = false
  }
}

async function submitForm() {
  try {
    const updated = await ipcrfApi.submitForm(activeForm.value.id)
    _sync(updated); showToast('Form submitted for review')
  } catch (e) { showToast(e.message, 'error') }
}
async function approveForm() {
  try {
    const updated = await ipcrfApi.approveForm(activeForm.value.id)
    _sync(updated); showToast('Form approved')
  } catch (e) { showToast(e.message, 'error') }
}
async function returnForm() {
  try {
    const updated = await ipcrfApi.returnForm(activeForm.value.id)
    _sync(updated); showToast('Form returned for correction')
  } catch (e) { showToast(e.message, 'error') }
}
async function computeScore() {
  try {
    const updated = await ipcrfApi.computeScore(activeForm.value.id)
    _sync(updated); showToast(`Score: ${updated.finalNumericalRating} — ${updated.adjectivalRating}`)
  } catch (e) { showToast(e.message, 'error') }
}

function _sync(updated) {
  activeForm.value = { ...activeForm.value, ...updated }
  const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
  if (idx !== -1) forms.value[idx] = activeForm.value
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
* { box-sizing: border-box; }

.content {
  padding: 20px 24px 32px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1A2332;
  min-height: 100%;
}

/* ── Utilities ── */
.muted    { color: #94A3B8; }
.text-xs  { font-size: 11px; }
.text-sm  { font-size: 12px; }
.mt-12    { margin-top: 12px; }
.mt-14    { margin-top: 14px; }
.req      { color: #EF4444; font-size: 11px; }

/* ── Page header ── */
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 18px;
}
.page-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
.page-sub   { font-size: 12px; color: #94A3B8; margin: 0; }

/* ── Filter bar ── */
.filter-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px; gap: 12px;
}
.filter-tabs { display: flex; gap: 3px; }
.ftab {
  padding: 5px 12px; border-radius: 20px; font-size: 12px; cursor: pointer;
  border: 1.5px solid #E2E8F0; background: #fff; color: #64748B;
  display: inline-flex; align-items: center; gap: 5px;
  transition: all .15s; font-family: 'DM Sans', sans-serif; font-weight: 500;
}
.ftab:hover { border-color: #CBD5E1; background: #F8FAFC; }
.ftab.active { background: #0F172A; color: #fff; border-color: #0F172A; }
.ftab-count {
  background: #3B82F6; color: #fff; border-radius: 10px;
  font-size: 10px; padding: 1px 5px; min-width: 16px; text-align: center; line-height: 1.4;
}
.filter-right { display: flex; gap: 6px; }
.filter-select {
  padding: 6px 10px; border: 1.5px solid #E2E8F0; border-radius: 7px;
  font-size: 12px; font-family: 'DM Sans', sans-serif; background: #fff;
  cursor: pointer; outline: none; color: #374151; font-weight: 500;
}

/* ── Skeleton ── */
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 12px; }
.skeleton-card { background:#fff; border:1px solid #E8EDF3; border-radius:10px; padding:16px; }
.sk { background: linear-gradient(90deg, #F1F5F9 25%, #E8EDF3 50%, #F1F5F9 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 5px; }
.sk-row   { height: 16px; width: 60%; margin-bottom: 10px; }
.sk-title { height: 18px; width: 80%; margin-bottom: 8px; }
.sk-sub   { height: 13px; width: 50%; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── Empty ── */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; padding: 64px 0; text-align: center;
}
.empty-icon  { color: #CBD5E1; margin-bottom: 4px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 0; }
.empty-sub   { font-size: 12px; color: #94A3B8; margin: 0 0 6px; }

/* ── Forms Grid ── */
.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  transition: all .25s;
}
.forms-grid-narrow {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  margin-right: 496px;
}

.form-card {
  background: #fff; border: 1.5px solid #E8EDF3; border-radius: 10px;
  padding: 14px 16px; cursor: pointer; transition: all .15s;
}
.form-card:hover   { border-color: #BFDBFE; box-shadow: 0 2px 10px rgba(59,130,246,.08); }
.form-card.selected { border-color: #3B82F6; background: #EFF6FF; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }

.fc-top    { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.fc-name   { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 2px; }
.fc-meta   { font-size: 11px; color: #94A3B8; margin-bottom: 10px; }
.fc-footer { display: flex; align-items: center; justify-content: space-between; }
.fc-period { font-size: 11px; color: #64748B; }
.fc-score  { font-size: 15px; font-weight: 700; color: #16A34A; }

/* ── Badges ── */
.type-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; letter-spacing:.02em; }
.type-ipcrf { background: #DBEAFE; color: #1D4ED8; }
.type-ccef  { background: #EDE9FE; color: #6D28D9; }

.status-dot {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; padding: 2px 7px;
  border-radius: 10px;
}
.dot-pip { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot-draft     { background: #F1F5F9; color: #64748B; }
.dot-draft .dot-pip { background: #94A3B8; }
.dot-submitted { background: #DBEAFE; color: #1D4ED8; }
.dot-submitted .dot-pip { background: #3B82F6; }
.dot-returned  { background: #FEF9C3; color: #92400E; }
.dot-returned .dot-pip  { background: #F59E0B; }
.dot-approved  { background: #DCFCE7; color: #166534; }
.dot-approved .dot-pip  { background: #22C55E; }
.dot-rated     { background: #E0F2FE; color: #075985; }
.dot-rated .dot-pip     { background: #0EA5E9; }
.dot-finalized { background: #F3E8FF; color: #6B21A8; }
.dot-finalized .dot-pip { background: #A855F7; }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 500;
  cursor: pointer; border: 1.5px solid #E2E8F0; background: #fff;
  color: #374151; transition: all .15s; font-family: 'DM Sans', sans-serif;
}
.btn:hover    { background: #F8FAFC; border-color: #CBD5E1; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary  { background: #2563EB; color: #fff; border-color: #2563EB; }
.btn-primary:hover  { background: #1D4ED8; }
.btn-success  { background: #16A34A; color: #fff; border-color: #16A34A; }
.btn-success:hover  { background: #15803D; }
.btn-danger   { background: #EF4444; color: #fff; border-color: #EF4444; }
.btn-danger:hover   { background: #DC2626; }
.btn-outline-danger { background: #fff; color: #EF4444; border-color: #FCA5A5; }
.btn-outline-danger:hover { background: #FEF2F2; }
.btn-sm  { padding: 5px 11px; font-size: 11px; }
.btn-group { display: flex; gap: 6px; }

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  border: none; background: transparent; cursor: pointer; color: #94A3B8;
}
.close-btn:hover { background: #F1F5F9; color: #475569; }

.pill-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 12px; font-size: 10px; font-weight: 600;
  border: 1px solid #E2E8F0; background: #F8FAFC; cursor: pointer; color: #475569;
  transition: all .12s; font-family: 'DM Sans', sans-serif;
}
.pill-btn:hover { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }

.action-icon {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 5px;
  border: 1px solid transparent; background: transparent; cursor: pointer;
  color: #94A3B8; transition: all .12s;
}
.action-icon:hover { background: #F1F5F9; border-color: #E2E8F0; color: #475569; }
.action-icon.danger:hover { background: #FEF2F2; border-color: #FCA5A5; color: #EF4444; }

/* ── Detail Panel ── */
.detail-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 480px;
  background: #fff; border-left: 1px solid #E8EDF3;
  box-shadow: -8px 0 32px rgba(0,0,0,.07);
  z-index: 50; display: flex; flex-direction: column; overflow: hidden;
}
.panel-slide-enter-active, .panel-slide-leave-active { transition: transform .22s cubic-bezier(.4,0,.2,1); }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(100%); }

.panel-hd {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.panel-hd-info { flex: 1; min-width: 0; }
.panel-badges  { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; }
.panel-name    { font-size: 16px; font-weight: 700; color: #0F172A; }
.panel-meta    { font-size: 11px; color: #94A3B8; margin-top: 2px; }

.panel-tabs {
  display: flex; padding: 0 20px; border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.ptab {
  padding: 10px 14px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: none; background: transparent; color: #64748B;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  font-family: 'DM Sans', sans-serif; transition: all .15s;
  display: inline-flex; align-items: center; gap: 5px;
}
.ptab:hover { color: #374151; }
.ptab.active { color: #2563EB; border-bottom-color: #2563EB; font-weight: 600; }
.ptab-count {
  background: #EFF6FF; color: #2563EB; border-radius: 9px;
  font-size: 10px; padding: 1px 5px; font-weight: 600;
}

.entries-loading {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  flex: 1;
}
.spinner-sm {
  width: 18px; height: 18px; border: 2px solid #E2E8F0;
  border-top-color: #3B82F6; border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.panel-body { flex: 1; overflow-y: auto; padding: 16px 20px 20px; }

/* ── Function blocks ── */
.fn-block { margin-bottom: 20px; }
.fn-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #F8FAFC; border-radius: 8px;
  border: 1px solid #F1F5F9; margin-bottom: 8px;
}
.fn-header-left { display: flex; align-items: center; gap: 8px; }
.fn-label  { font-size: 12px; font-weight: 600; color: #374151; }
.fn-weight { font-size: 11px; color: #2563EB; font-weight: 600;
  background: #EFF6FF; padding: 1px 6px; border-radius: 8px; }
.fn-count  { font-size: 10px; color: #94A3B8; }
.fn-actions { display: flex; gap: 5px; }
.fn-empty  { text-align: center; padding: 14px 0; font-size: 11px; color: #94A3B8;
  border: 1px dashed #E2E8F0; border-radius: 8px; }

/* ── Entry cards ── */
.entries-list { display: flex; flex-direction: column; gap: 6px; }
.entry-card {
  background: #fff; border: 1px solid #E8EDF3; border-radius: 8px;
  transition: border-color .12s;
}
.entry-card:hover { border-color: #BFDBFE; }
.entry-card-body { padding: 10px 12px; }
.entry-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 5px;
}
.entry-kra-tag {
  font-size: 11px; font-weight: 600; color: #1D4ED8;
  background: #EFF6FF; padding: 2px 7px; border-radius: 8px;
}
.entry-actions-inline { display: flex; gap: 3px; }
.entry-si {
  font-size: 11px; color: #475569; line-height: 1.55;
  margin-bottom: 7px;
}
.entry-footer { display: flex; flex-wrap: wrap; gap: 4px; }

/* ── Tags ── */
.etag {
  padding: 2px 7px; border-radius: 9px; font-size: 10px;
  font-weight: 500; background: #F1F5F9; color: #64748B;
}
.etag-blue  { background: #DBEAFE; color: #1D4ED8; }
.etag-amber { background: #FEF3C7; color: #92400E; }
.etag-green { background: #DCFCE7; color: #166534; }

/* ── Workflow bar ── */
.workflow-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; margin-top: 8px; border-top: 1px solid #F1F5F9;
}
.workflow-hint { font-size: 11px; color: #64748B; display: flex; align-items: center; gap: 5px; }

/* ── Detail sections ── */
.detail-section { margin-bottom: 20px; }
.detail-section-title {
  font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;
  letter-spacing: .07em; margin-bottom: 10px;
}
.detail-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 7px 0; border-bottom: 1px solid #F8FAFC; gap: 12px;
}
.dk { font-size: 11px; color: #94A3B8; font-weight: 500; flex-shrink: 0; }
.dv { font-size: 12px; color: #1A2332; text-align: right; }

.weights-bar-wrap { padding: 4px 0; }
.weights-bar { display: flex; height: 26px; border-radius: 6px; overflow: hidden; }
.wb-core    { background: #2563EB; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #fff; font-weight: 600; }
.wb-support { background: #7C3AED; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #fff; font-weight: 600; }

/* ── Score ── */
.score-empty  { text-align: center; padding: 40px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.score-hero   { text-align: center; padding: 20px 0 16px; }
.score-circle {
  display: inline-flex; align-items: baseline; gap: 4px;
  padding: 16px 24px; border-radius: 16px; margin-bottom: 8px;
}
.score-outstanding { background: #DCFCE7; }
.score-vs          { background: #DBEAFE; }
.score-satisfactory { background: #FEF9C3; }
.score-low          { background: #FEE2E2; }
.score-num  { font-size: 48px; font-weight: 800; line-height: 1; color: #0F172A; }
.score-max  { font-size: 16px; color: #94A3B8; }
.score-adj  { font-size: 15px; font-weight: 600; color: #374151; }
.score-breakdown      { margin-top: 16px; border-top: 1px solid #F1F5F9; padding-top: 12px; }
.score-breakdown-title { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing:.07em; margin-bottom: 8px; }
.score-row   { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F8FAFC; }
.sr-left     { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
.sr-fn       { width: 18px; height: 18px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
.sr-core     { background: #DBEAFE; color: #1D4ED8; }
.sr-support  { background: #EDE9FE; color: #6D28D9; }
.sr-name     { font-size: 11px; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr-right    { flex-shrink: 0; }
.sr-val      { font-size: 12px; font-weight: 600; color: #0F172A; }

/* ── Modals ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.45);
  display: flex; align-items: center; justify-content: center; z-index: 200;
  backdrop-filter: blur(2px);
}
.modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 480px;
  max-height: 88vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,.18);
  animation: modal-in .18s ease;
}
.modal-lg { max-width: 640px; }
@keyframes modal-in { from { opacity:0; transform: scale(.97) translateY(8px); } to { opacity:1; transform: none; } }

.modal-hd {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 24px 14px; border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; }
.modal-sub   { font-size: 11px; color: #94A3B8; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
.modal-body  { padding: 18px 24px; overflow-y: auto; flex: 1; }
.modal-ft {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-top: 1px solid #F1F5F9;
  background: #F8FAFC; border-radius: 0 0 14px 14px; flex-shrink: 0;
}
.modal-ft > .btn:last-child { margin-left: auto; }

/* ── Form fields ── */
.form-section-title {
  font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;
  letter-spacing: .07em; margin-bottom: 12px;
}
.form-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field      { display: flex; flex-direction: column; gap: 5px; }
.field.full { grid-column: span 2; }
.fl   { font-size: 11px; font-weight: 600; color: #374151; }
.fi   {
  padding: 8px 11px; border: 1.5px solid #E2E8F0; border-radius: 7px;
  font-size: 12px; font-family: 'DM Sans', sans-serif; color: #0F172A;
  outline: none; transition: border-color .15s, box-shadow .15s;
  resize: vertical; background: #fff;
}
.fi:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.fi::placeholder { color: #CBD5E1; }
.avg-display {
  background: #F0FDF4; color: #16A34A; font-weight: 600;
  cursor: default; pointer-events: none;
}

/* ── Library ── */
.lib-search-bar {
  display: flex; gap: 8px; padding: 12px 24px;
  border-bottom: 1px solid #F1F5F9; flex-shrink: 0; flex-wrap: wrap;
}
.search-wrap { flex: 1; position: relative; min-width: 180px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.search-input {
  width: 100%; padding: 8px 11px 8px 30px;
  border: 1.5px solid #E2E8F0; border-radius: 7px;
  font-size: 12px; font-family: 'DM Sans', sans-serif; color: #0F172A; outline: none;
}
.search-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.lib-body { padding: 12px 24px !important; }
.lib-grid { display: flex; flex-direction: column; gap: 8px; max-height: 45vh; overflow-y: auto; padding-right: 2px; }
.lib-card {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 11px 14px; border: 1.5px solid #E8EDF3; border-radius: 9px;
  background: #FAFBFD; transition: border-color .12s;
}
.lib-card:hover { border-color: #BFDBFE; background: #F8FBFF; }
.lib-card-body  { flex: 1; min-width: 0; }
.lib-kra { font-size: 12px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
.lib-pi  { font-size: 11px; color: #475569; line-height: 1.5; margin-bottom: 6px; }
.lib-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.lib-add-btn {
  display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
  padding: 5px 11px; border-radius: 7px; font-size: 11px; font-weight: 600;
  border: 1.5px solid #BFDBFE; background: #EFF6FF; color: #1D4ED8;
  cursor: pointer; transition: all .12s; font-family: 'DM Sans', sans-serif;
}
.lib-add-btn:hover { background: #2563EB; color: #fff; border-color: #2563EB; }

/* ── Confirm dialog ── */
.confirm-box {
  background: #fff; border-radius: 14px; padding: 28px 26px;
  max-width: 360px; width: 100%; text-align: center;
  box-shadow: 0 24px 64px rgba(0,0,0,.18);
  animation: modal-in .18s ease;
}
.confirm-icon-wrap {
  width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center;
  justify-content: center; margin: 0 auto 14px;
}
.confirm-icon-wrap.danger { background: #FEF2F2; }
.confirm-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 7px; }
.confirm-msg   { font-size: 12px; color: #475569; line-height: 1.65; margin-bottom: 20px; }
.confirm-btns  { display: flex; justify-content: center; gap: 8px; }

/* ── Toast ── */
.toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 300;
  padding: 10px 16px; border-radius: 9px; font-size: 12px; font-weight: 500;
  box-shadow: 0 4px 20px rgba(0,0,0,.12); pointer-events: none;
  display: flex; align-items: center; gap: 7px;
}
.toast-success { background: #F0FDF4; color: #166534; border: 1px solid #86EFAC; }
.toast-error   { background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to       { opacity: 0; transform: translateY(8px); }

/* ── Spinner ── */
.spinner {
  width: 24px; height: 24px; border: 2.5px solid #E2E8F0;
  border-top-color: #3B82F6; border-radius: 50%; animation: spin .7s linear infinite;
}
.state-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 0; }
</style>