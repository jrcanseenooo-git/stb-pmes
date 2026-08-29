<template>
  <div class="review-page">

    <!-- Top toolbar -->
    <div class="rq-toolbar">
      <div class="rq-toolbar-title">
        <h1>{{ isOwnerView ? 'My Form Status' : 'Review Queue' }}</h1>
        <p>{{ isOwnerView ? 'Track the review progress of your submitted form' : 'Forms routed to you for checking and sign-off' }}</p>
      </div>
      <div class="rq-toolbar-controls">
        <div class="rq-mode-switch">
          <button type="button" :class="['rq-mode-btn', viewMode === 'queue' && 'active']" @click="setMode('queue')">Review Queue</button>
          <button type="button" :class="['rq-mode-btn', viewMode === 'myforms' && 'active']" @click="setMode('myforms')">My Form</button>
        </div>
        <template v-if="!isOwnerView">
          <div class="rq-segmented" role="tablist" aria-label="Review type">
            <button type="button" :class="['rq-seg-btn', reviewTypeFilter === 'targets' && 'active']" @click="setReviewType('targets')">Targets</button>
            <button type="button" :class="['rq-seg-btn', reviewTypeFilter === 'ratings' && 'active']" @click="setReviewType('ratings')">Ratings</button>
          </div>
          <select v-model="semesterFilter" class="rq-select">
            <option value="">All Semesters</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
          </select>
        </template>
        <button class="rq-btn rq-btn-ghost" @click="isOwnerView ? loadMyForms() : loadQueue()" :disabled="displayLoading">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" :class="displayLoading && 'rq-spin'">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ displayLoading ? 'Loading' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div class="rq-body">

      <!-- ============ LEFT: queue list ============ -->
      <aside class="rq-list">
        <div v-if="displayLoading" class="rq-empty-state">
          <div class="rq-spinner"></div>
          <p>{{ isOwnerView ? 'Loading your forms...' : 'Loading assigned forms...' }}</p>
        </div>

        <div v-else-if="!displayForms.length" class="rq-empty-state">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M20 5l13 6v9c0 7.5-5.5 12.5-13 14-7.5-1.5-13-6.5-13-14v-9l13-6z" stroke="#D7E0EE" stroke-width="2"/>
            <path d="M14.5 20l4 4 7-8" stroke="#B9C5DD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>{{ emptyMessage }}</p>
        </div>

        <button
          v-else
          v-for="form in displayForms" :key="form.id"
          type="button"
          :class="['rq-item', selectedForm?.id === form.id && 'active']"
          @click="selectForm(form)"
        >
          <div class="rq-item-top">
            <span class="rq-avatar">{{ initials(form.employeeName) }}</span>
            <div class="rq-item-id">
              <strong>{{ form.employeeName }}</strong>
              <span>{{ form.divisionName }}<template v-if="form.sectionName"> · {{ form.sectionName }}</template></span>
            </div>
            <span :class="['rq-chip', form.type === 'IPCRF' ? 'tone-blue' : 'tone-note']">{{ form.type }}</span>
          </div>
          <div class="rq-item-bottom">
            <span class="rq-period">{{ form.semester ? 'S' + form.semester + ' ' : '' }}{{ form.year }}</span>
            <span class="rq-item-status">{{ reviewLabel(form) }}</span>
            <span :class="['rq-stage-pill', 'tone-' + stageTone(routeStageFor(form))]">{{ routeStageFor(form) }}</span>
          </div>
        </button>
      </aside>

      <!-- ============ RIGHT: workbook ============ -->
      <main class="rq-detail">

        <div v-if="!selectedForm" class="rq-empty-state rq-empty-detail">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect x="7" y="9" width="30" height="26" rx="3" stroke="#D7E0EE" stroke-width="2"/>
            <path d="M13 17h18M13 23h18M13 29h11" stroke="#B9C5DD" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>Pick a form from the list to begin reviewing.</p>
        </div>

        <template v-else>

          <!-- Document header -->
          <header class="rq-doc-head">
            <div class="rq-doc-id">
              <span class="rq-avatar lg">{{ initials(selectedForm.employeeName) }}</span>
              <div>
                <div class="rq-doc-name">{{ selectedForm.employeeName }}</div>
                <div class="rq-doc-meta">{{ formTitle }} · {{ periodText(selectedForm) }} · {{ selectedForm.divisionName }}</div>
              </div>
            </div>
            <div class="rq-doc-actions" v-if="!isOwnerView">
              <span v-if="saveChipText" :class="['rq-save-chip', `save-${saveState}`]" @click="saveState === 'error' && flushReviewSaves()">
                <span v-if="saveState === 'saving'" class="rq-spinner-xs"></span>
                {{ saveChipText }}
              </span>
              <button class="rq-btn rq-btn-outline-warn" @click="returnSelected"
                :disabled="routing || saveBusy"
                :title="saveBusy ? 'Please wait - your edits are still saving.' : ''">
                <span v-if="routingAction === 'return'" class="rq-spinner-xs rq-spinner-warn"></span>
                {{ routingAction === 'return' ? 'Returning…' : 'Return' }}
              </button>

              <div class="rq-assign-wrap" v-click-outside="closeAssignPanel">
                <button class="rq-btn rq-btn-ghost" @click="openAssignPanel" :disabled="routing || saveBusy"
                  :title="saveBusy ? 'Please wait - your edits are still saving.' : ''">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                  Assign to...
                </button>
                <div v-if="showAssignPanel" class="rq-assign-panel">
                  <input
                    v-model="assigneeSearch"
                    class="rq-assign-search"
                    type="text"
                    placeholder="Search a name, role, or division..."
                    autofocus
                  />
                  <div class="rq-assign-results">
                    <div v-if="assigneeLoading" class="rq-assign-empty">Searching...</div>
                    <div v-else-if="!assigneeResults.length" class="rq-assign-empty">No matches.</div>
                    <button
                      v-else
                      v-for="person in assigneeResults" :key="person.id"
                      type="button"
                      class="rq-assign-row"
                      @click="confirmAssign(person)"
                    >
                      <span class="rq-avatar sm">{{ initials(person.fullName) }}</span>
                      <div class="rq-assign-info">
                        <strong>{{ person.fullName }}</strong>
                        <span>{{ person.tag || person.role }}<template v-if="person.divisionName"> · {{ person.divisionName }}</template></span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <button class="rq-btn rq-btn-primary" @click="completeSelected" :disabled="routing || entriesLoading || saveBusy"
                :title="saveBusy ? 'Please wait - your edits are still saving.' : ''">
                <span v-if="routingAction === 'complete'" class="rq-spinner-xs rq-spinner-light"></span>
                {{ routingAction === 'complete' ? 'Saving & completing…' : routing ? 'Please wait…' : saveBusy ? 'Saving edits…' : completeButtonLabel }}
              </button>
            </div>
            <div v-else class="rq-owner-badge">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 014 4v2.5l1 2H3l1-2V6a4 4 0 014-4z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6.5 14.5a1.5 1.5 0 003 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
              Read-only - your form is under review
            </div>
          </header>

          <div class="rq-assignee-line">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a4.5 4.5 0 014.5 4.5v3l1.5 2.5H2L3.5 9V6A4.5 4.5 0 018 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Currently with <strong>{{ currentAssigneeName || '-' }}</strong>
          </div>

          <div v-if="isOwnerView" class="rq-owner-banner">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 7.2v3.6M8 5.2v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Your {{ selectedForm.type }} is currently under review. You can track its progress and read reviewer notes below, but cannot make changes.
          </div>

          <!-- Stage stepper -->
          <div class="rq-stepper" role="list" aria-label="Review progress">
            <template v-for="(step, i) in routeSteps" :key="step.key">
              <div class="rq-step" role="listitem">
                <span :class="['rq-step-dot', 'is-' + step.state]">
                  <svg v-if="step.state === 'done'" width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.2l2.6 2.6 4.4-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span :class="['rq-step-label', 'is-' + step.state]">{{ step.label }}</span>
              </div>
              <div v-if="i < routeSteps.length - 1" :class="['rq-step-line', routeSteps[i + 1].state !== 'upcoming' && 'filled']"></div>
            </template>
          </div>

          <!-- Workbook tabs -->
          <nav class="rq-tabs">
            <button v-for="tab in workbookTabs" :key="tab.value"
              :class="['rq-tab', activeWorkbookTab === tab.value && 'active']"
              @click="activeWorkbookTab = tab.value">{{ tab.label }}</button>
          </nav>

          <div class="rq-hint">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 7.2v3.6M8 5.2v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <span>{{ activeInstruction }}</span>
          </div>

          <!-- ===== TARGETS ===== -->
          <div v-if="activeWorkbookTab === 'targets'" class="rq-entries">
            <div v-if="entriesLoading" class="rq-empty-state"><div class="rq-spinner"></div><p>Loading form entries...</p></div>
            <div v-else-if="!entries.length" class="rq-empty-state"><p>No indicators submitted yet.</p></div>
            <fieldset :disabled="isOwnerView" class="rq-owner-fs">

            <section v-if="coreEntries.length" class="rq-fn-section rq-fn-core">
              <div class="rq-fn-hd">
                <span class="rq-fn-label">Core Functions</span>
                <span class="rq-fn-weight">{{ selectedForm.coreFunctionWeight }}%</span>
                <span class="rq-fn-count">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <article v-for="(entry, i) in coreEntries" :key="entry.id" class="rq-entry-card">
                <div class="rq-entry-hd">
                  <span class="rq-entry-no">{{ i + 1 }}</span>
                  <textarea v-model="editableEntries[entry.id].kraName" class="rq-kra-input" rows="1" placeholder="Key Result Area"></textarea>
                  <span class="rq-fn-tag">Core</span>
                </div>
                <div class="rq-entry-grid">
                  <label class="rq-field rq-field-wide">
                    <span>Success Indicator</span>
                    <textarea :value="editableEntries[entry.id].successIndicator" rows="3" disabled></textarea>
                  </label>

                  <div class="rq-guide-table rq-field-wide">
                    <div class="rq-guide-caption">
                      <span>Rating Guide</span>
                      <select v-model="editableEntries[entry.id].applicableRatingPeriod" class="rq-guide-period">
                        <option value="1st Semester">1st Semester</option>
                        <option value="2nd Semester">2nd Semester</option>
                        <option value="Both semesters">Both semesters</option>
                      </select>
                    </div>
                    <div class="rq-guide-cols">
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Efficiency (E)</div>
                        <textarea v-model="editableEntries[entry.id].efficiencyGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Quality (Q)</div>
                        <textarea v-model="editableEntries[entry.id].qualityGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Timeliness (T)</div>
                        <textarea v-model="editableEntries[entry.id].timelinessGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                    </div>
                  </div>

                  <div class="rq-mov-remarks rq-field-wide">
                    <label class="rq-field">
                      <span>Means of Verification</span>
                      <textarea v-model="editableEntries[entry.id].meansOfVerification" rows="4"></textarea>
                    </label>
                    <label class="rq-field">
                      <span>Remarks</span>
                      <textarea v-model="editableEntries[entry.id].remarks" rows="4"></textarea>
                    </label>
                  </div>
                </div>
                <label class="rq-note-field">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13.5l1-3.3L11.5 1.7a1.2 1.2 0 0 1 1.7 0l1.1 1.1a1.2 1.2 0 0 1 0 1.7L5.8 12.9l-3.3 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    {{ isOwnerView ? "Reviewer's Notes" : "Your Review Notes" }}
                  </span>
                  <textarea v-model="reviewComments[entry.id]" rows="2" :placeholder="isOwnerView ? 'No notes yet.' : 'Add a note for this indicator...'"></textarea>
                </label>
              </article>
            </section>

            <section v-if="supportEntries.length" class="rq-fn-section rq-fn-support">
              <div class="rq-fn-hd">
                <span class="rq-fn-label">Support Functions</span>
                <span class="rq-fn-weight">{{ selectedForm.supportFunctionWeight }}%</span>
                <span class="rq-fn-count">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <article v-for="(entry, i) in supportEntries" :key="entry.id" class="rq-entry-card">
                <div class="rq-entry-hd">
                  <span class="rq-entry-no">{{ i + 1 }}</span>
                  <textarea v-model="editableEntries[entry.id].kraName" class="rq-kra-input" rows="1" placeholder="Key Result Area"></textarea>
                  <span class="rq-fn-tag">Support</span>
                </div>
                <div class="rq-entry-grid">
                  <label class="rq-field rq-field-wide">
                    <span>Success Indicator</span>
                    <textarea :value="editableEntries[entry.id].successIndicator" rows="3" disabled></textarea>
                  </label>

                  <div class="rq-guide-table rq-field-wide">
                    <div class="rq-guide-caption">
                      <span>Rating Guide</span>
                      <select v-model="editableEntries[entry.id].applicableRatingPeriod" class="rq-guide-period">
                        <option value="1st Semester">1st Semester</option>
                        <option value="2nd Semester">2nd Semester</option>
                        <option value="Both semesters">Both semesters</option>
                      </select>
                    </div>
                    <div class="rq-guide-cols">
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Efficiency (E)</div>
                        <textarea v-model="editableEntries[entry.id].efficiencyGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Quality (Q)</div>
                        <textarea v-model="editableEntries[entry.id].qualityGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Timeliness (T)</div>
                        <textarea v-model="editableEntries[entry.id].timelinessGuide" class="rq-guide-input" :rows="guideRows(editableEntries[entry.id])"></textarea>
                      </div>
                    </div>
                  </div>

                  <div class="rq-mov-remarks rq-field-wide">
                    <label class="rq-field">
                      <span>Means of Verification</span>
                      <textarea v-model="editableEntries[entry.id].meansOfVerification" rows="4"></textarea>
                    </label>
                    <label class="rq-field">
                      <span>Remarks</span>
                      <textarea v-model="editableEntries[entry.id].remarks" rows="4"></textarea>
                    </label>
                  </div>
                </div>
                <label class="rq-note-field">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13.5l1-3.3L11.5 1.7a1.2 1.2 0 0 1 1.7 0l1.1 1.1a1.2 1.2 0 0 1 0 1.7L5.8 12.9l-3.3 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    Your Review Notes
                  </span>
                  <textarea v-model="reviewComments[entry.id]" rows="2" :placeholder="isOwnerView ? 'No notes yet.' : 'Add a note for this indicator...'"></textarea>
                </label>
              </article>
            </section>
            </fieldset>
          </div>

          <!-- ===== RATINGS ===== -->
          <div v-else-if="activeWorkbookTab === 'ratings'" class="rq-entries">
            <div v-if="entriesLoading" class="rq-empty-state"><div class="rq-spinner"></div><p>Loading form entries...</p></div>
            <div v-else-if="!entries.length" class="rq-empty-state"><p>No accomplishments submitted yet.</p></div>
            <fieldset :disabled="isOwnerView" class="rq-owner-fs">

            <section v-if="coreEntries.length" class="rq-fn-section rq-fn-core">
              <div class="rq-fn-hd">
                <span class="rq-fn-label">Core Functions</span>
                <span class="rq-fn-weight">{{ selectedForm.coreFunctionWeight }}%</span>
                <span class="rq-fn-count">{{ coreEntries.length }} indicator{{ coreEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <article v-for="(entry, i) in coreEntries" :key="entry.id" class="rq-entry-card">
                <div class="rq-entry-hd">
                  <span class="rq-entry-no">{{ i + 1 }}</span>
                  <textarea v-model="editableEntries[entry.id].kraName" class="rq-kra-input" rows="1" placeholder="Key Result Area"></textarea>
                  <span class="rq-period-chip">{{ entry.applicableRatingPeriod || '-' }}</span>
                  <span class="rq-fn-tag">Core</span>
                </div>
                <div class="rq-entry-grid">
                  <label class="rq-field rq-field-wide">
                    <span>Success Indicator / Target Basis</span>
                    <textarea :value="editableEntries[entry.id].successIndicator" rows="3" disabled></textarea>
                  </label>
                  <label class="rq-field rq-field-wide">
                    <span>Accomplishment</span>
                    <textarea v-model="editableEntries[entry.id].accomplishment" rows="3"></textarea>
                  </label>

                  <div class="rq-guide-table rq-field-wide">
                    <div class="rq-guide-caption">Rating Guide</div>
                    <div class="rq-guide-cols">
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Efficiency (E)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].efficiencyGuide || 'N/A' }}</div>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Quality (Q)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].qualityGuide || 'N/A' }}</div>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Timeliness (T)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].timelinessGuide || 'N/A' }}</div>
                      </div>
                    </div>
                  </div>

                  <div class="rq-ratings-row rq-field-wide">
                    <div class="rq-rate-col"><span>Efficiency</span><input :value="editableEntries[entry.id].ratingEfficiency" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingEfficiency', $event)" @blur="onRqRatingBlur(entry.id, 'ratingEfficiency', $event)"/></div>
                    <div class="rq-rate-col"><span>Quality</span><input :value="editableEntries[entry.id].ratingQuality" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingQuality', $event)" @blur="onRqRatingBlur(entry.id, 'ratingQuality', $event)"/></div>
                    <div class="rq-rate-col"><span>Timeliness</span><input :value="editableEntries[entry.id].ratingTimeliness" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingTimeliness', $event)" @blur="onRqRatingBlur(entry.id, 'ratingTimeliness', $event)"/></div>
                    <div class="rq-rate-col rq-avg"><span>Average</span><input :value="editableEntries[entry.id].ratingAverage" inputmode="decimal" readonly title="Auto-computed from E/Q/T"/></div>
                  </div>

                  <div class="rq-mov-remarks rq-field-wide">
                    <label class="rq-field">
                      <span>Means of Verification</span>
                      <textarea v-model="editableEntries[entry.id].movReferences" rows="4"></textarea>
                    </label>
                    <label class="rq-field">
                      <span>Remarks</span>
                      <textarea v-model="editableEntries[entry.id].remarks" rows="4"></textarea>
                    </label>
                  </div>
                </div>
                <label class="rq-note-field">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13.5l1-3.3L11.5 1.7a1.2 1.2 0 0 1 1.7 0l1.1 1.1a1.2 1.2 0 0 1 0 1.7L5.8 12.9l-3.3 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    {{ isOwnerView ? "Reviewer's Notes" : "Your Review Notes" }}
                  </span>
                  <textarea v-model="reviewComments[entry.id]" rows="2" :placeholder="isOwnerView ? 'No notes yet.' : 'Add a note for this indicator...'"></textarea>
                </label>
              </article>
            </section>

            <section v-if="supportEntries.length" class="rq-fn-section rq-fn-support">
              <div class="rq-fn-hd">
                <span class="rq-fn-label">Support Functions</span>
                <span class="rq-fn-weight">{{ selectedForm.supportFunctionWeight }}%</span>
                <span class="rq-fn-count">{{ supportEntries.length }} indicator{{ supportEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <article v-for="(entry, i) in supportEntries" :key="entry.id" class="rq-entry-card">
                <div class="rq-entry-hd">
                  <span class="rq-entry-no">{{ i + 1 }}</span>
                  <textarea v-model="editableEntries[entry.id].kraName" class="rq-kra-input" rows="1" placeholder="Key Result Area"></textarea>
                  <span class="rq-period-chip">{{ entry.applicableRatingPeriod || '-' }}</span>
                  <span class="rq-fn-tag">Support</span>
                </div>
                <div class="rq-entry-grid">
                  <label class="rq-field rq-field-wide">
                    <span>Success Indicator / Target Basis</span>
                    <textarea :value="editableEntries[entry.id].successIndicator" rows="3" disabled></textarea>
                  </label>
                  <label class="rq-field rq-field-wide">
                    <span>Accomplishment</span>
                    <textarea v-model="editableEntries[entry.id].accomplishment" rows="3"></textarea>
                  </label>

                  <div class="rq-guide-table rq-field-wide">
                    <div class="rq-guide-caption">Rating Guide</div>
                    <div class="rq-guide-cols">
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Efficiency (E)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].efficiencyGuide || 'N/A' }}</div>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Quality (Q)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].qualityGuide || 'N/A' }}</div>
                      </div>
                      <div class="rq-guide-col">
                        <div class="rq-guide-colhd">Timeliness (T)</div>
                        <div class="rq-guide-body">{{ editableEntries[entry.id].timelinessGuide || 'N/A' }}</div>
                      </div>
                    </div>
                  </div>

                  <div class="rq-ratings-row rq-field-wide">
                    <div class="rq-rate-col"><span>Efficiency</span><input :value="editableEntries[entry.id].ratingEfficiency" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingEfficiency', $event)" @blur="onRqRatingBlur(entry.id, 'ratingEfficiency', $event)"/></div>
                    <div class="rq-rate-col"><span>Quality</span><input :value="editableEntries[entry.id].ratingQuality" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingQuality', $event)" @blur="onRqRatingBlur(entry.id, 'ratingQuality', $event)"/></div>
                    <div class="rq-rate-col"><span>Timeliness</span><input :value="editableEntries[entry.id].ratingTimeliness" inputmode="decimal" class="rating-field" placeholder="0-5 or N/A" @input="onRqRatingInput(entry.id, 'ratingTimeliness', $event)" @blur="onRqRatingBlur(entry.id, 'ratingTimeliness', $event)"/></div>
                    <div class="rq-rate-col rq-avg"><span>Average</span><input :value="editableEntries[entry.id].ratingAverage" inputmode="decimal" readonly title="Auto-computed from E/Q/T"/></div>
                  </div>

                  <div class="rq-mov-remarks rq-field-wide">
                    <label class="rq-field">
                      <span>Means of Verification</span>
                      <textarea v-model="editableEntries[entry.id].movReferences" rows="4"></textarea>
                    </label>
                    <label class="rq-field">
                      <span>Remarks</span>
                      <textarea v-model="editableEntries[entry.id].remarks" rows="4"></textarea>
                    </label>
                  </div>
                </div>
                <label class="rq-note-field">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13.5l1-3.3L11.5 1.7a1.2 1.2 0 0 1 1.7 0l1.1 1.1a1.2 1.2 0 0 1 0 1.7L5.8 12.9l-3.3 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                    {{ isOwnerView ? "Reviewer's Notes" : "Your Review Notes" }}
                  </span>
                  <textarea v-model="reviewComments[entry.id]" rows="2" :placeholder="isOwnerView ? 'No notes yet.' : 'Add a note for this indicator...'"></textarea>
                </label>
              </article>
            </section>
            </fieldset>

            <div v-if="showPartII" class="rq-feedback-card">
              <div class="rq-feedback-hd">Part II · Feedback and Proposed Intervention</div>
              <template v-if="isDCReviewer">
                <div class="rq-feedback-grid rq-feedback-edit">
                  <div>
                    <label class="rq-fb-label">Strengths</label>
                    <textarea v-model="dcFeedbackForm.feedbackStrengths" class="rq-fb-input" rows="2" placeholder="What the ratee does well..."></textarea>
                  </div>
                  <div>
                    <label class="rq-fb-label">Areas for Improvement</label>
                    <textarea v-model="dcFeedbackForm.feedbackAreasForImprovement" class="rq-fb-input" rows="2" placeholder="Development needs..."></textarea>
                  </div>
                  <div>
                    <label class="rq-fb-label">Rater's Comments &amp; Recommendations</label>
                    <textarea v-model="dcFeedbackForm.feedbackComments" class="rq-fb-input" rows="2" placeholder="Comments, commendations, recommendations..."></textarea>
                  </div>
                </div>
                <p class="rq-fb-note">Part II will be saved when you click "{{ completeButtonLabel }}".</p>
              </template>
              <template v-else>
                <div class="rq-feedback-grid">
                  <div><span>Strengths</span><p>{{ selectedForm.feedbackStrengths || 'Pending Division Chief input' }}</p></div>
                  <div><span>Areas for Improvement</span><p>{{ selectedForm.feedbackAreasForImprovement || 'Pending Division Chief input' }}</p></div>
                  <div><span>Comments / Recommendations</span><p>{{ selectedForm.feedbackComments || selectedForm.feedbackRecommendations || 'Pending Division Chief input' }}</p></div>
                </div>
              </template>
            </div>
          </div>

          <!-- ===== COMMENTS ===== -->
          <div v-else-if="activeWorkbookTab === 'comments'" class="rq-comments">
            <div v-if="isOwnerView" class="rq-owner-banner" style="margin-bottom:10px;">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 7.2v3.6M8 5.2v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              These are comments left by reviewers. You can read but not edit them.
            </div>
            <div v-if="!entries.length" class="rq-empty-state"><p>No indicators to comment on.</p></div>
            <div v-for="entry in entries" :key="entry.id" class="rq-comment-row">
              <div class="rq-comment-ref">
                <strong>{{ entry.kraName }}</strong>
                <p>{{ entry.successIndicator }}</p>
              </div>
              <textarea v-model="reviewComments[entry.id]" rows="3" :disabled="isOwnerView" :placeholder="isOwnerView ? 'No comments yet.' : 'Add clarification, correction, or note for this row...'"></textarea>
            </div>
          </div>

          <!-- ===== ROUTING ===== -->
          <div v-else class="rq-routing">
            <div class="rq-routing-grid">
              <div><span>Employee</span><strong>{{ selectedForm.employeeName }}</strong></div>
              <div><span>Form Type</span><strong>{{ selectedForm.type }}</strong></div>
              <div><span>Period</span><strong>{{ periodText(selectedForm) }}</strong></div>
              <div><span>Current Review Type</span><strong>{{ selectedReviewType }}</strong></div>
              <div><span>Current Stage</span><strong>{{ currentRouteStage }}</strong></div>
              <div><span>Currently With</span><strong>{{ currentAssigneeName || '-' }}</strong></div>
              <div><span>Targets Submitted</span><strong>{{ formatDate(selectedForm.submittedAt) }}</strong></div>
              <div><span>Targets Approved</span><strong>{{ formatDate(selectedForm.approvedAt) }}</strong></div>
              <div><span>Ratings Completed</span><strong>{{ formatDate(selectedForm.ratingCompletedAt || selectedForm.ratedAt) }}</strong></div>
            </div>
          </div>

        </template>
      </main>
    </div>

    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ipcrf as ipcrfApi } from '@/services/api'
