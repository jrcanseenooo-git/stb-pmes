<template>
  <div class="content">

    <section class="page-panel">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Administration</p>
          <h1>User Management</h1>
          <p class="page-subtitle">Maintain accounts, reviewer routing, and temporary access credentials.</p>
        </div>
        <div class="top-actions">
          <button v-if="canManageFocalAssignments" class="btn btn-secondary" @click="toggleFocalPanel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M4 7h6M6 10.5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Focal Assignments
          </button>
          <button v-if="canManageDatabase" class="btn btn-secondary" @click="toggleMaintenancePanel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 2.5h8M3 7h8M3 11.5h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M5 1.5v2M9 6v2M6 10.5v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Database Maintenance
          </button>
          <button v-if="canManageUsers" class="btn btn-primary" @click="openAddModal">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1 12c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M10 3v4M12 5H8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span>Total users</span>
          <strong>{{ users.length }}</strong>
        </div>
        <div class="summary-item">
          <span>Active</span>
          <strong>{{ activeUsersCount }}</strong>
        </div>
        <div class="summary-item">
          <span>Review roles</span>
          <strong>{{ reviewerUsersCount }}</strong>
        </div>
        <div class="summary-item">
          <span>Inactive</span>
          <strong>{{ inactiveUsersCount }}</strong>
        </div>
      </div>

      <div v-if="canManageUsers" class="access-mode-strip">
        <div class="access-mode-copy">
          <span>System Access Mode</span>
          <strong>{{ accessModeLabel }}</strong>
          <p>{{ accessModeDescription }}</p>
        </div>
        <div class="access-mode-controls">
          <label
            v-for="mode in systemAccessModes"
            :key="mode.value"
            :class="['access-mode-option', systemAccessMode === mode.value && 'is-selected']"
          >
            <input v-model="systemAccessMode" type="radio" :value="mode.value" />
            <span>{{ mode.label }}</span>
          </label>
          <button class="btn btn-primary" :disabled="systemSettingsSaving || systemSettingsLoading" @click="saveSystemSettings">
            {{ systemSettingsSaving ? 'Saving...' : 'Save Mode' }}
          </button>
        </div>
      </div>

      <div class="control-strip">
        <div class="search-box">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
            <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <input v-model="search" type="text" placeholder="Search name, email, role, division..."/>
        </div>
        <select v-model="roleFilter" class="filter-select">
          <option value="">All roles</option>
          <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
        </select>
        <select v-model="statusFilter" class="filter-select">
          <option value="">All status</option>
          <option value="Pending">Pending activation{{ pendingUsersCount ? ` (${pendingUsersCount})` : '' }}</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
    </section>

    <div v-if="canManageFocalAssignments && showFocalPanel" class="card focal-card">
      <div class="focal-panel-hd">
        <div>
          <span class="card-title">Review Routing</span>
        </div>
        <span class="badge badge-blue">{{ focalLoading ? 'Loading...' : 'Focal Assignments' }}</span>
      </div>

      <div class="focal-routing-shell">
        <aside class="focal-route-card focal-bureau">
          <div class="route-card-top">
            <div>
              <h3>Bureau Focal</h3>
              <p>Bureau-wide review focal</p>
            </div>
          </div>
          <div class="focal-slot">
            <span class="focal-slot-label"><i class="dot"></i>Primary</span>
            <SearchSelect
              v-model="bureauFocals.primaryUserId"
              :options="focalUsers"
              placeholder="Search primary bureau focal..."
            />
          </div>
          <div class="focal-slot">
            <span class="focal-slot-label is-alt"><i class="dot"></i>Alternate</span>
            <SearchSelect
              v-model="bureauFocals.alternateUserId"
              :options="focalUsers"
              placeholder="Search alternate bureau focal..."
            />
          </div>
        </aside>

        <section class="division-route-panel">
          <div class="route-table-head">
            <span>Division</span>
            <span>Primary Focal</span>
            <span>Alternate Focal</span>
          </div>
          <div class="division-route-list">
            <div v-for="item in divisionFocalRows" :key="item.divisionId" class="division-route-row">
              <div class="division-route-name">
                <!-- <div class="route-icon route-icon-sm">{{ divisionInitials(item.divisionName) }}</div> -->
                <div>
                  <div class="focal-division">{{ item.divisionName }}</div>
                  <div class="text-xs muted">IPCRF/CCEF checker and reviewer</div>
                </div>
              </div>
              <div class="focal-slot">
                <span class="focal-slot-label compact"><i class="dot"></i>Primary</span>
                <SearchSelect
                  v-model="item.primaryUserId"
                  :options="focalUsersForDivision(item.divisionId)"
                  placeholder="Search primary focal..."
                />
              </div>
              <div class="focal-slot">
                <span class="focal-slot-label compact is-alt"><i class="dot"></i>Alternate</span>
                <SearchSelect
                  v-model="item.alternateUserId"
                  :options="focalUsersForDivision(item.divisionId)"
                  placeholder="Search alternate focal..."
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="focal-actions">
        <button class="btn" @click="loadFocalAssignments" :disabled="focalLoading || focalSaving">Refresh</button>
        <button class="btn btn-primary" @click="saveFocalAssignments" :disabled="focalLoading || focalSaving">
          {{ focalSaving ? 'Saving...' : 'Save Assignments' }}
        </button>
      </div>
    </div>

    <div v-if="canManageDatabase && showMaintenancePanel" class="card maintenance-card">
      <div class="maintenance-hd">
        <div>
          <span class="card-title">Database Maintenance</span>
          <h2>Fresh Schema Rebuild</h2>
          <p>Clear test/transactional records, repair table order, and keep core setup data intact.</p>
        </div>
        <span :class="['maintenance-state', maintenancePreview ? 'ready' : 'idle']">
          {{ maintenanceLoading ? 'Checking...' : maintenancePreview ? 'Preview ready' : 'Not checked' }}
        </span>
      </div>

      <div class="maintenance-body">
        <div class="maintenance-summary">
          <div class="maintenance-pill keep">
            <span>Preserve data</span>
            <strong>{{ maintenancePreview?.preservedDataSheets?.length || 3 }}</strong>
          </div>
          <div class="maintenance-pill rebuild">
            <span>Rebuild sheets</span>
            <strong>{{ maintenancePreview?.finalSheetOrder?.length || '-' }}</strong>
          </div>
          <div class="maintenance-pill remove">
            <span>Remove unused</span>
            <strong>{{ maintenancePreview?.removeSheets?.length ?? '-' }}</strong>
          </div>
        </div>

        <div class="maintenance-grid">
          <section class="maintenance-box safe">
            <h3>Data kept</h3>
            <p>Rows in these setup tables will remain.</p>
            <div class="chip-list">
              <span v-for="name in preservedSheetNames" :key="name" class="schema-chip keep">{{ name }}</span>
            </div>
          </section>

          <section class="maintenance-box">
            <h3>System tables rebuilt</h3>
            <p>These tabs keep headers only, in the correct sequence.</p>
            <div class="chip-list scroll">
              <span v-for="name in rebuiltSheetNames" :key="name" class="schema-chip">{{ name }}</span>
            </div>
          </section>

          <section class="maintenance-box danger">
            <h3>Unused tabs removed</h3>
            <p>Only non-active legacy tables are removed.</p>
            <div class="chip-list">
              <span v-if="!maintenancePreview" class="schema-chip muted-chip">Run preview first</span>
              <span v-else-if="!maintenancePreview.removeSheets?.length" class="schema-chip muted-chip">None</span>
              <span v-for="name in maintenancePreview?.removeSheets || []" :key="name" class="schema-chip remove">{{ name }}</span>
            </div>
          </section>
        </div>

        <div class="maintenance-warning">
          <strong>Backup first.</strong>
          The rebuild creates a backup copy before changing the database. After rebuild, forms, accomplishments, reviews, notifications, audit rows, and generated document links are cleared.
        </div>
      </div>

      <div class="maintenance-actions">
        <button class="btn" @click="previewMaintenance" :disabled="maintenanceLoading || maintenanceRunning">
          {{ maintenanceLoading ? 'Checking...' : 'Preview Fresh Schema' }}
        </button>
        <button class="btn btn-danger-solid" @click="rebuildFreshDatabase" :disabled="!maintenancePreview || maintenanceLoading || maintenanceRunning">
          {{ maintenanceRunning ? 'Rebuilding...' : 'Rebuild Fresh Database' }}
        </button>
      </div>
    </div>

    <!-- Table card -->
    <div class="card user-card">
      <div class="card-hd user-card-hd">
        <div>
          <span class="card-title">Accounts</span>
          <p class="card-subtitle">{{ loading ? 'Showing ...' : paginationSummary }}</p>
        </div>
        <span class="badge badge-blue">{{ loading ? 'Loading...' : filteredUsers.length + ' shown' }}</span>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Division</th>
              <th>Section</th>
              <th v-if="canManageUsers">Temp Password</th>
              <th>Status</th>
              <!-- <th>Last Login</th> -->
              <th v-if="canAdministerUsers">Actions</th>
            </tr>
          </thead>
          <tbody>

            <!-- ── Skeleton rows while loading ── -->
            <template v-if="loading">
              <tr v-for="i in 5" :key="'sk'+i" class="skeleton-row">
                <td>
                  <div class="sk-user">
                    <div class="sk-av"></div>
                    <div>
                      <div class="sk-line" style="width:110px;margin-bottom:5px"></div>
                      <div class="sk-line" style="width:70px;height:9px"></div>
                    </div>
                  </div>
                </td>
                <td><div class="sk-line" style="width:140px"></div></td>
                <td><div class="sk-pill"></div></td>
                <td><div class="sk-line" style="width:120px"></div></td>
                <td><div class="sk-line" style="width:120px"></div></td>
                <td v-if="canManageUsers"><div class="sk-line" style="width:80px"></div></td>
                <td><div class="sk-pill" style="width:55px"></div></td>
                <!-- <td><div class="sk-line" style="width:60px"></div></td> -->
                <td v-if="canAdministerUsers"><div class="sk-actions"></div></td>
              </tr>
            </template>

            <!-- ── Real data rows ── -->
            <template v-else>
              <tr v-for="(u, i) in pagedUsers" :key="u.id || u.email" :class="i % 2 === 1 ? 'stripe' : ''">
                <td>
                  <div class="user-cell">
                    <div class="av" :style="{ background: u.avatarColor }">{{ u.initials }}</div>
                    <div>
                      <div class="user-name">{{ u.name }}</div>
                      <div class="user-meta">{{ u.employeeNo || 'No employee no.' }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-xs muted">{{ u.email }}</td>
                <td><span :class="['role-badge', roleBadgeClass(u.role)]">{{ u.role }}</span></td>
                <td class="text-xs muted">{{ u.division || '-' }}</td>
                <td class="text-xs muted">{{ u.section || '-' }}</td>
                <td v-if="canManageUsers">
                  <div class="flex-row gap-6" v-if="u.tempPassword">
                    <code class="temp-pw">{{ showPw[u.email] ? u.tempPassword : '••••••••' }}</code>
                    <button class="icon-btn-sm" @click="togglePw(u.email)" title="Toggle">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <ellipse cx="6" cy="6" rx="5" ry="3" stroke="#94A3B8" stroke-width="1.2"/>
                        <circle cx="6" cy="6" r="1.5" fill="#94A3B8"/>
                      </svg>
                    </button>
                    <button class="icon-btn-sm" @click="copyPw(u.tempPassword)" title="Copy">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="4" y="4" width="7" height="7" rx="1" stroke="#94A3B8" stroke-width="1.2"/>
                        <path d="M8 4V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1H3.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <span v-if="copied" class="copied-tag">Copied!</span>
                  </div>
                  <span v-else class="text-xs muted">-</span>
                </td>
                <td v-if="canAdministerUsers">
                  <span :class="['status-badge', u.status === 'Active' ? 's-green' : u.status === 'Pending' ? 's-amber' : 's-red']">
                    {{ u.status === 'Pending' ? 'Pending' : u.status }}
                  </span>
                  <div v-if="u.status === 'Pending' && u.requestedRole" class="req-role-hint">wants: {{ u.requestedRole }}</div>
                </td>
                <!-- <td class="text-xs muted">{{ u.lastLogin }}</td> -->
                <td>
                  <div class="action-group">
                    <button class="icon-btn-sm" @click="openEditModal(u)" title="Edit">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 9.5L7.5 3l1.5 1.5L2.5 11H1V9.5z" stroke="#64748B" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6.5 4l1.5-1.5 1.5 1.5L8 5.5" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <template v-if="u.status === 'Pending'">
                      <button class="btn btn-xs approve" :disabled="busyUserId === u.id" @click="activateUser(u)">
                        <span v-if="busyUserId === u.id" class="spinner-xs"></span>{{ busyUserId === u.id ? 'Approving…' : 'Approve' }}
                      </button>
                      <button class="btn btn-xs deactivate" :disabled="busyUserId === u.id" @click="declineUser(u)">Decline</button>
                    </template>
                    <button v-else-if="u.status === 'Inactive'" class="btn btn-xs activate" :disabled="busyUserId === u.id" @click="activateUser(u)">
                      <span v-if="busyUserId === u.id" class="spinner-xs"></span>{{ busyUserId === u.id ? 'Activating…' : 'Activate' }}
                    </button>
                    <button v-else-if="u.status === 'Active'" class="btn btn-xs deactivate" :disabled="busyUserId === u.id" @click="deactivateUser(u)">
                      <span v-if="busyUserId === u.id" class="spinner-xs"></span>{{ busyUserId === u.id ? 'Saving…' : 'Deactivate' }}
                    </button>
                    <button v-if="canManageUsers" class="icon-btn-sm danger" @click="resetPassword(u)" title="Reset password">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <button v-if="canManageUsers" class="icon-btn-sm danger" :disabled="busyUserId === u.id" title="Delete permanently" @click="deleteUser(u)">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && !filteredUsers.length">
                <td :colspan="usersTableColspan" class="empty-row">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="margin:0 auto 8px;display:block">
                    <circle cx="16" cy="16" r="14" stroke="#E2E8F0" stroke-width="2"/>
                    <path d="M11 16h10M16 11v10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  No users found.
                </td>
              </tr>
            </template>

          </tbody>
        </table>
      </div>
      <div v-if="!loading && filteredUsers.length" class="pagination-bar">
        <div class="pagination-meta">
          <span>{{ pageRangeLabel }}</span>
          <label class="page-size-control">
            <span>Rows</span>
            <select v-model.number="pageSize" class="page-size-select">
              <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
            </select>
          </label>
        </div>
        <div class="pagination-controls">
          <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(1)" title="First page">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M7.5 3L4 6.5L7.5 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 3L6.5 6.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)" title="Previous page">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8 3L4.5 6.5L8 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="page-indicator">Page {{ currentPage }} of {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)" title="Next page">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5 3L8.5 6.5L5 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(totalPages)" title="Last page">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5.5 3L9 6.5L5.5 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 3L6.5 6.5L3 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════
         ADD / EDIT USER MODAL - redesigned
         ══════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">

          <!-- Header with colored stripe -->
          <div class="modal-hd">
            <div class="modal-hd-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.6"/>
                <path d="M2 17c0-4 3-7 7-7s7 3 7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <template v-if="!editingUser">
                  <path d="M14 2v5M16.5 4.5H11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </template>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingUser ? 'Edit User' : 'Add New User' }}</h3>
              <p class="modal-sub">{{ editingUser ? 'Update account details and permissions' : 'Create a new PMES account' }}</p>
            </div>
            <button class="modal-close" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">

            <!-- Section: Identity -->
            <div class="form-section">
              <div class="form-section-label">Identity</div>
              <div class="form-grid">
                <div class="field full">
                  <label class="field-label">Full Name <span class="req">*</span></label>
                  <input v-model="form.fullName" class="field-input" placeholder="Juan Dela Cruz"/>
                </div>
                <div class="field full">
                  <label class="field-label">Email Address <span class="req">*</span></label>
                  <div class="input-icon-wrap">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1" y="3" width="11" height="8" rx="1.5" stroke="#94A3B8" stroke-width="1.2"/>
                      <path d="M1 4l5.5 3.5L12 4" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <input v-model="form.email" type="email" class="field-input has-icon"
                      placeholder="juan.delacruz@dswd.gov.ph" :disabled="!!editingUser"/>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section: Access -->
            <div class="form-section">
              <div class="form-section-label">Access & Assignment</div>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">Role <span class="req">*</span></label>
                  <select v-model="form.role" class="field-select">
                    <option value="">Select role…</option>
                    <option v-for="role in userFormRoleOptions" :key="role">{{ role }}</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">Division</label>
                  <select v-model="form.division" class="field-select">
                    <option value="">Select division…</option>
                    <option v-for="division in selectedOfficeDivisions" :key="division.id || division.name" :value="division.name">
                      {{ division.name }}
                    </option>
                  </select>
                </div>
                <div class="field full">
                  <label class="field-label">Section <span v-if="roleRequiresSection" class="req">*</span></label>
                  <select v-model="form.section" class="field-select" :disabled="!form.division">
                    <option value="">{{ form.division ? sectionSelectPlaceholder : 'Select division first…' }}</option>
                    <option v-for="section in sectionsForSelectedDivision" :key="section.id" :value="section.name">
                      {{ section.name }}
                    </option>
                  </select>
                  <p v-if="!roleRequiresSection && form.role" class="field-help">
                    Optional for this role - it oversees the whole division or office rather than a single section.
                  </p>
                </div>
                <div v-if="canManageUsers" class="field">
                  <label class="field-label">System Scope</label>
                  <select v-model="form.systemScope" class="field-select">
                    <option v-for="opt in systemScopeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                  <p class="field-help">{{ systemScopeDescription }}</p>
                  <div v-if="form.systemScope === 'CLUSTER_ADMIN'" class="access-group-warning" style="margin-top:6px;">
                    This scope alone grants no abilities - provisioning, monitoring, etc. still come from the
                    <strong>Access Groups</strong> checked below (the Cluster / Central Administration section).
                  </div>
                </div>
                <div v-if="canManageUsers" class="field">
                  <label class="field-label">Office</label>
                  <select v-model="form.officeId" class="field-select" :disabled="form.systemScope === 'STB_FULL' || !officeOptions.length">
                    <option value="STB">Social Technology Bureau</option>
                    <option v-for="office in officeOptions" :key="office.officeId" :value="office.officeId">
                      {{ office.officeName }}
                    </option>
                  </select>
                  <p class="field-help">{{ officeFieldHelp }}</p>
                </div>
                <div v-if="canManageUsers" class="field full">
                  <label class="field-label">Access Groups</label>
                  <p class="field-help" style="margin-bottom:10px;">
                    Groups add system permissions without changing the user's official role. Most accounts need none of these -
                    only check a box if this specific person needs the extra ability it describes.
                  </p>

                  <div class="access-group-subhead">STB Bureau Access</div>
                  <p class="access-group-subnote">Adds abilities within the Social Technology Bureau's own scope.</p>
                  <div class="access-group-grid">
                    <label v-for="group in stbAccessGroupOptions" :key="group.value" class="access-group-option">
                      <input v-model="form.permissionGroups" type="checkbox" :value="group.value"/>
                      <span>
                        <strong>{{ group.label }}</strong>
                        <small>{{ group.description }}</small>
                      </span>
                    </label>
                  </div>

                  <details class="cluster-group-disclosure" :open="hasClusterGroupSelected">
                    <summary class="access-group-subhead">Cluster / Central Administration</summary>
                    <div class="access-group-warning">
                      <strong>These are cross-office, not scoped to one office.</strong>
                      To restrict an account to managing only its own office, use
                      <strong>System Scope → Office Admin Portal</strong> above instead - do not check a box here for that.
                      Checking any of these gives visibility or control across every participating office.
                    </div>
                    <div class="access-group-grid">
                      <label v-for="group in clusterAccessGroupOptions" :key="group.value" class="access-group-option">
                        <input v-model="form.permissionGroups" type="checkbox" :value="group.value"/>
                        <span>
                          <strong>{{ group.label }}</strong>
                          <small>{{ group.description }}</small>
                        </span>
                      </label>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <!-- Section: Profile -->
            <div class="form-section">
              <div class="form-section-label">Profile Details</div>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">Position / Title</label>
                  <input v-model="form.position" class="field-input" placeholder="e.g. Social Welfare Officer II"/>
                </div>
                <div class="field">
                  <label class="field-label">Employee No.</label>
                  <input v-model="form.employeeNo" class="field-input" placeholder="24-0247"/>
                </div>
                <div class="field">
                  <label class="field-label">Employment Type</label>
                  <!-- Options come from the shared list so this screen cannot
                       write a spelling registration does not use. A retired
                       value already on the record is appended by
                       employmentTypeOptions() so it stays visible. -->
                  <select v-model="form.type" class="field-select">
                    <option v-for="t in employmentTypeOptions(form.type)" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Section: Temp Password (add only) -->
            <div v-if="!editingUser" class="form-section pw-section">
              <div class="pw-section-hd">
                <div>
                  <div class="form-section-label" style="margin-bottom:2px">Temporary Password</div>
                  <div class="pw-section-note">Auto-generated. User must change on first login.</div>
                </div>
                <button class="btn btn-sm" @click="regeneratePassword" type="button">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                  Regenerate
                </button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ form.tempPassword }}</code>
                <button class="icon-btn-sm" @click="copyPw(form.tempPassword)" type="button" title="Copy">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2"/>
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span v-if="copied" class="copied-tag">Copied!</span>
              </div>
            </div>

          </div><!-- /modal-body -->

          <div class="modal-footer">
            <button class="btn" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="saveUser" :disabled="saving">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ── RESET PASSWORD MODAL ── -->
    <transition name="modal-fade">
      <div v-if="showResetModal" class="modal-overlay" @click.self="showResetModal = false">
        <div class="modal modal-sm">
          <div class="modal-hd">
            <div class="modal-hd-icon modal-hd-icon--warn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 6a7 7 0 0112.5-3M16 6a7 7 0 01-12.5 9M16 4v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Reset Password</h3>
              <p class="modal-sub">New temporary password for <strong>{{ resetTarget?.name }}</strong></p>
            </div>
            <button class="modal-close" @click="showResetModal = false">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="pw-section-inner">
              <div class="pw-section-hd">
                <span class="form-section-label">New Temporary Password</span>
                <button class="btn btn-sm" @click="resetTempPw = generatePassword()" type="button">Regenerate</button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ resetTempPw }}</code>
                <button class="icon-btn-sm" @click="copyPw(resetTempPw)" type="button">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2"/>
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span v-if="copied" class="copied-tag">Copied!</span>
              </div>
            </div>
            <div class="access-group-warning" style="margin-top:10px;">
              Copy this now - the system never stores the plain-text password, only a hash.
              Once you apply the reset, this is the only place it will ever be shown; the Temp
              Password column reflects it only until this page is next refreshed.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" :disabled="resettingPw" @click="showResetModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="resettingPw" @click="confirmReset">
              {{ resettingPw ? 'Applying...' : 'Apply Reset' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
        <svg v-if="toast.type === 'success'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ toast.msg }}
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, h, onMounted, watch } from 'vue'
import { usersApi, focalAssignmentsApi, maintenanceApi, systemSettingsApi, officeRegistryApi } from '@/services/api'
import { useConfirm, CONFIRMS } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'
import { useOrgOptions } from '@/composables/useOrgOptions'
import { useAuthStore } from '@/stores/auth'
import { employmentTypeOptions } from '@/utils/employmentTypes'

// Split into two groups because they answer two different questions, and
// mixing them in one flat grid is what made "10 checkboxes, no idea which one"
// confusing. STB groups add abilities WITHIN the bureau's own scope - safe
// defaults for STB staff. Cluster groups add abilities ACROSS every
// participating office and are rarely what a new account needs; checking one
// of these for someone who should only manage their own office is the most
// common mistake this form invites; System Scope -> Office Admin Portal is
// the correct tool for that instead.
const stbAccessGroupOptions = [
  {
    value: 'system-admin',
    label: 'System Admin Group',
    description: 'Full system controls including users, libraries, monitoring, and database tools.'
  },
  {
    value: 'bureau-monitor',
    label: 'Bureau Monitoring',
    description: 'Can oversee bureau-wide monitoring and audit-style views.'
  },
  {
    value: 'division-monitor',
    label: 'Division Monitoring',
    description: 'Can oversee records within the assigned division.'
  },
  {
    value: 'library-manager',
    label: 'Library Manager',
    description: 'Can maintain KRA library and assessment content.'
  },
  {
    value: 'user-manager',
    label: 'User Manager',
    description: 'Can maintain users and focal assignments.'
  },
  {
    value: 'evaluation-manager',
    label: 'Evaluation Manager',
    description: 'Can generate and monitor IPAT evaluation assignments.'
  }
]

const clusterAccessGroupOptions = [
  {
    value: 'cluster-system-admin',
    label: 'Cluster System Admin',
    description: 'Can manage office registry, provisioning, validation, and cluster monitoring.'
  },
  {
    value: 'cluster-technical-admin',
    label: 'Cluster Technical Admin',
    description: 'Can provision and validate office assessment spreadsheets.'
  },
  {
    value: 'cluster-assessment-admin',
    label: 'Cluster Assessment Admin',
    description: 'Can manage assessment content and monitor participating offices.'
  },
  {
    value: 'cluster-monitoring-admin',
    label: 'Cluster Monitoring Admin',
    description: 'Can monitor participating offices without provisioning access.'
  }
]

const hasClusterGroupSelected = computed(() =>
  clusterAccessGroupOptions.some(g => (form.value.permissionGroups || []).includes(g.value))
)

// Same fix as Access Groups: the difference between these four was only ever
// explained in chat, not in the form itself, so it had to be re-explained
// every time someone hit this screen. Putting the description at the point of
// decision means it doesn't need to be remembered or asked about again.
const systemScopeOptions = [
  {
    value: 'STB_FULL',
    label: 'STB Full PMES',
    description: 'The complete original PMES for Social Technology Bureau - Dashboard, KRA, IPCRF/CCEF, Accomplishments, Evaluation, Reports. Always uses the central STB spreadsheet, never an office one.'
  },
  {
    value: 'CLUSTER_PORTAL',
    label: 'Innovation Cluster Portal',
    description: 'Restricted personnel screens only - My Dashboard, My Rating Tasks, My Results, Assessment Library. No KRA, no admin screens. This is what self-registration into a participating office sets automatically.'
  },
  {
    value: 'OFFICE_ADMIN',
    label: 'Office Admin Portal',
    description: 'Everything Cluster Portal gets, plus office-scoped admin screens (Personnel Validation, Office Dashboard, Rater Tagging) - strictly limited to the Office selected on the right. Use this to make someone an administrator of one office only.'
  },
  {
    value: 'CLUSTER_ADMIN',
    label: 'Central Cluster Admin',
    description: 'Opts out of the "STB is the only full scope" default so cross-office screens (Cluster Overview, Office Registry) become reachable - but grants no ability by itself. What this account can actually do still depends on which Access Groups are checked below.'
  }
]

const systemScopeDescription = computed(() =>
  systemScopeOptions.find(o => o.value === form.value.systemScope)?.description || ''
)

const search        = ref('')
const roleFilter    = ref('')
const statusFilter  = ref('')
const currentPage   = ref(1)
const pageSize      = ref(10)
const pageSizeOptions = [10, 25, 50]
const showModal     = ref(false)
const showResetModal = ref(false)
const resettingPw    = ref(false)
const showFocalPanel = ref(false)
const showMaintenancePanel = ref(false)
const editingUser   = ref(null)
const resetTarget   = ref(null)
const resetTempPw   = ref('')
const saving        = ref(false)
const loading       = ref(false)
const focalLoading  = ref(false)
const focalSaving   = ref(false)
const copied        = ref(false)
const showPw        = ref({})
const toast         = ref({ show: false, msg: '', type: 'success' })
const users         = ref([])
const officeOptions = ref([])
const officeOptionsError = ref(false)
// Backend paginate() defaults to 50; this view shows the whole directory at once,
// so ask for a ceiling well above any realistic office headcount. If the cluster
// ever exceeds this, loadUsers() warns instead of truncating silently.
const USERS_PAGE_SIZE = 2000
// Which row is mid-write. Approving hits Apps Script AND the Firebase Admin API,
// so it is measured in seconds - without this the admin clicked Approve and saw
// nothing change, with no way to tell whether it had registered.
const busyUserId = ref('')
const focalUsers    = ref([])
const divisionFocalRows = ref([])
const bureauFocals = ref({ primaryUserId: '', alternateUserId: '' })
const maintenanceLoading = ref(false)
const maintenanceRunning = ref(false)
const maintenancePreview = ref(null)
const systemSettingsLoading = ref(false)
const systemSettingsSaving = ref(false)
const systemAccessMode = ref('evaluation_only')
const systemAccessModes = ref([
  {
    value: 'evaluation_only',
    label: 'Evaluation Monitoring only',
    description: 'Regular users can only access Evaluation and Profile Settings. Hidden module links redirect to Evaluation.'
  },
  {
    value: 'full_access',
    label: 'Full module access',
    description: 'Users can access the modules allowed by their role and permissions.'
  }
])
const { canManageUsers, canManageOfficeUsers, canManageFocalAssignments, canManageDatabase } = usePermissions()
const { confirm, confirmState } = useConfirm()
const authStore = useAuthStore()
const { loadOrgOptions, optionsForOffice } = useOrgOptions()
const activeUsersCount = computed(() => users.value.filter(u => u.status === 'Active').length)
const inactiveUsersCount = computed(() => users.value.filter(u => u.status === 'Inactive').length)
const pendingUsersCount = computed(() => users.value.filter(u => u.status === 'Pending').length)
const canAdministerUsers = computed(() => canManageUsers.value || canManageOfficeUsers.value)
const usersTableColspan = computed(() => 6 + (canManageUsers.value ? 1 : 0) + (canAdministerUsers.value ? 1 : 0))
/**
 * Roles offered when editing an account.
 *
 * Drawn from the SELECTED OFFICE's own configuration, the same source the
 * Division and Section selects beside it already use. This was a hardcoded
 * Bureau ladder, so an administrator editing someone in a participating office
 * was offered STB roles that office does not use - and could not assign the
 * roles it does.
 *
 * The Bureau ladder remains the fallback for STB and for any office that has
 * not configured its own roles yet.
 */
const userFormRoleOptions = computed(() => {
  const STB_ROLES = ['Bureau Director', 'Assistant Bureau Director', 'Division Chief', 'Section Head', 'Technical Staff']
  const configured = selectedOfficeOrgOptions.value.requestedRoles || []
  const base = configured.length ? [...configured] : STB_ROLES
  const roles = canManageUsers.value ? ['System Administrator', ...base] : base

  // The role this person already holds, and the one they asked for at
  // registration, must always be selectable. Otherwise a pending request for a
  // role outside the configured list - 'Undersecretary', say - cannot be
  // approved from this screen at all, and editing an existing account would
  // silently blank a role that is not on the list.
  const pinned = [form.value.role, form.value.requestedRole].filter(Boolean)
  return [...new Set([...roles, ...pinned])]
})
const reviewerUsersCount = computed(() => users.value.filter(u =>
  ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief', 'Section Head'].includes(u.role)
).length)
const roleOptions = computed(() => [...new Set(users.value.map(u => u.role).filter(Boolean))].sort())
const preservedSheetNames = computed(() =>
  maintenancePreview.value?.preservedDataSheets || ['Users', 'Divisions', 'MasterKRALibrary']
)
const rebuiltSheetNames = computed(() => {
  const preserved = new Set(preservedSheetNames.value)
  return (maintenancePreview.value?.finalSheetOrder || []).filter(name => !preserved.has(name))
})
const accessModeLabel = computed(() =>
  systemAccessModes.value.find(mode => mode.value === systemAccessMode.value)?.label || 'Evaluation Monitoring only'
)
const accessModeDescription = computed(() =>
  systemAccessModes.value.find(mode => mode.value === systemAccessMode.value)?.description || ''
)

const SearchSelect = {
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Search and select...' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const query = ref('')
    const open = ref(false)
    const selected = computed(() => props.options.find(o => o.id === props.modelValue) || null)
    const filtered = computed(() => {
      const q = query.value.toLowerCase().trim()
      return props.options
        .filter(o => !q ||
          String(o.fullName || '').toLowerCase().includes(q) ||
          String(o.role || '').toLowerCase().includes(q) ||
          String(o.divisionName || '').toLowerCase().includes(q) ||
          String(o.email || '').toLowerCase().includes(q)
        )
        .slice(0, 40)
    })

    // Closed-state text is just the name - full role/division shows in the
    // tooltip and in the dropdown itself, so a long title never has to be
    // crammed into a ~200px box.
    watch(() => props.modelValue, () => {
      query.value = selected.value ? selected.value.fullName : ''
    }, { immediate: true })

    function metaFor(option) {
      return `${option.role}${option.divisionName ? ' · ' + option.divisionName : ''}`
    }

    function choose(option) {
      emit('update:modelValue', option.id)
      query.value = option.fullName
      open.value = false
    }

    function clear() {
      emit('update:modelValue', '')
      query.value = ''
      open.value = false
    }

    function onBlur() {
      setTimeout(() => {
        open.value = false
        query.value = selected.value ? selected.value.fullName : ''
      }, 120)
    }

    function initials(name) {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
      if (!parts.length) return '?'
      return parts.map(p => p[0]).join('').toUpperCase()
    }

    return () => h('div', { class: 'search-select' }, [
      h('div', { class: 'search-select-icon' },
        selected.value
          ? h('span', { class: 'search-select-avatar' }, initials(selected.value.fullName))
          : h('svg', { width: 12, height: 12, viewBox: '0 0 13 13', fill: 'none' }, [
              h('circle', { cx: 5.5, cy: 5.5, r: 4, stroke: '#94A3B8', 'stroke-width': 1.3 }),
              h('path', { d: 'M9 9l2.5 2.5', stroke: '#94A3B8', 'stroke-width': 1.3, 'stroke-linecap': 'round' })
            ])
      ),
      h('input', {
        value: query.value,
        class: 'field-input search-select-input',
        type: 'text',
        placeholder: props.placeholder,
        title: selected.value ? `${selected.value.fullName} - ${metaFor(selected.value)}` : '',
        onFocus: () => { open.value = true },
        onInput: event => {
          query.value = event.target.value
          open.value = true
        },
        onBlur
      }),
      props.modelValue
        ? h('button', {
            type: 'button',
            class: 'search-select-clear',
            title: 'Clear assignment',
            onMousedown: event => {
              event.preventDefault()
              clear()
            }
          }, '×')
        : null,
      open.value
        ? h('div', { class: 'search-select-menu' },
            filtered.value.length
              ? filtered.value.map(option => h('button', {
                  key: option.id,
                  type: 'button',
                  class: ['search-select-option', option.id === props.modelValue && 'is-selected'],
                  onMousedown: event => {
                    event.preventDefault()
                    choose(option)
                  }
                }, [
                  h('span', { class: 'search-select-option-avatar' }, initials(option.fullName)),
                  h('div', { class: 'search-select-option-text' }, [
                    h('strong', option.fullName),
                    h('span', metaFor(option))
                  ])
                ]))
              : [h('div', { class: 'search-select-empty' }, 'No matching user')]
          )
        : null
    ])
  }
}

