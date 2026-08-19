// src/composables/useRatings.js
// Client-side rating helpers (mirrors server computation for preview).
// The authoritative rating is always computed server-side.

export function useRatings() {

  /**
   * Timeliness score based on days relative to deadline.
   * @param {string} submittedAt ISO date string
   * @param {string} deadline    ISO date string
   * @returns {number} 1-5
   */
  function timelinessScore(submittedAt, deadline) {
    if (!submittedAt || !deadline) return 1
    const diff = Math.floor(
      (new Date(deadline) - new Date(submittedAt)) / (1000 * 60 * 60 * 24)
    )
    if (diff >= 3)  return 5  // Outstanding: 3+ days early
    if (diff >= 1)  return 4  // Very Satisfactory: 1-2 days early
    if (diff === 0) return 3  // Satisfactory: on deadline day
    if (diff >= -3) return 2  // Unsatisfactory: 1-3 days late
    return 1                  // Poor: 4+ days late
  }

  /**
   * Quality score based on number of revision requests.
   * @param {number} revisions
   * @returns {number} 1-5
   */
  function qualityScore(revisions) {
    if (revisions === 0) return 5
    if (revisions === 1) return 4
    if (revisions === 2) return 3
    if (revisions === 3) return 2
    return 1
  }

  /**
   * Efficiency score based on accomplishment percentage vs target.
   * @param {number} accomplished
   * @param {number} target
   * @returns {number} 1-5
   */
  function efficiencyScore(accomplished, target) {
    if (!target) return 1
    const pct = (accomplished / target) * 100
    if (pct >= 100) return 5
    if (pct >= 90)  return 4
    if (pct >= 80)  return 3
    if (pct >= 51)  return 2
    return 1
  }

  /**
   * Weighted overall rating (Efficiency 30%, Quality 30%, Timeliness 40%).
   */
  function overallRating(efficiency, quality, timeliness) {
    return +(efficiency * 0.30 + quality * 0.30 + timeliness * 0.40).toFixed(2)
  }

  /**
   * Rating label from numeric score.
   */
  function ratingLabel(score) {
    if (score >= 4.5) return 'Outstanding'
    if (score >= 3.5) return 'Very Satisfactory'
    if (score >= 2.5) return 'Satisfactory'
    if (score >= 1.5) return 'Unsatisfactory'
    return 'Poor'
  }

  /**
   * Full rating object for a single accomplishment entry.
   */
  function computeRating({ accomplished, target, submittedAt, deadline, revisions }) {
    const E = efficiencyScore(accomplished, target)
    const Q = qualityScore(revisions ?? 0)
    const T = timelinessScore(submittedAt, deadline)
    const O = overallRating(E, Q, T)
    return { efficiency: E, quality: Q, timeliness: T, overall: O, label: ratingLabel(O) }
  }

  return { timelinessScore, qualityScore, efficiencyScore, overallRating, ratingLabel, computeRating }
}