import { useConfirm, CONFIRMS } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'

const { confirm, confirmState } = useConfirm()
const authStore = useAuthStore()
const loading = ref(false)
const entriesLoading = ref(false)
const routing = ref(false)
const routingAction = ref('')   // 'return' | 'complete' | 'assign' - which routing action is running
const forms = ref([])
const entries = ref([])
const editableEntries = ref({})
const reviewComments = ref({})
const selectedForm = ref(null)
const reviewTypeFilter = ref('targets')
const semesterFilter = ref('')
const activeWorkbookTab = ref('targets')
const toast = ref({ show: false, msg: '', type: 'success' })
const showAssignPanel = ref(false)
const assigneeSearch = ref('')
const assigneeResults = ref([])
const assigneeLoading = ref(false)
const viewMode = ref('queue')
const myForms = ref([])
const myFormsLoading = ref(false)
const isOwnerView = computed(() => viewMode.value === 'myforms')
const displayForms = computed(() => isOwnerView.value ? myForms.value : forms.value)
const displayLoading = computed(() => isOwnerView.value ? myFormsLoading.value : loading.value)
const isDCReviewer = computed(() => !isOwnerView.value && currentRouteStage.value === 'Division Chief')
const showPartII   = computed(() => isOwnerView.value || isDCReviewer.value)
const dcFeedbackForm = ref({ feedbackStrengths: '', feedbackAreasForImprovement: '', feedbackComments: '' })

