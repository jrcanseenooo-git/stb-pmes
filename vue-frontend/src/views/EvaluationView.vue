<template>
  <div class="eval-page">

    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">IPAT Evaluation</h2>
        <p class="page-sub">Innovations Performance Assessment Tool — CBC 30% · FPO 55% · JF 15%</p>
      </div>
      <button v-if="canCreate" class="btn btn-primary" @click="openCreateModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        New Assessment
      </button>
    </div>

    <!-- Domain weight bar -->
    <div class="domain-bar">
      <div class="domain-item d-cbc">
        <div class="domain-pct">30%</div>
        <div class="domain-label">Core Behavioral Competencies</div>
        <div class="domain-sub">5 HEARTWORK Values · 5 Indicators each · 1–4 Likert</div>
      </div>
      <div class="domain-sep">+</div>
      <div class="domain-item d-fpo">
        <div class="domain-pct">55%</div>
        <div class="domain-label">Functional Performance Output</div>
        <div class="domain-sub">IPCRF/DPCR Final Numerical Rating</div>
      </div>
      <div class="domain-sep">+</div>
      <div class="domain-item d-jf">
        <div class="domain-pct">15%</div>
        <div class="domain-label">Job Fitness</div>
        <div class="domain-sub">7 Indicators · Self + Supervisor + Skip Supervisor</div>
      </div>
      <div class="domain-sep">=</div>
      <div class="domain-item d-overall">
        <div class="domain-pct">100%</div>
        <div class="domain-label">Overall Performance Audit Score</div>
        <div class="domain-sub">1.00 – 4.00 Scale</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
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
          <input v-model="search" type="text" class="srch-inp" placeholder="Search employee…"/>
        </div>
        <select v-model="filterDiv" class="filter-select">
          <option value="">All Divisions</option>
          <option value="dfd">Design Formulation</option>
          <option value="pid">Pilot Implementation</option>
          <option value="staed">STAE Division</option>
          <option value="admin-pool">Admin Pool</option>
        </select>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="records-grid">
      <div v-for="i in 3" :key="i" class="record-card sk-card">
        <div class="sk-hd"><div class="sk-badge"></div><div class="sk-line" style="width:60px"></div></div>
        <div class="sk-line" style="width:80%;margin-bottom:6px"></div>
        <div class="sk-line" style="width:55%;margin-bottom:16px"></div>
        <div class="sk-scores">
          <div class="sk-line" style="width:40px;height:32px"></div>
          <div class="sk-line" style="width:40px;height:32px"></div>
          <div class="sk-line" style="width:40px;height:32px"></div>
          <div class="sk-line" style="width:40px;height:32px"></div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredRecords.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M24 14v10l6 4" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">{{ records.length === 0 ? 'No assessments yet' : 'No matching assessments' }}</p>
      <p class="empty-sub">{{ records.length === 0 ? 'Click New Assessment to start.' : 'Try adjusting your filters.' }}</p>
    </div>

    <!-- Records grid -->
    <div v-else class="records-grid">
      <div v-for="rec in filteredRecords" :key="rec.id" class="record-card" @click="openDetailModal(rec)">
        <div class="rc-hd">
          <span :class="['status-badge', statusClass(rec.status)]">{{ rec.status }}</span>
          <span class="rc-period">S{{ rec.semester }} {{ rec.year }}</span>
        </div>
        <div class="rc-name">{{ rec.rateeName }}</div>
        <div class="rc-div">{{ rec.divisionName || '—' }} · {{ rec.position || '—' }}</div>
        <div class="rc-scores">
          <div class="score-block">
            <div class="score-lbl">CBC (30%)</div>
            <div :class="['score-val', rec.cbcScore ? 'has-score' : '']">{{ rec.cbcScore || '—' }}</div>
          </div>
          <div class="score-block">
            <div class="score-lbl">FPO (55%)</div>
            <div :class="['score-val', rec.fpoScore ? 'has-score' : '']">{{ rec.fpoScore || '—' }}</div>
          </div>
          <div class="score-block">
            <div class="score-lbl">JF (15%)</div>
            <div :class="['score-val', rec.jfScore ? 'has-score' : '']">{{ rec.jfScore || '—' }}</div>
          </div>
          <div class="score-block score-block-overall">
            <div class="score-lbl">Overall</div>
            <div v-if="rec.overallScore" :class="['score-val score-val-overall', descriptorClass(rec.descriptor)]">
              {{ rec.overallScore }}
            </div>
            <div v-else class="score-val">—</div>
          </div>
        </div>
        <div v-if="rec.descriptor" :class="['rc-descriptor', descriptorClass(rec.descriptor)]">
          {{ rec.descriptor }}
        </div>
      </div>
    </div>

    <!-- Rating scale reference -->
    <div class="scale-card">
      <div class="scale-title">Likert Scale (CBC &amp; JF) and Qualitative Descriptors</div>
      <div class="scale-grid">
        <div class="scale-row">
          <div class="scale-label">Rating Scale (1–4)</div>
          <div class="scale-items">
            <span class="scale-item"><strong>1</strong> = Rarely/Never</span>
            <span class="scale-item"><strong>2</strong> = Sometimes</span>
            <span class="scale-item"><strong>3</strong> = Most of the Time</span>
            <span class="scale-item"><strong>4</strong> = Always</span>
          </div>
        </div>
        <div class="scale-row">
          <div class="scale-label">Overall Descriptors</div>
          <div class="scale-items">
            <span class="scale-item desc-excellent">3.50–4.00 Excellent Alignment</span>
            <span class="scale-item desc-satisfactory">2.50–3.49 Satisfactory Alignment</span>
            <span class="scale-item desc-needs">1.50–2.49 Needs Development</span>
            <span class="scale-item desc-immediate">1.00–1.49 Requires Immediate Intervention</span>
          </div>
        </div>
        <div class="scale-row">
          <div class="scale-label">CBC Raters &amp; Weights</div>
          <div class="scale-items">
            <span class="scale-item">Self 15%</span>
            <span class="scale-item">Peer 15% (or 30% if no subordinate)</span>
            <span class="scale-item">Subordinate 15%</span>
            <span class="scale-item">Supervisor 30%</span>
            <span class="scale-item">Skip Supervisor 25%</span>
          </div>
        </div>
        <div class="scale-row">
          <div class="scale-label">JF Raters</div>
          <div class="scale-items">
            <span class="scale-item">Self + Immediate Supervisor + Skip Supervisor ÷ 3</span>
          </div>
        </div>
      </div>
    </div>

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
                <input v-model.number="createForm.fpoScore" type="number" step="0.01" min="1" max="5" class="field-input" placeholder="e.g. 4.25 (1–5 IPCRF scale)"/>
                <span style="font-size:10px;color:#94A3B8;margin-top:3px;display:block">Will be auto-converted to 4-pt IPAT scale. Leave blank to update later.</span>
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

    <!-- ══════════════════════ DETAIL MODAL ══════════════════════ -->
    <teleport to="body">
      <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
        <div class="modal modal-detail">

          <div class="modal-hd">
            <div>
              <div style="display:flex;gap:6px;margin-bottom:6px">
                <span :class="['status-badge', statusClass(activeRecord?.status)]">{{ activeRecord?.status }}</span>
                <span class="period-badge">S{{ activeRecord?.semester }} {{ activeRecord?.year }}</span>
              </div>
              <h3 class="modal-title">{{ activeRecord?.rateeName }}</h3>
              <p class="modal-sub">{{ activeRecord?.divisionName }} · {{ activeRecord?.position }}</p>
            </div>
            <button class="modal-close" @click="closeDetailModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>

          <!-- Score summary -->
          <div class="score-summary-bar">
            <div class="sscore">
              <div class="sscore-lbl">CBC (30%)</div>
              <div :class="['sscore-val', activeRecord?.cbcScore ? 'has-val' : '']">{{ activeRecord?.cbcScore || '—' }}</div>
            </div>
            <div class="sscore-op">+</div>
            <div class="sscore">
              <div class="sscore-lbl">FPO (55%)</div>
              <div :class="['sscore-val', activeRecord?.fpoScore ? 'has-val' : '']">{{ activeRecord?.fpoScore || '—' }}</div>
            </div>
            <div class="sscore-op">+</div>
            <div class="sscore">
              <div class="sscore-lbl">JF (15%)</div>
              <div :class="['sscore-val', activeRecord?.jfScore ? 'has-val' : '']">{{ activeRecord?.jfScore || '—' }}</div>
            </div>
            <div class="sscore-op">=</div>
            <div class="sscore sscore-overall">
              <div class="sscore-lbl">Overall</div>
              <div v-if="activeRecord?.overallScore" :class="['sscore-val', descriptorClass(activeRecord.descriptor)]" style="font-size:22px;font-weight:800">
                {{ activeRecord.overallScore }}
              </div>
              <div v-else class="sscore-val">—</div>
              <div v-if="activeRecord?.descriptor" :class="['sscore-desc', descriptorClass(activeRecord.descriptor)]">
                {{ activeRecord.descriptor }}
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="dtabs">
            <button :class="['dtab', activeTab === 'cbc' && 'active']" @click="activeTab = 'cbc'">A. Core Behavioral Competencies</button>
            <button :class="['dtab', activeTab === 'fpo' && 'active']" @click="activeTab = 'fpo'">B. Functional Performance Output</button>
            <button :class="['dtab', activeTab === 'jf'  && 'active']" @click="activeTab = 'jf'">C. Job Fitness</button>
          </div>

          <!-- ── CBC TAB ── -->
          <div v-if="activeTab === 'cbc'" class="modal-body-scroll">
            <div class="tab-intro">
              Rate each behavioral indicator using the <strong>1–4 Likert scale</strong>:
              <span class="scale-hint">1 = Rarely/Never · 2 = Sometimes · 3 = Most of the Time · 4 = Always</span>
            </div>

            <div class="rater-row">
              <div class="rater-selector">
                <span class="rater-label">Rating as:</span>
                <select v-model="cbcRaterType" class="field-input" style="width:220px">
                  <option value="Self">Self (15%)</option>
                  <option value="Peer">Peer (15% or 30% if no subordinate)</option>
                  <option value="Subordinate">Subordinate (15%)</option>
                  <option value="Supervisor">Immediate Supervisor (30%)</option>
                  <option value="SkipSupervisor">Skip Supervisor (25%)</option>
                </select>
              </div>
              <div class="has-sub-note">
                Subordinates: <strong>{{ activeRecord?.hasSubordinate ? 'Yes' : 'No' }}</strong>
                {{ !activeRecord?.hasSubordinate ? '— Peer weight is 30%' : '' }}
              </div>
            </div>

            <div v-for="theme in HEARTWORK_THEMES" :key="theme.id" class="theme-section">
              <div class="theme-hd">
                <div class="theme-hd-left">
                  <span class="theme-badge">{{ theme.label }}</span>
                  <span class="theme-desc">{{ theme.description }}</span>
                </div>
                <span v-if="themeAvg(theme.id)" class="theme-avg">Avg: {{ themeAvg(theme.id) }}</span>
              </div>
              <div class="indicator-list">
                <div v-for="(ind, idx) in theme.indicators" :key="idx" class="indicator-row">
                  <div class="ind-num">{{ idx + 1 }}</div>
                  <div class="ind-text">{{ ind }}</div>
                  <div class="ind-rating">
                    <button v-for="n in [1,2,3,4]" :key="n"
                      :class="['rating-btn', getCBCRating(theme.id, idx) === n && 'selected']"
                      @click="setCBCRating(theme.id, idx, n)">{{ n }}</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="action-bar">
              <button class="btn btn-primary" :disabled="savingCBC" @click="saveCBCRatings">
                <span v-if="savingCBC" class="spinner-sm"></span>
                {{ savingCBC ? 'Saving…' : 'Save CBC Ratings' }}
              </button>
              <button class="btn" :disabled="computingCBC" @click="computeCBC">
                {{ computingCBC ? 'Computing…' : 'Compute CBC Score' }}
              </button>
            </div>
          </div>

          <!-- ── FPO TAB ── -->
          <div v-if="activeTab === 'fpo'" class="modal-body-scroll">
            <div class="tab-intro">
              The <strong>Functional Performance Output</strong> domain uses the employee's
              <strong>IPCRF/DPCR Final Numerical Rating</strong> (1–5 scale) as the basis.
              It constitutes <strong>55%</strong> of the overall IPAT score.
            </div>

            <div class="fpo-panel">
              <div class="fpo-current">
                <div class="fpo-label">Current IPCRF Score (1–5 scale)</div>
                <div class="fpo-score">{{ activeRecord?.fpoScore || '—' }}</div>
                <div v-if="activeRecord?.fpoScore" class="fpo-converted">
                  Converted to 4-pt IPAT scale: <strong>{{ convertFPO(activeRecord.fpoScore) }}</strong>
                </div>
              </div>
              <div class="fpo-update">
                <label class="field-label">Update IPCRF Score</label>
                <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                  <input v-model.number="fpoInput" type="number" step="0.01" min="1" max="5" class="field-input" style="width:130px" placeholder="1.00–5.00"/>
                  <button class="btn btn-primary" :disabled="savingFPO" @click="saveFPO">
                    {{ savingFPO ? 'Saving…' : 'Update' }}
                  </button>
                </div>
                <span style="font-size:10px;color:#94A3B8;margin-top:4px;display:block">
                  Enter the IPCRF Final Numerical Rating from the DSPMS/IPCR form
                </span>
              </div>
            </div>

            <div class="fpo-formula">
              <div class="formula-label">Scale Conversion (IPCRF 5-pt → IPAT 4-pt)</div>
              <div class="formula-text">Converted = ((IPCRF Score − 1) ÷ 4) × 3 + 1</div>
              <div class="formula-examples">
                <span>5.00 → 4.00</span>
                <span>4.50 → 3.63</span>
                <span>4.00 → 3.25</span>
                <span>3.50 → 2.88</span>
                <span>3.00 → 2.50</span>
                <span>2.50 → 2.13</span>
              </div>
            </div>
          </div>

          <!-- ── JF TAB ── -->
          <div v-if="activeTab === 'jf'" class="modal-body-scroll">
            <div class="tab-intro">
              <strong>Job Fitness</strong> is rated by <strong>three raters</strong>:
              the Ratee (Self), Immediate Supervisor, and Skip Supervisor, in coordination with HR.
              Indicator Score = (Self + Supervisor + Skip Supervisor) ÷ 3
            </div>

            <div class="rater-selector" style="margin-bottom:16px">
              <span class="rater-label">Rating as:</span>
              <select v-model="jfRaterType" class="field-input" style="width:220px">
                <option value="Self">Self (Ratee)</option>
                <option value="Supervisor">Immediate Supervisor</option>
                <option value="SkipSupervisor">Skip Supervisor</option>
              </select>
            </div>

            <div class="jf-list">
              <div v-for="(ind, idx) in JF_INDICATORS" :key="idx" class="jf-row">
                <div class="jf-num">{{ idx + 1 }}</div>
                <div class="jf-info">
                  <div class="jf-label">{{ ind }}</div>
                  <input v-model="jfEvidence[idx]" type="text" class="jf-evidence" placeholder="Supporting evidence / document reference (optional)"/>
                </div>
                <div class="ind-rating">
                  <button v-for="n in [1,2,3,4]" :key="n"
                    :class="['rating-btn', getJFRating(idx) === n && 'selected']"
                    @click="setJFRating(idx, n)">{{ n }}</button>
                </div>
              </div>
            </div>

            <div class="action-bar">
              <button class="btn btn-primary" :disabled="savingJF" @click="saveJFRatings">
                <span v-if="savingJF" class="spinner-sm"></span>
                {{ savingJF ? 'Saving…' : 'Save Job Fitness Ratings' }}
              </button>
              <button class="btn" :disabled="computingJF" @click="computeJF">
                {{ computingJF ? 'Computing…' : 'Compute JF Score' }}
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn" @click="closeDetailModal">Close</button>
            <button class="btn btn-primary" :disabled="computingOverall" @click="computeOverall">
              <span v-if="computingOverall" class="spinner-sm"></span>
              {{ computingOverall ? 'Computing…' : 'Compute Overall Score' }}
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
import { ref, computed, onMounted } from 'vue'
import { ipatApi } from '@/services/api'
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