// ── Load users on mount ──
onMounted(async () => {
  await loadUsers()
  const loads = [loadOrgOptions()]
  if (canManageUsers.value) loads.push(loadOfficeOptions(), loadSystemSettings())
  await Promise.all(loads)
})

async function loadOfficeOptions() {
  officeOptionsError.value = false
  try {
    // The full registry (officeRegistryApi.list) is central-admin-only and 403s
    // for any admin who only has User Management access - this picker endpoint
    // is authorized under manage_users instead, since assigning a user to an
    // office is a user-management task, not a central-registry one.
    const data = await officeRegistryApi.picker()
    officeOptions.value = data.items || (Array.isArray(data) ? data : [])
  } catch (e) {
    console.warn('[PMES] Office registry unavailable for user form:', e?.message || e)
    officeOptions.value = []
    officeOptionsError.value = true
  }
}

const officeFieldHelp = computed(() => {
  if (form.value.systemScope === 'STB_FULL') {
    return 'Locked to STB - STB Full PMES always uses the central STB spreadsheet.'
  }
  if (!officeOptions.value.length) {
    return officeOptionsError.value
      ? 'Could not load participating offices - the dropdown is disabled until this loads. Refresh the page and try again.'
      : 'Disabled: no participating office is active yet. Provision and activate one in Office Registry first.'
  }
  return 'The one office this account is limited to for office-scoped screens and data.'
})

