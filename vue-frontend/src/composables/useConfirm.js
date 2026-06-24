// src/composables/useConfirm.js
// Usage:
//   const { confirm, confirmState } = useConfirm()
//   const ok = await confirm({ type: 'danger', title: 'Delete User', message: '...' })
//   if (ok) { ... do the action ... }

import { reactive } from 'vue'

const state = reactive({
  show:         false,
  type:         'info',
  title:        '',
  message:      '',
  details:      null,
  note:         null,
  confirmLabel: 'Confirm',
  cancelLabel:  'Cancel',
  loading:      false,
  resolve:      null
})

export function useConfirm() {

  function confirm(options = {}) {
    state.show         = true
    state.type         = options.type         || 'info'
    state.title        = options.title        || 'Are you sure?'
    state.message      = options.message      || 'This action cannot be undone.'
    state.details      = options.details      || null
    state.note         = options.note         || null
    state.confirmLabel = options.confirmLabel || 'Confirm'
    state.cancelLabel  = options.cancelLabel  || 'Cancel'
    state.loading      = false

    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function onConfirm() {
    state.show = false
    state.resolve?.(true)
    state.resolve = null
  }

  function onCancel() {
    state.show = false
    state.resolve?.(false)
    state.resolve = null
  }

  function setLoading(val) {
    state.loading = val
  }

  return { confirm, confirmState: state, onConfirm, onCancel, setLoading }
}

// ── Pre-built confirmation dialogs ─────────────────────────────

export const CONFIRMS = {

  // Submitting a form for approval
  submitForm: (formType, semester, year) => ({
    type:         'submit',
    title:        `Submit ${formType} for Approval`,
    message:      `You are about to submit your ${formType} for ${String(semester) === '1' ? '1st' : '2nd'} Semester ${year} to your immediate supervisor for review and approval.`,
    details: [
      { label: 'Form Type', value: formType },
      { label: 'Period',    value: `${String(semester) === '1' ? '1st' : '2nd'} Semester ${year}` },
      { label: 'Status',   value: 'DRAFT -> SUBMITTED' }
    ],
    note:         'Once submitted, you will not be able to edit your targets unless your supervisor returns it for revision.',
    confirmLabel: 'Yes, Submit Form',
    cancelLabel:  'Not yet'
  }),

  // Approving a form (by DC)
  approveForm: (employeeName, formType) => ({
    type:         'approve',
    title:        `Approve ${formType} Targets`,
    message:      `You are approving the performance commitment targets of ${employeeName}. The employee will be notified and can begin logging accomplishments.`,
    details: [
      { label: 'Employee',  value: employeeName },
      { label: 'Form Type', value: formType },
      { label: 'Action',   value: 'SUBMITTED -> APPROVED' }
    ],
    note:         'Approved targets are locked for the employee. You can still add ratings at the end of the semester.',
    confirmLabel: 'Approve Targets',
    cancelLabel:  'Review Again'
  }),

  // Returning a form for revision
  returnForm: (employeeName) => ({
    type:         'warning',
    title:        'Return for Revision',
    message:      `The IPCRF/CCEF form of ${employeeName} will be returned to DRAFT status. The employee will be notified to make the necessary corrections.`,
    note:         'The employee must re-submit after making changes.',
    confirmLabel: 'Return for Revision',
    cancelLabel:  'Cancel'
  }),

  // Removing an indicator
  removeEntry: (kraName) => ({
    type:         'danger',
    title:        'Remove Indicator',
    message:      `Are you sure you want to remove this indicator from your form?`,
    details: [
      { label: 'KRA',  value: kraName || 'Selected indicator' }
    ],
    note:         'This cannot be undone. Any ratings or accomplishments entered for this indicator will also be removed.',
    confirmLabel: 'Yes, Remove It',
    cancelLabel:  'Keep It'
  }),

  // Saving/updating an entry
  saveEntry: (isEdit) => ({
    type:         'info',
    title:        isEdit ? 'Save Changes' : 'Add Indicator',
    message:      isEdit
      ? 'Your changes to this indicator will be saved to the form and the database.'
      : 'This indicator will be added to your IPCRF/CCEF form and saved to the database.',
    confirmLabel: isEdit ? 'Save Changes' : 'Add Indicator',
    cancelLabel:  'Cancel'
  }),

  // Creating a new form
  createForm: (type, semester, year) => ({
    type:         'info',
    title:        `Create New ${type} Form`,
    message:      `A new ${type} form will be created for ${String(semester) === '1' ? '1st' : '2nd'} Semester ${year}.`,
    details: [
      { label: 'Form Type', value: type },
      { label: 'Period',    value: `${String(semester) === '1' ? '1st' : '2nd'} Semester ${year}` }
    ],
    note:         'You can start adding your KRA targets immediately after creation.',
    confirmLabel: 'Create Form',
    cancelLabel:  'Cancel'
  }),

  // Computing final score
  computeScore: (employeeName) => ({
    type:         'approve',
    title:        'Compute Final Score',
    message:      `The final SPMS score for ${employeeName} will be computed based on all rated indicators using the official IPCRF formula.`,
    note:         'Make sure all indicators have been rated (E, Q, T) before computing. You can re-compute if needed.',
    confirmLabel: 'Compute Score',
    cancelLabel:  'Not Yet'
  }),

  // Deactivating a user
  deactivateUser: (name) => ({
    type:         'warning',
    title:        'Deactivate User Account',
    message:      `${name}'s account will be deactivated. They will no longer be able to log in to the system.`,
    details: [
      { label: 'User', value: name },
      { label: 'Action', value: 'Active -> Inactive' }
    ],
    note:         'You can reactivate this account at any time from User Management.',
    confirmLabel: 'Deactivate Account',
    cancelLabel:  'Cancel'
  }),

  // Activating a user
  activateUser: (name) => ({
    type:         'approve',
    title:        'Activate User Account',
    message:      `${name}'s account will be reactivated. They will be able to log in and use the system again.`,
    confirmLabel: 'Activate Account',
    cancelLabel:  'Cancel'
  }),

  // Resetting password
  resetPassword: (name) => ({
    type:         'warning',
    title:        'Reset Temporary Password',
    message:      `A new temporary password will be generated for ${name}. The user will be required to change it on next login.`,
    note:         'Make sure to share the new temporary password with the user through a secure channel.',
    confirmLabel: 'Generate New Password',
    cancelLabel:  'Cancel'
  }),

  // Creating a user
  createUser: (email, role) => ({
    type:         'info',
    title:        'Create User Account',
    message:      `A new PMES account will be created. The user can log in with their DSWD Google account or using the temporary password.`,
    details: [
      { label: 'Email', value: email || 'Not set' },
      { label: 'Role',  value: role  || 'Not set' }
    ],
    note:         'The temporary password will only be shown once. Copy and share it with the user securely.',
    confirmLabel: 'Create Account',
    cancelLabel:  'Cancel'
  }),

  // Saving form feedback (Part II)
  saveFeedback: () => ({
    type:         'submit',
    title:        'Save Part II Feedback',
    message:      'The performance feedback, strengths, areas for improvement, and recommendations will be saved to the form.',
    confirmLabel: 'Save Feedback',
    cancelLabel:  'Cancel'
  }),

  // Assign peers
  assignPeers: (name) => ({
    type:         'info',
    title:        'Assign JRB Peer Raters',
    message:      `Two peers will be randomly assigned to rate ${name}'s job-related behavior for this semester.`,
    details: [
      { label: 'Peer 1', value: 'Same division (5% weight)' },
      { label: 'Peer 2', value: 'Different division (5% weight)' }
    ],
    note:         'Assigned peers will receive a notification to complete the JRB peer rating form.',
    confirmLabel: 'Assign Peers',
    cancelLabel:  'Cancel'
  }),

  // Submit JRB rating
  submitJRB: (raterType, name) => ({
    type:         'submit',
    title:        `Submit JRB ${raterType} Rating`,
    message:      `Your job-related behavior rating for ${name} will be submitted. This rating will contribute to the final evaluation score.`,
    note:         'Once submitted, you can still update your rating before the rating period ends.',
    confirmLabel: 'Submit Rating',
    cancelLabel:  'Review Again'
  }),

  // Log attendance
  logAttendance: (name, month, year) => ({
    type:         'info',
    title:        'Save Attendance Record',
    message:      `Attendance record for ${name} for ${month}/${year} will be saved to the database.`,
    confirmLabel: 'Save Record',
    cancelLabel:  'Cancel'
  }),

  // Generic delete
  deleteRecord: (label) => ({
    type:         'danger',
    title:        'Delete Record',
    message:      `Are you sure you want to permanently delete this ${label || 'record'}? This action cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel:  'Cancel'
  })
}
