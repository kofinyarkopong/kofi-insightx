'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Score, classify, and apply filters
//
// Filter A (Broad)   : homeWinProb >= 45
// Filter B (Strict)  : homeWinProb >= 55 AND confidenceScore >= 60
// Best Shortlist     : top fixtures by confidenceScore from Filter B
// Needs Review       : homeWinProb >= 40 but < 45 (border cases)
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_A_MIN_PROB   = 45;
const FILTER_B_MIN_PROB   = 55;
const FILTER_B_MIN_SCORE  = 60;
const BEST_SHORTLIST_SIZE = 15;

/**
 * Compute a confidence score (0-100) for a fixture.
 * Weighted combination of probability dominance, score prediction certainty,
 * and goal expectation.
 */
function scoreFixture(f) {
  let score = 0;
  const breakdown = {};

  // 1. Home win probability (0-40 points)
  if (f.homeWinProb !== null) {
    const prob = Math.min(f.homeWinProb, 85);
    const pts  = Math.round(((prob - 40) / 45) * 40);
    breakdown.probScore = Math.max(0, pts);
    score += breakdown.probScore;
  }

  // 2. Dominance over draw (0-20 points): how much home > draw
  if (f.homeWinProb !== null && f.drawProb !== null) {
    const gap = f.homeWinProb - f.drawProb;
    const pts = Math.round(Math.min(Math.max(gap, 0), 30) * (20 / 30));
    breakdown.dominanceScore = pts;
    score += pts;
  }

  // 3. Predicted score alignment (0-20 points): score predicts home win
  if (f.predictedScore) {
    const parts = f.predictedScore.split('-').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > parts[1]) {
        const margin = Math.min(parts[0] - parts[1], 3);
        const pts    = Math.round((margin / 3) * 20);
        breakdown.scoreAlignmentScore = pts;
        score += pts;
      } else {
        breakdown.scoreAlignmentScore = 0;
      }
    }
  }

  // 4. Goal expectation (0-10 points): 1.5–2.5 goals is ideal
  if (f.avgGoals !== null) {
    const ideal = f.avgGoals >= 1.2 && f.avgGoals <= 3.0;
    const pts   = ideal ? 10 : 5;
    breakdown.goalsScore = pts;
    score += pts;
  }

  // 5. Enrichment bonus (0-10 points)
  if (f.enriched && f.enrichmentData) {
    const ed = f.enrichmentData;
    let bonus = 0;
    if (ed.homeScoredLast10 !== undefined && ed.homeScoredLast10 >= 7) bonus += 5;
    if (ed.awayConcededLast10 !== undefined && ed.awayConcededLast10 >= 6) bonus += 5;
    breakdown.enrichmentBonus = bonus;
    score += bonus;
  }

  const finalScore = Math.min(Math.round(score), 100);

  let tier;
  if      (finalScore >= 80) tier = 'strong';
  else if (finalScore >= 70) tier = 'watch';
  else if (finalScore >= 60) tier = 'lean';
  else                       tier = 'reject';

  return { confidenceScore: finalScore, confidenceTier: tier, scoreBreakdown: breakdown };
}

/**
 * Compute risk flags for a fixture.
 */
function computeRiskFlags(f) {
  const flags = [];
  if (f.homeWinProb !== null && f.homeWinProb < 50) flags.push('low_prob');
  if (f.drawProb !== null && f.drawProb > 30) flags.push('high_draw_prob');
  if (f.predictedScore) {
    const parts = f.predictedScore.split('-').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] <= parts[1]) {
      flags.push('score_mismatch');
    }
  }
  if (f.league && /women|ladies|female/i.test(f.league)) flags.push('womens_match');
  return flags;
}

/**
 * Apply all filters and scoring to an array of raw fixtures.
 * Returns the same array with scoring and filter fields populated.
 * @param {Array<object>} fixtures
 * @returns {Array<object>}
 */
function applyFilters(fixtures) {
  // Score every fixture
  for (const f of fixtures) {
    const { confidenceScore, confidenceTier, scoreBreakdown } = scoreFixture(f);
    f.confidenceScore = confidenceScore;
    f.confidenceTier  = confidenceTier;
    f.scoreBreakdown  = scoreBreakdown;
    f.riskFlags       = computeRiskFlags(f);

    f.filterA      = (f.homeWinProb ?? 0) >= FILTER_A_MIN_PROB;
    f.filterB      = (f.homeWinProb ?? 0) >= FILTER_B_MIN_PROB && confidenceScore >= FILTER_B_MIN_SCORE;
    f.needsReview  = !f.filterA && (f.homeWinProb ?? 0) >= 40;
    f.bestShortlist = false; // assigned below
  }

  // Best shortlist: top N from filter B by confidence score
  const filterBFixtures = fixtures
    .filter(f => f.filterB)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const shortlistIds = new Set(filterBFixtures.slice(0, BEST_SHORTLIST_SIZE).map(f => f.id));
  for (const f of fixtures) {
    f.bestShortlist = shortlistIds.has(f.id);
  }

  const counts = {
    total:         fixtures.length,
    filterA:       fixtures.filter(f => f.filterA).length,
    filterB:       fixtures.filter(f => f.filterB).length,
    bestShortlist: fixtures.filter(f => f.bestShortlist).length,
    strong:        fixtures.filter(f => f.confidenceTier === 'strong').length,
    needsReview:   fixtures.filter(f => f.needsReview).length,
  };

  console.log('[Filters] Results:', counts);
  return fixtures;
}

module.exports = { applyFilters };
