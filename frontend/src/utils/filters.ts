// ─────────────────────────────────────────────────────────────────────────────
// Filter logic — List A, B, C generation
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture, FilterSettings } from '../types/Fixture';

// Helper: is a predicted score a home win?
function isHomeWinScore(score: string): boolean {
  const parts = score.split('-');
  if (parts.length !== 2) return false;
  const h = parseInt(parts[0], 10);
  const a = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(a)) return false;
  return h > a;
}

// ── Pre-filter: apply global toggles ─────────────────────────────────────────

function applyGlobalToggles(fixtures: Fixture[], f: FilterSettings): Fixture[] {
  return fixtures.filter(fx => {
    if (f.upcomingOnly && fx.status !== 'upcoming') return false;
    if (f.hideYouthReserve && fx.isYouthOrReserve) return false;
    if (f.hideWomens && fx.isWomen) return false;
    if (!f.includeCups && fx.isCup) return false;
    if (!f.includeLowConfidenceParsed && fx.parseConfidence < 60) return false;
    if (f.leagueSearch && !fx.league.toLowerCase().includes(f.leagueSearch.toLowerCase()) &&
        !(fx.competition ?? '').toLowerCase().includes(f.leagueSearch.toLowerCase()) &&
        !fx.homeTeam.toLowerCase().includes(f.leagueSearch.toLowerCase()) &&
        !fx.awayTeam.toLowerCase().includes(f.leagueSearch.toLowerCase())) return false;
    // Odds filters (only applied when odds are available)
    if (f.showOnlyWithOdds && !fx.oddsAttached) return false;
    if (fx.oddsAttached && fx.homeOdds1X2) {
      if (f.minHomeOdds > 1.00 && fx.homeOdds1X2 < f.minHomeOdds) return false;
      if (f.maxHomeOdds > 0    && fx.homeOdds1X2 > f.maxHomeOdds) return false;
    }
    return true;
  });
}

// ── List A ────────────────────────────────────────────────────────────────────
// All upcoming games with homeWinProb >= minHomeWinProb

export function buildListA(fixtures: Fixture[], f: FilterSettings): Fixture[] {
  const filtered = applyGlobalToggles(fixtures, f);
  return filtered
    .filter(fx =>
      fx.homeWinProb >= f.minHomeWinProb &&
      fx.parseConfidence >= (f.includeLowConfidenceParsed ? 0 : 60)
    )
    .sort((a, b) => {
      // Sort by timeGMT first, then homeWinProb desc
      const t = a.timeGMT.localeCompare(b.timeGMT);
      if (t !== 0) return t;
      return b.homeWinProb - a.homeWinProb;
    });
}

// ── List B ────────────────────────────────────────────────────────────────────
// Stricter: avgGoals >= 2.5, predicted home win, no high-risk flags

export function buildListB(listA: Fixture[], f: FilterSettings): Fixture[] {
  return listA
    .filter(fx => {
      if (fx.avgGoals < f.minAvgGoals) return false;
      if (f.requirePredictedHomeWin && !isHomeWinScore(fx.correctScore)) return false;
      if (f.requireOverTwoFive && fx.avgGoals < 2.5) return false;
      if (f.excludeDerbies && fx.isDerbyRisk) return false;
      if (f.excludeCupsAndSecondLegs && (fx.isCup || fx.isSecondLegRisk)) return false;
      if (f.excludeRelegationTraps && fx.isRelegationTrapRisk) return false;
      if (fx.lowBlockRisk >= 70) return false;         // high low-block risk
      if (fx.motivationScore < 40) return false;       // likely dead rubber
      if (fx.formProxyScore < 50) return false;        // weak form proxy
      return true;
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// ── List C ────────────────────────────────────────────────────────────────────
// Best fixtures from List B, ranked by confidenceScore

export function buildListC(listB: Fixture[], f: FilterSettings): Fixture[] {
  return listB
    .filter(fx => fx.confidenceScore >= f.minConfidenceScore)
    .slice(0, f.bestListSize);
}

// ── Needs Review ──────────────────────────────────────────────────────────────
// Fixtures with low parse confidence

export function buildNeedsReview(fixtures: Fixture[]): Fixture[] {
  return fixtures.filter(fx => fx.parseConfidence < 60);
}

// ── Confidence label ──────────────────────────────────────────────────────────

export type ConfidenceLabel = 'Very Strong' | 'Strong' | 'Good' | 'Watchlist';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return 'Very Strong';
  if (score >= 70) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Watchlist';
}

export function confidenceColour(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 70) return 'text-lime-700 bg-lime-50';
  if (score >= 60) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}