const workbookTabs = [
  { value: 'targets', label: 'Targets' },
  { value: 'ratings', label: 'Ratings' },
  { value: 'comments', label: 'Comments' },
  { value: 'routing', label: 'Routing' }
]

const queueParams = computed(() => ({
  reviewType: reviewTypeFilter.value,
  ...(semesterFilter.value ? { semester: semesterFilter.value } : {})
}))

const isTargetsReview = computed(() => selectedForm.value?.status === 'Submitted')
const selectedReviewType = computed(() => isTargetsReview.value ? 'Targets Review' : 'Ratings Review')
const formTitle = computed(() => selectedForm.value?.type === 'CCEF'
  ? 'Contractor Commitment and Evaluation Form (CCEF)'
  : 'Individual Performance Commitment and Review Form (IPCRF)'
)
const currentRouteStage = computed(() => {
  if (!selectedForm.value) return ''
  return isTargetsReview.value
    ? (selectedForm.value.targetReviewStage || 'Division Focal')
    : (selectedForm.value.ratingReviewStage || 'Division Focal')
})
const completeButtonLabel = computed(() => {
  if (!selectedForm.value) return 'Mark Complete'
  return isTargetsReview.value ? 'Approve Targets & Notify Staff' : 'Complete Ratings Review'
})
const currentAssigneeName = computed(() => {
  if (!selectedForm.value) return ''
  return isTargetsReview.value
    ? (selectedForm.value.targetRoutedToName || '')
    : (selectedForm.value.ratingRoutedToName || '')
})
const emptyMessage = computed(() => {
  if (isOwnerView.value) return 'None of your forms are currently under review.'
  return reviewTypeFilter.value === 'ratings'
    ? 'No ratings forms assigned yet. Ratings review appears after targets are approved and accomplishments/ratings are ready.'
    : 'No target forms assigned for review.'
})
const activeInstruction = computed(() => {
  if (activeWorkbookTab.value === 'targets') return 'Review the submitted KRA/SI, applicable rating period, rating guide, means of verification, and remarks.'
  if (activeWorkbookTab.value === 'ratings') return 'Review accomplishments against the target basis, EQT rating guide, MOV, remarks, average, and Part II feedback.'
  if (activeWorkbookTab.value === 'comments') return 'Use row-level comments for clarifications, corrections, or instructions before routing.'
  return 'Route this document to the next reviewer once the current review stage is complete.'
})
const coreEntries = computed(() => entries.value.filter(e => e.functionType === 'Core'))
const supportEntries = computed(() => entries.value.filter(e => e.functionType === 'Support'))

