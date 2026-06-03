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
        + New Form
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

    <!-- ── Loading ── -->
    <div v-if="loading" class="state-wrap">
      <div class="spinner"></div>
      <p class="muted">Loading forms…</p>
    </div>

    <!-- ── Empty ── -->
    <div v-else-if="filteredForms.length === 0" class="state-wrap">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#CBD5E1" stroke-width="2"/>
        <path d="M16 16h16M16 22h12M16 28h8" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">No forms yet</p>
      <p class="empty-sub">Create your first IPCRF or CCEF form to get started.</p>
      <button class="btn btn-primary" @click="showNewFormModal = true">Create New Form</button>
    </div>

    <!-- ── Forms Grid ── -->
    <div v-else class="forms-grid">
      <div v-for="form in filteredForms" :key="form.id"
        :class="['form-card', activeForm?.id === form.id && 'selected']"
        @click="openForm(form)">
        <div class="form-card-top">
          <span :class="['type-badge', form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">
            {{ form.type }}
          </span>
          <span :class="['status-badge', statusClass(form.status)]">{{ form.status }}</span>
        </div>
        <div class="form-card-name">{{ form.employeeName }}</div>
        <div class="form-card-meta">
          {{ form.divisionName || '—' }} &bull; Sem {{ form.semester }}, {{ form.year }}
        </div>
        <div v-if="form.finalNumericalRating" class="form-card-rating">
          <span class="rating-score">{{ form.finalNumericalRating }}</span>
          <span class="rating-adj">{{ form.adjectivalRating }}</span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════
         FORM DETAIL PANEL
    ═══════════════════════════ -->
    <transition name="slide">
      <div v-if="activeForm" class="detail-panel">

        <!-- Panel Header -->
        <div class="panel-hd">
          <div>
            <div class="panel-badges">
              <span :class="['type-badge', activeForm.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">
                {{ activeForm.type }}
              </span>
              <span :class="['status-badge', statusClass(activeForm.status)]">
                {{ activeForm.status }}
              </span>
            </div>
            <div class="panel-name">{{ activeForm.employeeName }}</div>
            <div class="panel-meta muted">
              Sem {{ activeForm.semester }} · {{ activeForm.year }} · {{ activeForm.divisionName }}
            </div>
          </div>
          <button class="close-btn" @click="activeForm = null">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Panel Tabs -->
        <div class="panel-tabs">
          <button :class="['ptab', activeTab === 'indicators' && 'active']" @click="activeTab = 'indicators'">Indicators</button>
          <button :class="['ptab', activeTab === 'details' && 'active']"    @click="activeTab = 'details'">Details</button>
          <button :class="['ptab', activeTab === 'score' && 'active']"      @click="activeTab = 'score'">Score</button>
        </div>

        <!-- ── Indicators Tab ── -->
        <div v-if="activeTab === 'indicators'" class="panel-body">

          <!-- Core Functions -->
          <div class="section-row">
            <span class="section-label">Core Functions
              <span class="muted">({{ activeForm.coreFunctionWeight }}%)</span>
            </span>
            <div class="btn-group">
              <button class="btn btn-xs" @click="openLibrary('Core')">+ Library</button>
              <button class="btn btn-xs" @click="openCustomEntry('Core')">+ Custom</button>
            </div>
          </div>
          <p v-if="coreEntries.length === 0" class="no-entries muted">No core indicators yet.</p>
          <div v-for="e in coreEntries" :key="e.id" class="entry-item">
            <div class="entry-content">
              <div class="entry-kra">{{ e.kraName }}</div>
              <div class="entry-si">{{ e.successIndicator }}</div>
              <div class="entry-chips">
                <span class="chip">Wt: {{ e.weight }}%</span>
                <span class="chip">{{ e.applicableRatingPeriod }}</span>
                <span v-if="e.isCustom === true || e.isCustom === 'true'" class="chip chip-amber">Custom</span>
              </div>
              <div v-if="e.ratingAverage" class="entry-rating">
                Avg <strong>{{ e.ratingAverage }}</strong>
                &nbsp;(E:{{ e.ratingEfficiency }} Q:{{ e.ratingQuality }} T:{{ e.ratingTimeliness }})
              </div>
            </div>
            <div class="entry-btns">
              <button class="icon-btn" @click="openEditEntry(e)" title="Edit">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="icon-btn danger" @click="confirmDeleteEntry(e)" title="Delete">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3h8M5 3V2h2v1M4 3v6.5c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Support Functions -->
          <div class="section-row mt-16">
            <span class="section-label">Support Functions
              <span class="muted">({{ activeForm.supportFunctionWeight }}%)</span>
            </span>
            <div class="btn-group">
              <button class="btn btn-xs" @click="openLibrary('Support')">+ Library</button>
              <button class="btn btn-xs" @click="openCustomEntry('Support')">+ Custom</button>
            </div>
          </div>
          <p v-if="supportEntries.length === 0" class="no-entries muted">No support indicators yet.</p>
          <div v-for="e in supportEntries" :key="e.id" class="entry-item">
            <div class="entry-content">
              <div class="entry-kra">{{ e.kraName }}</div>
              <div class="entry-si">{{ e.successIndicator }}</div>
              <div class="entry-chips">
                <span class="chip">Wt: {{ e.weight }}%</span>
                <span class="chip">{{ e.applicableRatingPeriod }}</span>
                <span v-if="e.isCustom === true || e.isCustom === 'true'" class="chip chip-amber">Custom</span>
              </div>
              <div v-if="e.ratingAverage" class="entry-rating">
                Avg <strong>{{ e.ratingAverage }}</strong>
                &nbsp;(E:{{ e.ratingEfficiency }} Q:{{ e.ratingQuality }} T:{{ e.ratingTimeliness }})
              </div>
            </div>
            <div class="entry-btns">
              <button class="icon-btn" @click="openEditEntry(e)" title="Edit">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2L4 10H2v-2l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="icon-btn danger" @click="confirmDeleteEntry(e)" title="Delete">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3h8M5 3V2h2v1M4 3v6.5c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-row">
            <template v-if="activeForm.status === 'DRAFT' || activeForm.status === 'RETURNED'">
              <button class="btn btn-primary" @click="submitForm">Submit Form</button>
            </template>
            <template v-if="activeForm.status === 'SUBMITTED'">
              <button class="btn btn-success" @click="approveForm">Approve</button>
              <button class="btn btn-danger"  @click="returnForm">Return</button>
            </template>
          </div>
        </div>

        <!-- ── Details Tab ── -->
        <div v-if="activeTab === 'details'" class="panel-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="dl">Type</span>
              <span class="dv">{{ activeForm.type }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Semester / Year</span>
              <span class="dv">Sem {{ activeForm.semester }}, {{ activeForm.year }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Position Level</span>
              <span class="dv">{{ activeForm.positionLevel || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Division</span>
              <span class="dv">{{ activeForm.divisionName || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Immediate Supervisor</span>
              <span class="dv">{{ activeForm.immediateSupervisor || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Supervisor Position</span>
              <span class="dv">{{ activeForm.supervisorPosition || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Approving Authority</span>
              <span class="dv">{{ activeForm.approvingAuthority || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Authority Position</span>
              <span class="dv">{{ activeForm.authorityPosition || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Core Weight</span>
              <span class="dv">{{ activeForm.coreFunctionWeight }}%</span>
            </div>
            <div class="detail-item">
              <span class="dl">Support Weight</span>
              <span class="dv">{{ activeForm.supportFunctionWeight }}%</span>
            </div>
            <div class="detail-item">
              <span class="dl">Submitted</span>
              <span class="dv">{{ fmtDate(activeForm.submittedAt) || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="dl">Approved</span>
              <span class="dv">{{ fmtDate(activeForm.approvedAt) || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- ── Score Tab ── -->
        <div v-if="activeTab === 'score'" class="panel-body">
          <div v-if="!activeForm.finalNumericalRating" class="score-empty">
            <p class="muted">Ratings not yet computed.</p>
            <button class="btn btn-primary mt-12" @click="computeScore">Compute Score</button>
          </div>
          <div v-else class="score-display">
            <div class="score-num">{{ activeForm.finalNumericalRating }}</div>
            <div class="score-adj">{{ activeForm.adjectivalRating }}</div>
            <div class="score-breakdown">
              <div v-for="e in allEntries" :key="e.id" class="score-row">
                <span class="sr-name">{{ e.kraName }}</span>
                <span class="sr-val">{{ e.ratingAverage || '—' }}</span>
              </div>
            </div>
            <button class="btn btn-sm mt-12" @click="computeScore">Recompute</button>
          </div>
        </div>

      </div>
    </transition>

    <!-- ══════════════════════════
         NEW FORM MODAL
    ═══════════════════════════ -->
    <div v-if="showNewFormModal" class="overlay" @click.self="showNewFormModal = false">
      <div class="modal">
        <div class="modal-hd">
          <div>
            <div class="modal-title">New Performance Form</div>
            <div class="modal-sub muted">Create an IPCRF or CCEF form</div>
          </div>
          <button class="close-btn" @click="showNewFormModal = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="fg">
            <div class="field">
              <label class="fl">Form Type</label>
              <select v-model="newForm.type" class="fi">
                <option>IPCRF</option>
                <option>CCEF</option>
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
            <div class="field">
              <label class="fl">Position Level</label>
              <select v-model="newForm.positionLevel" class="fi">
                <option value="II">Level II</option>
                <option value="III">Level III</option>
                <option value="IV">Level IV</option>
              </select>
            </div>
            <div class="field full">
              <label class="fl">Immediate Supervisor</label>
              <input v-model="newForm.immediateSupervisor" type="text" class="fi" placeholder="Full name" />
            </div>
            <div class="field full">
              <label class="fl">Supervisor Position / Title</label>
              <input v-model="newForm.supervisorPosition" type="text" class="fi" placeholder="e.g. Division Chief / SWO V" />
            </div>
            <div class="field full">
              <label class="fl">Approving Authority</label>
              <input v-model="newForm.approvingAuthority" type="text" class="fi" placeholder="e.g. Helen Y. Suzara" />
            </div>
            <div class="field full">
              <label class="fl">Authority Position / Title</label>
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

    <!-- ══════════════════════════
         KRA LIBRARY PICKER
    ═══════════════════════════ -->
    <div v-if="showLibrary" class="overlay" @click.self="showLibrary = false">
      <div class="modal modal-wide">
        <div class="modal-hd">
          <div>
            <div class="modal-title">KRA Library — {{ currentFnType }} Functions</div>
            <div class="modal-sub muted">Pick indicators from the master library</div>
          </div>
          <button class="close-btn" @click="showLibrary = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="lib-filters">
            <input v-model="libSearch" type="text" class="fi flex-1" placeholder="Search KRAs…" />
            <select v-model="libPhase" class="fi" style="width:150px">
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
          <div v-if="libLoading" class="state-wrap"><div class="spinner"></div></div>
          <div v-else-if="filteredLibrary.length === 0" class="muted p-16 text-center">No matching indicators.</div>
          <div v-else class="lib-list">
            <div v-for="item in filteredLibrary" :key="item.id" class="lib-item">
              <div class="lib-content">
                <div class="lib-kra">{{ item.kraName }}</div>
                <div class="lib-pi">{{ item.performanceIndicator || item.successIndicator }}</div>
                <div class="entry-chips mt-4">
                  <span class="chip">{{ item.phase }}</span>
                  <span class="chip">Wt: {{ posWeight(item) }}%</span>
                  <span :class="['chip', item.classification === 'Complex' || item.classification === 'Highly Technical' ? 'chip-blue' : '']">
                    {{ item.classification }}
                  </span>
                </div>
              </div>
              <button class="btn btn-xs btn-primary" @click="addFromLibrary(item)">Add</button>
            </div>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showLibrary = false">Done</button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════
         ENTRY MODAL (add/edit)
    ═══════════════════════════ -->
    <div v-if="showEntryModal" class="overlay" @click.self="closeEntryModal">
      <div class="modal">
        <div class="modal-hd">
          <div>
            <div class="modal-title">{{ editingEntry ? 'Edit Entry' : 'Custom Entry' }}</div>
            <div class="modal-sub muted">{{ editingEntry ? 'Update this indicator' : `Add custom ${currentFnType} indicator` }}</div>
          </div>
          <button class="close-btn" @click="closeEntryModal">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="fg">
            <div class="field full">
              <label class="fl">KRA Name <span style="color:#EF4444">*</span></label>
              <input v-model="entryForm.kraName" type="text" class="fi" placeholder="e.g. Research" />
            </div>
            <div class="field full">
              <label class="fl">Success Indicator <span style="color:#EF4444">*</span></label>
              <textarea v-model="entryForm.successIndicator" class="fi" rows="3" placeholder="Describe the target output…"></textarea>
            </div>
            <div class="field">
              <label class="fl">Function Type</label>
              <select v-model="entryForm.functionType" class="fi">
                <option>Core</option>
                <option>Support</option>
              </select>
            </div>
            <div class="field">
              <label class="fl">Weight (%)</label>
              <input v-model.number="entryForm.weight" type="number" class="fi" min="0" max="100" />
            </div>
            <div class="field">
              <label class="fl">Applicable Period</label>
              <select v-model="entryForm.applicableRatingPeriod" class="fi">
                <option>Both semesters</option>
                <option>1st Semester</option>
                <option>2nd Semester</option>
              </select>
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
              <label class="fl">Means of Verification</label>
              <input v-model="entryForm.meansOfVerification" type="text" class="fi" />
            </div>
            <!-- Rating fields only when editing -->
            <template v-if="editingEntry">
              <div class="field full"><div class="divider"></div></div>
              <div class="field full">
                <label class="fl">Accomplishment</label>
                <textarea v-model="entryForm.accomplishment" class="fi" rows="2"></textarea>
              </div>
              <div class="field">
                <label class="fl">Efficiency (1–5)</label>
                <input v-model.number="entryForm.ratingEfficiency" type="number" class="fi" min="1" max="5" step="0.01" />
              </div>
              <div class="field">
                <label class="fl">Quality (1–5)</label>
                <input v-model.number="entryForm.ratingQuality" type="number" class="fi" min="1" max="5" step="0.01" />
              </div>
              <div class="field">
                <label class="fl">Timeliness (1–5)</label>
                <input v-model.number="entryForm.ratingTimeliness" type="number" class="fi" min="1" max="5" step="0.01" />
              </div>
            </template>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="closeEntryModal">Cancel</button>
          <button class="btn btn-primary" :disabled="savingEntry" @click="saveEntry">
            {{ savingEntry ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Add Entry') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete Dialog ── -->
    <div v-if="confirmDelete.show" class="overlay" @click.self="confirmDelete.show = false">
      <div class="confirm-dialog">
        <div class="cd-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#EF4444" stroke-width="1.5"/>
            <path d="M12 7v5M12 16v1" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="cd-title">Delete Entry</div>
        <div class="cd-msg">Remove "{{ confirmDelete.entryName }}" from this form?<br>This cannot be undone.</div>
        <div class="cd-btns">
          <button class="btn" @click="confirmDelete.show = false">Cancel</button>
          <button class="btn btn-danger" :disabled="deletingEntry" @click="doDeleteEntry">
            {{ deletingEntry ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Toast ── -->
    <transition name="toast">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'

// ── State ──
const forms            = ref([])
const loading          = ref(false)
const creating         = ref(false)
const activeStatus     = ref('ALL')
const filterType       = ref('')
const filterSemester   = ref('')
const activeForm       = ref(null)
const activeTab        = ref('indicators')
const allEntries       = ref([])
const showNewFormModal = ref(false)
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

// ── Status tabs ──
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

const libPhases = computed(() => [...new Set(libraryItems.value.map(i => i.phase).filter(Boolean))])

const filteredLibrary = computed(() => {
  let items = libraryItems.value.filter(i =>
    (i.functionType === currentFnType.value || i.applicableTo === 'BOTH')
  )
  if (libSearch.value) {
    const q = libSearch.value.toLowerCase()
    items = items.filter(i =>
      i.kraName?.toLowerCase().includes(q) ||
      (i.performanceIndicator || i.successIndicator)?.toLowerCase().includes(q)
    )
  }
  if (libPhase.value) items = items.filter(i => i.phase === libPhase.value)
  if (libClass.value) items = items.filter(i => i.classification === libClass.value)
  return items
})

// ── Helpers ──
function countByStatus(status) {
  return forms.value.filter(f => f.status === status).length
}

function posWeight(item) {
  const lvl = activeForm.value?.positionLevel || 'III'
  return Number(item[`weight${lvl}`] || item.weight || 0)
}

function statusClass(s) {
  return {
    DRAFT:     'status-draft',
    SUBMITTED: 'status-submitted',
    RETURNED:  'status-returned',
    APPROVED:  'status-approved',
    RATED:     'status-rated',
    FINALIZED: 'status-finalized'
  }[s] || 'status-draft'
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

// ── Actions ──
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
  activeForm.value = form
  activeTab.value  = 'indicators'
  allEntries.value = []
  try {
    const res = await ipcrfApi.getEntries(form.id)
    allEntries.value = Array.isArray(res) ? res : []
  } catch (e) {
    showToast(e.message, 'error')
  }
  // Pre-load library silently
  if (libraryItems.value.length === 0) {
    libLoading.value = true
    try {
      const lib = await kraLibraryApi.list()
      libraryItems.value = Array.isArray(lib) ? lib : []
    } catch { /* silent */ } finally {
      libLoading.value = false
    }
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
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    creating.value = false
  }
}

function openLibrary(fnType) {
  currentFnType.value = fnType
  libSearch.value = ''
  libPhase.value  = ''
  libClass.value  = ''
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
  editingEntry.value = entry
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
  currentFnType.value  = entry.functionType
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
      const updated = await ipcrfApi.updateEntry(editingEntry.value.id, entryForm.value)
      const idx = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (idx !== -1) allEntries.value[idx] = { ...allEntries.value[idx], ...updated }
      showToast('Entry updated')
    } else {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        ...entryForm.value,
        functionType: currentFnType.value,
        isCustom: true
      })
      allEntries.value.push(entry)
      showToast('Entry added')
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
    showToast('Entry deleted')
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
    _updateActiveForm(updated)
    showToast('Form submitted')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

async function approveForm() {
  try {
    const updated = await ipcrfApi.approveForm(activeForm.value.id)
    _updateActiveForm(updated)
    showToast('Form approved')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

async function returnForm() {
  try {
    const updated = await ipcrfApi.returnForm(activeForm.value.id)
    _updateActiveForm(updated)
    showToast('Form returned')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

async function computeScore() {
  try {
    const updated = await ipcrfApi.computeScore(activeForm.value.id)
    _updateActiveForm(updated)
    showToast(`Score: ${updated.finalNumericalRating} — ${updated.adjectivalRating}`)
  } catch (e) {
    showToast(e.message, 'error')
  }
}

function _updateActiveForm(updated) {
  activeForm.value = { ...activeForm.value, ...updated }
  const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
  if (idx !== -1) forms.value[idx] = activeForm.value
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
* { box-sizing: border-box; }

.content {
  padding: 20px 24px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1A2332;
  position: relative;
  min-height: 100%;
}

/* ── Utilities ── */
.muted    { color: #94A3B8; }
.mt-4     { margin-top: 4px; }
.mt-12    { margin-top: 12px; }
.mt-16    { margin-top: 16px; }
.flex-1   { flex: 1; }
.p-16     { padding: 16px; }
.text-center { text-align: center; }

/* ── Page header ── */
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 20px;
}
.page-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 2px; }
.page-sub   { font-size: 12px; color: #94A3B8; margin: 0; }

/* ── Filter bar ── */
.filter-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
}
.filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.ftab {
  padding: 5px 13px; border-radius: 20px; font-size: 12px; cursor: pointer;
  border: 1px solid #E2E8F0; background: #fff; color: #718096;
  display: inline-flex; align-items: center; gap: 5px;
  transition: all .15s; font-family: 'DM Sans', sans-serif;
}
.ftab:hover { background: #F8FAFC; }
.ftab.active { background: #0F172A; color: #fff; border-color: #0F172A; }
.ftab-count {
  background: #3B82F6; color: #fff; border-radius: 10px;
  font-size: 10px; padding: 0 5px; min-width: 16px; text-align: center;
}
.filter-right { display: flex; gap: 8px; }
.filter-select {
  padding: 6px 10px; border: 1px solid #E2E8F0; border-radius: 7px;
  font-size: 12px; font-family: 'DM Sans', sans-serif; background: #fff;
  cursor: pointer; outline: none; color: #374151;
}

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 13px; border-radius: 7px; font-size: 12px;
  cursor: pointer; border: 1px solid #E2E8F0; background: #fff;
  color: #4A5568; transition: all .15s; font-family: 'DM Sans', sans-serif;
}
.btn:hover    { background: #F8FAFC; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary  { background: #2F80ED; color: #fff; border-color: #2F80ED; }
.btn-primary:hover { background: #1A6FD6; }
.btn-success  { background: #27AE60; color: #fff; border-color: #27AE60; }
.btn-success:hover { background: #1e9550; }
.btn-danger   { background: #EF4444; color: #fff; border-color: #EF4444; }
.btn-danger:hover  { background: #DC2626; }
.btn-sm  { padding: 5px 10px; font-size: 11px; }
.btn-xs  { padding: 3px 8px;  font-size: 10px; }
.btn-group { display: flex; gap: 4px; }

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer; color: #94A3B8;
}
.close-btn:hover { background: #F1F5F9; color: #64748B; }

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 5px;
  border: 1px solid #E2E8F0; background: #fff; cursor: pointer; color: #94A3B8;
}
.icon-btn:hover { background: #F8FAFC; color: #4A5568; }
.icon-btn.danger:hover { background: #FEF2F2; color: #EF4444; border-color: #FCA5A5; }

/* ── State / Empty ── */
.state-wrap {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; padding: 60px 0;
}
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 0; }
.empty-sub   { font-size: 12px; color: #94A3B8; margin: 0 0 8px; }

.spinner {
  width: 24px; height: 24px; border: 2.5px solid #E2E8F0;
  border-top-color: #2F80ED; border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Forms grid ── */
.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.form-card {
  background: #fff; border: 1px solid #E8EDF3; border-radius: 10px;
  padding: 14px; cursor: pointer; transition: all .15s;
}
.form-card:hover   { border-color: #2F80ED; box-shadow: 0 2px 12px rgba(47,128,237,.1); }
.form-card.selected { border-color: #2F80ED; background: #F0F7FF; }

.form-card-top  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.form-card-name { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
.form-card-meta { font-size: 11px; color: #94A3B8; }
.form-card-rating { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
.rating-score   { font-size: 20px; font-weight: 700; color: #27AE60; }
.rating-adj     { font-size: 11px; color: #718096; }

/* ── Badges ── */
.type-badge {
  padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;
}
.type-ipcrf { background: #EBF4FF; color: #2F80ED; }
.type-ccef  { background: #F3EEFF; color: #7C3AED; }

.status-badge { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
.status-draft     { background: #F1F5F9; color: #64748B; }
.status-submitted { background: #EBF4FF; color: #2F80ED; }
.status-returned  { background: #FEF9C3; color: #B45309; }
.status-approved  { background: #D1FAE5; color: #065F46; }
.status-rated     { background: #E0F2FE; color: #0369A1; }
.status-finalized { background: #EDE9FE; color: #5B21B6; }

/* ── Detail Panel ── */
.detail-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 480px;
  background: #fff; border-left: 1px solid #E8EDF3;
  box-shadow: -4px 0 24px rgba(0,0,0,.08);
  z-index: 100; display: flex; flex-direction: column; overflow: hidden;
}
.slide-enter-active, .slide-leave-active { transition: transform .25s ease; }
.slide-enter-from, .slide-leave-to       { transform: translateX(100%); }

.panel-hd {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.panel-badges { display: flex; gap: 6px; margin-bottom: 6px; }
.panel-name   { font-size: 15px; font-weight: 700; color: #0F172A; }
.panel-meta   { font-size: 11px; margin-top: 2px; }

.panel-tabs {
  display: flex; gap: 2px; padding: 10px 16px 0;
  border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.ptab {
  padding: 7px 14px; font-size: 12px; cursor: pointer;
  border: none; background: transparent; color: #718096;
  border-bottom: 2px solid transparent;
  font-family: 'DM Sans', sans-serif; transition: all .15s;
}
.ptab.active { color: #2F80ED; border-bottom-color: #2F80ED; font-weight: 600; }

.panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; }

/* ── Section rows ── */
.section-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.section-label {
  font-size: 11px; font-weight: 600; color: #4A5568;
  text-transform: uppercase; letter-spacing: .05em;
}
.no-entries { font-size: 12px; margin-bottom: 8px; }

/* ── Entry items ── */
.entry-item {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 8px; padding: 10px 0; border-bottom: 1px solid #F1F5F9;
}
.entry-item:last-of-type { border-bottom: none; }
.entry-content { flex: 1; min-width: 0; }
.entry-kra  { font-size: 12px; font-weight: 600; color: #0F172A; }
.entry-si   { font-size: 11px; color: #64748B; line-height: 1.5; margin-top: 2px; }
.entry-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.entry-rating { font-size: 11px; color: #27AE60; margin-top: 4px; }
.entry-btns { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }

/* ── Chips ── */
.chip { padding: 2px 7px; border-radius: 10px; font-size: 10px; background: #F1F5F9; color: #64748B; }
.chip-blue  { background: #EBF4FF; color: #2F80ED; }
.chip-amber { background: #FEF3C7; color: #92400E; }

/* ── Action row ── */
.action-row { display: flex; gap: 8px; padding-top: 16px; margin-top: 8px; border-top: 1px solid #F1F5F9; }

/* ── Detail grid ── */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.detail-item { display: flex; flex-direction: column; gap: 2px; }
.dl { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: .05em; }
.dv { font-size: 12px; color: #1A2332; }

/* ── Score ── */
.score-empty  { text-align: center; padding: 32px 0; }
.score-display { text-align: center; }
.score-num   { font-size: 52px; font-weight: 700; color: #27AE60; line-height: 1; }
.score-adj   { font-size: 14px; font-weight: 600; color: #4A5568; margin-top: 4px; }
.score-breakdown { text-align: left; border-top: 1px solid #F1F5F9; margin-top: 16px; padding-top: 12px; }
.score-row   { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #F8FAFC; font-size: 12px; }
.sr-name     { color: #4A5568; flex: 1; }
.sr-val      { font-weight: 600; }

/* ── Modals ── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 500px;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.modal-wide { max-width: 660px; }
.modal-hd {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 24px 14px; border-bottom: 1px solid #F1F5F9; flex-shrink: 0;
}
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; }
.modal-sub   { font-size: 11px; margin-top: 2px; }
.modal-body  { padding: 18px 24px; overflow-y: auto; flex: 1; }
.modal-ft {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 24px; border-top: 1px solid #F1F5F9;
  background: #F8FAFC; border-radius: 0 0 14px 14px; flex-shrink: 0;
}

/* ── Form fields ── */
.fg   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field      { display: flex; flex-direction: column; gap: 4px; }
.field.full { grid-column: span 2; }
.fl   { font-size: 11px; font-weight: 600; color: #374151; }
.fi   {
  padding: 7px 10px; border: 1.5px solid #E2E8F0; border-radius: 7px;
  font-size: 12px; font-family: 'DM Sans', sans-serif; color: #0F172A;
  outline: none; transition: border-color .15s; resize: vertical;
  background: #fff;
}
.fi:focus { border-color: #2F80ED; box-shadow: 0 0 0 3px rgba(47,128,237,.1); }
.divider { border: none; border-top: 1px solid #F1F5F9; width: 100%; }

/* ── Library ── */
.lib-filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.lib-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow-y: auto; }
.lib-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 12px; border: 1px solid #E8EDF3; border-radius: 8px;
  background: #FAFBFD;
}
.lib-content { flex: 1; min-width: 0; }
.lib-kra { font-size: 12px; font-weight: 600; color: #0F172A; }
.lib-pi  { font-size: 11px; color: #64748B; line-height: 1.5; margin-top: 2px; }

/* ── Confirm dialog ── */
.confirm-dialog {
  background: #fff; border-radius: 14px; padding: 28px 24px;
  max-width: 360px; width: 100%; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.cd-icon  { margin-bottom: 12px; }
.cd-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 6px; }
.cd-msg   { font-size: 12px; color: #64748B; line-height: 1.6; margin-bottom: 20px; }
.cd-btns  { display: flex; justify-content: center; gap: 8px; }

/* ── Toast ── */
.toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 300;
  padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 500;
  box-shadow: 0 4px 20px rgba(0,0,0,.12); pointer-events: none;
}
.toast-success { background: #F0FDF4; color: #166534; border: 1px solid #86EFAC; }
.toast-error   { background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; }
.toast-enter-active, .toast-leave-active { transition: opacity .3s, transform .3s; }
.toast-enter-from, .toast-leave-to       { opacity: 0; transform: translateY(8px); }
</style>