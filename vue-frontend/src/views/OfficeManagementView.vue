<template>
  <div class="pui-page">
    <PageHeader
      kicker="Office Administration"
      title="Office Structure"
      :subtitle="`Maintain the divisions, sections, and registration options for ${officeName || 'your office'}.`"
    />

    <section class="office-management-shell">
      <OfficeRegistryView embedded />
    </section>
  </div>
</template>

<script setup>
import { useBranding } from '@/composables/useBranding'
import PageHeader from '@/components/ui/PageHeader.vue'
import OfficeRegistryView from './OfficeRegistryView.vue'

const { officeName } = useBranding()
</script>

<style scoped>
.office-management-shell {
  display: grid;
  gap: 14px;
}

</style>