onMounted(() => {
  loadQueue()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  flushReviewSaves()
})
watch([reviewTypeFilter, semesterFilter], loadQueue)

// ── Inline autosave (replaces the Save Edits / Save Comments buttons) ──
const lastSavedComments = ref({})
const saveState = ref('idle')   // idle | dirty | saving | saved | error
const savedAt = ref(null)
let saveTimer = null
let saveInFlight = false
let saveQueued = false

const saveBusy = computed(() => saveState.value === 'saving')

const saveChipText = computed(() => {
  if (saveState.value === 'saving') return 'Saving…'
  if (saveState.value === 'dirty') return 'Unsaved changes'
  if (saveState.value === 'error') return 'Save failed - click to retry'
  if (saveState.value === 'saved' && savedAt.value) {
    return `Saved ${savedAt.value.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
  }
  return ''
})

watch(editableEntries, scheduleAutosave, { deep: true })
watch(reviewComments, scheduleAutosave, { deep: true })

function scheduleAutosave() {
  if (isOwnerView.value || entriesLoading.value || routing.value || !selectedForm.value) return
  recomputeAverages()
  if (!dirtyEntryIds().length && !commentsDirty()) {
    if (saveState.value === 'dirty') saveState.value = 'idle'
    return
  }
  saveState.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => flushReviewSaves(), 1200)
}

function recomputeAverages() {
  Object.values(editableEntries.value).forEach(entry => {
    if (!entry) return
    const values = [entry.ratingEfficiency, entry.ratingQuality, entry.ratingTimeliness]
      .map(v => String(v ?? '').trim())
      .filter(v => v !== '' && v.toUpperCase() !== 'N/A')
      .map(Number)
      .filter(n => !Number.isNaN(n))
    const avg = values.length
      ? Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100000) / 100000
      : ''
    if (String(entry.ratingAverage ?? '') !== String(avg)) entry.ratingAverage = avg
  })
}

function onRqRatingInput(entryId, field, event) {
  const el = event.target
  const upper = el.value.toUpperCase()
  if (upper === 'N' || upper === 'N/' || upper === 'N/A') { el.classList.remove('rating-invalid'); return }
  const raw = el.value.replace(/[^0-9.]/g, '')
  if (raw !== el.value) el.value = raw
  if (raw === '' || raw === '.') { editableEntries.value[entryId][field] = ''; el.classList.remove('rating-invalid'); scheduleAutosave(); return }
  const n = parseFloat(raw)
  if (isNaN(n) || n < 0 || n > 5) {
    el.classList.add('rating-invalid')
    setTimeout(() => { el.value = ''; el.classList.remove('rating-invalid'); editableEntries.value[entryId][field] = ''; scheduleAutosave() }, 400)
  } else {
    el.classList.remove('rating-invalid')
    editableEntries.value[entryId][field] = n
    scheduleAutosave()
  }
}
function onRqRatingBlur(entryId, field, event) {
  const el = event.target
  if (el.value.toUpperCase() === 'N/A') { editableEntries.value[entryId][field] = 'N/A'; el.value = 'N/A'; el.classList.remove('rating-invalid'); scheduleAutosave(); return }
  const n = parseFloat(el.value)
  if (!el.value) { el.value = ''; editableEntries.value[entryId][field] = ''; el.classList.remove('rating-invalid') }
  else if (isNaN(n) || n < 0 || n > 5) { el.value = ''; editableEntries.value[entryId][field] = ''; el.classList.remove('rating-invalid') }
  else { editableEntries.value[entryId][field] = Math.round(n * 100) / 100; el.value = editableEntries.value[entryId][field] }
  scheduleAutosave()
}

function dirtyEntryIds() {
  return entries.value
    .filter(entry => {
      const edited = editableEntries.value[entry.id]
      if (!edited) return false
      return JSON.stringify(entryPayload(edited)) !== JSON.stringify(entryPayload(entry))
    })
    .map(entry => entry.id)
}

function commentsDirty() {
  return entries.value.some(entry =>
    (reviewComments.value[entry.id] || '') !== (lastSavedComments.value[entry.id] || '')
  )
}

async function flushReviewSaves(isRetry = false) {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (!selectedForm.value || isOwnerView.value) return
  const form = selectedForm.value
  const dirtyIds = dirtyEntryIds()
  const doComments = commentsDirty()
  if (!dirtyIds.length && !doComments) {
    if (saveState.value === 'dirty') saveState.value = 'idle'
    return
  }
  if (saveInFlight) { saveQueued = true; return }
  saveInFlight = true
  saveState.value = 'saving'
  const entryJobs = dirtyIds.map(id => ({ id, payload: entryPayload(editableEntries.value[id] || {}) }))
  const commentsPayload = doComments
    ? entries.value.map(entry => ({ entryId: entry.id, comment: reviewComments.value[entry.id] || '' }))
    : null
  try {
    for (const job of entryJobs) {
      const updated = await ipcrfApi.updateEntry(form.id, job.id, job.payload)
      const idx = entries.value.findIndex(e => e.id === job.id)
      if (idx !== -1) entries.value[idx] = updated
    }
    if (commentsPayload) {
      await ipcrfApi.saveReviewComments(form.id, {
        reviewType: reviewTypeForForm(form),
        comments: commentsPayload
      })
      const snap = { ...lastSavedComments.value }
      commentsPayload.forEach(c => { snap[c.entryId] = c.comment })
      lastSavedComments.value = snap
    }
    savedAt.value = new Date()
    if (saveState.value === 'saving') saveState.value = 'saved'
  } catch (e) {
    if (!isRetry) {
      // One silent retry for transient failures before bothering the user
      setTimeout(() => flushReviewSaves(true), 1500)
    } else {
      saveState.value = 'error'
      console.error(e); showToast('Auto-save failed. Please try again.', 'error')
    }
  } finally {
    saveInFlight = false
    if (saveQueued) { saveQueued = false; flushReviewSaves() }
  }
}

function onBeforeUnload(e) {
  if (saveState.value === 'dirty' || saveState.value === 'saving' || saveTimer) {
    e.preventDefault()
    e.returnValue = ''
  }
}

function setReviewType(type) {
  reviewTypeFilter.value = type
  activeWorkbookTab.value = type === 'ratings' ? 'ratings' : 'targets'
}

function setMode(mode) {
  viewMode.value = mode
  selectedForm.value = null
  entries.value = []
  editableEntries.value = {}
  reviewComments.value = {}
  if (mode === 'myforms') loadMyForms()
  else loadQueue()
}

async function loadMyForms() {
  myFormsLoading.value = true
  try {
    const r = await ipcrfApi.listForms(authStore.profileId ? { userId: authStore.profileId } : {})
    const all = r?.items || (Array.isArray(r) ? r : [])
    myForms.value = all.filter(f => ['Submitted', 'Approved', 'Rated', 'Returned'].includes(f.status))
    if (!selectedForm.value && myForms.value.length) await selectForm(myForms.value[0])
  } catch (e) {
    console.error(e); showToast('Could not load your forms. Please try again.', 'error')
  } finally {
    myFormsLoading.value = false
  }
}

async function loadQueue() {
  loading.value = true
  try {
    const result = await ipcrfApi.reviewQueue(queueParams.value)
    forms.value = result?.items || (Array.isArray(result) ? result : [])
    if (!selectedForm.value && forms.value.length) await selectForm(forms.value[0])
    if (selectedForm.value && !forms.value.some(f => f.id === selectedForm.value.id)) {
      selectedForm.value = null
      entries.value = []
      editableEntries.value = {}
      reviewComments.value = {}
    }
  } catch (e) {
    console.error(e); showToast('Could not load review queue. Please try again.', 'error')
  } finally {
    loading.value = false
  }
}

async function selectForm(form) {
  flushReviewSaves() // flush pending edits of the previous form (fire-and-forget)
  selectedForm.value = form
  entries.value = []
  editableEntries.value = {}
  reviewComments.value = {}
  lastSavedComments.value = {}
  saveState.value = 'idle'
  dcFeedbackForm.value = {
    feedbackStrengths:           form.feedbackStrengths           || '',
    feedbackAreasForImprovement: form.feedbackAreasForImprovement || '',
    feedbackComments:            form.feedbackComments || form.feedbackRecommendations || ''
  }
  entriesLoading.value = true
  activeWorkbookTab.value = reviewTypeForForm(form) === 'ratings' ? 'ratings' : 'targets'
  try {
    const [entryResult, commentResult] = await Promise.all([
      ipcrfApi.listEntries(form.id),
      ipcrfApi.reviewComments(form.id, reviewTypeForForm(form))
    ])
    entries.value = Array.isArray(entryResult) ? entryResult : []
    editableEntries.value = Object.fromEntries(entries.value.map(entry => [entry.id, cloneEntry(entry)]))
    reviewComments.value = Object.fromEntries((Array.isArray(commentResult) ? commentResult : [])
      .map(comment => [comment.entryId, comment.comment || '']))
    lastSavedComments.value = { ...reviewComments.value }
    saveState.value = 'idle'
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    entriesLoading.value = false
  }
}

// Routing actions must not write in parallel with an in-flight autosave:
// cancel the pending debounce (the caller saves everything itself) and wait
// out any request that is already on the wire.
async function waitForSaveIdle() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  while (saveInFlight) await new Promise(resolve => setTimeout(resolve, 150))
}

// Saves only entries that actually changed, and leaves editableEntries alone
// so in-progress typing is never clobbered by a save.
async function saveEntryEditsSilently() {
  if (!selectedForm.value) return
  await waitForSaveIdle()
  const dirtyIds = dirtyEntryIds()
  for (const id of dirtyIds) {
    const updated = await ipcrfApi.updateEntry(selectedForm.value.id, id, entryPayload(editableEntries.value[id] || {}))
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx !== -1) entries.value[idx] = updated
  }
}

async function completeSelected() {
  if (!selectedForm.value) return
  const ok = await confirm({
    type: 'approve',
    title: completeButtonLabel.value,
    message: `This will save edits and comments, then mark ${selectedForm.value.employeeName}'s ${selectedForm.value.type} ${selectedReviewType.value.toLowerCase()} as complete. No further routing will happen automatically.`,
    details: [
      { label: 'Currently with', value: currentAssigneeName.value || authStore.fullName || 'you' },
      { label: 'Review type', value: selectedReviewType.value }
    ],
    confirmLabel: completeButtonLabel.value,
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  routing.value = true
  routingAction.value = 'complete'
  try {
    await Promise.all([saveEntryEditsSilently(), saveCommentsSilently()])
    if (isDCReviewer.value && !isTargetsReview.value) {
      await ipcrfApi.rateForm(selectedForm.value.id, {
        finalNumericalRating: selectedForm.value.finalNumericalRating || '',
        adjectivalRating:     selectedForm.value.adjectivalRating     || '',
        ...dcFeedbackForm.value
      })
    }
    const updated = await ipcrfApi.routeForm(selectedForm.value.id, {
      reviewType: reviewTypeForForm(selectedForm.value),
      action: 'complete'
    })
    syncSelected(updated)
    showToast('Marked complete.')
    await loadQueue()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    routing.value = false
    routingAction.value = ''
  }
}

async function openAssignPanel() {
  showAssignPanel.value = true
  assigneeSearch.value = ''
  await searchAssignees('')
}

function closeAssignPanel() {
  showAssignPanel.value = false
}

let assigneeSearchTimer = null
watch(assigneeSearch, (value) => {
  clearTimeout(assigneeSearchTimer)
  assigneeSearchTimer = setTimeout(() => searchAssignees(value), 250)
})

async function searchAssignees(query) {
  if (!selectedForm.value) return
  assigneeLoading.value = true
  try {
    const result = await ipcrfApi.assignableUsers(selectedForm.value.id, query)
    assigneeResults.value = result?.items || (Array.isArray(result) ? result : [])
  } catch (e) {
    assigneeResults.value = []
  } finally {
    assigneeLoading.value = false
  }
}

async function confirmAssign(person) {
  if (!selectedForm.value) return
  const ok = await confirm({
    type: 'submit',
    title: 'Assign for Review',
    message: `This will save edits and comments, then route ${selectedForm.value.employeeName}'s ${selectedForm.value.type} ${selectedReviewType.value.toLowerCase()} to ${person.fullName}.`,
    details: [
      { label: 'Assign to', value: `${person.fullName}${person.tag ? ' - ' + person.tag : ''}` },
      { label: 'Review type', value: selectedReviewType.value }
    ],
    confirmLabel: 'Assign',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  closeAssignPanel()
  routing.value = true
  routingAction.value = 'assign'
  try {
    await Promise.all([saveEntryEditsSilently(), saveCommentsSilently()])
    const updated = await ipcrfApi.routeForm(selectedForm.value.id, {
      reviewType: reviewTypeForForm(selectedForm.value),
      action: 'assign',
      assignToUserId: person.id
    })
    syncSelected(updated)
    showToast(`Routed to ${person.fullName}.`)
    await loadQueue()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    routing.value = false
    routingAction.value = ''
  }
}

async function saveCommentsSilently() {
  if (!selectedForm.value) return
  await waitForSaveIdle()
  const result = await ipcrfApi.saveReviewComments(selectedForm.value.id, {
    reviewType: reviewTypeForForm(selectedForm.value),
    comments: entries.value.map(entry => ({
      entryId: entry.id,
      comment: reviewComments.value[entry.id] || ''
    }))
  })
  reviewComments.value = Object.fromEntries((Array.isArray(result) ? result : [])
    .map(comment => [comment.entryId, comment.comment || '']))
  lastSavedComments.value = { ...reviewComments.value }
}

async function returnSelected() {
  if (!selectedForm.value) return
  const ok = await confirm(CONFIRMS.returnForm(selectedForm.value.employeeName))
  if (!ok) return
  routing.value = true
  routingAction.value = 'return'
  try {
    await Promise.all([saveEntryEditsSilently(), saveCommentsSilently()])
    const updated = await ipcrfApi.returnForm(selectedForm.value.id, { remarks: confirmState.inputValue })
    syncSelected(updated)
    showToast('Form returned for revision.', 'warning')
    await loadQueue()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    routing.value = false
    routingAction.value = ''
  }
}

function syncSelected(updated) {
  selectedForm.value = { ...selectedForm.value, ...updated }
  const index = forms.value.findIndex(f => f.id === selectedForm.value.id)
  if (index >= 0) forms.value[index] = selectedForm.value
}

function cloneEntry(entry) {
  return { ...entry }
}

function entryPayload(entry) {
  return {
    kraName: entry.kraName || '',
    successIndicator: entry.successIndicator || '',
    applicableRatingPeriod: entry.applicableRatingPeriod || '',
    efficiencyGuide: entry.efficiencyGuide || '',
    qualityGuide: entry.qualityGuide || '',
    timelinessGuide: entry.timelinessGuide || '',
    meansOfVerification: entry.meansOfVerification || '',
    accomplishment: entry.accomplishment || '',
    ratingEfficiency: entry.ratingEfficiency || '',
    ratingQuality: entry.ratingQuality || '',
    ratingTimeliness: entry.ratingTimeliness || '',
    ratingAverage: entry.ratingAverage || '',
    movReferences: entry.movReferences || '',
    remarks: entry.remarks || ''
  }
}

function semesterText(value) {
  if (!value || String(value).trim() === '') return ''
  return String(value) === '1' ? '1st Semester' : '2nd Semester'
}

function periodText(form) {
  const sem = semesterText(form?.semester)
  return sem ? `${sem}, CY ${form?.year}` : `CY ${form?.year}`
}

function reviewLabel(form) {
  if (form.status === 'Submitted') return 'Targets Review'
  if (form.status === 'Approved') return 'Ratings Preparation'
  if (form.status === 'Rated') return 'Ratings Review'
  return form.status
}

function reviewTypeForForm(form) {
  return form?.status === 'Submitted' ? 'targets' : 'ratings'
}

function routeStageFor(form) {
  if (!form) return ''
  return reviewTypeForForm(form) === 'targets'
    ? (form.targetReviewStage || 'Division Focal')
    : (form.ratingReviewStage || 'Division Focal')
}

function formatDate(value) {
  if (!value) return '---'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}

const vClickOutside = {
  mounted(el, binding) {
    el._onClickOutside = (e) => { if (!el.contains(e.target)) binding.value(e) }
    document.addEventListener('click', el._onClickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._onClickOutside)
  }
}

// ── Presentational-only helpers (added for the redesign - no state/behavior change) ──
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.map(p => p[0]).join('').toUpperCase()
}

function stageTone(stage) {
  const map = { 'Division Focal': 'blue', 'Bureau Focal': 'note', 'Division Chief': 'warn', 'Completed': 'good' }
  return map[stage] || 'slate'
}

// Sizes the three Targets rating-guide boxes off whichever of the three has
// the most lines, so all three grow together as one block instead of each
// needing its own scroll/resize.
function guideRows(entry) {
  const lineCount = (text) => String(text || '').split('\n').length
  const longest = Math.max(
    lineCount(entry?.efficiencyGuide),
    lineCount(entry?.qualityGuide),
    lineCount(entry?.timelinessGuide),
    1
  )
  return Math.min(Math.max(longest, 4), 14)
}

const routeSteps = computed(() => {
  if (!selectedForm.value) return []
  const stage = currentRouteStage.value
  const sequence = isTargetsReview.value
    ? [
        { key: 'Division Focal', label: 'Division Focal' },
        { key: 'Bureau Focal', label: 'Bureau Focal' },
        { key: 'Completed', label: 'Approved' }
      ]
    : [
        { key: 'Division Focal', label: 'Division Focal' },
        { key: 'Bureau Focal', label: 'Bureau Focal' },
        { key: 'Division Chief', label: 'Division Chief' },
        { key: 'Completed', label: 'Rated' }
      ]
  const idx = sequence.findIndex(s => s.key === stage)
  return sequence.map((step, i) => ({
    ...step,
    // idx === -1 means this form is currently assigned to someone outside the
    // usual three (a manual "assign to" pick) - don't falsely light up step 1,
    // the "Currently With" line above is the source of truth in that case.
    state: idx === -1 ? 'upcoming' : (i < idx ? 'done' : i === idx ? 'current' : 'upcoming')
  }))
})
</script>

<style scoped>
* { box-sizing: border-box; }
.review-page {
  --ink: #0B1626;
  --ink-soft: #3B4863;
  --muted: #6B7A99;
  --faint: #9AA7C0;
  --bg: #F2F5FA;
  --surface: #FFFFFF;
  --surface-2: #F7F9FC;
  --border: #E1E7F0;
  --accent: #2454E0;
  --accent-soft: #EAF0FF;
  --accent-strong: #15348C;
  --good: #1A9A5C;
  --good-soft: #E9F8EF;
  --warn: #C2780B;
  --warn-soft: #FFF3DF;
  --danger: #D1455A;
  --danger-soft: #FDEEF0;
  --note: #6E4FCC;
  --note-soft: #F1ECFC;
  --slate: #64748B;
  --slate-soft: #F1F4F9;

  min-height: 100%;
  padding: 18px;
  background: var(--bg);
  color: var(--ink);
}


/* ── Toolbar ── */
.rq-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.rq-toolbar-title h1 { font-size: 21px; font-weight: 800; margin: 0 0 2px; letter-spacing: -.3px; }
.rq-toolbar-title p { margin: 0; color: var(--muted); font-size: 12.5px; }
.rq-toolbar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rq-segmented { display: flex; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 3px; }
.rq-seg-btn { height: 30px; border: 0; border-radius: 7px; background: transparent; padding: 0 14px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--muted); cursor: pointer; transition: all .15s; }
.rq-seg-btn.active { background: var(--ink); color: #fff; }
.rq-seg-btn:not(.active):hover { background: var(--slate-soft); color: var(--ink); }
.rq-select { height: 36px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); padding: 0 10px; font: inherit; font-size: 12.5px; color: var(--ink); }
.rq-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); padding: 0 14px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); cursor: pointer; transition: all .15s; white-space: nowrap; }
.rq-btn:hover:not(:disabled) { background: var(--slate-soft); border-color: #CBD5E1; }
.rq-btn:disabled { opacity: .5; cursor: not-allowed; }
.rq-btn-ghost { background: var(--surface); }
.rq-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.rq-btn-primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
.rq-btn-outline-warn { color: var(--warn); border-color: #F3D399; background: var(--warn-soft); }
.rq-btn-outline-warn:hover { background: #FCE7BE; }
.rq-spin { animation: rq-spin 1s linear infinite; }
@keyframes rq-spin { to { transform: rotate(360deg); } }

/* ── Body: two-pane layout ── */
.rq-body { display: flex; gap: 16px; align-items: flex-start; }

/* ── Left: queue list ── */
.rq-list { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 160px); overflow-y: auto; padding-right: 4px; }
.rq-item { display: flex; flex-direction: column; gap: 8px; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: 12px; padding: 12px; cursor: pointer; font: inherit; transition: all .15s; }
.rq-item:hover { border-color: #C7D3E6; }
.rq-item.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.rq-item-top { display: flex; align-items: flex-start; gap: 9px; }
.rq-item-id { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rq-item-id strong { font-size: 13px; font-weight: 700; color: var(--ink); line-height: 1.3; }
.rq-item-id span { font-size: 11px; color: var(--muted); }
.rq-item-bottom { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rq-item-status { font-size: 10.5px; color: var(--muted); margin-right: auto; }
.rq-period { font-size: 10.5px; font-weight: 700; color: var(--ink-soft); background: var(--slate-soft); border-radius: 6px; padding: 2px 7px; }

.rq-avatar { width: 30px; height: 30px; border-radius: 9px; background: var(--accent-soft); color: var(--accent-strong); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; flex-shrink: 0; letter-spacing: -.02em; }
.rq-avatar.lg { width: 44px; height: 44px; border-radius: 12px; font-size: 13px; }

.rq-chip { font-size: 9.5px; font-weight: 800; letter-spacing: .3px; border-radius: 6px; padding: 3px 7px; flex-shrink: 0; }
.rq-stage-pill { font-size: 10px; font-weight: 700; border-radius: 999px; padding: 3px 9px; }
.tone-blue { background: #E8F1FF; color: #1A56B0; }
.tone-note { background: var(--note-soft); color: var(--note); }
.tone-warn { background: var(--warn-soft); color: var(--warn); }
.tone-good { background: var(--good-soft); color: var(--good); }
.tone-slate { background: var(--slate-soft); color: var(--slate); }

/* ── Empty states ── */
.rq-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 20px; color: var(--faint); text-align: center; font-size: 12.5px; }
.rq-empty-detail { background: var(--surface); border: 1px dashed var(--border); border-radius: 14px; min-height: 320px; }
.rq-spinner { width: 22px; height: 22px; border: 2.5px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: rq-spin .7s linear infinite; }

/* ── Right: detail panel ── */
.rq-detail { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px 22px; }

.rq-doc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.rq-doc-id { display: flex; align-items: center; gap: 12px; }
.rq-doc-name { font-size: 17px; font-weight: 800; letter-spacing: -.2px; }
.rq-doc-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
.rq-doc-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rq-save-chip { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.save-dirty { background: #FEF3E2; color: #B45309; }
.save-saving { background: #EFF6FF; color: #1D4ED8; }
.save-saved { background: #ECFDF5; color: #047857; }
.save-error { background: #FEF2F2; color: #B91C1C; cursor: pointer; }
.rq-spinner-xs { width: 9px; height: 9px; border: 2px solid rgba(29,78,216,.25); border-top-color: #1D4ED8; border-radius: 50%; animation: rq-spin .6s linear infinite; display: inline-block; }
.rq-spinner-warn { border-color: rgba(180,83,9,.25); border-top-color: #B45309; }
.rq-spinner-light { border-color: rgba(255,255,255,.35); border-top-color: #fff; }

.rq-avatar.sm { width: 26px; height: 26px; border-radius: 8px; font-size: 10px; }

/* ── Assign-to picker ── */
.rq-assign-wrap { position: relative; }
.rq-assign-panel { position: absolute; top: calc(100% + 6px); right: 0; width: 300px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.16); z-index: 40; overflow: hidden; }
.rq-assign-search { width: 100%; border: 0; border-bottom: 1px solid var(--border); padding: 11px 14px; font: inherit; font-size: 13px; color: var(--ink); outline: none; }
.rq-assign-search:focus { background: var(--surface-2); }
.rq-assign-results { max-height: 280px; overflow-y: auto; padding: 6px; }
.rq-assign-empty { padding: 18px; text-align: center; font-size: 12px; color: var(--faint); }
.rq-assign-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 0; background: transparent; padding: 8px; border-radius: 9px; cursor: pointer; font: inherit; }
.rq-assign-row:hover { background: var(--slate-soft); }
.rq-assign-info { display: flex; flex-direction: column; min-width: 0; }
.rq-assign-info strong { font-size: 12.5px; color: var(--ink); }
.rq-assign-info span { font-size: 11px; color: var(--muted); }

.rq-assignee-line { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.rq-assignee-line strong { color: var(--ink-soft); font-weight: 700; }

/* ── Stepper (signature element) ── */
.rq-stepper { display: flex; align-items: center; padding: 14px 6px 18px; }
.rq-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }
.rq-step-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; border: 2px solid var(--border); color: var(--faint); background: var(--surface); transition: all .2s; }
.rq-step-dot.is-done { background: var(--good); border-color: var(--good); color: #fff; }
.rq-step-dot.is-current { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 0 0 4px var(--accent-soft); }
.rq-step-label { font-size: 10.5px; font-weight: 700; color: var(--faint); white-space: nowrap; }
.rq-step-label.is-done { color: var(--good); }
.rq-step-label.is-current { color: var(--accent-strong); }
.rq-step-line { height: 2px; flex: 1; min-width: 24px; background: var(--border); margin: 0 6px; margin-bottom: 19px; border-radius: 2px; }
.rq-step-line.filled { background: var(--good); }

/* ── Tabs ── */
.rq-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.rq-tab { border: 0; background: transparent; padding: 9px 16px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s; }
.rq-tab.active { color: var(--accent-strong); border-color: var(--accent); }
.rq-tab:not(.active):hover { color: var(--ink); }

.rq-hint { display: flex; align-items: center; gap: 8px; background: var(--accent-soft); color: var(--accent-strong); border-radius: 9px; padding: 9px 12px; font-size: 12px; margin-bottom: 16px; }
.rq-hint svg { flex-shrink: 0; }

/* ── Core / Support grouping ── */
.rq-fn-section { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
.rq-fn-section:last-of-type { margin-bottom: 0; }
.rq-fn-hd { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; }
.rq-fn-label { font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.rq-fn-weight { font-size: 10.5px; font-weight: 800; border-radius: 999px; padding: 3px 10px; }
.rq-fn-count { font-size: 11.5px; margin-left: auto; }

.rq-fn-core .rq-fn-hd { background: #1A56B0; }
.rq-fn-core .rq-fn-label { color: #fff; }
.rq-fn-core .rq-fn-weight { background: rgba(255,255,255,.22); color: #fff; }
.rq-fn-core .rq-fn-count { color: rgba(255,255,255,.8); }
.rq-fn-core .rq-entry-card { border-left: 5px solid #1A56B0; background: #F6F9FE; }
.rq-fn-core .rq-fn-tag { background: #1A56B0; color: #fff; }

.rq-fn-support .rq-fn-hd { background: #6B3FA0; }
.rq-fn-support .rq-fn-label { color: #fff; }
.rq-fn-support .rq-fn-weight { background: rgba(255,255,255,.22); color: #fff; }
.rq-fn-support .rq-fn-count { color: rgba(255,255,255,.8); }
.rq-fn-support .rq-entry-card { border-left: 5px solid #6B3FA0; background: #FAF7FD; }
.rq-fn-support .rq-fn-tag { background: #6B3FA0; color: #fff; }

.rq-fn-tag { font-size: 9.5px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; border-radius: 6px; padding: 4px 8px; flex-shrink: 0; }

/* ── Entry cards ── */
.rq-entries { display: flex; flex-direction: column; gap: 14px; }
.rq-entry-card { border: 1px solid var(--border); border-radius: 13px; padding: 14px 16px; background: var(--surface-2); }
.rq-entry-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.rq-entry-no { width: 22px; height: 22px; border-radius: 7px; background: var(--ink); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rq-kra-input { flex: 1; border: 1px solid transparent; background: transparent; font: inherit; font-size: 14px; font-weight: 700; color: var(--ink); padding: 4px 6px; border-radius: 6px; resize: none; min-height: 30px; }
.rq-kra-input:focus { border-color: var(--border); background: var(--surface); outline: none; }
.rq-period-chip { font-size: 10.5px; font-weight: 700; background: var(--slate-soft); color: var(--ink-soft); border-radius: 999px; padding: 3px 10px; flex-shrink: 0; }

.rq-entry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.rq-field-wide { grid-column: 1 / -1; }
.rq-field { display: flex; flex-direction: column; gap: 5px; }
.rq-field > span { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.rq-field textarea, .rq-field select, .rq-field input { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); padding: 7px 9px; font: inherit; font-size: 12.5px; color: var(--ink); resize: vertical; width: 100%; }
.rq-field textarea:focus, .rq-field select:focus, .rq-field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

.rq-field textarea:disabled { background: var(--surface-2); color: var(--ink-soft); cursor: not-allowed; resize: none; }

/* Rating Guide - three-column reference table (Efficiency / Quality / Timeliness) */
.rq-guide-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.rq-guide-caption { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--ink); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; padding: 7px 10px 7px 12px; }
.rq-guide-period { height: 24px; border: 1px solid rgba(255,255,255,.25); border-radius: 6px; background: rgba(255,255,255,.12); color: #fff; font-size: 10.5px; font-weight: 700; text-transform: none; letter-spacing: 0; padding: 0 6px; }
.rq-guide-period option { color: var(--ink); }
.rq-guide-cols { display: grid; grid-template-columns: repeat(3, 1fr); }
.rq-guide-col { border-left: 1px solid var(--border); }
.rq-guide-col:first-child { border-left: 0; }
.rq-guide-colhd { background: #DCE7EC; color: var(--ink-soft); font-size: 11px; font-weight: 800; text-align: center; padding: 7px 8px; border-bottom: 1px solid var(--border); }
.rq-guide-body { font-size: 11.5px; line-height: 1.5; color: var(--ink-soft); padding: 10px; white-space: pre-line; min-height: 60px; }
.rq-guide-input { width: 100%; border: 0; background: transparent; padding: 9px 10px; font: inherit; font-size: 11.5px; line-height: 1.5; color: var(--ink-soft); resize: none; overflow-y: auto; }
.rq-guide-input:focus { outline: none; background: var(--accent-soft); color: var(--ink); }

/* Ratings figures - even 4-column grid, easy to scan at a glance */
.rq-ratings-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.rq-rate-col { display: flex; flex-direction: column; gap: 5px; }
.rq-rate-col > span { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; text-align: center; }
.rq-rate-col input { text-align: center; border: 1px solid var(--border); border-radius: 8px; padding: 9px 4px; font: inherit; font-size: 15px; font-weight: 700; color: var(--ink); width: 100%; }
.rq-rate-col input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.rq-rate-col.rq-avg input { background: var(--accent-soft); border-color: #BFD3FA; color: var(--accent-strong); }

/* MOV / Remarks - full-width, even two columns, tall textareas */
.rq-mov-remarks { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rq-mov-remarks textarea { min-height: 110px; }

.rq-note-field { display: block; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border); }
.rq-note-field > span { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; color: var(--note); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 5px; }
.rq-note-field textarea { width: 100%; border: 1px solid #DCD3F5; background: var(--note-soft); border-radius: 8px; padding: 7px 9px; font: inherit; font-size: 12.5px; color: var(--ink); resize: vertical; }
.rq-note-field textarea:focus { outline: none; border-color: var(--note); }

/* ── Feedback (Part II) ── */
.rq-feedback-card { border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rq-feedback-hd { background: var(--ink); color: #fff; font-weight: 800; font-size: 12px; padding: 9px 14px; }
.rq-feedback-grid { display: grid; grid-template-columns: 200px 1fr; }
.rq-feedback-grid > div { display: contents; }
.rq-feedback-grid span { padding: 11px 14px; font-size: 11.5px; font-weight: 700; color: var(--muted); background: var(--surface-2); border-top: 1px solid var(--border); }
.rq-feedback-grid p { margin: 0; padding: 11px 14px; font-size: 12.5px; color: var(--ink-soft); border-top: 1px solid var(--border); }
.rq-feedback-edit { display: flex; flex-direction: column; gap: 0; }
.rq-feedback-edit > div { padding: 10px 14px; border-top: 1px solid var(--border); }
.rq-fb-label { display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 5px; }
.rq-fb-input { width: 100%; resize: vertical; border: 1px solid var(--border); border-radius: 7px; padding: 7px 9px; font-size: 12.5px; color: var(--ink-soft); background: var(--surface); box-sizing: border-box; }
.rq-fb-input:focus { outline: none; border-color: var(--accent); }
.rq-fb-note { margin: 0; padding: 8px 14px 10px; font-size: 11px; color: var(--muted); font-style: italic; }

/* ── Comments tab ── */
.rq-comments { display: flex; flex-direction: column; gap: 10px; }
.rq-comment-row { display: grid; grid-template-columns: minmax(220px, 360px) 1fr; gap: 14px; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; background: var(--surface-2); }
.rq-comment-ref strong { font-size: 13px; }
.rq-comment-ref p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.rq-comment-row textarea { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); padding: 8px 10px; font: inherit; font-size: 12.5px; resize: vertical; }
.rq-comment-row textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

/* ── Routing tab ── */
.rq-routing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.rq-routing-grid > div { background: var(--surface); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.rq-routing-grid span { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.rq-routing-grid strong { font-size: 13px; color: var(--ink); }

/* ── Toast ── */
.toast { position: fixed; right: 24px; bottom: 24px; background: var(--ink); color: #fff; border-radius: 10px; padding: 10px 16px; z-index: 999; font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.toast-error { background: var(--danger); }
.toast-warning { background: var(--warn); }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .2s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }

/* ── Mode switch (Review Queue / My Form toggle) ── */
.rq-mode-switch { display: flex; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 3px; }
.rq-mode-btn { height: 30px; border: 0; border-radius: 7px; background: transparent; padding: 0 14px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--muted); cursor: pointer; transition: all .15s; white-space: nowrap; }
.rq-mode-btn.active { background: var(--accent); color: #fff; }
.rq-mode-btn:not(.active):hover { background: var(--slate-soft); color: var(--ink); }

/* ── Owner view elements ── */
.rq-owner-badge { display: inline-flex; align-items: center; gap: 7px; height: 36px; border: 1px solid #BFD3FA; border-radius: 9px; background: var(--accent-soft); padding: 0 14px; font-size: 12.5px; font-weight: 700; color: var(--accent-strong); white-space: nowrap; }
.rq-owner-banner { display: flex; align-items: flex-start; gap: 9px; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 14px; }
.rq-owner-banner svg { flex-shrink: 0; margin-top: 1px; }
.rq-owner-fs { border: 0; padding: 0; margin: 0; min-width: 0; width: 100%; display: contents; }
.rq-owner-fs:disabled textarea,
.rq-owner-fs[disabled] textarea,
.rq-owner-fs:disabled input,
.rq-owner-fs[disabled] input,
.rq-owner-fs:disabled select,
.rq-owner-fs[disabled] select { background: var(--surface-2) !important; color: var(--ink-soft) !important; cursor: not-allowed !important; }

/* ── Responsive ── */
@media (max-width: 980px) {
  .rq-body { flex-direction: column; }
  .rq-list { width: 100%; max-height: 320px; }
  .rq-detail { width: 100%; }
  .rq-stepper { overflow-x: auto; }
}
@media (max-width: 640px) {
  .rq-guide-cols { grid-template-columns: 1fr; }
  .rq-guide-col { border-left: 0; border-top: 1px solid var(--border); }
  .rq-guide-col:first-child { border-top: 0; }
  .rq-ratings-row { grid-template-columns: repeat(2, 1fr); }
  .rq-mov-remarks { grid-template-columns: 1fr; }
}
.rating-field{text-align:center;font-weight:700;font-size:16px;transition:background .15s,border-color .15s,color .15s;}
.rating-invalid{background:#FEE2E2 !important;border-color:#EF4444 !important;color:#DC2626 !important;}
</style>
