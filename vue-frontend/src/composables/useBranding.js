import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { officeAcronym } from '@/utils/officeAcronyms'

const STB_PORTAL_TITLE = 'Performance Management and Evaluation System'
const STB_PORTAL_SUBTITLE = 'Social Technology Bureau'
const CLUSTER_PORTAL_TITLE = 'Innovation Cluster Personnel Assessment Portal'

/**
 * Single source of truth for portal naming.
 *
 * The cluster specification requires the portal title and the office subtitle to
 * follow the authenticated user everywhere the system names itself - shell,
 * browser tab, reports, print views and exports. Anything that renders a title
 * should read it from here rather than hard-coding "PMES" or "STB", so a new
 * participating office needs no code change to be named correctly.
 */
export function useBranding() {
  const authStore = useAuthStore()

  const systemScope = computed(() => authStore.profile?.systemScope || 'STB_FULL')
  const isClusterPortal = computed(() => systemScope.value !== 'STB_FULL')

  const officeName = computed(() => authStore.profile?.officeName || '')
  const officeCode = computed(() => authStore.profile?.officeCode || '')
  const officeShortName = computed(() => officeAcronym({
    officeCode: officeCode.value,
    officeName: officeName.value,
    officeId: authStore.profile?.officeId || ''
  }))

  const portalTitle = computed(() => (isClusterPortal.value ? CLUSTER_PORTAL_TITLE : STB_PORTAL_TITLE))

  const portalSubtitle = computed(() => {
    if (!isClusterPortal.value) return STB_PORTAL_SUBTITLE
    return officeName.value || 'Innovation Cluster'
  })

  // The sidebar wordmark's second line wraps rather than truncates (see
  // .brand-sub in AppLayout.vue), so it isn't limited to one short line.
  const wordmarkTop = computed(() => (isClusterPortal.value ? 'INNOVATION CLUSTER' : 'PERFORMANCE MANAGEMENT'))
  const wordmarkBottom = computed(() => (isClusterPortal.value ? 'Performance Monitoring and Evaluation System' : 'AND EVALUATION SYSTEM'))

  const shortName = computed(() => {
    if (!isClusterPortal.value) return 'PMES'
    return officeShortName.value || 'ICPAP'
  })

  // Used for the browser tab and for report/print headers.
  const documentTitle = (pageTitle = '') => {
    const base = isClusterPortal.value ? `${shortName.value} Assessment Portal` : 'PMES'
    return pageTitle ? `${pageTitle} · ${base}` : base
  }

  const reportHeader = computed(() => ({
    title: portalTitle.value,
    subtitle: portalSubtitle.value,
    officeCode: officeShortName.value || officeCode.value
  }))

  return {
    systemScope,
    isClusterPortal,
    officeName,
    officeCode,
    officeShortName,
    portalTitle,
    portalSubtitle,
    wordmarkTop,
    wordmarkBottom,
    shortName,
    documentTitle,
    reportHeader
  }
}
