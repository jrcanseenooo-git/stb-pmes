<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Help"
      title="Rating Guide"
      subtitle="How to complete an assessment, what each rater relationship means, and how the rating scale is applied."
    >
      <template #actions>
        <RouterLink to="/library" class="btn-secondary">Assessment Library</RouterLink>
      </template>
    </PageHeader>

    <section class="card p-5">
      <h2 class="text-sm font-extrabold text-slate-900">Completing an assessment</h2>
      <ol class="mt-3 grid gap-3">
        <li v-for="(step, index) in STEPS" :key="step.title" class="flex gap-3">
          <span class="w-6 h-6 rounded-full bg-blue-700 text-white grid place-items-center text-xs font-extrabold shrink-0">
            {{ index + 1 }}
          </span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-900">{{ step.title }}</p>
            <p class="mt-0.5 text-xs text-slate-600 leading-relaxed">{{ step.detail }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="card overflow-hidden">
      <div class="card-header !px-4 !py-3">
        <h2 class="card-title">Rating Scale</h2>
        <span v-if="scaleSource" class="text-[11px] font-bold text-slate-400">{{ scaleSource }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" class="w-20">Rating</th>
              <th scope="col">Descriptor</th>
              <th scope="col">What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="level in SCALE" :key="level.value">
              <td><strong class="text-sm text-slate-900">{{ level.value }}</strong></td>
              <td class="font-bold text-slate-800">{{ level.descriptor }}</td>
              <td class="text-slate-600">{{ level.meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 leading-relaxed">
        Ratings accept one decimal place. Any value outside 1 to 5 is rejected by the form.
      </p>
    </section>

    <section class="card overflow-hidden">
      <div class="card-header !px-4 !py-3">
        <h2 class="card-title">Rater Relationships</h2>
      </div>
      <dl class="divide-y divide-slate-100">
        <div v-for="type in RATER_TYPES" :key="type.label" class="px-4 py-3">
          <dt class="text-sm font-bold text-slate-900">{{ type.label }}</dt>
          <dd class="mt-0.5 text-xs text-slate-600 leading-relaxed">{{ type.detail }}</dd>
        </div>
      </dl>
    </section>

    <section class="card overflow-hidden">
      <div class="card-header !px-4 !py-3">
        <h2 class="card-title">Common Questions</h2>
      </div>
      <div class="divide-y divide-slate-100">
        <details v-for="faq in FAQS" :key="faq.question" class="group">
          <summary class="px-4 py-3 cursor-pointer text-sm font-bold text-slate-900 hover:bg-slate-50 list-none flex items-center justify-between gap-3">
            {{ faq.question }}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </summary>
          <p class="px-4 pb-3.5 text-xs text-slate-600 leading-relaxed">{{ faq.answer }}</p>
        </details>
      </div>
    </section>

    <section class="card p-4 bg-slate-50">
      <p class="text-xs text-slate-600 leading-relaxed">
        <b class="text-slate-800">Still need help?</b>
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
