<template>
  <div class="pui-page">
    <PageHeader
      kicker="Office Administration"
      title="Office Management"
      :subtitle="`Maintain structure and personnel records for ${officeName || 'your office'}.`"
    >
      <template #actions>
        <div class="office-management-tabs" role="tablist" aria-label="Office management features">
          <button
            v-if="canConfigureOfficeStructure"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'structure'"
            :class="['office-management-tab', activeTab === 'structure' && 'office-management-tab-active']"
            @click="setTab('structure')"
          >
            Structure
          </button>
          <button
            v-if="canViewOfficePersonnel"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'personnel'"
            :class="['office-management-tab', activeTab === 'personnel' && 'office-management-tab-active']"
            @click="setTab('personnel')"
          >
            Personnel
          </button>
        </div>
      </template>
    </PageHeader>

    <section class="office-management-shell">
      <OfficeRegistryView v-if="activeTab === 'structure'" embedded />
      <OfficePersonnelView v-else embedded />
    </section>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissions } from '@/composables/usePermissions'
import { useBranding } from '@/composables/useBranding'
import PageHeader from '@/components/ui/PageHeader.vue'
import OfficeRegistryView from './OfficeRegistryView.vue'
import OfficePersonnelView from './OfficePersonnelView.vue'

const route = useRoute()
const router = useRouter()
const { canConfigureOfficeStructure, canViewOfficePersonnel } = usePermissions()
const { officeName } = useBranding()

const defaultTab = computed(() => (canConfigureOfficeStructure.value ? 'structure' : 'personnel'))
const availableTabs = computed(() => [
  canConfigureOfficeStructure.value ? 'structure' : '',
  canViewOfficePersonnel.value ? 'personnel' : ''
].filter(Boolean))

const activeTab = computed(() => {
  const requested = String(route.query.tab || '').toLowerCase()
  return availableTabs.value.includes(requested) ? requested : defaultTab.value
})

watch(activeTab, tab => {
  if (route.query.tab === tab) return
  router.replace({ query: { ...route.query, tab } })
}, { immediate: true })

function setTab(tab) {
  router.replace({ query: { ...route.query, tab } })
}
</script>

<style scoped>
.office-management-shell {
  display: grid;
  gap: 14px;
}

.office-management-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: min(360px, 42vw);
  padding: 6px;
  border: 1px solid #dbe6f4;
  border-radius: 10px;
  background: #fff;
}

.office-management-tab {
  min-height: 36px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.office-management-tab:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.office-management-tab-active {
  background: #08213d;
  color: #fff;
}

.office-management-tab-active:hover {
  border-color: transparent;
  background: #08213d;
}

@media (max-width: 720px) {
  .office-management-tabs {
    width: min(100%, 420px);
  }
}
</style>
