<template>
  <div class="kra-page">

    <!-- Content card -->
    <div class="content-card">
      
    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="page-sub">{{ pageSubtitle }}</p>
      </div>
    </div>

    <div class="library-tabs" role="tablist" aria-label="Library sections">
      <button
        class="library-tab"
        :class="{ active: activeLibraryTab === 'kra' }"
        type="button"
        @click="activeLibraryTab = 'kra'"
      >
        KRA Library
      </button>
      <button
        v-if="canManageAssessmentContent"
        class="library-tab"
        :class="{ active: activeLibraryTab === 'assessment' }"
        type="button"
        @click="activeLibraryTab = 'assessment'"
      >
        Assessment Content
      </button>
    </div>

    <section v-show="activeLibraryTab === 'kra'" class="kra-library-section">

    <!-- Filters -->
    <div class="filter-bar">
      <div class="srch-wrap">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="srch-icon">
          <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
          <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <input v-model="search" type="text" class="srch-inp" placeholder="Search KRA name or indicator…"/>
      </div>
      <div class="filter-selects">
        <select v-model="filterPhase" class="filter-select">
          <option value="">All Phases</option>
          <option v-for="p in PHASES" :key="p" :value="p">{{ phaseLabel(p) }}</option>
        </select>
        <select v-model="filterFnType" class="filter-select">
          <option value="">All Types</option>
          <option value="Core">Core</option>
          <option value="Support">Support</option>
        </select>
        <select v-model="filterClass" class="filter-select">
          <option value="">All Classifications</option>
          <option value="Simple">Simple</option>
          <option value="Complex">Complex</option>
          <option value="Highly Technical">Highly Technical</option>
          <option value="Exempted">Exempted</option>
        </select>
      </div>
      <button class="btn btn-primary btn-add-kra" @click="openAddModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Add KRA
      </button>
    </div>

    <!-- Stats bar -->
    <div v-if="!loading" class="stats-bar">
      <span class="stat-pill stat-pill-total">{{ filteredKRAs.length }} results</span>
      <span class="stat-pill stat-pill-core">{{ countByFnType('Core') }} Core</span>
      <span class="stat-pill stat-pill-support">{{ countByFnType('Support') }} Support</span>
      <span v-if="countByFnType('Strategic')" class="stat-pill stat-pill-strategic">{{ countByFnType('Strategic') }} Strategic</span>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="kra-table">
      <div class="table-hd">
        <div class="th" style="width:160px">Phase</div>
        <div class="th" style="flex:1">KRA / Indicator</div>
        <div class="th" style="width:100px">Type</div>
        <div class="th" style="width:110px">Classification</div>
        <div class="th" style="width:90px">Weights</div>
        <div class="th" style="width:80px">Actions</div>
      </div>
      <div v-for="i in 6" :key="i" class="table-row">
        <div class="sk-line" style="width:100px;height:12px"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="sk-line" style="width:60%;height:13px"></div>
          <div class="sk-line" style="width:80%;height:11px"></div>
        </div>
        <div class="sk-line" style="width:60px;height:12px"></div>
        <div class="sk-line" style="width:80px;height:12px"></div>
        <div class="sk-line" style="width:60px;height:12px"></div>
        <div class="sk-line" style="width:50px;height:12px"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredKRAs.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">{{ kras.length === 0 ? 'No KRAs yet' : 'No matching KRAs' }}</p>
      <p class="empty-sub">{{ kras.length === 0 ? 'Click Add KRA to create the first entry.' : 'Try adjusting your filters.' }}</p>
    </div>

    <!-- Table -->
    <div v-else class="kra-table">
      <div class="table-hd">
        <div class="th th-phase">Phase</div>
        <div class="th th-main">KRA / Performance Indicator</div>
        <div class="th th-type">Type</div>
        <div class="th th-class">Classification</div>
        <div class="th th-wt">Weights</div>
        <div class="th th-act">Actions</div>
      </div>
      <div v-for="row in paginatedKRAs" :key="row.id" class="table-row" @click="openViewModal(row)">
        <div class="td td-phase">
          <span class="phase-pill">{{ phaseLabel(row.phase) }}</span>
        </div>
        <div class="td td-main">
          <div class="kra-name">{{ row.kraName }}</div>
          <div class="kra-pi">{{ row.performanceIndicator || row.successIndicator || '' }}</div>
          <div v-if="row.meansOfVerification" class="kra-mov">
            <span class="mov-lbl">MOV:</span> {{ row.meansOfVerification }}
          </div>
        </div>
        <div class="td td-type">
          <span :class="['fn-badge', fnBadgeClass(row.functionType)]">
            {{ row.functionType }}
          </span>
        </div>
        <div class="td td-class">
          <span :class="['class-badge', classStyle(row.classification)]">{{ row.classification }}</span>
        </div>
        <div class="td td-wt">
          <div class="wt-stack">
            <span class="wt-item">II: {{ row.weightII }}%</span>
            <span class="wt-item">III: {{ row.weightIII }}%</span>
            <span class="wt-item">IV: {{ row.weightIV }}%</span>
          </div>
        </div>
        <div class="td td-act" @click.stop>
          <button class="act" @click="openEditModal(row)" title="Edit">
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="act act-del" @click="confirmRemove(row)" title="Deactivate">
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && filteredKRAs.length" class="pagination-bar">
      <div class="pg-info">
        <span>{{ pageRangeLabel }}</span>
        <div class="pg-size">
          <span>Rows per page</span>
          <select v-model.number="pageSize" class="pg-size-select">
            <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>

      <div class="pg-controls">
        <button class="pg-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)" title="Previous page">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2.5L3.5 6.5 8 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <template v-for="(p, idx) in pageNumbers" :key="idx">
          <span v-if="p === '…'" class="pg-ellipsis">…</span>
          <button
            v-else
            class="pg-num"
            :class="{ active: p === currentPage }"
            @click="goToPage(p)"
          >{{ p }}</button>
        </template>

        <button class="pg-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)" title="Next page">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 2.5l4.5 4-4.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    </section>

    <section v-if="activeLibraryTab === 'assessment' && canManageAssessmentContent" class="assessment-manager">
      <aside class="assessment-nav">
        <div class="assessment-nav-title">Assessment Domains</div>
        <div
          v-for="domain in assessmentDomains"
          :key="domain.id"
          class="assessment-domain"
          :class="{ active: selectedAssessmentDomain === domain.id }"
        >
          <button class="assessment-domain-head" type="button" @click="selectAssessmentDomain(domain.id)">
            <span class="domain-mark" :class="domain.id">{{ domain.short }}</span>
            <span class="domain-info">
              <strong>{{ domain.name }}</strong>
              <small>{{ assessmentDomainCount(domain.id) }}</small>
            </span>
            <span class="domain-chevron">⌄</span>
          </button>
          <div v-show="selectedAssessmentDomain === domain.id" class="assessment-category-list">
            <button
              v-for="cat in domain.categories"
              :key="cat.id"
              class="assessment-category"
              :class="{ active: selectedAssessmentCategory === cat.id }"
              type="button"
              @click="selectAssessmentCategory(cat.id)"
            >
              <span class="status-dot" :class="categoryStatusClass(cat.id)"></span>
              <span>{{ cat.name }}</span>
              <em>{{ assessmentCategoryCount(cat.id) }}</em>
            </button>
          </div>
        </div>
        <div v-if="!assessmentDomains.length && !loadingCategories" style="padding:12px;text-align:center">
          <p style="font-size:12px;color:#64748B;margin-bottom:8px">No categories yet</p>
          <button class="btn btn-outline" style="font-size:11px" :disabled="seedingCategories" @click="seedCategories">
            {{ seedingCategories ? 'Seeding…' : 'Seed Standard Categories' }}
          </button>
        </div>
        <div class="assessment-legend">
          <span><i class="status-dot active"></i>Active</span>
          <span><i class="status-dot draft"></i>Draft</span>
          <span><i class="status-dot archived"></i>Archived</span>
        </div>
      </aside>

      <div class="assessment-workspace">
        <div class="assessment-workspace-hd">
          <div>
            <div class="assessment-title-row">
              <h3>{{ selectedAssessmentCategoryData?.name }}</h3>
              <span class="domain-chip">{{ selectedAssessmentDomainData?.name }}</span>
              <button class="cat-edit-btn" type="button" title="Edit category" @click="openCategoryEditModal">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9.2 1.5l2.3 2.3-7 7H2.2V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
            <p>{{ selectedAssessmentCategoryData?.description }}</p>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="assessment-count">
              <strong>{{ activeCategoryQuestions.length }}</strong> / {{ filteredAssessmentQuestions.length }} questions
              <span>(Active)</span>
            </div>
            <button class="btn btn-primary assessment-add-btn" type="button" @click="openQuestionModal()" style="margin:0;white-space:nowrap">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              Add Question
            </button>
          </div>
        </div>

        <div class="assessment-toolbar">
          <div class="srch-wrap assessment-search">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="srch-icon">
              <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
              <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <input v-model="assessmentSearch" type="text" class="srch-inp" placeholder="Search assessment questions..."/>
          </div>
          <select v-model="assessmentStatusFilter" class="filter-select">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>
          <select v-model="assessmentRaterFilter" class="filter-select">
            <option value="">All Rater Types</option>
            <option v-for="rater in raterOptions" :key="rater" :value="rater">{{ rater }}</option>
          </select>
          <select v-model="assessmentLevelFilter" class="filter-select">
            <option value="">All Employee Levels</option>
            <option v-for="level in employeeLevelOptions" :key="level" :value="level">{{ level }}</option>
          </select>
          <select v-model="assessmentPeriodFilter" class="filter-select">
            <option value="">All Periods</option>
            <option value="S1 2026">S1 2026</option>
            <option value="S2 2026">S2 2026</option>
          </select>
          <div class="assessment-view-toggle">
            <button type="button" :class="{ active: assessmentView === 'list' }" @click="assessmentView = 'list'">List</button>
            <button type="button" :class="{ active: assessmentView === 'preview' }" @click="assessmentView = 'preview'">Preview</button>
          </div>
        </div>

        <div v-if="loadingQuestions" class="assessment-loading">
          <span class="spinner-sm dark"></span>
          Loading assessment content...
        </div>

        <div v-else-if="assessmentView === 'list'" class="assessment-list">
          <div v-if="!assessmentQuestions.length && !loadingQuestions" class="empty-state compact">
            <p class="empty-title">No assessment questions yet</p>
            <p class="empty-sub">Seed the standard HEARTWORK and Job Fitness indicators, or add questions manually.</p>
            <button class="btn btn-primary" style="margin-top:10px" :disabled="seeding" @click="seedFromStandard(false)">
              {{ seeding ? 'Seeding…' : 'Seed Standard Questions' }}
            </button>
          </div>
          <div v-else-if="!filteredAssessmentQuestions.length" class="empty-state compact">
            <p class="empty-title">No questions match</p>
            <p class="empty-sub">Try adjusting filters or add a new question.</p>
            <button v-if="!categoryQuestions.length" class="btn btn-outline" style="margin-top:8px;font-size:11px" :disabled="seeding" @click="seedFromStandard(true)">
              {{ seeding ? 'Reseeding…' : 'Reseed Standard Questions' }}
            </button>
          </div>
          <article v-for="(question, index) in filteredAssessmentQuestions" :key="question.id" class="question-card" :class="question.status.toLowerCase()">
            <div class="question-handle">⋮⋮</div>
            <div class="question-no">{{ question.sequence || index + 1 }}</div>
            <div class="question-main">
              <div class="question-topline">
                <h4>{{ question.questionText }}</h4>
                <span class="question-status" :class="question.status.toLowerCase()">{{ question.status }}</span>
              </div>
              <p>{{ question.guidanceText }}</p>
              <div class="question-tags">
                <span v-for="rater in question.applicableRaters" :key="rater" class="tag-blue">{{ rater }}</span>
                <span v-for="level in question.applicableLevels" :key="level" class="tag-green">{{ level }}</span>
                <span :class="question.required ? 'tag-red' : 'tag-gray'">{{ question.required ? 'Required' : 'Optional' }}</span>
                <span class="tag-gray">Ver. {{ question.version }}</span>
                <span class="tag-gray">{{ question.period }}</span>
              </div>
            </div>
            <div class="question-actions">
              <button class="act" type="button" title="Move up" :disabled="index === 0" @click="moveQuestion(question.id, -1)">↑</button>
              <button class="act" type="button" title="Move down" :disabled="index === filteredAssessmentQuestions.length - 1" @click="moveQuestion(question.id, 1)">↓</button>
              <button class="act" type="button" title="Edit" @click="openQuestionModal(question)">
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="act" type="button" title="Duplicate as new version" @click="duplicateQuestionVersion(question)">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="5" y="3" width="7" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M3 9H2.5A1.5 1.5 0 011 7.5v-5A1.5 1.5 0 012.5 1h5A1.5 1.5 0 019 2.5V3" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </button>
              <button class="act act-del" type="button" title="Archive" :disabled="question.status === 'Archived'" @click="confirmArchiveQuestion(question)">
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </article>
        </div>

        <div v-else class="assessment-preview">
          <div class="preview-hd">
            <span>{{ selectedAssessmentCategoryData?.name }}</span>
            <small>Rater-facing preview, active questions only</small>
          </div>
          <div v-for="(question, index) in activeCategoryQuestions" :key="question.id" class="preview-question">
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ question.questionText }}</strong>
              <p>{{ question.guidanceText }}</p>
            </div>
            <div class="preview-scale">
              <button v-for="n in 4" :key="n" type="button">{{ n }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    </div>
    <!-- /Content card -->

    <!-- ══════════════════════════════════
         VIEW MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
        <div class="modal modal-view">
          <div class="modal-hd">
            <div>
              <div class="modal-hd-badges">
                <span :class="['fn-badge', fnBadgeClass(viewItem?.functionType)]">{{ viewItem?.functionType }}</span>
                <span :class="['class-badge', classStyle(viewItem?.classification)]">{{ viewItem?.classification }}</span>
                <span class="phase-pill">{{ phaseLabel(viewItem?.phase) }}</span>
              </div>
              <h3 class="modal-title" style="margin-top:8px">{{ viewItem?.kraName }}</h3>
            </div>
            <button class="modal-close" @click="showViewModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" v-if="viewItem">
            <div class="view-section">
              <div class="view-label">Performance Indicator</div>
              <div class="view-text">{{ viewItem.performanceIndicator || '—' }}</div>
            </div>
            <div class="view-section">
              <div class="view-label">Means of Verification</div>
              <div class="view-text">{{ viewItem.meansOfVerification || '—' }}</div>
            </div>
            <div class="view-2col">
              <div class="view-section">
                <div class="view-label">Applicable To</div>
                <div class="view-text">{{ viewItem.applicableTo || 'BOTH' }}</div>
              </div>
              <div class="view-section">
                <div class="view-label">Weights (II / III / IV)</div>
                <div class="view-text">{{ viewItem.weightII }}% / {{ viewItem.weightIII }}% / {{ viewItem.weightIV }}%</div>
              </div>
            </div>
            <div v-if="viewItem.efficiencyGuide" class="view-section">
              <div class="view-label">Efficiency Guide</div>
              <div class="view-guide">{{ viewItem.efficiencyGuide }}</div>
            </div>
            <div v-if="viewItem.qualityGuide" class="view-section">
              <div class="view-label">Quality Guide</div>
              <div class="view-guide">{{ viewItem.qualityGuide }}</div>
            </div>
            <div v-if="viewItem.timelinessGuide" class="view-section">
              <div class="view-label">Timeliness Guide</div>
              <div class="view-guide">{{ viewItem.timelinessGuide }}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showViewModal = false">Close</button>
            <button class="btn btn-primary" @click="openEditModal(viewItem); showViewModal = false">Edit</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         ADD / EDIT MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal modal-form">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingItem ? 'Edit KRA Entry' : 'Add KRA Entry' }}</h3>
              <p class="modal-sub">Master KRA Library</p>
            </div>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Phase <span class="req">*</span></label>
                <select v-model="form.phase" class="field-input">
                  <option value="">Select phase…</option>
                  <option v-for="p in PHASES" :key="p" :value="p">{{ phaseLabel(p) }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Function Type <span class="req">*</span></label>
                <select v-model="form.functionType" class="field-input">
                  <option value="Core">Core</option>
                  <option value="Support">Support</option>
                  <option value="Strategic">Strategic</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="form.kraName" type="text" class="field-input" placeholder="e.g. Research"/>
              </div>
              <div class="field">
                <label class="field-label">Classification <span class="req">*</span></label>
                <select v-model="form.classification" class="field-input">
                  <option value="Simple">Simple</option>
                  <option value="Complex">Complex</option>
                  <option value="Highly Technical">Highly Technical</option>
                  <option value="Exempted">Exempted</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Applicable To</label>
                <select v-model="form.applicableTo" class="field-input">
                  <option value="BOTH">Both Semesters</option>
                  <option value="S1">1st Semester Only</option>
                  <option value="S2">2nd Semester Only</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Performance Indicator <span class="req">*</span></label>
                <textarea v-model="form.performanceIndicator" class="field-input" rows="3" placeholder="Describe the specific target output…"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Means of Verification</label>
                <input v-model="form.meansOfVerification" type="text" class="field-input" placeholder="e.g. Approved report with memo endorsement"/>
              </div>
            </div>

            <div class="field-section-label">Weights per Position Level</div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Weight II (%)</label>
                <input v-model.number="form.weightII" type="number" class="field-input" min="0" max="100"/>
              </div>
              <div class="field">
                <label class="field-label">Weight III (%)</label>
                <input v-model.number="form.weightIII" type="number" class="field-input" min="0" max="100"/>
              </div>
              <div class="field">
                <label class="field-label">Weight IV (%)</label>
                <input v-model.number="form.weightIV" type="number" class="field-input" min="0" max="100"/>
              </div>
            </div>

            <div class="field-section-label">Rating Guides <span class="field-label-opt">(optional)</span></div>
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Efficiency Guide</label>
                <textarea v-model="form.efficiencyGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Quality Guide</label>
                <textarea v-model="form.qualityGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Timeliness Guide</label>
                <textarea v-model="form.timelinessGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeFormModal">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEntry">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Saving…' : (editingItem ? 'Save Changes' : 'Add Entry') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Confirm deactivate -->
    <teleport to="body">
      <div v-if="confirmDel.show" class="modal-overlay">
        <div class="confirm-box">
          <div class="cb-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M8 6V4h6v2M5 6v13a2 2 0 002 2h8a2 2 0 002-2V6" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="cb-title">Deactivate Entry?</div>
          <div class="cb-msg">
            Deactivate <strong>{{ confirmDel.name }}</strong>?<br>
            <span class="muted-text" style="font-size:11px">It will no longer appear in the KRA Library picker.</span>
          </div>
          <div class="cb-btns">
            <button class="btn" @click="confirmDel.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="removing" @click="doRemove">
              {{ removing ? 'Removing…' : 'Deactivate' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Category edit modal -->
    <teleport to="body">
      <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal = false">
        <div class="modal" style="max-width:480px">
          <div class="modal-hd">
            <div class="modal-icon"><svg width="16" height="16" viewBox="0 0 13 13" fill="none"><path d="M9.2 1.5l2.3 2.3-7 7H2.2V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div><div class="modal-title">Edit Category</div><div class="modal-sub">Update the category name, domain, or description</div></div>
          </div>
          <div class="modal-body" style="padding:16px 20px">
            <div class="field" style="margin-bottom:12px">
              <label class="field-label">Domain Name</label>
              <input v-model="categoryEditForm.domainName" class="field-input" placeholder="e.g. Core Behavioral Competencies"/>
            </div>
            <div class="field" style="margin-bottom:12px">
              <label class="field-label">Category Name <span class="req">*</span></label>
              <input v-model="categoryEditForm.categoryName" class="field-input" placeholder="e.g. Makatao"/>
            </div>
            <div class="field">
              <label class="field-label">Description</label>
              <textarea v-model="categoryEditForm.description" class="field-input" rows="3" placeholder="Brief description of this category…"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCategoryModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="savingCategory" @click="saveCategory">
              <span v-if="savingCategory" class="spinner-sm"></span>
              {{ savingCategory ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Assessment question modal -->
    <teleport to="body">
      <div v-if="showQuestionModal" class="modal-overlay" @click.self="closeQuestionModal">
        <div class="modal modal-question">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M5 3h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M6.5 7h5M6.5 10h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingQuestion ? 'Edit Assessment Question' : 'Add Assessment Question' }}</h3>
              <p class="modal-sub">Assessment Content Library</p>
            </div>
            <button class="modal-close" @click="closeQuestionModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div v-if="questionReadOnly" class="readonly-alert">
              This active question has already been used in ratings. Create a new version before changing its content.
              <button class="btn btn-sm" type="button" @click="duplicateQuestionVersion(editingQuestion)">Create New Version</button>
            </div>

            <div class="field-section-label">Content Classification</div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Domain <span class="req">*</span></label>
                <select v-model="questionForm.domain" class="field-input" :disabled="questionReadOnly" @change="syncQuestionCategory">
                  <option v-for="domain in assessmentDomains" :key="domain.id" :value="domain.id">{{ domain.name }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Category <span class="req">*</span></label>
                <select v-model="questionForm.category" class="field-input" :disabled="questionReadOnly">
                  <option v-for="cat in questionCategoryOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Question Text <span class="req">*</span></label>
                <textarea v-model="questionForm.questionText" class="field-input" rows="3" :disabled="questionReadOnly" placeholder="Write the assessment question..."></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Guidance Text</label>
                <textarea v-model="questionForm.guidanceText" class="field-input" rows="2" :disabled="questionReadOnly" placeholder="Short helper text shown to the rater..."></textarea>
              </div>
              <div class="field">
                <label class="field-label">Sequence</label>
                <input v-model.number="questionForm.sequence" type="number" min="1" class="field-input" :disabled="questionReadOnly"/>
              </div>
            </div>

            <div class="field-section-label">Rating Configuration</div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Scale Type</label>
                <select v-model="questionForm.scaleType" class="field-input" :disabled="questionReadOnly">
                  <option value="1-4 Likert">1-4 Likert</option>
                  <option value="1-5 Numeric">1-5 Numeric</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Requirement</label>
                <select v-model="questionForm.required" class="field-input" :disabled="questionReadOnly">
                  <option :value="true">Required</option>
                  <option :value="false">Optional</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Evidence Required</label>
                <select v-model="questionForm.evidenceRequired" class="field-input" :disabled="questionReadOnly">
                  <option :value="false">No</option>
                  <option :value="true">Yes</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Applicable Raters <span class="req">*</span></label>
                <div class="check-grid">
                  <label v-for="rater in raterOptions" :key="rater" class="check-pill">
                    <input type="checkbox" :checked="isQuestionArrayChecked('applicableRaters', rater)" :disabled="questionReadOnly" @change="toggleQuestionArray('applicableRaters', rater)">
                    <span>{{ rater }}</span>
                  </label>
                </div>
              </div>
              <div class="field full">
                <label class="field-label">Applicable Levels <span class="req">*</span></label>
                <div class="check-grid">
                  <label v-for="level in employeeLevelOptions" :key="level" class="check-pill green">
                    <input type="checkbox" :checked="isQuestionArrayChecked('applicableLevels', level)" :disabled="questionReadOnly" @change="toggleQuestionArray('applicableLevels', level)">
                    <span>{{ level }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="field-section-label">Publication / Versioning</div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Status</label>
                <select v-model="questionForm.status" class="field-input" :disabled="questionReadOnly">
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Effective Period</label>
                <select v-model="questionForm.period" class="field-input" :disabled="questionReadOnly">
                  <option value="S1 2026">S1 2026</option>
                  <option value="S2 2026">S2 2026</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Version</label>
                <input v-model.number="questionForm.version" type="number" min="1" class="field-input" :disabled="questionReadOnly"/>
              </div>
              <div class="field full">
                <label class="field-label">Change Notes</label>
                <textarea v-model="questionForm.changeNotes" class="field-input" rows="2" :disabled="questionReadOnly" placeholder="What changed in this version?"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeQuestionModal">Cancel</button>
            <button v-if="editingQuestion && questionForm.status !== 'Active'" class="btn" :disabled="savingQuestion || questionReadOnly" @click="confirmPublishQuestion">Publish</button>
            <button class="btn btn-primary" :disabled="savingQuestion || questionReadOnly" @click="saveQuestion">
              <span v-if="savingQuestion" class="spinner-sm"></span>
              {{ savingQuestion ? 'Saving...' : 'Save Question' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="publishConfirm.show" class="modal-overlay">
        <div class="confirm-box">
          <div class="cb-title">Publish Question?</div>
          <div class="cb-msg">This question will become available in the evaluation tool for its selected raters and employee levels.</div>
          <div class="cb-btns">
            <button class="btn" @click="publishConfirm.show = false">Cancel</button>
            <button class="btn btn-primary" :disabled="savingQuestion" @click="publishQuestion">Publish</button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="archiveConfirm.show" class="modal-overlay">
        <div class="confirm-box">
          <div class="cb-title">Archive Question?</div>
          <div class="cb-msg">This will hide the question from future rating tasks without deleting its history.</div>
          <div class="cb-btns">
            <button class="btn" @click="archiveConfirm.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="savingQuestion" @click="archiveQuestion">Archive</button>
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
import { kraLibrary as kraLibraryApi, assessmentContent as assessmentContentApi, assessmentCategory as assessmentCategoryApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'

const PHASES = ['ANALYSIS', 'DESIGN', 'TESTING', 'EVALUATION', 'PROMOTION', 'PORTFOLIO', 'SOCIAL_MARKETING', 'STRATEGIC', 'SUPPORT']

const { hasPermission } = usePermissions()

// ── State ──
const kras        = ref([])
const loading     = ref(false)
const saving      = ref(false)
const removing    = ref(false)
const search      = ref('')
const filterPhase  = ref('')
const filterFnType = ref('')
const filterClass  = ref('')

const currentPage = ref(1)
const pageSize    = ref(10)
const pageSizeOptions = [10, 25, 50, 100]

const showViewModal = ref(false)
const showFormModal = ref(false)
const viewItem      = ref(null)
const editingItem   = ref(null)
const confirmDel    = ref({ show: false, id: null, name: '' })
const toast         = ref({ show: false, msg: '', type: 'success' })

const emptyForm = () => ({
  phase: '', functionType: 'Core', kraName: '', classification: 'Complex',
  performanceIndicator: '', meansOfVerification: '', applicableTo: 'BOTH',
  weightII: 0, weightIII: 0, weightIV: 0,
  efficiencyGuide: '', qualityGuide: '', timelinessGuide: ''
})

const form = ref(emptyForm())

const activeLibraryTab = ref('kra')
const selectedAssessmentDomain = ref('cbc')
const selectedAssessmentCategory = ref('makatao')
const assessmentSearch = ref('')
const assessmentStatusFilter = ref('')
const assessmentRaterFilter = ref('')
const assessmentLevelFilter = ref('')
const assessmentPeriodFilter = ref('')
const assessmentView = ref('list')
const assessmentQuestions = ref([])
const loadingQuestions = ref(false)
const assessmentLoaded = ref(false)
const seeding = ref(false)
const seedingCategories = ref(false)
const showCategoryModal = ref(false)
const savingCategory = ref(false)
const categoryEditForm = ref({ id: '', domainName: '', categoryName: '', description: '' })
const savingQuestion = ref(false)
const showQuestionModal = ref(false)
const editingQuestion = ref(null)
const publishConfirm = ref({ show: false, id: null })
const archiveConfirm = ref({ show: false, id: null })

const raterOptions = ['Self', 'Peer', 'Upward', 'Supervisor', 'Skip Supervisor']
const employeeLevelOptions = ['Technical Staff', 'Section Head', 'Division Chief']

const assessmentCategoryRows = ref([])
const loadingCategories = ref(false)

const assessmentDomains = computed(() => {
  const rows = assessmentCategoryRows.value.filter(r => r.status === 'Active')
  const domainMap = {}
  rows.forEach(r => {
    if (!domainMap[r.domainId]) {
      domainMap[r.domainId] = {
        id: r.domainId,
        short: r.domainId.toUpperCase(),
        name: r.domainName || r.domainId,
        categories: []
      }
    }
    domainMap[r.domainId].categories.push({
      id: r.categoryId,
      name: r.categoryName,
      description: r.description || ''
    })
  })
  const order = ['cbc', 'jf']
  const sorted = order.filter(id => domainMap[id]).map(id => domainMap[id])
  Object.keys(domainMap).filter(id => !order.includes(id)).forEach(id => sorted.push(domainMap[id]))
  return sorted
})

async function loadCategories() {
  loadingCategories.value = true
  try {
    const data = await assessmentCategoryApi.list({ status: 'Active', pageSize: 200 })
    assessmentCategoryRows.value = data?.items || (Array.isArray(data) ? data : [])
  } catch (e) {
    console.error(e)
  } finally {
    loadingCategories.value = false
  }
}

function emptyQuestionForm() {
  return {
    domain: selectedAssessmentDomain.value,
    category: selectedAssessmentCategory.value,
    questionText: '',
    guidanceText: '',
    sequence: 1,
    scaleType: '1-4 Likert',
    required: true,
    evidenceRequired: false,
    applicableRaters: ['Self', 'Peer', 'Upward', 'Supervisor'],
    applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'],
    status: 'Draft',
    period: 'S2 2026',
    version: 1,
    changeNotes: ''
  }
}

const questionForm = ref(emptyQuestionForm())

// ── Computed ──
const canManageAssessmentContent = hasPermission('manage_assessment_content')
const pageTitle = computed(() => activeLibraryTab.value === 'assessment' ? 'Assessment Content Library' : 'Key Result Areas Library')
const pageSubtitle = computed(() => activeLibraryTab.value === 'assessment'
  ? 'Manage evaluation domains, competency themes, and assessment questions'
  : 'Master KRA & Success Indicator List'
)

const filteredKRAs = computed(() => {
  let rows = kras.value
  if (search.value) {
    const q = search.value.toLowerCase()
    rows = rows.filter(r =>
      r.kraName?.toLowerCase().includes(q) ||
      (r.performanceIndicator || '').toLowerCase().includes(q)
    )
  }
  if (filterPhase.value)  rows = rows.filter(r => r.phase        === filterPhase.value)
  if (filterFnType.value) rows = rows.filter(r => r.functionType === filterFnType.value)
  if (filterClass.value)  rows = rows.filter(r => r.classification === filterClass.value)
  return rows
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredKRAs.value.length / pageSize.value))
)

const paginatedKRAs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredKRAs.value.slice(start, start + pageSize.value)
})

const pageRangeLabel = computed(() => {
  if (!filteredKRAs.value.length) return '0–0 of 0'
  const start = (currentPage.value - 1) * pageSize.value + 1
  const end   = Math.min(currentPage.value * pageSize.value, filteredKRAs.value.length)
  return `${start}–${end} of ${filteredKRAs.value.length}`
})

const pageNumbers = computed(() => {
  const total = totalPages.value
  const curr  = currentPage.value
  const range = []
  const delta = 1
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= curr - delta && i <= curr + delta)) {
      range.push(i)
    } else if (range[range.length - 1] !== '…') {
      range.push('…')
    }
  }
  return range
})

const selectedAssessmentDomainData = computed(() =>
  assessmentDomains.value.find(d => d.id === selectedAssessmentDomain.value) || assessmentDomains.value[0]
)

const selectedAssessmentCategoryData = computed(() =>
  selectedAssessmentDomainData.value?.categories.find(c => c.id === selectedAssessmentCategory.value)
  || selectedAssessmentDomainData.value?.categories[0]
)

const questionCategoryOptions = computed(() =>
  assessmentDomains.value.find(d => d.id === questionForm.value.domain)?.categories || []
)

const categoryQuestions = computed(() =>
  assessmentQuestions.value
    .filter(q => q.domain === selectedAssessmentDomain.value && q.category === selectedAssessmentCategory.value)
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
)

const filteredAssessmentQuestions = computed(() => {
  let rows = categoryQuestions.value
  const q = assessmentSearch.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(row =>
      row.questionText.toLowerCase().includes(q) ||
      (row.guidanceText || '').toLowerCase().includes(q)
    )
  }
  if (assessmentStatusFilter.value) rows = rows.filter(row => row.status === assessmentStatusFilter.value)
  if (assessmentRaterFilter.value) rows = rows.filter(row => row.applicableRaters?.includes(assessmentRaterFilter.value))
  if (assessmentLevelFilter.value) rows = rows.filter(row => row.applicableLevels?.includes(assessmentLevelFilter.value))
  if (assessmentPeriodFilter.value) rows = rows.filter(row => row.period === assessmentPeriodFilter.value)
  return rows
})

const activeCategoryQuestions = computed(() =>
  filteredAssessmentQuestions.value.filter(q => q.status === 'Active')
)

const questionReadOnly = computed(() =>
  Boolean(editingQuestion.value?.hasBeenUsed && editingQuestion.value?.status === 'Active')
)

// Reset to page 1 whenever filters/search/page size change
watch([search, filterPhase, filterFnType, filterClass, pageSize], () => {
  currentPage.value = 1
})

watch(activeLibraryTab, (tab) => {
  if (tab === 'assessment' && canManageAssessmentContent.value && !assessmentLoaded.value) {
    loadAssessmentQuestions()
  }
})

watch(canManageAssessmentContent, (allowed) => {
  if (!allowed && activeLibraryTab.value === 'assessment') activeLibraryTab.value = 'kra'
})

function goToPage(p) {
  if (p === '…' || p < 1 || p > totalPages.value) return
  currentPage.value = p
}

// ── Helpers ──
function countByFnType(type) { return filteredKRAs.value.filter(r => r.functionType === type).length }

function phaseLabel(p) { return (p || '').replace(/_/g, ' ') }

function fnBadgeClass(type) {
  if (type === 'Support')   return 'fn-support'
  if (type === 'Strategic') return 'fn-strategic'
  return 'fn-core'
}

function classStyle(c) {
  if (c === 'Simple')          return 'class-simple'
  if (c === 'Complex')         return 'class-complex'
  if (c === 'Highly Technical') return 'class-ht'
  return 'class-exempt'
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}

function selectAssessmentDomain(domainId) {
  selectedAssessmentDomain.value = domainId
  selectedAssessmentCategory.value = assessmentDomains.value.find(d => d.id === domainId)?.categories[0]?.id || ''
}

function selectAssessmentCategory(categoryId) {
  selectedAssessmentCategory.value = categoryId
}

function assessmentDomainCount(domainId) {
  return assessmentQuestions.value.filter(q => q.domain === domainId && q.status !== 'Archived').length
}

function assessmentCategoryCount(categoryId) {
  return assessmentQuestions.value.filter(q => q.category === categoryId && q.status !== 'Archived').length
}

function categoryStatusClass(categoryId) {
  const rows = assessmentQuestions.value.filter(q => q.category === categoryId)
  if (rows.some(q => q.status === 'Draft')) return 'draft'
  if (rows.some(q => q.status === 'Active')) return 'active'
  return 'archived'
}

function syncQuestionCategory() {
  questionForm.value.category = questionCategoryOptions.value[0]?.id || ''
}

function isQuestionArrayChecked(field, value) {
  return (questionForm.value[field] || []).includes(value)
}

function toggleQuestionArray(field, value) {
  const set = new Set(questionForm.value[field] || [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  questionForm.value[field] = [...set]
}

function openQuestionModal(question = null) {
  editingQuestion.value = question
  questionForm.value = question
    ? {
        domain: question.domain,
        category: question.category,
        questionText: question.questionText,
        guidanceText: question.guidanceText || '',
        sequence: Number(question.sequence) || 1,
        scaleType: question.scaleType || '1-4 Likert',
        required: question.required !== false,
        evidenceRequired: Boolean(question.evidenceRequired),
        applicableRaters: [...(question.applicableRaters || [])],
        applicableLevels: [...(question.applicableLevels || [])],
        status: question.status || 'Draft',
        period: question.period || 'S2 2026',
        version: Number(question.version) || 1,
        changeNotes: question.changeNotes || ''
      }
    : {
        ...emptyQuestionForm(),
        sequence: categoryQuestions.value.length + 1
      }
  showQuestionModal.value = true
}

function closeQuestionModal() {
  showQuestionModal.value = false
  editingQuestion.value = null
  questionForm.value = emptyQuestionForm()
}

function validateQuestionForm() {
  if (!questionForm.value.domain || !questionForm.value.category || !questionForm.value.questionText.trim()) {
    showToast('Complete the required assessment fields before saving.', 'error')
    return false
  }
  if (!questionForm.value.applicableRaters.length || !questionForm.value.applicableLevels.length) {
    showToast('Select at least one rater type and employee level.', 'error')
    return false
  }
  return true
}

function questionPayload(statusOverride = null) {
  return {
    ...questionForm.value,
    status: statusOverride || questionForm.value.status,
    sequence: Number(questionForm.value.sequence) || 1,
    version: Number(questionForm.value.version) || 1,
    updatedAt: new Date().toISOString()
  }
}

function normalizeQuestion(row = {}) {
  return {
    id: row.id || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    domain: row.domain || 'cbc',
    category: row.category || 'makatao',
    questionText: row.questionText || '',
    guidanceText: row.guidanceText || '',
    sequence: Number(row.sequence) || 1,
    scaleType: row.scaleType || '1-4 Likert',
    required: row.required !== false,
    evidenceRequired: Boolean(row.evidenceRequired),
    applicableRaters: Array.isArray(row.applicableRaters) ? row.applicableRaters : String(row.applicableRaters || '').split(',').map(v => v.trim()).filter(Boolean),
    applicableLevels: Array.isArray(row.applicableLevels) ? row.applicableLevels : String(row.applicableLevels || '').split(',').map(v => v.trim()).filter(Boolean),
    status: row.status || 'Draft',
    period: row.period || 'S2 2026',
    version: Number(row.version) || 1,
    hasBeenUsed: Boolean(row.hasBeenUsed),
    changeNotes: row.changeNotes || '',
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString()
  }
}

function applyLocalQuestion(payload, id = null) {
  if (id) {
    const idx = assessmentQuestions.value.findIndex(q => q.id === id)
    if (idx !== -1) assessmentQuestions.value[idx] = normalizeQuestion({ ...assessmentQuestions.value[idx], ...payload, id })
    return assessmentQuestions.value[idx]
  }
  const created = normalizeQuestion({ ...payload, id: `local_${Date.now()}`, createdAt: new Date().toISOString() })
  assessmentQuestions.value.unshift(created)
  return created
}

function seedAssessmentQuestions() {
  return [
    {
      id: 'seed_makatao_1', domain: 'cbc', category: 'makatao', sequence: 1, status: 'Active', version: 1, period: 'S2 2026',
      questionText: 'Champions equality and social justice in program design and service delivery.',
      guidanceText: 'Consider how consistently the employee integrates equity and inclusive practices into assigned work.',
      applicableRaters: ['Self', 'Peer', 'Upward', 'Supervisor', 'Skip Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: true
    },
    {
      id: 'seed_makatao_2', domain: 'cbc', category: 'makatao', sequence: 2, status: 'Active', version: 1, period: 'S2 2026',
      questionText: 'Embodies compassion and respect in all professional interactions.',
      guidanceText: 'Evaluate how the employee treats clients, colleagues, and partners with empathy and cultural sensitivity.',
      applicableRaters: ['Self', 'Peer', 'Upward', 'Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: true
    },
    {
      id: 'seed_makatao_3', domain: 'cbc', category: 'makatao', sequence: 3, status: 'Draft', version: 1, period: 'S2 2026',
      questionText: 'Promotes cultural awareness, understanding, and respect for diverse identities.',
      guidanceText: 'Consider efforts to recognize and value differences in backgrounds, beliefs, values, and perspectives.',
      applicableRaters: ['Self', 'Peer', 'Upward', 'Supervisor', 'Skip Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: true
    },
    {
      id: 'seed_makatao_4', domain: 'cbc', category: 'makatao', sequence: 4, status: 'Active', version: 1, period: 'S1 2026',
      questionText: 'Upholds human rights and dignity in the delivery of services.',
      guidanceText: 'Evaluate commitment to protecting rights and ensuring fair, just, and non-discriminatory service.',
      applicableRaters: ['Self', 'Peer', 'Upward', 'Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: true, hasBeenUsed: true
    },
    {
      id: 'seed_makatao_5', domain: 'cbc', category: 'makatao', sequence: 5, status: 'Archived', version: 1, period: 'S2 2026',
      questionText: 'Advocates for vulnerable groups and promotes inclusive programs.',
      guidanceText: 'Consider support for initiatives that empower disadvantaged and marginalized populations.',
      applicableRaters: ['Self', 'Peer', 'Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: false
    },
    {
      id: 'seed_education_1', domain: 'jf', category: 'educational-fit', sequence: 1, status: 'Active', version: 1, period: 'S2 2026',
      questionText: 'Educational background supports the technical requirements of the position.',
      guidanceText: 'Assess whether formal education aligns with the functions and expected outputs of the role.',
      applicableRaters: ['Self', 'Supervisor'],
      applicableLevels: ['Technical Staff', 'Section Head', 'Division Chief'], required: true
    }
  ].map(normalizeQuestion)
}

// ── Actions ──
function openAddModal() {
  editingItem.value = null
  form.value = emptyForm()
  showFormModal.value = true
}

function openEditModal(item) {
  editingItem.value = item
  form.value = {
    phase:                item.phase || '',
    functionType:         item.functionType || 'Core',
    kraName:              item.kraName || '',
    classification:       item.classification || 'Complex',
    performanceIndicator: item.performanceIndicator || '',
    meansOfVerification:  item.meansOfVerification || '',
    applicableTo:         item.applicableTo || 'BOTH',
    weightII:             Number(item.weightII)  || 0,
    weightIII:            Number(item.weightIII) || 0,
    weightIV:             Number(item.weightIV)  || 0,
    efficiencyGuide:      item.efficiencyGuide  || '',
    qualityGuide:         item.qualityGuide     || '',
    timelinessGuide:      item.timelinessGuide  || ''
  }
  showFormModal.value = true
}

function openViewModal(item) {
  viewItem.value = item
  showViewModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value   = null
}

function confirmRemove(item) {
  confirmDel.value = { show: true, id: item.id, name: item.kraName }
}

// ── API ──
onMounted(() => { loadKRAs(); loadCategories() })

async function loadKRAs() {
  loading.value = true
  try {
    const r = await kraLibraryApi.list()
    kras.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) {
    console.error(e); showToast('Could not load KRA library. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

async function saveEntry() {
  if (!form.value.phase || !form.value.kraName || !form.value.performanceIndicator) {
    showToast('Phase, KRA name and performance indicator are required', 'error')
    return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      const u = await kraLibraryApi.update(editingItem.value.id, form.value)
      const i = kras.value.findIndex(r => r.id === editingItem.value.id)
      if (i !== -1) kras.value[i] = { ...kras.value[i], ...u }
      showToast('KRA entry updated')
    } else {
      const created = await kraLibraryApi.create(form.value)
      kras.value.unshift(created)
      showToast('KRA entry added')
    }
    closeFormModal()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    saving.value = false
  }
}

async function doRemove() {
  removing.value = true
  try {
    await kraLibraryApi.delete(confirmDel.value.id)
    kras.value = kras.value.filter(r => r.id !== confirmDel.value.id)
    showToast('Entry deactivated')
    confirmDel.value.show = false
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    removing.value = false
  }
}

async function loadAssessmentQuestions() {
  loadingQuestions.value = true
  try {
    const r = await assessmentContentApi.list()
    const rows = r?.items || (Array.isArray(r) ? r : [])
    assessmentQuestions.value = rows.map(normalizeQuestion)
  } catch (e) {
    console.error(e)
    assessmentQuestions.value = []
    showToast('Could not load live assessment content. Please refresh or contact the system administrator.', 'error')
  } finally {
    assessmentLoaded.value = true
    loadingQuestions.value = false
  }
}

async function seedFromStandard(force = false) {
  seeding.value = true
  try {
    const result = await assessmentContentApi.seed({ force })
    showToast(`Seeded ${result.seeded || result.cbcCount + result.jfCount} standard assessment questions.`)
    await loadAssessmentQuestions()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    seeding.value = false
  }
}

function openCategoryEditModal() {
  const catId = selectedAssessmentCategory.value
  const row = assessmentCategoryRows.value.find(r => r.categoryId === catId)
  if (!row) { showToast('Category not found in database', 'error'); return }
  categoryEditForm.value = {
    id: row.id,
    domainName: row.domainName || '',
    categoryName: row.categoryName || '',
    description: row.description || ''
  }
  showCategoryModal.value = true
}

async function saveCategory() {
  const form = categoryEditForm.value
  if (!form.categoryName.trim()) { showToast('Category name is required', 'error'); return }
  savingCategory.value = true
  try {
    await assessmentCategoryApi.update(form.id, {
      domainName: form.domainName,
      categoryName: form.categoryName,
      description: form.description
    })
    showToast('Category updated')
    showCategoryModal.value = false
    await loadCategories()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    savingCategory.value = false
  }
}

async function seedCategories() {
  seedingCategories.value = true
  try {
    const result = await assessmentCategoryApi.seed({ force: true })
    showToast(`Seeded ${result.seeded} assessment categories.`)
    await loadCategories()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    seedingCategories.value = false
  }
}

async function saveQuestion() {
  if (!validateQuestionForm()) return
  savingQuestion.value = true
  try {
    const payload = questionPayload()
    if (editingQuestion.value) {
      const updated = await assessmentContentApi.update(editingQuestion.value.id, payload)
      applyLocalQuestion(updated || payload, editingQuestion.value.id)
      showToast('Assessment question updated')
    } else {
      const created = await assessmentContentApi.create(payload)
      applyLocalQuestion(created || payload)
      showToast('Assessment question added')
    }
    closeQuestionModal()
  } catch (e) {
    console.error(e)
    showToast(assessmentQuestionErrorMessage(e), 'error')
  } finally {
    savingQuestion.value = false
  }
}

function assessmentQuestionErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('already been used') || message.includes('new version')) {
    return 'This active question has already been used. Duplicate it as a new version before changing it.'
  }
  if (message.includes('access denied') || message.includes('required permission') || message.includes('unauthorized')) {
    return 'You do not have permission to update assessment content.'
  }
  if (message.includes('required')) {
    return 'Please complete all required assessment question fields.'
  }
  return 'Could not save the assessment question. Please try again.'
}

function confirmPublishQuestion() {
  if (!validateQuestionForm()) return
  publishConfirm.value = { show: true, id: editingQuestion.value?.id || null }
}

async function publishQuestion() {
  savingQuestion.value = true
  try {
    const payload = questionPayload('Active')
    if (publishConfirm.value.id) {
      const published = await assessmentContentApi.publish(publishConfirm.value.id, payload)
      applyLocalQuestion(published || payload, publishConfirm.value.id)
    } else {
      const created = await assessmentContentApi.create(payload)
      applyLocalQuestion(created || payload)
    }
    showToast('Assessment question published')
    publishConfirm.value.show = false
    closeQuestionModal()
  } catch (e) {
    console.error(e)
    showToast('Could not publish the assessment question. Please try again.', 'error')
    publishConfirm.value.show = false
  } finally {
    savingQuestion.value = false
  }
}

function confirmArchiveQuestion(question) {
  archiveConfirm.value = { show: true, id: question.id }
}

async function archiveQuestion() {
  const id = archiveConfirm.value.id
  savingQuestion.value = true
  try {
    await assessmentContentApi.archive(id)
    applyLocalQuestion({ status: 'Archived' }, id)
    showToast('Assessment question archived')
  } catch (e) {
    console.error(e)
    showToast('Could not archive the assessment question. Please try again.', 'error')
  } finally {
    archiveConfirm.value.show = false
    savingQuestion.value = false
  }
}

async function duplicateQuestionVersion(question) {
  const newVersion = normalizeQuestion({
    ...question,
    id: `local_${Date.now()}`,
    status: 'Draft',
    version: Number(question.version || 1) + 1,
    hasBeenUsed: false,
    changeNotes: `New version from Ver. ${question.version || 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  try {
    const duplicated = await assessmentContentApi.duplicateVersion(question.id, newVersion)
    assessmentQuestions.value.unshift(normalizeQuestion(duplicated || newVersion))
  } catch (e) {
    console.error(e)
    showToast('Could not create a new version. Please try again.', 'error')
    return
  }
  selectedAssessmentDomain.value = newVersion.domain
  selectedAssessmentCategory.value = newVersion.category
  openQuestionModal(newVersion)
  showToast('New draft version created')
}

async function moveQuestion(id, direction) {
  const rows = categoryQuestions.value
  const currentIndex = rows.findIndex(q => q.id === id)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) return
  const current = rows[currentIndex]
  const next = rows[nextIndex]
  const currentSequence = current.sequence
  applyLocalQuestion({ sequence: next.sequence }, current.id)
  applyLocalQuestion({ sequence: currentSequence }, next.id)
  try {
    await assessmentContentApi.reorder(categoryQuestions.value.map((q, index) => ({ id: q.id, sequence: index + 1 })))
  } catch (e) {
    console.error(e)
  }
}
</script>

<style scoped>
.kra-page { padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.muted-text { color: #94A3B8; }
.req { color: #EF4444; font-size: 11px; }

/* Header */
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; letter-spacing: -.3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }

/* Content card */
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }

/* Filters */
.filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.srch-wrap { flex: 1 1 220px; position: relative; min-width: 200px; max-width: 420px; }
.srch-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { box-sizing: border-box; width: 100%; padding: 8px 11px 8px 30px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; color: #0F172A; outline: none; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.filter-selects { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 0 auto; }
.filter-select { box-sizing: border-box; flex: 0 0 auto; min-width: 132px; padding: 7px 28px 7px 10px; border: 1px solid #E2E8F0; border-radius: 7px; font-size: 12px; color: #374151; background: #fff; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; -moz-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
.filter-select:focus { border-color: #3B82F6; }
.btn-add-kra { margin-left: auto; }

/* Stats bar */
.stats-bar { display: flex; gap: 8px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #F1F5F9; flex-wrap: wrap; }
.stat-pill { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.3; }
.stat-pill-total { background: #F1F5F9; color: #334155; }
.stat-pill-core { background: #EBF4FF; color: #1A56B0; }
.stat-pill-support { background: #F3EEFF; color: #6B3FA0; }
.stat-pill-strategic { background: #FFF4E5; color: #B45309; }

/* Table */
.kra-table { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }

/* ── Pagination ── */
.pagination-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 14px; padding: 14px 4px 0; border-top: 1px solid #F1F5F9; }
.pg-info { display: flex; align-items: center; gap: 16px; font-size: 12px; color: #64748B; }
.pg-size { display: flex; align-items: center; gap: 6px; }
.pg-size-select { box-sizing: border-box; padding: 5px 22px 5px 8px; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; color: #374151; background: #fff; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; -moz-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
.pg-size-select:focus { border-color: #3B82F6; }
.pg-controls { display: flex; align-items: center; gap: 4px; }
.pg-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #E2E8F0; border-radius: 6px; background: #fff; color: #475569; cursor: pointer; transition: background .12s, border-color .12s; }
.pg-btn:hover:not(:disabled) { background: #F8FAFC; border-color: #CBD5E1; }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
.pg-num { min-width: 28px; height: 28px; padding: 0 6px; border: 1px solid #E2E8F0; border-radius: 6px; background: #fff; color: #374151; font-size: 12px; font-weight: 600; cursor: pointer; transition: background .12s, border-color .12s, color .12s; }
.pg-num:hover { background: #F8FAFC; border-color: #CBD5E1; }
.pg-num.active { background: #1E3A8A; border-color: #1E3A8A; color: #fff; }
.pg-ellipsis { display: flex; align-items: center; justify-content: center; min-width: 24px; color: #94A3B8; font-size: 12px; }
.table-hd { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
.th-phase { width: 120px; flex-shrink: 0; }
.th-main { flex: 1; }
.th-type { width: 80px; flex-shrink: 0; }
.th-class { width: 120px; flex-shrink: 0; }
.th-wt { width: 90px; flex-shrink: 0; }
.th-act { width: 64px; flex-shrink: 0; }

.table-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }

.td { font-size: 12px; color: #374151; }
.td-phase { width: 120px; flex-shrink: 0; padding-top: 2px; }
.td-main { flex: 1; min-width: 0; }
.td-type { width: 80px; flex-shrink: 0; padding-top: 2px; }
.td-class { width: 120px; flex-shrink: 0; padding-top: 2px; }
.td-wt { width: 90px; flex-shrink: 0; padding-top: 2px; }
.td-act { width: 64px; flex-shrink: 0; display: flex; gap: 3px; padding-top: 2px; }

/* KRA cell */
.kra-name { font-size: 12px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
.kra-pi { font-size: 11px; color: #475569; line-height: 1.55; margin-bottom: 4px; }
.kra-mov { font-size: 11px; color: #94A3B8; }
.mov-lbl { font-weight: 600; color: #64748B; }

/* Phase pill */
.phase-pill { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; background: #F1F5F9; color: #475569; }

/* Function type badge */
.fn-badge { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; }
.fn-core { background: #EBF4FF; color: #1A56B0; }
.fn-support { background: #F3EEFF; color: #6B3FA0; }
.fn-strategic { background: #FFF4E5; color: #B45309; }

/* Classification badge */
.class-badge { display: inline-flex; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 500; }
.class-simple { background: #F0FDF4; color: #15803D; }
.class-complex { background: #FEF3E2; color: #B45309; }
.class-ht { background: #FEF2F2; color: #B91C1C; }
.class-exempt { background: #F8FAFC; color: #64748B; }

/* Weight stack */
.wt-stack { display: flex; flex-direction: column; gap: 2px; }
.wt-item { font-size: 10px; color: #64748B; }

/* Action buttons */
.act { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: pointer; color: #94A3B8; transition: all .12s; }
.act:hover { background: #F1F5F9; border-color: #E2E8F0; color: #475569; }
.act-del:hover { background: #FEF2F2; border-color: #FCA5A5; color: #EF4444; }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 8px; }

/* Skeleton */
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; display: block; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; border-color: #1e3f61; }
.btn-danger { background: #EF4444; color: #fff; border-color: #EF4444; }
.btn-danger:hover { background: #DC2626; }
.btn-sm { padding: 5px 12px; font-size: 11px; }

/* Modal overlay */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; backdrop-filter: blur(4px); }

/* Modal base */
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.2); overflow: hidden; }
.modal-view { max-width: 640px; }
.modal-form { max-width: 680px; }
.modal-hd { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid #F1F5F9; background: #FAFBFF; flex-shrink: 0; }
.modal-hd-badges { display: flex; gap: 6px; margin-bottom: 4px; }
.modal-icon { width: 36px; height: 36px; border-radius: 10px; background: #EBF4FF; color: #2F80ED; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 2px; }
.modal-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.modal-close { margin-left: auto; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #94A3B8; transition: all .15s; }
.modal-close:hover { background: #F1F5F9; color: #374151; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid #F1F5F9; background: #F8FAFC; flex-shrink: 0; }

/* View modal */
.view-section { margin-bottom: 16px; }
.view-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; }
.view-text { font-size: 13px; color: #1A2332; line-height: 1.6; }
.view-guide { font-size: 12px; color: #475569; line-height: 1.7; white-space: pre-line; background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 7px; padding: 8px 12px; }
.view-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Form fields */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full { grid-column: span 2; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; resize: vertical; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.field-input::placeholder { color: #CBD5E1; }
.field-section-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; }
.field-label-opt { font-weight: 400; text-transform: none; letter-spacing: 0; color: #CBD5E1; font-size: 10px; }

/* Confirm delete */
.confirm-box { background: #fff; border-radius: 16px; padding: 28px 26px; max-width: 360px; width: calc(100% - 32px); text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,.2); }
.cb-icon { width: 48px; height: 48px; border-radius: 14px; background: #FEF2F2; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
.cb-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 7px; }
.cb-msg { font-size: 12px; color: #475569; line-height: 1.65; margin-bottom: 20px; }
.cb-btns { display: flex; justify-content: center; gap: 8px; }

/* Spinner */
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }

/* Library tabs */
.library-tabs { display:flex; align-items:center; gap:8px; margin:-4px 0 18px; }
.library-tab { border:1px solid #E2E8F0; background:#F8FAFC; color:#334155; padding:8px 18px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; }
.library-tab:hover { border-color:#BFDBFE; color:#0B4DBA; background:#EFF6FF; }
.library-tab.active { background:#0B4DBA; border-color:#0B4DBA; color:#fff; box-shadow:0 5px 14px rgba(11,77,186,.18); }
.kra-library-section { min-width:0; }

/* Assessment content library */
.assessment-manager { display:grid; grid-template-columns:335px minmax(0,1fr); margin:0 -20px -20px; border-top:1px solid #E2E8F0; min-height:620px; }
.assessment-nav { padding:20px; border-right:1px solid #E2E8F0; background:linear-gradient(180deg,#FBFDFF 0%,#FFFFFF 100%); display:flex; flex-direction:column; gap:14px; }
.assessment-nav-title { font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
.assessment-domain { border-radius:12px; }
.assessment-domain.active { background:#F8FBFF; }
.assessment-domain-head { width:100%; display:flex; align-items:center; gap:12px; border:0; background:transparent; padding:10px 8px; text-align:left; cursor:pointer; border-radius:10px; }
.assessment-domain-head:hover { background:#F1F7FF; }
.domain-mark { width:36px; height:36px; border-radius:999px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:800; flex-shrink:0; }
.domain-mark.cbc { background:#0B4DBA; }
.domain-mark.jf { background:#168A43; }
.domain-info { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:8px; flex:1; }
.domain-info strong { font-size:13px; color:#0F172A; }
.domain-info small { min-width:24px; height:20px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:#E5EAF1; color:#475569; font-size:11px; font-weight:800; }
.domain-chevron { color:#64748B; font-size:14px; }
.assessment-category-list { display:flex; flex-direction:column; gap:4px; padding:4px 0 12px 44px; }
.assessment-category { display:flex; align-items:center; gap:10px; width:100%; border:0; border-radius:8px; background:transparent; padding:8px 10px; color:#475569; font-size:12px; font-weight:600; cursor:pointer; text-align:left; }
.assessment-category:hover, .assessment-category.active { background:#EAF3FF; color:#0B4DBA; }
.assessment-category span:nth-child(2) { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.assessment-category em { min-width:22px; height:20px; border-radius:999px; background:#EEF2F7; color:#64748B; display:inline-flex; align-items:center; justify-content:center; font-style:normal; font-size:11px; }
.status-dot { width:7px; height:7px; border-radius:999px; background:#94A3B8; flex-shrink:0; }
.status-dot.active { background:#22C55E; }
.status-dot.draft { background:#F59E0B; }
.status-dot.archived { background:#94A3B8; }
.assessment-legend { margin-top:auto; display:flex; gap:16px; padding:16px; border:1px solid #E2E8F0; border-radius:10px; background:#fff; color:#64748B; font-size:11px; }
.assessment-legend span { display:flex; align-items:center; gap:7px; }

.assessment-workspace { min-width:0; display:flex; flex-direction:column; background:#fff; }
.assessment-workspace-hd { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:22px 24px 18px; border-bottom:1px solid #E2E8F0; }
.assessment-title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.assessment-title-row h3 { margin:0; color:#0F172A; font-size:20px; font-weight:800; letter-spacing:-.02em; }
.cat-edit-btn { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:1px solid #E2E8F0; border-radius:6px; background:#fff; color:#64748B; cursor:pointer; transition:all .15s; }
.cat-edit-btn:hover { background:#F1F5F9; color:#0F172A; border-color:#CBD5E1; }
.domain-chip { display:inline-flex; align-items:center; border-radius:7px; padding:4px 8px; background:#EAF3FF; color:#0B4DBA; font-size:11px; font-weight:800; }
.assessment-workspace-hd p { margin:8px 0 0; color:#475569; font-size:12px; line-height:1.5; }
.assessment-count { color:#475569; font-size:12px; text-align:right; white-space:nowrap; }
.assessment-count strong { color:#0F172A; font-size:14px; }
.assessment-count span { display:block; color:#168A43; font-weight:700; margin-top:2px; }
.assessment-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:16px 24px; border-bottom:1px solid #F1F5F9; }
.assessment-search { flex:1 1 230px; max-width:310px; }
.assessment-view-toggle { display:inline-flex; align-items:center; border:1px solid #E2E8F0; border-radius:8px; background:#F8FAFC; overflow:hidden; margin-left:auto; }
.assessment-view-toggle button { min-width:72px; border:0; background:transparent; padding:8px 14px; color:#475569; font-size:12px; font-weight:700; cursor:pointer; }
.assessment-view-toggle button.active { background:#fff; color:#0B4DBA; box-shadow:0 1px 4px rgba(15,23,42,.08); }
.assessment-add-btn { margin-left:0; }
.assessment-loading { display:flex; align-items:center; justify-content:center; gap:8px; min-height:260px; color:#64748B; font-size:13px; }
.spinner-sm.dark { border-color:rgba(11,77,186,.18); border-top-color:#0B4DBA; }
.assessment-list { display:flex; flex-direction:column; gap:10px; padding:16px 24px 24px; }
.empty-state.compact { padding:48px 20px; border:1px dashed #CBD5E1; border-radius:12px; }
.question-card { display:grid; grid-template-columns:24px 38px minmax(0,1fr) auto; gap:12px; align-items:start; padding:18px; border:1px solid #E2E8F0; border-radius:12px; background:#fff; transition:border-color .15s, box-shadow .15s; }
.question-card:hover { border-color:#BFDBFE; box-shadow:0 8px 24px rgba(15,23,42,.06); }
.question-card.archived { opacity:.72; background:#FAFBFC; }
.question-handle { color:#94A3B8; font-size:18px; line-height:1; padding-top:6px; letter-spacing:-3px; }
.question-no { width:34px; height:34px; border:1px solid #E2E8F0; border-radius:999px; display:flex; align-items:center; justify-content:center; color:#0F172A; font-weight:800; background:#fff; }
.question-main { min-width:0; }
.question-topline { display:flex; gap:10px; align-items:flex-start; justify-content:space-between; }
.question-topline h4 { margin:0; color:#0F172A; font-size:13px; line-height:1.45; font-weight:800; }
.question-main p { margin:5px 0 0; color:#475569; line-height:1.5; font-size:12px; }
.question-status { display:inline-flex; align-items:center; border-radius:7px; padding:4px 8px; font-size:11px; font-weight:800; flex-shrink:0; }
.question-status.active { background:#E6F7ED; color:#15803D; }
.question-status.draft { background:#FFF4E5; color:#B45309; }
.question-status.archived { background:#E5EAF1; color:#64748B; }
.question-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
.tag-blue, .tag-green, .tag-red, .tag-gray { display:inline-flex; align-items:center; border-radius:6px; padding:3px 7px; font-size:10px; font-weight:700; }
.tag-blue { background:#EAF3FF; color:#0B4DBA; }
.tag-green { background:#E6F7ED; color:#15803D; }
.tag-red { background:#FEE2E2; color:#B91C1C; }
.tag-gray { background:#F1F5F9; color:#64748B; }
.question-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; max-width:160px; }
.question-actions .act:disabled { opacity:.35; cursor:not-allowed; }
.assessment-preview { padding:20px 24px 26px; display:flex; flex-direction:column; gap:10px; }
.preview-hd { display:flex; justify-content:space-between; align-items:center; border:1px solid #E2E8F0; border-radius:12px; padding:14px 16px; background:#F8FAFC; }
.preview-hd span { font-size:15px; font-weight:800; color:#0F172A; }
.preview-hd small { color:#64748B; font-size:12px; }
.preview-question { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:14px; align-items:center; border:1px solid #E2E8F0; border-radius:12px; padding:15px; background:#fff; }
.preview-question > span { width:26px; height:26px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#F1F5F9; color:#64748B; font-size:12px; font-weight:800; }
.preview-question strong { color:#0F172A; font-size:13px; }
.preview-question p { margin:4px 0 0; color:#64748B; font-size:12px; line-height:1.5; }
.preview-scale { display:flex; gap:8px; }
.preview-scale button { width:38px; height:38px; border:1px solid #CBD5E1; border-radius:10px; background:#fff; font-weight:800; color:#334155; }

.modal-question { max-width:820px; }
.readonly-alert { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #FCD34D; background:#FFFBEB; color:#92400E; border-radius:10px; font-size:12px; margin-bottom:18px; }
.check-grid { display:flex; flex-wrap:wrap; gap:8px; }
.check-pill { display:inline-flex; align-items:center; gap:7px; border:1px solid #D8E7FF; background:#F4F8FF; color:#0B4DBA; border-radius:8px; padding:8px 10px; font-size:12px; font-weight:700; cursor:pointer; }
.check-pill.green { border-color:#CDEFD9; background:#F0FDF4; color:#15803D; }
.check-pill input { accent-color:#0B4DBA; }

@media (max-width: 1100px) {
  .assessment-manager { grid-template-columns:1fr; }
  .assessment-nav { border-right:0; border-bottom:1px solid #E2E8F0; }
  .assessment-category-list { padding-left:0; }
  .assessment-toolbar .assessment-view-toggle { margin-left:0; }
}

@media (max-width: 720px) {
  .question-card { grid-template-columns:28px minmax(0,1fr); }
  .question-handle { display:none; }
  .question-no { width:28px; height:28px; }
  .question-main, .question-actions { grid-column:2; }
  .question-actions { justify-content:flex-start; max-width:none; }
  .preview-question { grid-template-columns:30px 1fr; }
  .preview-scale { grid-column:2; }
}
</style>