async function loadUsers() {
  loading.value = true
  try {
    // SpreadsheetService.paginate() defaults to pageSize 50. Calling list() with
    // no params silently returned only the first 50 rows - and because new
    // accounts are appended to the bottom of the sheet, the rows that went
    // missing were always the newest ones. That is why self-registered users
    // never appeared under "Pending activation".
    const result = await usersApi.list({ pageSize: USERS_PAGE_SIZE })
    users.value  = (result.items ?? result ?? []).map(mapUser)

    // If the account count ever exceeds the page size, say so loudly rather than
    // truncating in silence again.
    const total = Number(result?.total)
    if (Number.isFinite(total) && total > users.value.length) {
      console.warn(`[Users] Truncated: showing ${users.value.length} of ${total}.`)
      showToast(`Showing ${users.value.length} of ${total} accounts. Narrow the search to see the rest.`, 'error')
    }
  } catch (e) {
    console.warn('[Users]', e.message)
    showToast('Could not load users from database.', 'error')
  } finally {
    loading.value = false
  }
}

async function loadSystemSettings() {
  systemSettingsLoading.value = true
  try {
    const data = await systemSettingsApi.get()
    systemAccessMode.value = data.accessMode || 'evaluation_only'
    if (Array.isArray(data.modes) && data.modes.length) {
      systemAccessModes.value = data.modes
    }
  } catch (e) {
    console.warn('[SystemSettings]', e.message)
    showToast('Could not load system access mode.', 'error')
  } finally {
    systemSettingsLoading.value = false
  }
}

