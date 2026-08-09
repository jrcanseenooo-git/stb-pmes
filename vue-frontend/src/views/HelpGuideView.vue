<template>
  <div class="pui-page">
    <PageHeader
      kicker="Help"
      title="Rating Guide"
      subtitle="How to complete an assessment, what each rater relationship means, and how the rating scale is applied."
    >
      <template #actions>
        <RouterLink to="/library" class="pui-btn">Assessment Library</RouterLink>
      </template>
    </PageHeader>

    <section class="pui-card" style="padding:20px;">
      <h2 class="pui-card-title">Completing an assessment</h2>
      <ol style="margin:14px 0 0; padding:0; list-style:none; display:grid; gap:12px;">
        <li v-for="(step, index) in STEPS" :key="step.title" style="display:flex; gap:12px;">
          <span style="width:24px; height:24px; border-radius:999px; background:#0b3b75; color:#fff; display:grid; place-items:center; font-size:11px; font-weight:800; flex-shrink:0;">
            {{ index + 1 }}
          </span>
          <div style="min-width:0;">
            <p style="margin:0; font-size:13.5px; font-weight:700; color:#0f172a;">{{ step.title }}</p>
            <p style="margin:3px 0 0; font-size:12px; color:#64748b; line-height:1.5;">{{ step.detail }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Rating Scale</h2>
        <span v-if="scaleSource" style="font-size:11px; font-weight:700; color:#94a3b8;">{{ scaleSource }}</span>
      </div>
      <div class="pui-table-wrap">
        <table class="pui-table">
          <thead>
            <tr>
              <th scope="col" style="width:80px;">Rating</th>
              <th scope="col">Descriptor</th>
              <th scope="col">What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="level in SCALE" :key="level.value">
              <td><strong>{{ level.value }}</strong></td>
              <td style="font-weight:700; color:#334155;">{{ level.descriptor }}</td>
              <td>{{ level.meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="padding:12px 16px; font-size:12px; color:#64748b; border-top:1px solid #eef2f7; line-height:1.5; margin:0;">
        Ratings accept one decimal place. Any value outside 1 to 5 is rejected by the form.
      </p>
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Rater Relationships</h2>
      </div>
      <dl style="margin:0;">
        <div v-for="type in RATER_TYPES" :key="type.label" style="padding:12px 16px; border-top:1px solid #eef2f7;">
          <dt style="font-size:13px; font-weight:700; color:#0f172a; margin:0;">{{ type.label }}</dt>
          <dd style="margin:3px 0 0; font-size:12px; color:#64748b; line-height:1.5;">{{ type.detail }}</dd>
        </div>
      </dl>
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Common Questions</h2>
      </div>
      <div>
        <details v-for="faq in FAQS" :key="faq.question" style="border-top:1px solid #eef2f7;">
          <summary style="padding:12px 16px; cursor:pointer; font-size:13px; font-weight:700; color:#0f172a; list-style:none; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            {{ faq.question }}
          </summary>
          <p style="padding:0 16px 14px; font-size:12px; color:#64748b; line-height:1.5; margin:0;">{{ faq.answer }}</p>
        </details>
      </div>
    </section>

    <section class="pui-card" style="padding:16px; background:#f8fafc;">
      <p style="font-size:12px; color:#475569; line-height:1.55; margin:0;">
        <b style="color:#334155;">Still need help?</b>
        Contact your office administrator for questions about your assignments, your personnel
        details, or the assessment period. They can also request a rating task be reopened if a
        correction is needed after submission.
      </p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import PageHeader from '@/components/ui/PageHeader.vue'

// The scale is the approved protocol's, restated in plain language. The
// indicator text itself is never duplicated here — that lives in the Assessment
// Library and is loaded from the same published content, so there is one source
// of truth to maintain.
const SCALE = [
  { value: '5', descriptor: 'Outstanding', meaning: 'Consistently exceeds what the indicator describes, with clear and repeated evidence.' },
  { value: '4', descriptor: 'Very Satisfactory', meaning: 'Frequently exceeds what the indicator describes.' },
  { value: '3', descriptor: 'Satisfactory', meaning: 'Meets what the indicator describes.' },
  { value: '2', descriptor: 'Fair', meaning: 'Partially meets what the indicator describes; improvement is needed.' },
  { value: '1', descriptor: 'Needs Improvement', meaning: 'Does not yet meet what the indicator describes.' }
]

const RATER_TYPES = [
  { label: 'Self-assessment', detail: 'You rate your own performance against the same indicators used by your other raters.' },
  { label: 'Peer', detail: 'You rate a colleague at a comparable level in your office.' },
  { label: 'Subordinate', detail: 'You rate someone who reports to you.' },
  { label: 'Immediate Supervisor', detail: 'You rate the person you report to directly.' },
  { label: 'Skip-Level Supervisor', detail: 'You rate the supervisor above your immediate supervisor.' }
]

const STEPS = [
  { title: 'Open My Rating Tasks', detail: 'Every person you have been assigned to rate for the current period is listed there with its status.' },
  { title: 'Open a task', detail: 'Select Start Rating for a new task, or Continue for one you have already partly filled in.' },
  { title: 'Rate every indicator', detail: 'Work through each category. Indicators marked as required must be answered before the form can be submitted.' },
  { title: 'Save your draft as you go', detail: 'Saving keeps your entries without submitting them. You can close the form and come back later.' },
  { title: 'Submit the final rating', detail: 'Submitting is final. The task moves to Submitted and can only be changed if an administrator reopens it.' }
]

const FAQS = [
  {
    question: 'Can I change a rating after I submit it?',
    answer: 'No. A submitted rating is locked. If a correction is genuinely needed, ask your office administrator to reopen the task — reopening is recorded in the audit log.'
  },
  {
    question: 'What happens if I lose connection while rating?',
    answer: 'Entries you have already saved as a draft are kept. Anything typed since your last save may be lost, so save periodically on long forms.'
  },
  {
    question: 'Will the person I rate see my individual scores?',
    answer: 'No. Individual rater scores and rater identities are not shown to the person being rated. They see only the consolidated result once all raters have submitted.'
  },
  {
    question: 'When will I see my own results?',
    answer: 'Your consolidated result appears under My Results once every assigned rater has submitted and the result has been finalized for the period.'
  },
  {
    question: 'A person I should be rating is missing from my list.',
    answer: 'Rating assignments are generated by your office administrator. Contact them so the assignment can be added for the current period.'
  }
]

const scaleSource = ref('')

onMounted(async () => {
  // Surfaces the published content version so the guide and the library are
  // visibly the same release, without duplicating the content itself.
  try {
    const data = await portalApi.library()
    if (data?.version) scaleSource.value = `Assessment content version ${data.version}`
  } catch (e) {
    scaleSource.value = ''
  }
})
</script>
