<template>
  <transition name="modal-fade">
    <div v-if="show" class="overlay" @click.self="$emit('cancel')">
      <div class="modal" :class="`modal-${type}`">

        <!-- Icon -->
        <div class="icon-wrap" :class="`icon-${type}`">
          <!-- Danger -->
          <svg v-if="type === 'danger'" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 3L2 24h24L14 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 11v6M14 20v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <!-- Warning -->
          <svg v-else-if="type === 'warning'" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="2"/>
            <path d="M14 9v6M14 18v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <!-- Submit -->
          <svg v-else-if="type === 'submit'" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14l6 6L23 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <!-- Approve -->
          <svg v-else-if="type === 'approve'" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 3L2 24h24L14 3z" stroke="transparent"/>
            <circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="2"/>
            <path d="M9 14l3.5 3.5L19 10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <!-- Info / default -->
          <svg v-else width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="2"/>
            <path d="M14 12v8M14 9v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- Content -->
        <div class="modal-content">
          <h3 class="modal-title">{{ title }}</h3>
          <p class="modal-message">{{ message }}</p>

          <!-- Detail list (optional) -->
          <div v-if="details && details.length" class="detail-list">
            <div v-for="d in details" :key="d.label" class="detail-row">
              <span class="detail-label">{{ d.label }}</span>
              <span class="detail-value">{{ d.value }}</span>
            </div>
          </div>

          <!-- Warning note (optional) -->
          <div v-if="note" class="note-box" :class="`note-${type}`">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M6.5 6v3M6.5 4.5v.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            {{ note }}
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button class="btn-cancel" @click="$emit('cancel')" :disabled="loading">
            {{ cancelLabel || 'Cancel' }}
          </button>
          <button :class="['btn-confirm', `btn-confirm-${type}`]"
            @click="$emit('confirm')" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <component :is="confirmIcon" v-else-if="confirmIcon"/>
            {{ loading ? 'Processing...' : confirmLabel || 'Confirm' }}
          </button>
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  show:         { type: Boolean, default: false },
  type:         { type: String,  default: 'info' }, // info | warning | danger | submit | approve
  title:        { type: String,  required: true },
  message:      { type: String,  required: true },
  details:      { type: Array,   default: null },  // [{ label, value }]
  note:         { type: String,  default: null },
  confirmLabel: { type: String,  default: 'Confirm' },
  cancelLabel:  { type: String,  default: 'Cancel' },
  loading:      { type: Boolean, default: false },
  confirmIcon:  { type: Object,  default: null }
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}

.overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; padding: 16px;
  backdrop-filter: blur(4px);
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 100%; max-width: 420px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.2);
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

/* Top accent bar */
.modal::before {
  content: '';
  display: block;
  height: 4px;
  width: 100%;
}
.modal-danger::before  { background: linear-gradient(90deg, #EF4444, #DC2626); }
.modal-warning::before { background: linear-gradient(90deg, #F59E0B, #D97706); }
.modal-submit::before  { background: linear-gradient(90deg, #3B82F6, #2563EB); }
.modal-approve::before { background: linear-gradient(90deg, #22C55E, #16A34A); }
.modal-info::before    { background: linear-gradient(90deg, #6366F1, #4F46E5); }

/* Icon */
.icon-wrap {
  display: flex; align-items: center; justify-content: center;
  width: 60px; height: 60px; border-radius: 50%;
  margin: 24px auto 0;
}
.icon-danger  { background: #FEF2F2; color: #DC2626; }
.icon-warning { background: #FFFBEB; color: #D97706; }
.icon-submit  { background: #EFF6FF; color: #2563EB; }
.icon-approve { background: #F0FDF4; color: #16A34A; }
.icon-info    { background: #EEF2FF; color: #4F46E5; }

/* Content */
.modal-content {
  padding: 16px 28px 20px;
  text-align: center;
}

.modal-title {
  font-size: 17px; font-weight: 700; color: #0F172A;
  margin-bottom: 8px; letter-spacing: -0.3px;
}

.modal-message {
  font-size: 13px; color: #64748B; line-height: 1.6;
}

/* Detail list */
.detail-list {
  margin-top: 14px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  overflow: hidden;
  text-align: left;
}

.detail-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid #F1F5F9;
  font-size: 12px;
}
.detail-row:last-child { border-bottom: none; }

.detail-label { color: #94A3B8; font-weight: 500; }
.detail-value { color: #0F172A; font-weight: 600; }

/* Note box */
.note-box {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 12px; padding: 10px 12px;
  border-radius: 8px; font-size: 12px; line-height: 1.5;
  text-align: left;
}
.note-danger  { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
.note-warning { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; }
.note-submit  { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
.note-approve { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
.note-info    { background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; }

/* Actions */
.modal-actions {
  display: flex; gap: 10px;
  padding: 16px 28px 24px;
}

.btn-cancel {
  flex: 1; padding: 11px;
  background: #F8FAFC; border: 1.5px solid #E2E8F0;
  border-radius: 10px; font-size: 13px; font-weight: 500;
  color: #64748B; cursor: pointer; font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}
.btn-cancel:hover:not(:disabled) { background: #F1F5F9; border-color: #CBD5E1; color: #374151; }
.btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-confirm {
  flex: 1.4; padding: 11px;
  border: none; border-radius: 10px;
  font-size: 13px; font-weight: 600;
  color: #fff; cursor: pointer; font-family: 'Inter', sans-serif;
  transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 7px;
}
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-confirm-danger  { background: linear-gradient(135deg, #EF4444, #DC2626); box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
.btn-confirm-warning { background: linear-gradient(135deg, #F59E0B, #D97706); box-shadow: 0 4px 12px rgba(245,158,11,0.3); }
.btn-confirm-submit  { background: linear-gradient(135deg, #3B82F6, #2563EB); box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
.btn-confirm-approve { background: linear-gradient(135deg, #22C55E, #16A34A); box-shadow: 0 4px 12px rgba(34,197,94,0.3); }
.btn-confirm-info    { background: linear-gradient(135deg, #6366F1, #4F46E5); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }

.btn-confirm-danger:hover:not(:disabled)  { background: linear-gradient(135deg, #DC2626, #B91C1C); }
.btn-confirm-submit:hover:not(:disabled)  { background: linear-gradient(135deg, #2563EB, #1D4ED8); }
.btn-confirm-approve:hover:not(:disabled) { background: linear-gradient(135deg, #16A34A, #15803D); }
.btn-confirm-warning:hover:not(:disabled) { background: linear-gradient(135deg, #D97706, #B45309); }

/* Spinner */
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }
</style>