async function saveSystemSettings() {
  const selected = systemAccessModes.value.find(mode => mode.value === systemAccessMode.value)
  const ok = await confirm({
    type: 'info',
    title: 'Change System Access Mode',
    message: `Set PMES access mode to "${selected?.label || systemAccessMode.value}"?`,
    details: [
      { label: 'Selected mode', value: selected?.label || systemAccessMode.value },
      { label: 'Effect', value: selected?.description || 'Updates module access rules.' }
    ],
    note: 'This affects regular users after their profile refreshes or next sign-in. Your own navigation will refresh immediately.',
    confirmLabel: 'Save Mode',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  systemSettingsSaving.value = true
  try {
    const data = await systemSettingsApi.update({ accessMode: systemAccessMode.value })
    systemAccessMode.value = data.accessMode || systemAccessMode.value
    if (Array.isArray(data.modes) && data.modes.length) {
      systemAccessModes.value = data.modes
    }
    await authStore.fetchProfile()
    showToast('System access mode updated.')
  } catch (e) {
    console.error(e)
    showToast('Could not update system access mode. Please try again.', 'error')
  } finally {
    systemSettingsSaving.value = false
  }
}

async function toggleFocalPanel() {
  showFocalPanel.value = !showFocalPanel.value
  if (showFocalPanel.value && !divisionFocalRows.value.length) {
    await loadFocalAssignments()
  }
}

async function toggleMaintenancePanel() {
  showMaintenancePanel.value = !showMaintenancePanel.value
  if (showMaintenancePanel.value && !maintenancePreview.value) {
    await previewMaintenance()
  }
}

async function previewMaintenance() {
  maintenanceLoading.value = true
  try {
    maintenancePreview.value = await maintenanceApi.previewFreshSchema()
    showToast('Fresh database preview loaded.')
  } catch (e) {
    console.error(e); showToast('Could not load database preview. Please try again.', 'error')
  } finally {
    maintenanceLoading.value = false
  }
}

async function rebuildFreshDatabase() {
  if (!maintenancePreview.value) {
    await previewMaintenance()
    if (!maintenancePreview.value) return
  }

  const phrase = maintenancePreview.value.confirmationPhrase
  const ok = await confirm({
    type: 'danger',
    title: 'Rebuild Fresh Database',
    message: 'This will rebuild the live database schema and clear all transactional records. Core setup data will be preserved.',
    details: [
      { label: 'Data preserved', value: preservedSheetNames.value.join(', ') },
      { label: 'Sheets rebuilt', value: `${maintenancePreview.value.finalSheetOrder?.length || 0} active sheets` },
      { label: 'Unused tabs removed', value: `${maintenancePreview.value.removeSheets?.length || 0}` }
    ],
    note: 'A backup copy will be created first. Type the exact confirmation phrase to continue.',
    input: {
      label: 'Confirmation phrase',
      placeholder: phrase,
      rows: 2,
      required: true
    },
    confirmLabel: 'Rebuild Database',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  const typedPhrase = confirmState.inputValue
  if (typedPhrase !== phrase) {
    showToast('Confirmation phrase did not match. Database was not changed.', 'error')
    return
  }

  maintenanceRunning.value = true
  try {
    const result = await maintenanceApi.rebuildFreshSchema(typedPhrase)
    showToast(`Fresh database rebuilt. Removed ${result.removedSheets?.length || 0} unused sheets.`)
    maintenancePreview.value = null
    await Promise.all([loadUsers(), previewMaintenance()])
  } catch (e) {
    console.error(e); showToast('Rebuild failed. Please try again.', 'error')
  } finally {
    maintenanceRunning.value = false
  }
}

async function loadFocalAssignments() {
  focalLoading.value = true
  try {
    const data = await focalAssignmentsApi.list()
    focalUsers.value = data.users || []
    bureauFocals.value = {
      primaryUserId: data.bureauFocals?.primary?.userId || data.bureauFocal?.userId || '',
      alternateUserId: data.bureauFocals?.alternate?.userId || ''
    }
    divisionFocalRows.value = (data.divisionFocals || []).map(row => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      userId: row.userId || '',
      primaryUserId: row.primaryUserId || row.userId || '',
      alternateUserId: row.alternateUserId || ''
    }))
  } catch (e) {
    console.error(e); showToast('Could not load focal assignments. Please try again.', 'error')
  } finally {
    focalLoading.value = false
  }
}

function focalUsersForDivision(divisionId) {
  const sameDivision = focalUsers.value.filter(u => u.divisionId === divisionId)
  const admins = focalUsers.value.filter(u =>
    ['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(u.role)
  )
  const combined = [...sameDivision, ...admins]
  return combined.filter((u, idx, arr) => arr.findIndex(x => x.id === u.id) === idx)
}

async function saveFocalAssignments() {
  const duplicateMessage = focalAssignmentDuplicateMessage()
  if (duplicateMessage) {
    showToast(duplicateMessage, 'error')
    return
  }

  const ok = await confirm({
    type: 'submit',
    title: 'Save Focal Assignments',
    message: 'These assignments will control who receives and checks submitted IPCRF/CCEF forms.',
    details: [
      { label: 'Bureau Primary', value: focalUsers.value.find(u => u.id === bureauFocals.value.primaryUserId)?.fullName || 'Not assigned' },
      { label: 'Bureau Alternate', value: focalUsers.value.find(u => u.id === bureauFocals.value.alternateUserId)?.fullName || 'Not assigned' },
      { label: 'Divisions', value: `${divisionFocalRows.value.length} division routing records` }
    ],
    note: 'Saving overwrites the active focal slots. Replaced focals will lose review access.',
    confirmLabel: 'Save Assignments',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  focalSaving.value = true
  try {
    const data = await focalAssignmentsApi.save({
      bureauFocals: {
        primaryUserId: bureauFocals.value.primaryUserId,
        alternateUserId: bureauFocals.value.alternateUserId
      },
      divisionFocals: divisionFocalRows.value.map(row => ({
        divisionId: row.divisionId,
        primaryUserId: row.primaryUserId,
        alternateUserId: row.alternateUserId
      }))
    })
    focalUsers.value = data.users || focalUsers.value
    bureauFocals.value = {
      primaryUserId: data.bureauFocals?.primary?.userId || data.bureauFocal?.userId || '',
      alternateUserId: data.bureauFocals?.alternate?.userId || ''
    }
    divisionFocalRows.value = (data.divisionFocals || []).map(row => ({
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      userId: row.userId || '',
      primaryUserId: row.primaryUserId || row.userId || '',
      alternateUserId: row.alternateUserId || ''
    }))
    showToast('Focal assignments saved.')
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    focalSaving.value = false
  }
}

function focalAssignmentDuplicateMessage() {
  if (bureauFocals.value.primaryUserId &&
      bureauFocals.value.alternateUserId &&
      bureauFocals.value.primaryUserId === bureauFocals.value.alternateUserId) {
    return 'Bureau primary and alternate focal must be different users.'
  }
  const duplicate = divisionFocalRows.value.find(row =>
    row.primaryUserId && row.alternateUserId && row.primaryUserId === row.alternateUserId
  )
  return duplicate ? `${duplicate.divisionName}: primary and alternate focal must be different users.` : ''
}

function divisionInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(word => !['and', 'of', 'the'].includes(word.toLowerCase()))
    .map(word => word[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()
}

// ── Map sheet row → display object ──
function mapUser(row) {
  const colors = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#0D2137','#1e3f61','#27AE60','#E9A840','#EB5757']
  const name   = row.fullName || row.email
  return {
    id:           row.id,
    uid:          row.uid       || '',
    initials:     name.split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase(),
    name,
    email:        row.email        || '',
    role:         row.role         || 'Technical Staff',
    division:     row.divisionName || row.divisionId || '',
    divisionId:   row.divisionId   || '',
    section:      row.section      || '',
    position:     row.position     || '',
    employeeNo:   row.employeeNo   || '',
    type:         row.type         || 'Regular',
    status:       (row.pendingActivation === true || String(row.pendingActivation).toLowerCase() === 'true')
                    ? 'Pending'
                    : (row.active === false || row.active === 'false' ? 'Inactive' : 'Active'),
    pendingActivation: row.pendingActivation === true || String(row.pendingActivation).toLowerCase() === 'true',
    requestedRole: row.requestedRole || '',
    selfRegistered: row.selfRegistered === true || String(row.selfRegistered).toLowerCase() === 'true',
    officeId: row.officeId || 'STB',
    officeCode: row.officeCode || row.officeId || 'STB',
    officeName: row.officeName || 'Social Technology Bureau',
    systemScope: row.systemScope || 'STB_FULL',
    officeRole: row.officeRole || 'STB_PERSONNEL',
    centralRoles: parseList(row.centralRoles),
    permissionGroups: parseList(row.permissionGroups),
    permissions: parseList(row.permissions),
    lastLogin:    row.lastLoginAt ? formatDate(row.lastLoginAt) : 'Never',
    tempPassword: row.tempPassword || '',
    avatarColor:  colors[Math.abs(hashStr(row.email)) % colors.length]
  }
}

function hashStr(s) { return (s||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0) }

function parseList(value) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .split(/[,|]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function formatDate(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ── Password ──
function generatePassword() {
  const upper='ABCDEFGHJKLMNPQRSTUVWXYZ', lower='abcdefghjkmnpqrstuvwxyz'
  const digits='23456789', special='@#$%', all=upper+lower+digits+special
  let pw = upper[~~(Math.random()*upper.length)] + lower[~~(Math.random()*lower.length)]
         + digits[~~(Math.random()*digits.length)] + special[~~(Math.random()*special.length)]
  for (let i=0;i<6;i++) pw += all[~~(Math.random()*all.length)]
  return pw.split('').sort(() => Math.random()-.5).join('')
}

// ── Form ──
const defaultForm = () => {
  const profile = authStore.profile || {}
  const centralUserManager = canManageUsers.value
  return {
    fullName:'', email:'',
    role:'', division:'', section:'', position:'',
    employeeNo:'', type:'Regular',
    officeId: centralUserManager ? 'STB' : (profile.officeId || 'STB'),
    officeCode: centralUserManager ? 'STB' : (profile.officeCode || profile.officeId || 'STB'),
    officeName: centralUserManager ? 'Social Technology Bureau' : (profile.officeName || 'Social Technology Bureau'),
    systemScope: centralUserManager ? 'STB_FULL' : 'CLUSTER_PORTAL',
    officeRole: centralUserManager ? 'STB_PERSONNEL' : 'OFFICE_PERSONNEL',
    centralRoles: [],
    permissionGroups: [],
    tempPassword: generatePassword()
  }
}

const form = ref(defaultForm())
function regeneratePassword() { form.value.tempPassword = generatePassword() }

const selectedOfficeOrgOptions = computed(() => optionsForOffice(form.value.officeId, form.value.officeCode))
const selectedOfficeDivisions = computed(() => selectedOfficeOrgOptions.value.divisions || [])
const selectedOfficeSections = computed(() => selectedOfficeOrgOptions.value.sections || [])
const selectedDivisionOption = computed(() =>
  selectedOfficeDivisions.value.find(division => division.name === form.value.division || division.id === form.value.division)
)
const sectionsForSelectedDivision = computed(() => {
  const divisionId = selectedDivisionOption.value?.id || ''
  return selectedOfficeSections.value.filter(section => String(section.divisionId || '') === String(divisionId))
})
const sectionSelectPlaceholder = computed(() =>
  sectionsForSelectedDivision.value.length ? 'Select section…' : 'No sections available'
)

/**
 * Only roles that actually sit inside a section need one. Section Heads and the
 * staff under them belong to a single section; Assistant Division Chief and
 * every rank above it oversees a whole division, office, program or bureau, so
 * pinning them to one section is wrong - and the save used to be blocked until
 * they picked one.
 *
 * Offices configure their own role ladders, so this matches on the section-level
 * names rather than trying to enumerate everything above them. Anything not on
 * this list is treated as division-level or higher and saves without a section.
 */
const SECTION_LEVEL_ROLES = ['section head', 'technical staff', 'admin staff']
const roleRequiresSection = computed(() =>
  SECTION_LEVEL_ROLES.includes(String(form.value.role || '').trim().toLowerCase())
)

watch(() => form.value.division, () => {
  if (!form.value.section) return
  const valid = sectionsForSelectedDivision.value.some(section => section.name === form.value.section)
  if (!valid) form.value.section = ''
})

watch(() => form.value.systemScope, scope => {
  if (scope === 'STB_FULL') {
    form.value.officeId = 'STB'
    form.value.officeCode = 'STB'
    form.value.officeName = 'Social Technology Bureau'
    form.value.officeRole = 'STB_PERSONNEL'
  } else if (scope === 'OFFICE_ADMIN') {
    form.value.officeRole = 'OFFICE_ADMIN'
  } else if (scope === 'CLUSTER_ADMIN') {
    form.value.officeRole = 'CENTRAL_ADMIN'
  } else {
    form.value.officeRole = 'OFFICE_PERSONNEL'
  }
})

watch(() => form.value.officeId, officeId => {
  if (officeId === 'STB') {
    form.value.officeCode = 'STB'
    form.value.officeName = 'Social Technology Bureau'
    return
  }
  const office = officeOptions.value.find(item => item.officeId === officeId)
  if (office) {
    form.value.officeCode = office.officeCode
    form.value.officeName = office.officeName
  }
  if (!form.value.division) return
  const validDivision = selectedOfficeDivisions.value.some(division => division.name === form.value.division)
  if (!validDivision) {
    form.value.division = ''
    form.value.section = ''
  }
})

// ── Filter ──
function searchable(value) {
  return String(value ?? '').toLowerCase()
}

const filteredUsers = computed(() => {
  const q = searchable(search.value).trim()
  return users.value.filter(u => {
    const fields = [u.name, u.email, u.role, u.division, u.section, u.employeeNo]
    const matchesSearch = !q ||
      fields.some(field => searchable(field).includes(q))
    const matchesRole = !roleFilter.value || u.role === roleFilter.value
    const matchesStatus = !statusFilter.value || u.status === statusFilter.value
    return matchesSearch && matchesRole && matchesStatus
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)))
const pageStartIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const pagedUsers = computed(() =>
  filteredUsers.value.slice(pageStartIndex.value, pageStartIndex.value + pageSize.value)
)
const pageRangeLabel = computed(() => {
  if (!filteredUsers.value.length) return 'No users shown'
  const start = pageStartIndex.value + 1
  const end = Math.min(pageStartIndex.value + pageSize.value, filteredUsers.value.length)
  return `Showing ${start}-${end} of ${filteredUsers.value.length}`
})
const paginationSummary = computed(() => {
  const filteredCount = filteredUsers.value.length
  const totalCount = users.value.length
  return filteredCount === totalCount
    ? `${pageRangeLabel.value} users`
    : `${pageRangeLabel.value} matching users (${totalCount} total)`
})

function goToPage(page) {
  currentPage.value = Math.min(Math.max(Number(page) || 1, 1), totalPages.value)
}

watch([search, roleFilter, statusFilter, pageSize], () => {
  currentPage.value = 1
})

watch(totalPages, pages => {
  if (currentPage.value > pages) currentPage.value = pages
})

// ── Modal ──
function openAddModal()  { editingUser.value = null; form.value = defaultForm(); showModal.value = true }
function closeModal()    { showModal.value = false }

function openEditModal(user) {
  editingUser.value = user
  form.value = {
    fullName:     user.name,
    email:        user.email,
    role:         user.role,
    division:     user.division,
    section:      user.section    || '',
    position:     user.position    || '',
    employeeNo:   user.employeeNo  || '',
    type:         user.type        || 'Regular',
    officeId:     user.officeId    || 'STB',
    officeCode:   user.officeCode  || user.officeId || 'STB',
    officeName:   user.officeName  || 'Social Technology Bureau',
    systemScope:  user.systemScope || 'STB_FULL',
    officeRole:   user.officeRole  || 'STB_PERSONNEL',
    centralRoles: [...(user.centralRoles || [])],
    permissionGroups: [...(user.permissionGroups || [])],
    tempPassword: ''
  }
  showModal.value = true
}

// ── Save ──
async function saveUser() {
  if (!form.value.fullName || !form.value.email || !form.value.role) {
    showToast('Please fill in all required fields.', 'error'); return
  }
  if (roleRequiresSection.value && sectionsForSelectedDivision.value.length && !form.value.section) {
    showToast('Please select a section for the chosen division.', 'error'); return
  }
  if (form.value.systemScope !== 'STB_FULL' && !form.value.officeId) {
    showToast('Please select the assigned office for this portal user.', 'error'); return
  }
  const ok = await confirm(editingUser.value
    ? {
        type: 'info',
        title: 'Save User Changes',
        message: `Changes to ${form.value.fullName}'s account will be saved.`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel'
      }
    : CONFIRMS.createUser(form.value.email, form.value.role)
  )
  if (!ok) return
  saving.value = true
  try {
    const payload = {
      fullName:    form.value.fullName,
      email:       form.value.email,
      role:        form.value.role,
      divisionId:   selectedDivisionOption.value?.id || '',
      divisionName: form.value.division,
      section:     form.value.section,
      position:    form.value.position,
      employeeNo:  form.value.employeeNo,
      type:        form.value.type,
      officeId:    form.value.officeId || 'STB',
      officeCode:  form.value.officeCode || form.value.officeId || 'STB',
      officeName:  form.value.officeName || 'Social Technology Bureau',
      systemScope: form.value.systemScope || 'STB_FULL',
      officeRole:  form.value.officeRole || 'STB_PERSONNEL',
      centralRoles: [...(form.value.centralRoles || [])],
      permissionGroups: [...(form.value.permissionGroups || [])]
    }
    if (editingUser.value) {
      const updated = await usersApi.update(editingUser.value.id, payload)
      const idx = users.value.findIndex(u => u.id === editingUser.value.id)
      if (idx !== -1) users.value[idx] = mapUser(updated)
      showToast('User updated successfully.')
      if (updated?.officePersonnelSync?.error) {
        showToast(`Saved, but not yet added to the office roster: ${updated.officePersonnelSync.error}`, 'warning')
      }
    } else {
      const newUser = await usersApi.create({ ...payload, tempPassword: form.value.tempPassword, mustChangePassword: true })
      users.value.unshift(mapUser(newUser))
      showToast(`User created! Temp password: ${form.value.tempPassword}`)
      if (newUser?.officePersonnelSync?.error) {
        showToast(`Account created, but not yet added to the office roster: ${newUser.officePersonnelSync.error}`, 'warning')
      }
    }
    closeModal()
  } catch (e) {
    console.error(e); showToast(e?.message || 'Something went wrong. Please try again.', 'error')
  } finally {
    saving.value = false
  }
}

// ── Activate / Approve / Deactivate ──
async function activateUser(user) {
  const isApproval = user.status === 'Pending'
  const ok = await confirm(isApproval ? {
    type: 'approve',
    title: 'Approve Account',
    message: `${user.name} will be granted access to PMES with the role "${user.role}". Edit their role or division first if it needs to change.`,
    details: [
      { label: 'Email', value: user.email },
      { label: 'Requested role', value: user.requestedRole || '-' },
      { label: 'Assigned role', value: user.role },
      { label: 'System scope', value: user.systemScope || 'STB_FULL' },
      { label: 'Office', value: user.officeName || 'Social Technology Bureau' }
    ],
    note: 'The user will be able to sign in immediately after approval.',
    confirmLabel: 'Approve & Activate',
    cancelLabel: 'Not yet'
  } : CONFIRMS.activateUser(user.name))
  if (!ok) return
  busyUserId.value = user.id
  try {
    await usersApi.activate(user.id)
    user.status = 'Active'
    user.pendingActivation = false
    showToast(`${user.name} ${isApproval ? 'approved' : 'activated'}.`)
  } catch (e) {
    console.error(e)
    showToast(e?.message || 'Something went wrong. Please try again.', 'error')
  } finally {
    busyUserId.value = ''
  }
}

async function declineUser(user) {
  const ok = await confirm({
    type: 'danger',
    title: 'Decline Registration',
    message: `${user.name}'s registration request will be removed. They will not gain access. They can register again if this was a mistake.`,
    details: [{ label: 'Email', value: user.email }],
    confirmLabel: 'Decline',
    cancelLabel: 'Cancel'
  })
  if (!ok) return
  busyUserId.value = user.id
  try {
    await usersApi.decline(user.id)
    users.value = users.value.filter(u => u.id !== user.id)
    showToast(`${user.name}'s registration declined.`, 'warning')
  } catch (e) {
    console.error(e)
    showToast(e?.message || 'Something went wrong. Please try again.', 'error')
  } finally {
    busyUserId.value = ''
  }
}
async function deactivateUser(user) {
  const ok = await confirm(CONFIRMS.deactivateUser(user.name))
  if (!ok) return
  try   { await usersApi.deactivate(user.id); user.status = 'Inactive'; showToast(`${user.name} deactivated.`, 'warning') }
  catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
}

async function deleteUser(user) {
  const ok = await confirm(CONFIRMS.deleteUser(user.name, user.email))
  if (!ok) return
  busyUserId.value = user.id
  try {
    await usersApi.remove(user.id)
    users.value = users.value.filter(u => u.id !== user.id)
    showToast(`${user.name} permanently deleted.`, 'warning')
  } catch (e) {
    console.error(e)
    showToast(e?.message || 'Something went wrong. Please try again.', 'error')
  } finally {
    busyUserId.value = ''
  }
}

// ── Reset password ──
function resetPassword(user) { resetTarget.value = user; resetTempPw.value = generatePassword(); showResetModal.value = true }
async function confirmReset() {
  const ok = await confirm(CONFIRMS.resetPassword(resetTarget.value.name))
  if (!ok) return
  resettingPw.value = true
  try {
    await usersApi.resetPassword(resetTarget.value.id, { tempPassword: resetTempPw.value })
    resetTarget.value.tempPassword = resetTempPw.value
    showToast(`Password reset for ${resetTarget.value.name}.`)
  } catch (e) { console.error(e); showToast('Something went wrong. Please try again.', 'error') }
  finally { resettingPw.value = false; showResetModal.value = false }
}

// ── Helpers ──
function togglePw(email) { showPw.value = { ...showPw.value, [email]: !showPw.value[email] } }
async function copyPw(pw) {
  try { await navigator.clipboard.writeText(pw); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch {}
}

function roleBadgeClass(role) {
  const map = {
    'System Administrator': 'role-admin',
    'Bureau Director': 'role-director',
    'Assistant Bureau Director': 'role-director',
    'Division Chief': 'role-chief',
    'Staff': 'role-staff',
    'Technical Staff': 'role-staff',
    'Contractor of Service': 'role-contractor'
  }
  return map[role] || 'role-staff'
}

function showToast(msg, type='success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}
</script>

<style scoped>
*{box-sizing:border-box;}
.content{padding:20px;font-size:13px;color:#1A2332;background:#EEF2F7;min-height:100%;}

/* Page header */
.page-panel{background:#fff;border:1px solid #DDE7F3;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);padding:18px;margin-bottom:14px;}
.page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;}
.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#2F80ED;margin:0 0 4px;}
.page-heading h1{margin:0;font-size:22px;line-height:1.15;color:#071A2F;font-weight:800;letter-spacing:0;}
.page-subtitle{margin:5px 0 0;color:#7183A3;font-size:13px;}
.top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:14px;}
.summary-item{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.summary-item span{font-size:11px;color:#7183A3;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}
.summary-item strong{font-size:20px;color:#0D2137;line-height:1;}
.access-mode-strip{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:16px;align-items:center;border:1px solid #DDE7F3;background:#F8FAFC;border-radius:11px;padding:13px 14px;margin-bottom:14px;}
.access-mode-copy span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#2F80ED;font-weight:800;margin-bottom:3px;}
.access-mode-copy strong{display:block;font-size:15px;color:#0D2137;line-height:1.2;}
.access-mode-copy p{margin:4px 0 0;color:#7183A3;font-size:12px;line-height:1.35;}
.access-mode-controls{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;}
.access-mode-option{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:8px 11px;border:1px solid #DDE7F3;border-radius:9px;background:#fff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;}
.access-mode-option input{width:13px;height:13px;accent-color:#0B4DB3;}
.access-mode-option.is-selected{border-color:#2F80ED;background:#EBF4FF;color:#0B4DB3;box-shadow:0 0 0 3px rgba(47,128,237,.08);}
.control-strip{display:grid;grid-template-columns:minmax(260px,1fr) 190px 150px;gap:10px;align-items:center;}
.search-box{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #DDE7F3;border-radius:9px;padding:9px 12px;min-width:0;}
.search-box:focus-within{border-color:#2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.09);}
.search-box input{border:none;outline:none;font-size:13px;color:#1A2332;width:100%;min-width:0;}
.filter-select{height:39px;border:1.5px solid #DDE7F3;background:#fff;border-radius:9px;padding:0 12px;color:#1A2332;font-size:13px;outline:none;}
.filter-select:focus{border-color:#2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.09);}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-weight:500;}
.btn:hover{border-color:#CBD5E1;background:#F8FAFC;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover{background:#1e3f61;border-color:#1e3f61;}
.btn-secondary{background:#F8FAFC;color:#0D2137;border-color:#CBD5E1;}
.btn-secondary:hover{background:#EEF2F7;border-color:#94A3B8;}
.btn-danger-solid{background:#B91C1C;color:#fff;border-color:#B91C1C;}
.btn-danger-solid:hover{background:#991B1B;border-color:#991B1B;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-sm{padding:4px 9px;font-size:11px;}
.btn-xs{padding:3px 8px;font-size:10px;border-radius:5px;}
.btn-xs:disabled{opacity:.65;cursor:not-allowed;}
/* Inline busy indicator for row actions - approving reaches both Apps Script and
   the Firebase Admin API, so the wait is seconds, not milliseconds. */
.spinner-xs{display:inline-block;width:9px;height:9px;margin-right:5px;vertical-align:-1px;
  border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;}
.activate{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.activate:hover{background:#DCFCE7;}
.deactivate{background:#FEF2F2;color:#B91C1C;border-color:#FECACA;}
.deactivate:hover{background:#FFE4E6;}

/* Card */
.card{background:#fff;border:1px solid #DDE7F3;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.05);}
.card-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #EFF3F8;}
.card-title{font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;}
.card-subtitle{margin:3px 0 0;color:#94A3B8;font-size:12px;}
.badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;}
.badge-blue{background:#EBF4FF;color:#1A56B0;}

/* Focal assignments */
.focal-card{margin-bottom:14px;overflow:visible;}
.focal-panel-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #EFF3F8;background:#FBFCFE;}
.focal-panel-hd h2{font-size:18px;line-height:1.2;margin:3px 0 0;color:#071A2F;font-weight:800;}
.focal-routing-shell{display:grid;grid-template-columns:minmax(250px,300px) minmax(0,1fr);gap:14px;padding:16px 18px;min-width:0;}
.focal-route-card{border:1px solid #DDE7F3;background:#F8FAFC;border-radius:12px;padding:15px;display:flex;flex-direction:column;gap:14px;min-width:0;}
.route-card-top{display:flex;align-items:center;gap:10px;padding-bottom:2px;}
.route-card-top h3{font-size:14px;line-height:1.2;margin:0;color:#0F172A;font-weight:800;}
.route-card-top p{margin:2px 0 0;color:#8BA0C0;font-size:11.5px;}
.division-route-panel{border:1px solid #DDE7F3;border-radius:12px;overflow:visible;background:#fff;min-width:0;}
.route-table-head{display:grid;grid-template-columns:minmax(210px,.9fr) minmax(0,1fr) minmax(0,1fr);gap:14px;padding:10px 14px;background:#F8FAFC;border-bottom:1px solid #E8EEF6;color:#8BA0C0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;}
.route-table-head>*{min-width:0;}
.division-route-list{display:flex;flex-direction:column;}
.division-route-row{display:grid;grid-template-columns:minmax(210px,.9fr) minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:center;padding:13px 14px;border-bottom:1px solid #EEF3F8;min-width:0;}
.division-route-row>*{min-width:0;}
.division-route-row:last-child{border-bottom:none;}
.division-route-row:hover{background:#F8FBFF;}
.division-route-name{display:flex;align-items:center;gap:10px;min-width:0;}
.focal-division{font-weight:800;color:#0F172A;font-size:13px;line-height:1.25;}
.focal-slot{display:flex;flex-direction:column;gap:6px;min-width:0;}
.focal-slot-label{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#475569;}
.focal-slot-label.compact{display:none;}
.focal-slot-label.is-alt{color:#8BA0C0;}
.focal-slot-label .dot{width:5px;height:5px;border-radius:50%;background:#2F80ED;flex-shrink:0;}
.focal-slot-label.is-alt .dot{background:#CBD5E1;}

:deep(.search-select){position:relative;width:100%;min-width:0;}
:deep(.search-select-icon){position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;}
:deep(.search-select-avatar){width:19px;height:19px;border-radius:6px;background:#EBF4FF;color:#1A56B0;font-size:8.5px;font-weight:900;display:flex;align-items:center;justify-content:center;}
:deep(.search-select-input){display:block;box-sizing:border-box;width:100%;max-width:100%;height:40px;padding:0 34px 0 36px;border:1.5px solid #DDE7F3;border-radius:10px;font-size:12.5px;color:#0F172A;background:#fff;text-overflow:ellipsis;transition:border-color .15s,box-shadow .15s;}
:deep(.search-select-input:focus){outline:none;border-color:#2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.1);}
:deep(.search-select-input::placeholder){color:#AAB8CD;}
:deep(.search-select-clear){position:absolute;right:8px;top:50%;transform:translateY(-50%);width:20px;height:20px;border:0;background:#F1F5F9;color:#7183A3;border-radius:7px;font-size:13px;line-height:18px;cursor:pointer;transition:all .15s;}
:deep(.search-select-clear:hover){background:#FEE2E2;color:#DC2626;}
:deep(.search-select-menu){position:absolute;z-index:80;left:0;right:0;top:calc(100% + 6px);max-height:240px;overflow:auto;border:1px solid #DDE7F3;background:#fff;border-radius:10px;box-shadow:0 18px 38px rgba(15,23,42,.16);padding:5px;}
:deep(.search-select-option){width:100%;display:flex;align-items:center;gap:9px;text-align:left;border:0;background:#fff;border-radius:8px;padding:8px;cursor:pointer;color:#0F172A;}
:deep(.search-select-option:hover){background:#F1F5F9;}
:deep(.search-select-option.is-selected){background:#EFF6FF;}
:deep(.search-select-option-avatar){width:24px;height:24px;border-radius:7px;background:#EBF4FF;color:#1A56B0;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
:deep(.search-select-option-text){display:flex;flex-direction:column;min-width:0;}
:deep(.search-select-option-text strong){font-size:12.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
:deep(.search-select-option-text span){font-size:10.5px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
:deep(.search-select-empty){padding:14px;color:#94A3B8;font-size:12px;text-align:center;}
.focal-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 16px;}

/* Database maintenance */
.maintenance-card{margin-bottom:14px;overflow:hidden;border-color:#F2D6D6;}
.maintenance-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #F3E6E6;background:linear-gradient(180deg,#FFFBFB,#FFFFFF);}
.maintenance-hd h2{font-size:18px;line-height:1.2;margin:3px 0 0;color:#071A2F;font-weight:800;}
.maintenance-hd p{margin:5px 0 0;color:#7183A3;font-size:12.5px;max-width:680px;}
.maintenance-state{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid #E2E8F0;background:#F8FAFC;color:#64748B;white-space:nowrap;}
.maintenance-state.ready{border-color:#BBF7D0;background:#F0FDF4;color:#15803D;}
.maintenance-body{padding:16px 18px 14px;}
.maintenance-summary{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:10px;margin-bottom:14px;}
.maintenance-pill{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:10px;padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.maintenance-pill span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:900;color:#7183A3;}
.maintenance-pill strong{font-size:20px;line-height:1;color:#0D2137;}
.maintenance-pill.keep{border-color:#BBF7D0;background:#F0FDF4;}
.maintenance-pill.rebuild{border-color:#BFDBFE;background:#EFF6FF;}
.maintenance-pill.remove{border-color:#FECACA;background:#FEF2F2;}
.maintenance-grid{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:12px;align-items:stretch;}
.maintenance-box{border:1px solid #DDE7F3;background:#fff;border-radius:12px;padding:14px;min-width:0;}
.maintenance-box.safe{border-color:#BBF7D0;background:#FBFFFC;}
.maintenance-box.danger{border-color:#FECACA;background:#FFFBFB;}
.maintenance-box h3{font-size:13px;margin:0 0 4px;color:#0F172A;font-weight:900;}
.maintenance-box p{font-size:11.5px;color:#7183A3;margin:0 0 10px;line-height:1.45;}
.chip-list{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;}
.chip-list.scroll{max-height:96px;overflow:auto;padding-right:2px;}
.schema-chip{display:inline-flex;align-items:center;border:1px solid #DDE7F3;background:#F8FAFC;color:#334155;border-radius:999px;padding:4px 8px;font-size:10.5px;font-weight:800;line-height:1;}
.schema-chip.keep{border-color:#BBF7D0;background:#DCFCE7;color:#166534;}
.schema-chip.remove{border-color:#FECACA;background:#FEE2E2;color:#B91C1C;}
.schema-chip.muted-chip{border-color:#E2E8F0;background:#F8FAFC;color:#94A3B8;}
.maintenance-warning{margin-top:13px;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;}
.maintenance-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 16px;}
@media (max-width: 980px){
  .page-heading{flex-direction:column;align-items:stretch;}
  .top-actions{justify-content:flex-start;}
  .summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .access-mode-strip{grid-template-columns:1fr;}
  .access-mode-controls{justify-content:flex-start;}
  .control-strip{grid-template-columns:1fr;}
  .focal-routing-shell,.route-table-head,.division-route-row{grid-template-columns:1fr;}
  .route-table-head{display:none;}
  .focal-slot-label.compact{display:inline-flex;}
  .maintenance-grid,.maintenance-summary{grid-template-columns:1fr;}
  .maintenance-hd,.maintenance-actions{flex-direction:column;align-items:stretch;}
}
@media (max-width: 560px){
  .content{padding:12px;}
  .page-panel{padding:14px;}
  .summary-grid{grid-template-columns:1fr;}
  .page-heading h1{font-size:20px;}
  .top-actions .btn{width:100%;justify-content:center;}
  .pagination-bar{align-items:stretch;flex-direction:column;}
  .pagination-meta{justify-content:space-between;}
  .pagination-controls{justify-content:space-between;}
  .page-indicator{flex:1;}
  .form-grid,.access-group-grid{grid-template-columns:1fr;}
  .full{grid-column:span 1;}
}

/* Table */
.user-card{border-color:#DDE7F3;}
.user-card-hd{background:#FBFCFE;}
.table-wrap{overflow-x:auto;}
.tbl{width:100%;border-collapse:separate;border-spacing:0;}
.tbl th{padding:11px 14px;text-align:left;font-size:10px;font-weight:800;color:#8BA0C0;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid #E8EEF6;background:#F8FAFC;}
.tbl td{padding:13px 14px;border-bottom:1px solid #EEF3F8;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tbody tr{transition:background .12s;}
.tbl tbody tr:hover td{background:#F8FBFF;}
.stripe td{background:#FCFDFF;}
.empty-row{text-align:center;color:#94A3B8;padding:40px !important;font-size:13px;}
.pagination-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid #EFF3F8;background:#FBFCFE;}
.pagination-meta,.pagination-controls,.page-size-control{display:flex;align-items:center;gap:8px;min-width:0;}
.pagination-meta{color:#7183A3;font-size:12px;font-weight:600;}
.page-size-control span{font-size:11px;color:#8BA0C0;text-transform:uppercase;letter-spacing:.05em;}
.page-size-select{height:30px;border:1px solid #DDE7F3;background:#fff;border-radius:7px;padding:0 8px;color:#1A2332;font-size:12px;outline:none;}
.page-size-select:focus{border-color:#2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.08);}
.page-btn{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #DDE7F3;background:#fff;color:#64748B;border-radius:7px;cursor:pointer;transition:all .15s;}
.page-btn:hover:not(:disabled){border-color:#BFDBFE;background:#EFF6FF;color:#1A56B0;}
.page-btn:disabled{opacity:.45;cursor:not-allowed;}
.page-indicator{min-width:86px;text-align:center;color:#475569;font-size:12px;font-weight:700;}
.flex-row{display:flex;align-items:center;}
.gap-4{gap:4px;} .gap-6{gap:6px;} .gap-8{gap:8px;}
.fw-500{font-weight:500;font-size:13px;}
.text-xs{font-size:11px;} .muted{color:#94A3B8;}
.user-cell{display:flex;align-items:center;gap:10px;min-width:190px;}
.user-name{font-size:13px;font-weight:800;color:#0F172A;line-height:1.25;}
.user-meta{font-size:11px;color:#8BA0C0;margin-top:2px;}
.action-group{display:flex;align-items:center;gap:6px;justify-content:flex-start;white-space:nowrap;}

/* Avatar */
.av{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:inset 0 -10px 20px rgba(0,0,0,.08);}

/* Badges */
.role-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;}
.role-admin{background:#F3EEFF;color:#6B3FA0;}
.role-director{background:#EBF4FF;color:#1A56B0;}
.role-chief{background:#E6F4EA;color:#1E7E34;}
.role-staff{background:#F0F4F8;color:#4A5568;}
.role-contractor{background:#FEF3E2;color:#B35A0F;}
.status-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.s-green{background:#F0FDF4;color:#15803D;}
.s-red{background:#FEF2F2;color:#B91C1C;}
.s-amber{background:#FEF3E2;color:#B45309;}
.req-role-hint{font-size:9.5px;color:#94A3B8;margin-top:3px;}
.approve{background:#0D2137;color:#fff;border-color:#0D2137;}
.approve:hover{background:#1e3f61;}

/* Temp pw */
.temp-pw{font-family:'DM Mono',monospace;font-size:11px;color:#0F172A;background:#F1F5F9;padding:3px 7px;border-radius:5px;letter-spacing:.5px;}
.icon-btn-sm{background:none;border:none;cursor:pointer;padding:3px;border-radius:4px;color:#94A3B8;transition:all .15s;}
.icon-btn-sm:hover{background:#F1F5F9;color:#64748B;}
.icon-btn-sm.danger:hover{background:#FEF2F2;color:#EF4444;}
.copied-tag{font-size:10px;color:#22C55E;font-weight:500;}

/* ─── SKELETON ─────────────────────────────── */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line,.sk-pill,.sk-av,.sk-actions{
  background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);
  background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;
}
.sk-line{height:11px;display:block;}
.sk-pill{height:18px;width:70px;border-radius:20px;display:inline-block;}
.sk-av{width:28px;height:28px;border-radius:50%;flex-shrink:0;}
.sk-user{display:flex;align-items:center;gap:8px;}
.sk-actions{width:60px;height:18px;}
.skeleton-row td{padding:12px 14px;}

/* ─── MODAL ─────────────────────────────────── */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(4px);}
.modal{background:#fff;border-radius:16px;width:100%;max-width:600px;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;max-height:92vh;display:flex;flex-direction:column;}
.modal-sm{max-width:440px;}

/* Modal header */
.modal-hd{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;}
.modal-hd-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-hd-icon--warn{background:#FEF3E2;color:#C8882A;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:1px;}
.modal-sub{font-size:12px;color:#94A3B8;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;transition:all .15s;flex-shrink:0;}
.modal-close:hover{background:#F1F5F9;color:#374151;}

/* Modal body */
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}

/* Form sections */
.form-section{margin-bottom:20px;}
.form-section:last-child{margin-bottom:0;}
.form-section-label{font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.form-section-label::after{content:'';flex:1;height:1px;background:#F1F5F9;}

.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.req{color:#EF4444;}
.field-help{margin:2px 0 0;font-size:11px;line-height:1.35;color:#7183A3;}
.access-group-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.access-group-option{
  display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:flex-start;
  border:1px solid #DDE7F3;background:#F8FAFC;border-radius:10px;padding:10px;
  cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s;
}
.access-group-option:hover{border-color:#BFDBFE;background:#F0F7FF;}
.access-group-option input{margin-top:2px;accent-color:#0B4BB3;}
.access-group-option strong{display:block;font-size:12px;color:#0F172A;line-height:1.2;}
.access-group-option small{display:block;margin-top:3px;font-size:10.5px;color:#7183A3;line-height:1.35;}

.access-group-subhead{
  font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;
  letter-spacing:.5px;margin:14px 0 4px;cursor:default;list-style:none;
}
.access-group-subhead::-webkit-details-marker{display:none;}
summary.access-group-subhead{cursor:pointer;display:flex;align-items:center;gap:6px;}
summary.access-group-subhead::before{
  content:'▸';display:inline-block;font-size:9px;color:#94A3B8;
  transition:transform .15s;
}
.cluster-group-disclosure[open] summary.access-group-subhead::before{transform:rotate(90deg);}
.access-group-subnote{margin:0 0 8px;font-size:10.5px;color:#94A3B8;line-height:1.3;}
.cluster-group-disclosure{margin-top:2px;}
.access-group-warning{
  display:flex;flex-direction:column;gap:2px;margin:6px 0 10px;padding:9px 11px;
  background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;
  font-size:10.5px;line-height:1.4;color:#92400E;
}
.access-group-warning strong{color:#78350F;}

.field-input,.field-select{
  padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;
  font-size:13px;color:#0F172A;
  background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;width:100%;
}
.field-input:focus,.field-select:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.field-input:disabled{background:#F8FAFC;color:#94A3B8;cursor:not-allowed;}
.field-input::placeholder{color:#CBD5E1;}
.field-select{cursor:pointer;}

/* Email input with icon */
.input-icon-wrap{position:relative;}
.input-icon-wrap svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;}
.field-input.has-icon{padding-left:32px;}

/* Password section inside modal */
.pw-section{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;}
.pw-section-inner{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;}
.pw-section-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.pw-section-note{font-size:11px;color:#94A3B8;margin-top:2px;}
.pw-display{display:flex;align-items:center;gap:8px;}
.pw-code{font-family:'DM Mono',monospace;font-size:13px;color:#0F172A;background:#fff;border:1px solid #E2E8F0;padding:6px 12px;border-radius:7px;letter-spacing:.8px;flex:1;}

/* Modal footer */
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;}

/* Spinner */
.spinner-sm{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:4px;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:999;}
.toast-error{background:#EB5757;}
.toast-warning{background:#E9A840;}

/* Transitions */
.modal-fade-enter-active,.modal-fade-leave-active{transition:opacity .2s,transform .2s;}
.modal-fade-enter-from,.modal-fade-leave-to{opacity:0;transform:scale(.97);}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}

@media (max-width: 560px){
  .access-group-grid{grid-template-columns:1fr;}
}
</style>
