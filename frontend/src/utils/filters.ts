// ─────────────────────────────────────────────────────────────────────────────
// Filter logic — uses pre-computed flags from the Supabase scraper
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture, FilterSettings } from '../types/Fixture';

function matchesSearch(fx: Fixture, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    (fx.league ?? '').toLowerCase().includes(q) ||
    fx.homeTeam.toLowerCase().includes(q) ||
    fx.awayTeam.toLowerCase().includes(q)
  );
}

function isWomens(fx: Fixture): boolean {
  return /women|ladies|female/i.test(fx.league ?? '');
}

function applyCommon(fixtures: Fixture[], f: FilterSettings): Fixture[] {
  return fixtures.filter(fx => {
    if (f.hideWomens && isWomens(fx)) return false;
    if (!matchesSearch(fx, f.leagueSearch)) return false;
    return true;
  });
}

// ── List A — all fixtures that passed filter_a in the scraper ────────────────

export function buildListA(fixtures: Fixture[], f: FilterSettings): Fixture[] {
  return applyCommon(
    fixtures.filter(fx => fx.filterA && (fx.homeWinProb ?? 0) >= f.minHomeWinProb),
    f
  ).sort((a, b) => (b.homeWinProb ?? 0) - (a.homeWinProb ?? 0));
}

// ── List B — stricter filter_b + optional client-side confidence threshold ───

export function buildListB(listA: Fixture[], f: FilterSettings): Fixture[] {
  return listA
    .filter(fx => fx.filterB && fx.confidenceScore >= f.minConfidenceScore)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// ── List C — best shortlist from scraper (top N by confidence) ───────────────

export function buildListC(listB: Fixture[], f: FilterSettings): Fixture[] {
  return listB
    .filter(fx => fx.bestShortlist)
    .slice(0, f.bestListSize);
}

// ── Needs Review ─────────────────────────────────────────────────────────────

export function buildNeedsReview(fixtures: Fixture[]): Fixture[] {
  return fixtures.filter(fx => fx.needsReview);
}

// ── Confidence helpers ────────────────────────────────────────────────────────

export type ConfidenceLabel = 'Strong' | 'Watch' | 'Lean' | 'Reject';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Watch';
  if (score >= 60) return 'Lean';
  return 'Reject';
}

export function confidenceColour(score: number): string {
  if (score >= 80) return 'text-green-400 bg-green-950/40';
  if (score >= 70) return 'text-amber-300 bg-amber-950/40';
  if (score >= 60) return 'text-orange-300 bg-orange-950/40';
  return 'text-red-400 bg-red-950/40';
}
