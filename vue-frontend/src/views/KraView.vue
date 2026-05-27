<template>
  <div class="content">

    <!-- ── Header ── -->
    <div class="page-header">
      <div>
        <h2 class="page-title">IPCRF / CCEF Forms</h2>
        <p class="page-sub">Individual Performance Commitment and Review Forms</p>
      </div>
      <button class="btn btn-primary" @click="openNewFormModal">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        New Form
      </button>
    </div>

    <!-- ── Filter tabs ── -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="t in statusTabs" :key="t.value"
          :class="['ftab', activeStatus === t.value && 'active']"
          @click="activeStatus = t.value">
          {{ t.label }}
          <span v-if="countByStatus(t.value)" class="ftab-count">{{ countByStatus(t.value) }}</span>
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
    <div v-if="loading" class="loading-wrap">
      <div class="spinner-lg"></div>
      <p>Loading forms...</p>
    </div>

    <!-- ── Empty state ── -->
    <div v-else-if="filteredForms.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#CBD5E1" stroke-width="2"/>
        <path d="M16 16h16M16 22h12M16 28h8" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">No forms yet</p>
      <p class="empty-sub">Create your first IPCRF or CCEF form to get started.</p>
      <button class="btn btn-primary" @click="openNewFormModal">Create New Form</button>
    </div>

    <!-- ── Forms grid ── -->
    <div v-else class="forms-grid">
      <div v-for="form in filteredForms" :key="form.id" class="form-card" @click="openForm(form)">
        <div class="form-card-top">
          <div class="form-type-badge" :class="form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef'">
            {{ form.type }}
          </div>
          <span :class="['status-pill', statusClass(form.status)]">{{ form.status }}</span>
        </div>
        <div class="form-card-body">
          <div class="form-period">
            {{ form.semester === '1' || form.semester === 1 ? '1st' : '2nd' }} Semester · {{ form.year }}
          </div>
          <div class="form-name">{{ form.employeeName || authStore.fullName }}</div>
          <div class="form-position">{{ form.position || authStore.profile?.position || '—' }}</div>
          <div class="form-division">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L1 4v7h4V8h2v3h4V4L6 1z" stroke="#94A3B8" stroke-width="1.2"/>
            </svg>
            {{ form.divisionName || '—' }}
          </div>
        </div>
        <div class="form-card-footer">
          <div class="form-score" v-if="form.finalNumericalRating">
            <span class="score-val">{{ parseFloat(form.finalNumericalRating).toFixed(2) }}</span>
            <span class="score-label">{{ form.adjectivalRating }}</span>
          </div>
          <div class="form-score" v-else>
            <span class="score-pending">Pending rating</span>
          </div>
          <div class="form-entries-count">
            {{ form.entriesCount || 0 }} indicators
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         NEW FORM MODAL
    ══════════════════════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showNewFormModal" class="modal-overlay" @click.self="showNewFormModal = false">
        <div class="modal modal-sm">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">Create New Form</h3>
              <p class="modal-sub">Set up your performance commitment form for this semester</p>
            </div>
            <button class="modal-close" @click="showNewFormModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="field full">
                <label class="field-label">Form Type <span class="req">*</span></label>
                <div class="radio-group">
                  <label class="radio-opt" :class="newForm.type === 'IPCRF' && 'selected'">
                    <input type="radio" v-model="newForm.type" value="IPCRF"/>
                    <div class="radio-content">
                      <div class="radio-title">IPCRF</div>
                      <div class="radio-sub">Regular / Co-term / Casual</div>
                    </div>
                  </label>
                  <label class="radio-opt" :class="newForm.type === 'CCEF' && 'selected'">
                    <input type="radio" v-model="newForm.type" value="CCEF"/>
                    <div class="radio-content">
                      <div class="radio-title">CCEF</div>
                      <div class="radio-sub">Contract of Service (CoS)</div>
                    </div>
                  </label>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="newForm.semester" class="field-select">
                  <option value="1">1st Semester (Jan–Jun)</option>
                  <option value="2">2nd Semester (Jul–Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year <span class="req">*</span></label>
                <select v-model="newForm.year" class="field-select">
                  <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Immediate Supervisor</label>
                <input v-model="newForm.immediateSupervisor" class="field-input" placeholder="e.g. Darlene R. Dancel"/>
              </div>
              <div class="field full">
                <label class="field-label">Supervisor's Position</label>
                <input v-model="newForm.supervisorPosition" class="field-input" placeholder="e.g. Division Chief / SWO V"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showNewFormModal = false">Cancel</button>
            <button class="btn btn-primary" @click="createForm" :disabled="creating">
              <span v-if="creating" class="spinner-sm"></span>
              {{ creating ? 'Creating…' : 'Create Form' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ══════════════════════════════════════════════════════════
         FORM DETAIL / EDITOR MODAL
    ══════════════════════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="activeForm" class="modal-overlay" @click.self="activeForm = null">
        <div class="modal modal-xl">
          <div class="modal-hd">
            <div class="form-hd-info">
              <span :class="['form-type-badge', activeForm.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">
                {{ activeForm.type }}
              </span>
              <div>
                <h3 class="modal-title">
                  {{ activeForm.semester === '1' || activeForm.semester === 1 ? '1st' : '2nd' }} Semester · {{ activeForm.year }}
                </h3>
                <p class="modal-sub">{{ activeForm.employeeName }} · {{ activeForm.divisionName }}</p>
              </div>
            </div>
            <div class="form-hd-actions">
              <span :class="['status-pill', statusClass(activeForm.status)]">{{ activeForm.status }}</span>
              <button class="modal-close" @click="activeForm = null">✕</button>
            </div>
          </div>

          <!-- Tabs inside modal -->
          <div class="modal-tabs">
            <button v-for="t in formTabs" :key="t" :class="['mtab', activeFormTab === t && 'active']"
              @click="activeFormTab = t">{{ t }}</button>
          </div>

          <div class="modal-body modal-body-scroll">

            <!-- ── Tab: Indicators ── -->
            <div v-if="activeFormTab === 'Indicators'">
              <div class="section-header">
                <div>
                  <h4 class="section-title">Core Functions (70%)</h4>
                  <p class="section-sub">Select or add your KRA targets</p>
                </div>
                <div class="flex-row gap-8" v-if="activeForm.status === 'DRAFT'">
                  <button class="btn btn-sm" @click="openKRALibrary('Core')">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M9 9l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    Pick from Library
                  </button>
                  <button class="btn btn-sm btn-primary" @click="openCustomEntry('Core')">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    </svg>
                    Add Custom
                  </button>
                </div>
              </div>

              <!-- Core entries -->
              <div v-if="coreEntries.length === 0" class="empty-entries">
                No core function indicators added yet. Pick from the library or add custom.
              </div>
              <div v-else class="entries-table-wrap">
                <table class="entries-tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>KRA / Success Indicator</th><th>Rating Period</th>
                      <th>Weight</th><th>MOV</th>
                      <th v-if="canRate">E</th>
                      <th v-if="canRate">Q</th>
                      <th v-if="canRate">T</th>
                      <th v-if="canRate">Avg</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, idx) in coreEntries" :key="entry.id">
                      <td class="td-num">{{ idx + 1 }}</td>
                      <td class="td-si">
                        <div class="si-kra">{{ entry.kraName }}</div>
                        <div class="si-text">{{ entry.successIndicator }}</div>
                        <span v-if="entry.isCustom" class="custom-tag">Custom</span>
                      </td>
                      <td class="td-period">
                        <span class="period-badge">{{ entry.applicableRatingPeriod }}</span>
                      </td>
                      <td class="td-weight">
                        <span class="weight-badge">{{ entry.weight }}%</span>
                      </td>
                      <td class="td-mov">
                        <div v-if="entry.meansOfVerification" class="mov-hint" :title="entry.meansOfVerification">
                          📎 {{ entry.meansOfVerification.substring(0, 30) }}...
                        </div>
                      </td>
                      <!-- Rating columns for DC -->
                      <template v-if="canRate">
                        <td class="td-rating">
                          <select v-model="entry.ratingEfficiency" class="rating-select"
                            @change="saveRating(entry)" :disabled="entry.efficiencyGuide === 'N/A' || !entry.efficiencyGuide">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-rating">
                          <select v-model="entry.ratingQuality" class="rating-select"
                            @change="saveRating(entry)" :disabled="entry.qualityGuide === 'N/A' || !entry.qualityGuide">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-rating">
                          <select v-model="entry.ratingTimeliness" class="rating-select"
                            @change="saveRating(entry)" :disabled="entry.timelinessGuide === 'N/A' || !entry.timelinessGuide">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-avg">
                          <span v-if="entry.ratingAverage" :class="['avg-val', ratingColorClass(entry.ratingAverage)]">
                            {{ parseFloat(entry.ratingAverage).toFixed(2) }}
                          </span>
                          <span v-else class="muted-dash">—</span>
                        </td>
                      </template>
                      <td class="td-actions">
                        <button class="icon-btn" @click="editEntry(entry)" title="Edit">✎</button>
                        <button v-if="activeForm.status === 'DRAFT'" class="icon-btn danger" @click="removeEntry(entry)" title="Remove">✕</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Support Functions section -->
              <div class="section-header mt-20">
                <div>
                  <h4 class="section-title">Support Functions (30%)</h4>
                  <p class="section-sub">Administrative and support tasks</p>
                </div>
                <div class="flex-row gap-8" v-if="activeForm.status === 'DRAFT'">
                  <button class="btn btn-sm" @click="openKRALibrary('Support')">Pick from Library</button>
                  <button class="btn btn-sm btn-primary" @click="openCustomEntry('Support')">Add Custom</button>
                </div>
              </div>

              <div v-if="supportEntries.length === 0" class="empty-entries">
                No support function indicators added yet.
              </div>
              <div v-else class="entries-table-wrap">
                <table class="entries-tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>KRA / Success Indicator</th><th>Rating Period</th>
                      <th>Weight</th><th>MOV</th>
                      <th v-if="canRate">E</th><th v-if="canRate">Q</th><th v-if="canRate">T</th><th v-if="canRate">Avg</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, idx) in supportEntries" :key="entry.id">
                      <td class="td-num">{{ idx + 1 }}</td>
                      <td class="td-si">
                        <div class="si-kra">{{ entry.kraName }}</div>
                        <div class="si-text">{{ entry.successIndicator }}</div>
                        <span v-if="entry.isCustom" class="custom-tag">Custom</span>
                      </td>
                      <td class="td-period"><span class="period-badge">{{ entry.applicableRatingPeriod }}</span></td>
                      <td class="td-weight"><span class="weight-badge">{{ entry.weight }}%</span></td>
                      <td class="td-mov"></td>
                      <template v-if="canRate">
                        <td class="td-rating">
                          <select v-model="entry.ratingEfficiency" class="rating-select" @change="saveRating(entry)">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-rating">
                          <select v-model="entry.ratingQuality" class="rating-select" @change="saveRating(entry)">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-rating">
                          <select v-model="entry.ratingTimeliness" class="rating-select" @change="saveRating(entry)">
                            <option value="">–</option>
                            <option v-for="s in [5,4,3,2,1]" :key="s" :value="s">{{ s }}</option>
                          </select>
                        </td>
                        <td class="td-avg">
                          <span v-if="entry.ratingAverage" :class="['avg-val', ratingColorClass(entry.ratingAverage)]">
                            {{ parseFloat(entry.ratingAverage).toFixed(2) }}
                          </span>
                          <span v-else class="muted-dash">—</span>
                        </td>
                      </template>
                      <td class="td-actions">
                        <button class="icon-btn" @click="editEntry(entry)">✎</button>
                        <button v-if="activeForm.status === 'DRAFT'" class="icon-btn danger" @click="removeEntry(entry)">✕</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Score summary -->
              <div v-if="activeForm.finalNumericalRating" class="score-summary">
                <div class="score-item">
                  <div class="score-num">{{ parseFloat(activeForm.finalNumericalRating).toFixed(5) }}</div>
                  <div class="score-lbl">Final Numerical Rating</div>
                </div>
                <div class="score-divider"></div>
                <div class="score-item">
                  <div class="score-num" :class="adjectivalColor(activeForm.adjectivalRating)">
                    {{ activeForm.adjectivalRating }}
                  </div>
                  <div class="score-lbl">Adjectival Rating</div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="entry-actions" v-if="activeForm.status === 'DRAFT'">
                <button class="btn btn-primary" @click="submitForm" :disabled="allEntries.length === 0">
                  Submit for Approval
                </button>
              </div>
              <div class="entry-actions" v-if="activeForm.status === 'APPROVED' && canRate">
                <button class="btn btn-primary" @click="computeScore">
                  Compute Final Score
                </button>
              </div>
              <div class="entry-actions" v-if="activeForm.status === 'SUBMITTED' && canApprove">
                <button class="btn btn-primary" @click="approveForm">Approve Targets</button>
                <button class="btn" @click="returnForm">Return for Revision</button>
              </div>
            </div>

            <!-- ── Tab: Accomplishments ── -->
            <div v-if="activeFormTab === 'Accomplishments'">
              <div class="section-header">
                <h4 class="section-title">Log Your Accomplishments</h4>
              </div>
              <div v-for="entry in allEntries" :key="'acc-'+entry.id" class="acc-row">
                <div class="acc-si">
                  <div class="si-kra">{{ entry.kraName }}</div>
                  <div class="si-text">{{ entry.successIndicator }}</div>
                </div>
                <div class="acc-field">
                  <label class="field-label">Actual Accomplishment</label>
                  <textarea v-model="entry.accomplishment" class="acc-textarea"
                    placeholder="Describe what was actually accomplished..." rows="3"
                    @blur="saveAccomplishment(entry)"></textarea>
                </div>
                <div class="acc-field">
                  <label class="field-label">MOV Reference Codes</label>
                  <input v-model="entry.movReferences" class="field-input"
                    placeholder="e.g. STB-CYD-MEM-25-06-106835-E (comma-separated)"
                    @blur="saveAccomplishment(entry)"/>
                </div>
              </div>
            </div>

            <!-- ── Tab: Part II Feedback ── -->
            <div v-if="activeFormTab === 'Part II Feedback'">
              <div class="feedback-grid">
                <div class="field full">
                  <label class="field-label">Strengths</label>
                  <textarea v-model="activeForm.feedbackStrengths" class="acc-textarea" rows="4"
                    placeholder="Describe the employee's key strengths..." :disabled="!canRate"
                    @blur="saveFormMeta"></textarea>
                </div>
                <div class="field full">
                  <label class="field-label">Areas for Improvement</label>
                  <textarea v-model="activeForm.feedbackAreasForImprovement" class="acc-textarea" rows="4"
                    placeholder="Identify areas needing development..." :disabled="!canRate"
                    @blur="saveFormMeta"></textarea>
                </div>
                <div class="field full">
                  <label class="field-label">Rater's Comments, Recommendations & Commendations</label>
                  <textarea v-model="activeForm.feedbackComments" class="acc-textarea" rows="4"
                    placeholder="Overall comments from the supervisor..." :disabled="!canRate"
                    @blur="saveFormMeta"></textarea>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </transition>

    <!-- ══════════════════════════════════════════════════════════
         KRA LIBRARY PICKER MODAL
    ══════════════════════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showKRALibrary" class="modal-overlay" @click.self="showKRALibrary = false">
        <div class="modal modal-xl">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">KRA Indicator Library</h3>
              <p class="modal-sub">Select indicators from the Enhanced STB Performance Evaluation Protocol</p>
            </div>
            <button class="modal-close" @click="showKRALibrary = false">✕</button>
          </div>
          <div class="modal-body">
            <!-- Library filters -->
            <div class="lib-filters">
              <div class="search-box">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
                  <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <input v-model="libSearch" placeholder="Search indicators..." type="text"/>
              </div>
              <select v-model="libPhase" class="filter-select">
                <option value="">All Phases</option>
                <option v-for="p in phases" :key="p" :value="p">{{ p }}</option>
              </select>
              <select v-model="libClassification" class="filter-select">
                <option value="">All Classifications</option>
                <option>Simple</option>
                <option>Complex</option>
                <option>Highly Technical</option>
                <option>Exempted</option>
              </select>
            </div>

            <!-- Position level weight note -->
            <div class="weight-note">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="#3B82F6" stroke-width="1.2"/>
                <path d="M6.5 6v3M6.5 4v.1" stroke="#3B82F6" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              Weights shown for position level <strong>{{ positionLevel }}</strong>
              ({{ activeForm?.position || authStore.profile?.position || 'your position' }})
            </div>

            <!-- Library items grouped by phase -->
            <div v-if="libLoading" class="loading-wrap">
              <div class="spinner-lg"></div>
            </div>
            <div v-else>
              <div v-for="phase in filteredPhases" :key="phase" class="lib-phase-group">
                <div class="lib-phase-header">{{ phase }}</div>
                <div v-for="item in filteredLibraryItems(phase)" :key="item.id" class="lib-item"
                  :class="isSelected(item.id) && 'lib-item-selected'">
                  <div class="lib-item-info">
                    <div class="lib-item-kra">{{ item.kraName }}</div>
                    <div class="lib-item-indicator">{{ item.performanceIndicator }}</div>
                    <div class="lib-item-meta">
                      <span class="classification-badge" :class="classificationClass(item.classification)">
                        {{ item.classification }}
                      </span>
                      <span class="weight-chip">Weight: {{ getWeight(item) }}%</span>
                      <span class="mov-chip">MOV: {{ item.meansOfVerification?.substring(0, 60) }}...</span>
                    </div>
                  </div>
                  <button v-if="!isSelected(item.id)" class="btn btn-sm btn-primary"
                    @click="addFromLibrary(item)">
                    + Add
                  </button>
                  <span v-else class="already-added">✓ Added</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="showKRALibrary = false">Done</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ══════════════════════════════════════════════════════════
         CUSTOM ENTRY MODAL
    ══════════════════════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showCustomEntry" class="modal-overlay" @click.self="showCustomEntry = false">
        <div class="modal modal-md">
          <div class="modal-hd">
            <h3 class="modal-title">{{ editingEntry ? 'Edit Indicator' : 'Add Custom Indicator' }}</h3>
            <button class="modal-close" @click="showCustomEntry = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="customEntry.kraName" class="field-input" placeholder="e.g. Pilot Testing"/>
              </div>
              <div class="field full">
                <label class="field-label">Success Indicator <span class="req">*</span></label>
                <textarea v-model="customEntry.successIndicator" class="acc-textarea" rows="3"
                  placeholder="Describe the specific measurable target..."></textarea>
              </div>
              <div class="field">
                <label class="field-label">Function Type</label>
                <select v-model="customEntry.functionType" class="field-select">
                  <option value="Core">Core Function</option>
                  <option value="Support">Support Function</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Applicable Rating Period</label>
                <select v-model="customEntry.applicableRatingPeriod" class="field-select">
                  <option>1st Semester</option>
                  <option>2nd Semester</option>
                  <option>Both semesters</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Weight (%)</label>
                <input v-model.number="customEntry.weight" type="number" min="1" max="100" class="field-input" placeholder="e.g. 15"/>
              </div>
              <div class="field">
                <label class="field-label">Classification</label>
                <select v-model="customEntry.classification" class="field-select">
                  <option>Simple</option>
                  <option>Complex</option>
                  <option>Highly Technical</option>
                  <option>Exempted</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Means of Verification (MOV)</label>
                <input v-model="customEntry.meansOfVerification" class="field-input" placeholder="e.g. Memo endorsed to DC"/>
              </div>
              <div class="field full">
                <label class="field-label">Accomplishment</label>
                <textarea v-model="customEntry.accomplishment" class="acc-textarea" rows="2"
                  placeholder="Actual accomplishment (fill at end of semester)..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCustomEntry = false">Cancel</button>
            <button class="btn btn-primary" @click="saveCustomEntry" :disabled="savingEntry">
              <span v-if="savingEntry" class="spinner-sm"></span>
              {{ savingEntry ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Indicator' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ipcrf as ipcrfApi, kraLibrary } from '@/services/api'

const authStore = useAuthStore()

// ── State ──
const forms          = ref([])
const loading        = ref(false)
const creating       = ref(false)
const activeStatus   = ref('ALL')
const filterType     = ref('')
const filterSemester = ref('')
const showNewFormModal = ref(false)
const activeForm     = ref(null)
const activeFormTab  = ref('Indicators')
const allEntries     = ref([])
const showKRALibrary = ref(false)
const showCustomEntry = ref(false)
const editingEntry   = ref(null)
const savingEntry    = ref(false)
const libraryItems   = ref([])
const libLoading     = ref(false)
const libSearch      = ref('')
const libPhase       = ref('')
const libClassification = ref('')
const currentFunctionType = ref('Core')
const toast          = ref({ show: false, msg: '', type: 'success' })

const newForm = ref({
  type: 'IPCRF', semester: '1',
  year: new Date().getFullYear(),
  immediateSupervisor: '', supervisorPosition: ''
})

const defaultCustomEntry = () => ({
  kraName: '', successIndicator: '', functionType: 'Core',
  applicableRatingPeriod: 'Both semesters', weight: '',
  classification: 'Complex', meansOfVerification: '',
  accomplishment: '', movReferences: '', remarks: ''
})
const customEntry = ref(defaultCustomEntry())

// ── Computed ──
const yearOptions = computed(() => {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1]
})

const canRate    = computed(() => ['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(authStore.role))
const canApprove = computed(() => ['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(authStore.role))

const positionLevel = computed(() => {
  const pos = authStore.profile?.position || ''
  if (/\biv\b/i.test(pos)) return 'IV'
  if (/\bii\b/i.test(pos)) return 'II'
  return 'III'
})

const statusTabs = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rated', value: 'RATED' },
  { label: 'Finalized', value: 'FINALIZED' }
]

const formTabs = computed(() => {
  const tabs = ['Indicators', 'Accomplishments', 'Part II Feedback']
  return tabs
})

const filteredForms = computed(() => {
  let f = forms.value
  if (activeStatus.value !== 'ALL') f = f.filter(x => x.status === activeStatus.value)
  if (filterType.value)     f = f.filter(x => x.type === filterType.value)
  if (filterSemester.value) f = f.filter(x => String(x.semester) === filterSemester.value)
  return f
})

const coreEntries    = computed(() => allEntries.value.filter(e => e.functionType === 'Core' || e.functionType === 'Strategic'))
const supportEntries = computed(() => allEntries.value.filter(e => e.functionType === 'Support'))

const phases = computed(() => [...new Set(libraryItems.value.map(i => i.phase))].sort())

const filteredPhases = computed(() => {
  const items = filteredLibraryItemsAll()
  return [...new Set(items.map(i => i.phase))].sort()
})

// ── Methods ──
function countByStatus(status) {
  if (status === 'ALL') return 0
  return forms.value.filter(f => f.status === status).length
}

async function loadForms() {
  loading.value = true
  try {
    const result = await ipcrfApi.list()
    forms.value = (result.items ?? result ?? [])
  } catch (e) {
    showToast('Could not load forms: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function createForm() {
  creating.value = true
  try {
    const form = await ipcrfApi.create({
      type:                newForm.value.type,
      semester:            newForm.value.semester,
      year:                newForm.value.year,
      immediateSupervisor: newForm.value.immediateSupervisor,
      supervisorPosition:  newForm.value.supervisorPosition
    })
    forms.value.unshift(form)
    showNewFormModal.value = false
    showToast('Form created successfully!')
    // Open the new form immediately
    openForm(form)
  } catch (e) {
    showToast('Failed to create form: ' + e.message, 'error')
  } finally {
    creating.value = false
  }
}

async function openForm(form) {
  activeForm.value = { ...form }
  activeFormTab.value = 'Indicators'
  // Load entries
  try {
    const entries = await ipcrfApi.getEntries(form.id)
    allEntries.value = entries || []
  } catch (e) {
    allEntries.value = []
  }
}

async function openKRALibrary(funcType) {
  currentFunctionType.value = funcType
  showKRALibrary.value = true
  if (libraryItems.value.length === 0) {
    libLoading.value = true
    try {
      const items = await kraLibrary.list()
      libraryItems.value = items || []
    } catch (e) {
      showToast('Could not load KRA library: ' + e.message, 'error')
    } finally {
      libLoading.value = false
    }
  }
}

function filteredLibraryItemsAll() {
  let items = libraryItems.value
  if (libSearch.value) {
    const q = libSearch.value.toLowerCase()
    items = items.filter(i => i.kraName?.toLowerCase().includes(q) || i.performanceIndicator?.toLowerCase().includes(q))
  }
  if (libPhase.value)          items = items.filter(i => i.phase === libPhase.value)
  if (libClassification.value) items = items.filter(i => i.classification === libClassification.value)
  // Filter by function type
  items = items.filter(i =>
    currentFunctionType.value === 'Support'
      ? i.functionType === 'Support'
      : i.functionType !== 'Support'
  )
  return items
}

function filteredLibraryItems(phase) {
  return filteredLibraryItemsAll().filter(i => i.phase === phase)
}

function isSelected(masterKRAId) {
  return allEntries.value.some(e => e.masterKRAId === masterKRAId)
}

function getWeight(item) {
  if (positionLevel.value === 'II')  return item.weightII  || item.weightIII || '—'
  if (positionLevel.value === 'IV')  return item.weightIV  || item.weightIII || '—'
  return item.weightIII || '—'
}

async function addFromLibrary(item) {
  try {
    const weight = getWeight(item)
    const entry = await ipcrfApi.addEntry(activeForm.value.id, {
      masterKRAId:          item.id,
      functionType:         currentFunctionType.value,
      kraName:              item.kraName,
      successIndicator:     item.performanceIndicator,
      applicableRatingPeriod: 'Both semesters',
      weight,
      classification:       item.classification,
      efficiencyGuide:      item.efficiencyGuide,
      qualityGuide:         item.qualityGuide,
      timelinessGuide:      item.timelinessGuide,
      meansOfVerification:  item.meansOfVerification,
      isCustom:             false
    })
    allEntries.value.push(entry)
    showToast('Indicator added!')
  } catch (e) {
    showToast('Failed to add: ' + e.message, 'error')
  }
}

function openCustomEntry(funcType) {
  currentFunctionType.value = funcType
  editingEntry.value = null
  customEntry.value = { ...defaultCustomEntry(), functionType: funcType }
  showCustomEntry.value = true
}

function editEntry(entry) {
  editingEntry.value = entry
  customEntry.value = {
    kraName:              entry.kraName,
    successIndicator:     entry.successIndicator,
    functionType:         entry.functionType,
    applicableRatingPeriod: entry.applicableRatingPeriod,
    weight:               entry.weight,
    classification:       entry.classification,
    meansOfVerification:  entry.meansOfVerification,
    accomplishment:       entry.accomplishment,
    movReferences:        entry.movReferences,
    remarks:              entry.remarks
  }
  showCustomEntry.value = true
}

async function saveCustomEntry() {
  if (!customEntry.value.kraName || !customEntry.value.successIndicator) {
    showToast('KRA Name and Success Indicator are required', 'error')
    return
  }
  savingEntry.value = true
  try {
    if (editingEntry.value) {
      const updated = await ipcrfApi.updateEntry(editingEntry.value.id, customEntry.value)
      const idx = allEntries.value.findIndex(e => e.id === editingEntry.value.id)
      if (idx !== -1) allEntries.value[idx] = { ...allEntries.value[idx], ...updated }
      showToast('Indicator updated!')
    } else {
      const entry = await ipcrfApi.addEntry(activeForm.value.id, {
        ...customEntry.value, isCustom: true
      })
      allEntries.value.push(entry)
      showToast('Custom indicator added!')
    }
    showCustomEntry.value = false
  } catch (e) {
    showToast('Failed: ' + e.message, 'error')
  } finally {
    savingEntry.value = false
  }
}

async function removeEntry(entry) {
  if (!confirm('Remove this indicator?')) return
  try {
    await ipcrfApi.deleteEntry(entry.id)
    allEntries.value = allEntries.value.filter(e => e.id !== entry.id)
    showToast('Indicator removed.')
  } catch (e) {
    showToast('Failed: ' + e.message, 'error')
  }
}

async function saveAccomplishment(entry) {
  try {
    await ipcrfApi.updateEntry(entry.id, {
      accomplishment: entry.accomplishment,
      movReferences:  entry.movReferences
    })
  } catch (e) {}
}

async function saveRating(entry) {
  try {
    await ipcrfApi.rateEntry(entry.id, {
      ratingEfficiency: entry.ratingEfficiency,
      ratingQuality:    entry.ratingQuality,
      ratingTimeliness: entry.ratingTimeliness,
      accomplishment:   entry.accomplishment,
      movReferences:    entry.movReferences
    })
    // Recompute avg locally
    const vals = [entry.ratingEfficiency, entry.ratingQuality, entry.ratingTimeliness]
      .map(Number).filter(v => !isNaN(v) && v > 0)
    entry.ratingAverage = vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(5) : ''
  } catch (e) {
    showToast('Could not save rating: ' + e.message, 'error')
  }
}

async function submitForm() {
  try {
    const updated = await ipcrfApi.submit(activeForm.value.id)
    activeForm.value.status = 'SUBMITTED'
    const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
    if (idx !== -1) forms.value[idx].status = 'SUBMITTED'
    showToast('Form submitted for approval!')
  } catch (e) {
    showToast('Submit failed: ' + e.message, 'error')
  }
}

async function approveForm() {
  try {
    await ipcrfApi.approve(activeForm.value.id)
    activeForm.value.status = 'APPROVED'
    const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
    if (idx !== -1) forms.value[idx].status = 'APPROVED'
    showToast('Form approved! Staff can now log accomplishments.')
  } catch (e) {
    showToast('Approve failed: ' + e.message, 'error')
  }
}

async function returnForm() {
  try {
    await ipcrfApi.update(activeForm.value.id, { status: 'DRAFT' })
    activeForm.value.status = 'DRAFT'
    const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
    if (idx !== -1) forms.value[idx].status = 'DRAFT'
    showToast('Form returned for revision.')
  } catch (e) {
    showToast('Failed: ' + e.message, 'error')
  }
}

async function computeScore() {
  try {
    const result = await ipcrfApi.computeScore(activeForm.value.id)
    activeForm.value.finalNumericalRating = result.spmsScore
    activeForm.value.adjectivalRating     = result.adjectivalRating
    activeForm.value.status = 'RATED'
    const idx = forms.value.findIndex(f => f.id === activeForm.value.id)
    if (idx !== -1) {
      forms.value[idx].finalNumericalRating = result.spmsScore
      forms.value[idx].adjectivalRating     = result.adjectivalRating
      forms.value[idx].status = 'RATED'
    }
    showToast(`Score computed: ${parseFloat(result.spmsScore).toFixed(2)} — ${result.adjectivalRating}`)
  } catch (e) {
    showToast('Compute failed: ' + e.message, 'error')
  }
}

async function saveFormMeta() {
  try {
    await ipcrfApi.update(activeForm.value.id, {
      feedbackStrengths:           activeForm.value.feedbackStrengths,
      feedbackAreasForImprovement: activeForm.value.feedbackAreasForImprovement,
      feedbackComments:            activeForm.value.feedbackComments
    })
  } catch (e) {}
}

function openNewFormModal() {
  newForm.value = { type: 'IPCRF', semester: String(getCurrentSemester()), year: new Date().getFullYear(), immediateSupervisor: '', supervisorPosition: '' }
  showNewFormModal.value = true
}

function getCurrentSemester() {
  return new Date().getMonth() < 6 ? 1 : 2
}

// ── Helpers ──
function statusClass(status) {
  const map = {
    DRAFT: 's-gray', SUBMITTED: 's-blue', APPROVED: 's-green',
    FOR_RATING: 's-amber', RATED: 's-purple', FINALIZED: 's-green'
  }
  return map[status] || 's-gray'
}

function ratingColorClass(avg) {
  const v = parseFloat(avg)
  if (v >= 4.5) return 'rating-outstanding'
  if (v >= 3.5) return 'rating-vs'
  if (v >= 2.5) return 'rating-sat'
  return 'rating-low'
}

function adjectivalColor(label) {
  if (label === 'Outstanding') return 'rating-outstanding'
  if (label === 'Very Satisfactory') return 'rating-vs'
  if (label === 'Satisfactory') return 'rating-sat'
  return 'rating-low'
}

function classificationClass(c) {
  const map = { 'Simple': 'cl-simple', 'Complex': 'cl-complex', 'Highly Technical': 'cl-ht', 'Exempted': 'cl-ex' }
  return map[c] || 'cl-simple'
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}

onMounted(loadForms)
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 24px;font-family:'Inter',sans-serif;font-size:13px;color:#0F172A;min-height:100%;}

/* Header */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.page-title{font-size:18px;font-weight:700;color:#0F172A;margin-bottom:2px;}
.page-sub{font-size:12px;color:#94A3B8;}

/* Filter bar */
.filter-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;}
.filter-tabs{display:flex;gap:4px;flex-wrap:wrap;}
.filter-right{display:flex;gap:8px;}
.ftab{padding:5px 12px;border-radius:6px;border:1px solid #E2E8F0;background:#fff;font-size:12px;color:#64748B;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px;font-family:'Inter',sans-serif;}
.ftab:hover{border-color:#3B82F6;color:#3B82F6;}
.ftab.active{background:#0F172A;color:#fff;border-color:#0F172A;font-weight:500;}
.ftab-count{background:#EF4444;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:10px;}
.filter-select{padding:5px 9px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-family:'Inter',sans-serif;color:#0F172A;background:#fff;outline:none;cursor:pointer;}

/* Loading & empty */
.loading-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px;color:#94A3B8;}
.spinner-lg{width:28px;height:28px;border:2.5px solid #E2E8F0;border-top-color:#3B82F6;border-radius:50%;animation:spin .6s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:10px;padding:60px 24px;color:#94A3B8;text-align:center;}
.empty-title{font-size:15px;font-weight:600;color:#374151;}
.empty-sub{font-size:13px;color:#94A3B8;margin-bottom:4px;}

/* Forms grid */
.forms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.form-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:10px;}
.form-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);border-color:#BFDBFE;transform:translateY(-2px);}
.form-card-top{display:flex;align-items:center;justify-content:space-between;}
.form-type-badge{padding:3px 9px;border-radius:5px;font-size:11px;font-weight:700;letter-spacing:.5px;}
.type-ipcrf{background:#EFF6FF;color:#1D4ED8;}
.type-ccef{background:#F0FDF4;color:#15803D;}
.form-period{font-size:11px;color:#94A3B8;margin-bottom:3px;}
.form-name{font-size:14px;font-weight:600;color:#0F172A;}
.form-position{font-size:11px;color:#64748B;margin-bottom:2px;}
.form-division{display:flex;align-items:center;gap:4px;font-size:11px;color:#94A3B8;}
.form-card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid #F1F5F9;}
.score-val{font-size:18px;font-weight:700;color:#0F172A;}
.score-label{font-size:10px;color:#22C55E;font-weight:600;}
.score-pending{font-size:11px;color:#94A3B8;}
.form-entries-count{font-size:10px;color:#94A3B8;}

/* Status pills */
.status-pill{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;}
.s-gray  {background:#F1F5F9;color:#64748B;}
.s-blue  {background:#EFF6FF;color:#1D4ED8;}
.s-green {background:#F0FDF4;color:#15803D;}
.s-amber {background:#FFFBEB;color:#B45309;}
.s-purple{background:#F5F3FF;color:#7C3AED;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:7px;border:1px solid #E2E8F0;background:#fff;color:#374151;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;}
.btn:hover{border-color:#3B82F6;color:#3B82F6;background:#F8FAFC;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-primary{background:#2563EB;color:#fff;border-color:#2563EB;}
.btn-primary:hover:not(:disabled){background:#1D4ED8;border-color:#1D4ED8;color:#fff;}
.btn-sm{padding:4px 9px;font-size:11px;}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(3px);}
.modal{background:#fff;border-radius:14px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.18);overflow:hidden;display:flex;flex-direction:column;max-height:90vh;}
.modal-sm{max-width:480px;}
.modal-md{max-width:600px;}
.modal-xl{max-width:900px;}
.modal-hd{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;flex-shrink:0;}
.form-hd-info{display:flex;align-items:center;gap:10px;}
.form-hd-actions{display:flex;align-items:center;gap:10px;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:2px;}
.modal-sub{font-size:12px;color:#94A3B8;}
.modal-close{background:none;border:none;cursor:pointer;font-size:16px;color:#94A3B8;padding:4px 8px;border-radius:5px;}
.modal-close:hover{color:#374151;background:#F1F5F9;}
.modal-tabs{display:flex;border-bottom:1px solid #F1F5F9;padding:0 24px;flex-shrink:0;}
.mtab{padding:10px 14px;border-bottom:2px solid transparent;font-size:12px;color:#94A3B8;cursor:pointer;background:none;border-left:none;border-right:none;border-top:none;font-family:'Inter',sans-serif;transition:all .15s;}
.mtab:hover{color:#374151;}
.mtab.active{color:#2563EB;border-bottom-color:#2563EB;font-weight:500;}
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}
.modal-body-scroll{overflow-y:auto;max-height:calc(90vh - 180px);}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;flex-shrink:0;}

/* Form fields */
.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.field{display:flex;flex-direction:column;gap:5px;}
.field.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.3px;}
.req{color:#EF4444;}
.field-input{padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;color:#0F172A;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.field-select{padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;color:#0F172A;background:#fff;outline:none;cursor:pointer;}
.field-select:focus{border-color:#3B82F6;}
.acc-textarea{padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;font-family:'Inter',sans-serif;color:#0F172A;outline:none;resize:vertical;width:100%;transition:border-color .15s;}
.acc-textarea:focus{border-color:#3B82F6;}
.acc-textarea:disabled{background:#F8FAFC;color:#94A3B8;}

/* Radio group */
.radio-group{display:flex;gap:10px;}
.radio-opt{display:flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:9px;cursor:pointer;flex:1;transition:all .15s;}
.radio-opt:hover{border-color:#3B82F6;}
.radio-opt.selected{border-color:#2563EB;background:#EFF6FF;}
.radio-opt input{accent-color:#2563EB;}
.radio-title{font-size:13px;font-weight:600;color:#0F172A;}
.radio-sub{font-size:10px;color:#94A3B8;margin-top:1px;}

/* Section headers */
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.section-title{font-size:13px;font-weight:700;color:#0F172A;}
.section-sub{font-size:11px;color:#94A3B8;margin-top:2px;}
.mt-20{margin-top:24px;}
.flex-row{display:flex;align-items:center;}
.gap-8{gap:8px;}

/* Entries table */
.entries-table-wrap{overflow-x:auto;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:8px;}
.entries-tbl{width:100%;border-collapse:collapse;font-size:11px;}
.entries-tbl th{padding:7px 10px;text-align:left;color:#718096;font-weight:500;border-bottom:1px solid #E2E8F0;font-size:10px;text-transform:uppercase;letter-spacing:.3px;background:#F8FAFC;white-space:nowrap;}
.entries-tbl td{padding:8px 10px;border-bottom:1px solid #F1F5F9;vertical-align:top;}
.entries-tbl tr:last-child td{border-bottom:none;}
.entries-tbl tr:hover td{background:#FAFAFA;}
.td-num{width:30px;color:#94A3B8;font-weight:600;}
.td-si{max-width:300px;}
.si-kra{font-size:11px;font-weight:600;color:#1E40AF;margin-bottom:2px;}
.si-text{font-size:11px;color:#374151;line-height:1.4;}
.td-period{white-space:nowrap;}
.td-weight,.td-rating,.td-avg{text-align:center;}
.td-actions{white-space:nowrap;}
.period-badge{padding:2px 6px;background:#EFF6FF;color:#1D4ED8;border-radius:4px;font-size:9px;font-weight:600;}
.weight-badge{padding:2px 7px;background:#F0FDF4;color:#15803D;border-radius:4px;font-size:9px;font-weight:600;}
.custom-tag{display:inline-block;padding:1px 5px;background:#FEF9C3;color:#854D0E;border-radius:3px;font-size:9px;font-weight:600;margin-top:3px;}
.mov-hint{font-size:9px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;}
.rating-select{padding:3px 4px;border:1px solid #E2E8F0;border-radius:4px;font-size:11px;font-family:'Inter',sans-serif;width:44px;}
.avg-val{font-weight:700;font-size:12px;}
.rating-outstanding{color:#15803D;}
.rating-vs{color:#2563EB;}
.rating-sat{color:#B45309;}
.rating-low{color:#DC2626;}
.muted-dash{color:#CBD5E1;}
.icon-btn{background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:4px;font-size:12px;color:#64748B;transition:all .15s;}
.icon-btn:hover{background:#F1F5F9;}
.icon-btn.danger:hover{background:#FEF2F2;color:#DC2626;}
.empty-entries{padding:16px;text-align:center;color:#94A3B8;font-size:12px;background:#F8FAFC;border-radius:8px;border:1px dashed #E2E8F0;margin-bottom:8px;}

/* Score summary */
.score-summary{display:flex;align-items:center;gap:24px;padding:16px 20px;background:linear-gradient(135deg,#EFF6FF,#F0FDF4);border:1px solid #BFDBFE;border-radius:10px;margin-top:16px;}
.score-item{text-align:center;}
.score-num{font-size:22px;font-weight:700;color:#0F172A;}
.score-lbl{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;}
.score-divider{width:1px;height:40px;background:#CBD5E1;}

/* Actions */
.entry-actions{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #F1F5F9;}

/* Accomplishments */
.acc-row{border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:10px;background:#fff;}
.acc-si{margin-bottom:10px;}
.acc-field{margin-bottom:10px;}
.feedback-grid{display:flex;flex-direction:column;gap:14px;}

/* KRA Library */
.lib-filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
.search-box{display:flex;align-items:center;gap:6px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:7px;padding:6px 10px;flex:1;min-width:200px;}
.search-box input{border:none;background:transparent;font-size:12px;color:#0F172A;outline:none;width:100%;font-family:'Inter',sans-serif;}
.weight-note{display:flex;align-items:center;gap:7px;padding:8px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:7px;font-size:12px;color:#1D4ED8;margin-bottom:14px;}
.lib-phase-group{margin-bottom:20px;}
.lib-phase-header{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#64748B;padding:6px 0;border-bottom:1px solid #E2E8F0;margin-bottom:8px;}
.lib-item{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid #F1F5F9;border-radius:8px;margin-bottom:6px;transition:all .15s;}
.lib-item:hover{border-color:#BFDBFE;background:#F8FBFF;}
.lib-item-selected{border-color:#22C55E;background:#F0FDF4;}
.lib-item-info{flex:1;}
.lib-item-kra{font-size:12px;font-weight:600;color:#1E40AF;margin-bottom:2px;}
.lib-item-indicator{font-size:11px;color:#374151;line-height:1.5;margin-bottom:6px;}
.lib-item-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.classification-badge{padding:2px 7px;border-radius:4px;font-size:9px;font-weight:600;}
.cl-simple{background:#F0FDF4;color:#15803D;}
.cl-complex{background:#EFF6FF;color:#1D4ED8;}
.cl-ht{background:#FEF9C3;color:#854D0E;}
.cl-ex{background:#F5F3FF;color:#7C3AED;}
.weight-chip{padding:2px 6px;background:#F1F5F9;color:#374151;border-radius:4px;font-size:9px;font-weight:600;}
.mov-chip{font-size:9px;color:#94A3B8;}
.already-added{color:#22C55E;font-size:12px;font-weight:600;}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:8px;padding:12px 16px;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.12);border:1px solid #E2E8F0;font-size:13px;color:#0F172A;z-index:300;max-width:360px;}
.toast-success{border-left:3px solid #22C55E;}
.toast-error  {border-left:3px solid #EF4444;}

/* Transitions */
.modal-fade-enter-active,.modal-fade-leave-active{transition:all .2s ease;}
.modal-fade-enter-from,.modal-fade-leave-to{opacity:0;transform:scale(.97) translateY(8px);}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s ease;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(12px);}
.spinner-sm{width:13px;height:13px;border:1.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;}
</style>