const showCreateModal = ref(false)
const showDetailModal = ref(false)
const activeRecord    = ref(null)
const activeTab       = ref('cbc')

const cbcRaterType = ref('Self')
const cbcRatings   = ref({})
const savingCBC    = ref(false)
const computingCBC = ref(false)

const fpoInput  = ref('')
const savingFPO = ref(false)

const jfRaterType = ref('Self')
const jfRatings   = ref({})
const jfEvidence  = ref({})
const savingJF    = ref(false)
const computingJF = ref(false)

const computingOverall = ref(false)
const toast = ref({ show: false, msg: '', type: 'success' })

const createForm = ref({
  semester: String(new Date().getMonth() < 6 ? 1 : 2),
  year: new Date().getFullYear(),
  fpoScore: '',
  hasSubordinate: false
})

const statusTabs = [
  { label: 'All',      value: 'All'      },
  { label: 'Draft',    value: 'Draft'    },
  { label: 'Computed', value: 'Computed' },
  { label: 'Final',    value: 'Final'    }
]

// ── Computed ──
const canCreate = computed(() =>
  ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief'].includes(authStore.role)
)

const filteredRecords = computed(() => {
  let r = records.value
  if (activeStatus.value !== 'All') r = r.filter(x => x.status === activeStatus.value)
  if (filterDiv.value) r = r.filter(x => x.divisionId === filterDiv.value)
  if (search.value) { const q = search.value.toLowerCase(); r = r.filter(x => (x.rateeName || '').toLowerCase().includes(q)) }
  return r
})

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

