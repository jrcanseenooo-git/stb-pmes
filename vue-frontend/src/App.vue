<template>
  <RouterView />
  <ConfirmModal
    v-bind="confirmState"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>

<script setup>
import { RouterView } from 'vue-router'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { useConfirm } from '@/composables/useConfirm'

const { confirmState, onConfirm, onCancel } = useConfirm()
</script>
