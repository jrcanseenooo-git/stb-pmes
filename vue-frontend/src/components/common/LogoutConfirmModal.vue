<template>
  <transition name="modal-fade">
    <div v-if="show" class="overlay" @click.self="$emit('cancel')">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title">

        <div class="modal-body">
          <div class="icon-box">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M8 3H4.5A1.5 1.5 0 003 4.5v13A1.5 1.5 0 004.5 19H8M15.5 15.5L20 11l-4.5-4.5M20 11H8"
                stroke="#CE1126" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <h2 id="logout-title" class="title">Sign out of PMES?</h2>
          <p class="sub">You'll need to sign in again with your account to continue.</p>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="$emit('cancel')" :disabled="loading">
            Cancel
          </button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span>{{ loading ? 'Signing out…' : 'Sign Out' }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['confirm', 'cancel'])

const loading = ref(false)

async function handleConfirm() {
  loading.value = true
  try {
    await emit('confirm')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

.overlay {
  position: fixed; inset: 0;
  background: rgba(9, 19, 38, .6);
  display: flex; align-items: center; justify-content: center;
  z-index: 600; padding: 16px;
  font-family: Inter, system-ui, sans-serif;
}

.modal {
  background: #FFFFFF;
  border-radius: 14px;
  width: 100%; max-width: 380px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(9, 19, 38, .25);
}

.modal-body {
  padding: 28px 26px 22px;
  text-align: center;
}

.icon-box {
  width: 48px; height: 48px;
  border-radius: 10px;
  background: #FEF2F2;
  border: 1px solid #FCE4E6;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: #091326;
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}

.sub {
  font-size: 13px;
  color: #64748B;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 22px 22px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: Inter, system-ui, sans-serif;
  cursor: pointer;
  transition: background-color .15s, border-color .15s;
}

.btn-cancel {
  background: #F1F4F8;
  border: 1px solid #E2E8F0;
  color: #334155;
}
.btn-cancel:hover:not(:disabled) { background: #E7EBF1; }

.btn-confirm {
  background: #CE1126;
  border: 1px solid #CE1126;
  color: #fff;
}
.btn-confirm:hover:not(:disabled) { background: #B30E21; }

.btn-cancel:disabled,
.btn-confirm:disabled { opacity: .6; cursor: not-allowed; }

.spinner {
  width: 12px; height: 12px;
  border: 1.5px solid rgba(255,255,255,.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal, .modal-fade-leave-active .modal { transition: transform .15s ease; }
.modal-fade-enter-from .modal, .modal-fade-leave-to .modal { transform: scale(.97); }
</style>