onMounted(loadRecords)

async function loadRecords() {
  loading.value = true
  try {
    const r = await ipatApi.list()
    records.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { showToast(`Could not load assessments: ${e.message}`, 'error') }
  finally { loading.value = false }
}

function openCreateModal() {
  createForm.value = { semester: String(new Date().getMonth() < 6 ? 1 : 2), year: new Date().getFullYear(), fpoScore: '', hasSubordinate: false }
  showCreateModal.value = true
}

async function createRecord() {
  if (!createForm.value.semester) { showToast('Semester is required', 'error'); return }
  creating.value = true
  try {
    const rec = await ipatApi.create(createForm.value)
    records.value.unshift(rec)
    showCreateModal.value = false
    showToast('Assessment record created')
    openDetailModal(rec)
  } catch (e) { showToast(e.message, 'error') }
  finally { creating.value = false }
}

function openDetailModal(rec) {
  activeRecord.value = rec
  activeTab.value    = 'cbc'
  cbcRatings.value   = {}
  jfRatings.value    = {}
  jfEvidence.value   = {}
  fpoInput.value     = rec.fpoScore || ''
  showDetailModal.value = true
}

function closeDetailModal() { showDetailModal.value = false; activeRecord.value = null }

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
        ratings.push({ themeId: theme.id, themeName: theme.label, indicatorIdx: idx, rating, raterType: cbcRaterType.value })
      }
    })
  })
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingCBC.value = true
  try {
    await ipatApi.saveCBCRatings(activeRecord.value.id, ratings)
    showToast(`${ratings.length} CBC ratings saved`)
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
async function saveFPO() {
  if (!fpoInput.value) { showToast('Enter an FPO score', 'error'); return }
  savingFPO.value = true
  try {
    await ipatApi.updateStatus(activeRecord.value.id, { fpoScore: fpoInput.value, status: activeRecord.value.status || 'Draft' })
    _syncRecord({ fpoScore: fpoInput.value })
    showToast('FPO score updated')
  } catch (e) { showToast(e.message, 'error') }
  finally { savingFPO.value = false }
}

// ── JF ──
async function saveJFRatings() {
  const ratings = JF_INDICATORS.map((_, idx) => ({
    // Only send minimal fields — full indicator text causes URL to exceed GAS limits
    indicatorIdx: idx,
    rating: getJFRating(idx) || 1,
    evidence: jfEvidence.value[idx] || '',
    raterType: jfRaterType.value
  })).filter((_, idx) => getJFRating(idx) !== null)
  if (!ratings.length) { showToast('Please rate at least one indicator', 'error'); return }
  savingJF.value = true
  try {
    await ipatApi.saveJFRatings(activeRecord.value.id, ratings)
    showToast(`${ratings.length} Job Fitness ratings saved`)
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
</script>

<style>
.eval-page{padding:24px 32px 40px 24px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;color:#1A2332;min-height:100%;}
.page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
.page-title{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 3px;}
.page-sub{font-size:12px;color:#94A3B8;margin:0;}

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
.status-tab{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;font-family:inherit;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.filter-right{display:flex;gap:8px;align-items:center;}
.srch-wrap{position:relative;}
.srch-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;}
.srch-inp{padding:7px 11px 7px 28px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;width:200px;background:#fff;}
.filter-select{padding:7px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:inherit;color:#374151;background:#fff;outline:none;cursor:pointer;}

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

/* Scale card */
.scale-card{background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;}
.scale-title{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;}
.scale-grid{display:flex;flex-direction:column;gap:8px;}
.scale-row{display:flex;align-items:flex-start;gap:12px;}
.scale-label{font-size:11px;font-weight:600;color:#374151;width:200px;flex-shrink:0;}
.scale-items{display:flex;gap:8px;flex-wrap:wrap;}
.scale-item{font-size:11px;color:#64748B;padding:2px 8px;background:#F8FAFC;border-radius:6px;}

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
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-family:inherit;font-weight:500;}
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
.dtabs{display:flex;padding:0 24px;border-bottom:1px solid #E8EDF3;flex-shrink:0;overflow-x:auto;}
.dtab{padding:10px 14px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:#64748B;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit;transition:all .15s;white-space:nowrap;}
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
.rating-btn{width:32px;height:32px;border-radius:6px;border:1.5px solid #E2E8F0;background:#fff;font-size:12px;font-weight:600;color:#94A3B8;cursor:pointer;transition:all .12s;font-family:inherit;}
.rating-btn:hover{border-color:#1A56B0;color:#1A56B0;}
.rating-btn.selected{background:#1A56B0;color:#fff;border-color:#1A56B0;}
.action-bar{display:flex;gap:8px;padding-top:14px;border-top:1px solid #F1F5F9;margin-top:8px;}

/* FPO tab */
.fpo-panel{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;}
.fpo-current{background:#F8FAFC;border:1px solid #F1F5F9;border-radius:10px;padding:16px;text-align:center;}
.fpo-label{font-size:11px;font-weight:600;color:#94A3B8;margin-bottom:8px;}
.fpo-score{font-size:36px;font-weight:800;color:#0F172A;line-height:1;}
.fpo-converted{font-size:11px;color:#64748B;margin-top:6px;}
.fpo-update{display:flex;flex-direction:column;}
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
.jf-evidence{width:100%;padding:5px 9px;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;font-family:inherit;color:#64748B;outline:none;}
.jf-evidence:focus{border-color:#6B3FA0;}

/* Form fields */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.field-input{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:inherit;color:#0F172A;background:#fff;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.toggle-row{display:flex;gap:8px;}
.toggle-btn{flex:1;padding:10px;border:1.5px solid #E2E8F0;border-radius:9px;cursor:pointer;font-size:12px;font-family:inherit;background:#fff;color:#374151;transition:all .15s;}
.toggle-btn.active{border-color:#3B82F6;background:#EBF4FF;color:#1A56B0;font-weight:600;}

/* Spinner */
.spinner-sm{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999;pointer-events:none;}
.toast-error{background:#EB5757;}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}
</style>