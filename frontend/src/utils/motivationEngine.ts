// ─────────────────────────────────────────────────────────────────────────────
// Live Motivation Engine
//
// Uses real league standings from Football-Data.org to replace the proxy-based
// motivation and form scores in both the Forebet scanner and the Odds Scanner.
//
// Weighting in the Forebet confidence model:
//   motivationScore  × 0.15
//   formProxyScore   × 0.10
//   (other sub-scores are unchanged by this enrichment)
//
// Weighting in the Odds Scanner confidence model:
//   formScore        × 0.20  (mapped from standings form + position gap)
//   scoringConsistency × 0.20 (mapped from goals-for per game)
//
// When standings are unavailable (unsupported league / API key not set),
// the proxy scores remain unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture }     from '../types/Fixture';
import type { OddsFixture } from '../types/OddsFixture';
import { scoreOddsFixture } from './oddsFilters';

// ── Type that mirrors the backend CompetitionStandings ────────────────────────

export interface StandingEntry {
  position:    number;
  teamId:      number;
  teamName:    string;
  shortName:   string;
  tla:         string;
  points:      number;
  playedGames: number;
  won:         number;
  draw:        number;
  lost:        number;
  goalsFor:    number;
  goalsAgainst:number;
  form:        string;   // "W,D,W,L,W" — most recent LAST
}

export interface CompetitionStandings {
  code:       string;
  name:       string;
  country:    string;
  totalTeams: number;
  matchday:   number;
  season:     string;
  table:      StandingEntry[];
  fetchedAt:  string;
}

export type StandingsMap = Map<string, CompetitionStandings>;   // leagueName → standings

// ── Team name normaliser ──────────────────────────────────────────────────────
// Removes common suffixes and noise so "Arsenal FC" matches "Arsenal".

const STRIP_PATTERNS = [
  / fc$/i, / afc$/i, / cf$/i, / sc$/i, / ac$/i, / bc$/i,
  / united$/i, / city$/i, / town$/i, / rovers$/i, / wanderers$/i,
  / athletic$/i, / albion$/i, / villa$/i,
  /\bfc\b/i, /\bafc\b/i,
];

function normalise(name: string): string {
  let s = name.toLowerCase().trim();
  for (const p of STRIP_PATTERNS) s = s.replace(p, '').trim();
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Finds the best matching standing entry for a given team name.
 * Uses exact normalised match first, then substring match, then TLA match.
 */
export function findTeamInStandings(
  teamName: string,
  standings: CompetitionStandings
): StandingEntry | null {
  if (!teamName || !standings?.table?.length) return null;

  const needle = normalise(teamName);

  // 1. Exact normalised match
  const exact = standings.table.find(e =>
    normalise(e.teamName) === needle || normalise(e.shortName) === needle
  );
  if (exact) return exact;

  // 2. One contains the other
  const partial = standings.table.find(e => {
    const a = normalise(e.teamName);
    const b = normalise(e.shortName);
    return a.includes(needle) || needle.includes(a) ||
           b.includes(needle) || needle.includes(b);
  });
  if (partial) return partial;

  // 3. TLA match (e.g. "ARS" for Arsenal)
  const tla = standings.table.find(e =>
    e.tla.toLowerCase() === teamName.toUpperCase().slice(0, 3).toLowerCase()
  );
  return tla ?? null;
}

// ── Parse form string ─────────────────────────────────────────────────────────
// Football-Data.org returns form as "W,D,W,L,W" (most-recent LAST).
// Returns last N results as string for OddsFixture.homeForm.

function formToString(form: string, lastN = 5): string {
  const parts = form.split(',').filter(r => ['W', 'D', 'L'].includes(r));
  return parts.slice(-lastN).join('');
}

function formToPoints(form: string, lastN = 5): number {
  const results = form.split(',').filter(r => ['W', 'D', 'L'].includes(r)).slice(-lastN);
  return results.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
}

// ── Real motivation score ─────────────────────────────────────────────────────
// Replaces the proxy motivation score with actual league context.
// Returns score 0-100 and a reason string.

export function calcRealMotivationScore(
  homeEntry:  StandingEntry,
  totalTeams: number,
  totalMatchesInSeason: number   // e.g. 38 for a 20-team league
): { score: number; reason: string } {
  let score = 60;
  const reasons: string[] = [];

  const pos      = homeEntry.position;
  const pts      = homeEntry.points;
  const played   = homeEntry.playedGames;
  const remaining = Math.max(0, totalMatchesInSeason - played);

  // ── Title / European contention ────────────────────────────────────────────
  if (pos === 1) {
    score += 20;
    reasons.push('League leader — maximum title motivation');
  } else if (pos <= 4) {
    score += 15;
    reasons.push(`${pos}th — fighting for top-4 / title`);
  } else if (pos <= 6) {
    score += 8;
    reasons.push(`${pos}th — pushing for European spot`);
  }

  // ── Relegation battle ──────────────────────────────────────────────────────
  const relegationZone = totalTeams - 2;   // bottom 3 for a 20-team league
  if (pos >= relegationZone) {
    score += 20;
    reasons.push(`In relegation zone (${pos}/${totalTeams}) — survival pressure`);
  } else if (pos >= relegationZone - 3) {
    score += 12;
    reasons.push(`Near relegation zone — must win`);
  }

  // ── Mid-table malaise ──────────────────────────────────────────────────────
  const isMidTable = pos > 6 && pos < relegationZone - 3;
  if (isMidTable && remaining > 8) {
    score -= 10;
    reasons.push('Mid-table — low stakes');
  }

  // ── Late-season urgency ────────────────────────────────────────────────────
  if (remaining <= 3 && (pos <= 4 || pos >= relegationZone - 2)) {
    score += 15;
    reasons.push('Final 3 matches — critical run-in');
  } else if (remaining <= 6) {
    score += 8;
    reasons.push('Last 6 matches of season');
  }

  // ── Recent form (last 5 games) ─────────────────────────────────────────────
  if (homeEntry.form) {
    const formPts  = formToPoints(homeEntry.form, 5);
    const maxPts   = 15;
    const formAdj  = Math.round((formPts / maxPts) * 14) - 7;   // -7 to +7
    score += formAdj;
    const formStr = formToString(homeEntry.form, 5);
    reasons.push(`Form: ${formStr} (${formPts}/15 pts)`);
  }

  return {
    score:  Math.max(0, Math.min(100, score)),
    reason: reasons.join(', '),
  };
}

// ── Enrich a Forebet Fixture ──────────────────────────────────────────────────
// Uses delta arithmetic so we don't need all sub-scores:
//   ΔconfidenceScore = (newMotivation - oldMotivation) × 0.15
//                    + (newFormProxy  - oldFormProxy)  × 0.10

export function enrichForebetFixture(
  fixture:     Fixture,
  standingsMap: StandingsMap
): Fixture {
  // Try to find standings for this fixture's league
  const standings = findStandingsForLeague(fixture.league, standingsMap)
    ?? findStandingsForLeague(fixture.competition ?? '', standingsMap);

  if (!standings) return fixture; // no data — unchanged

  const homeEntry = findTeamInStandings(fixture.homeTeam, standings);
  const awayEntry = findTeamInStandings(fixture.awayTeam, standings);

  if (!homeEntry) return fixture; // home team not found

  const totalMatchesInSeason = (standings.totalTeams - 1) * 2;

  // Real motivation
  const { score: newMotivation } = calcRealMotivationScore(homeEntry, standings.totalTeams, totalMatchesInSeason);

  // Real form proxy (position gap + actual form)
  const positionGap = awayEntry ? (awayEntry.position - homeEntry.position) : 0;
  let newFormProxy = fixture.formProxyScore;
  if (homeEntry.form) {
    const homeFormPts = formToPoints(homeEntry.form, 5);
    const awayFormPts = awayEntry?.form ? formToPoints(awayEntry.form, 5) : 7;
    const formGap     = homeFormPts - awayFormPts;

    // 0-20 scale: form gap + position advantage
    newFormProxy = Math.max(0, Math.min(100,
      50                       // base
      + formGap * 2            // form gap contribution
      + Math.min(positionGap, 10) * 1.5  // position gap (capped)
    ));
  }

  // Delta update confidence score
  const motivationDelta = (newMotivation - fixture.motivationScore) * 0.15;
  const formDelta       = (newFormProxy  - fixture.formProxyScore)  * 0.10;
  const newConfidence   = Math.max(0, Math.min(100, Math.round(fixture.confidenceScore + motivationDelta + formDelta)));

  return {
    ...fixture,
    motivationScore: newMotivation,
    formProxyScore:  Math.round(newFormProxy),
    confidenceScore: newConfidence,
    standingsEnriched:    true,
    homeTablePosition:    homeEntry.position,
    homeTablePoints:      homeEntry.points,
    homeMatchesPlayed:    homeEntry.playedGames,
    homeMatchesRemaining: totalMatchesInSeason - homeEntry.playedGames,
    homeActualForm:       formToString(homeEntry.form, 5),
    awayTablePosition:    awayEntry?.position,
    awayTablePoints:      awayEntry?.points,
    awayActualForm:       awayEntry?.form ? formToString(awayEntry.form, 5) : undefined,
    leaderPoints:         standings.table[0]?.points,
    totalTeamsInLeague:   standings.totalTeams,
  };
}

// ── Enrich an OddsFixture ─────────────────────────────────────────────────────
// Sets homeForm, awayForm, homeScoring, awayScoring from standings, then
// re-runs the full scoreOddsFixture function for a fresh confidence calculation.

export function enrichOddsFixture(
  fixture:      OddsFixture,
  standingsMap: StandingsMap
): OddsFixture {
  const standings = findStandingsForLeague(fixture.league, standingsMap)
    ?? findStandingsForLeague(fixture.country, standingsMap);

  if (!standings) return fixture;

  const homeEntry = findTeamInStandings(fixture.homeTeam, standings);
  const awayEntry = findTeamInStandings(fixture.awayTeam, standings);

  if (!homeEntry && !awayEntry) return fixture;

  // Build enriched base (raw fields only — scored fields will be recalculated)
  const enrichedBase = {
    ...fixture,
    homeForm:    homeEntry?.form ? formToString(homeEntry.form, 5)  : fixture.homeForm,
    awayForm:    awayEntry?.form ? formToString(awayEntry.form, 5)  : fixture.awayForm,
    // goalsFor across played games ÷ played = avg goals/game × played = total goals
    homeScoring: homeEntry ? Math.round((homeEntry.goalsFor / Math.max(1, homeEntry.playedGames)) * 10) : fixture.homeScoring,
    awayScoring: awayEntry ? Math.round((awayEntry.goalsFor / Math.max(1, awayEntry.playedGames)) * 10) : fixture.awayScoring,
  };

  // Re-score with real data
  const rescored = scoreOddsFixture(enrichedBase as Parameters<typeof scoreOddsFixture>[0]);

  return {
    ...rescored,
    standingsEnriched: true,
    homeTablePosition:  homeEntry?.position,
    awayTablePosition:  awayEntry?.position,
    homeTablePoints:    homeEntry?.points,
    awayTablePoints:    awayEntry?.points,
    leaderPoints:       standings.table[0]?.points,
    totalTeamsInLeague: standings.totalTeams,
  };
}

// ── Batch enrichment (for use in hooks) ──────────────────────────────────────

export function batchEnrichForebetFixtures(
  fixtures:     Fixture[],
  standingsMap: StandingsMap
): { fixtures: Fixture[]; enrichedCount: number; leaguesFound: string[] } {
  const leaguesFound: string[] = [];
  const enriched = fixtures.map(fx => {
    const result = enrichForebetFixture(fx, standingsMap);
    if (result.standingsEnriched && !leaguesFound.includes(fx.league)) {
      leaguesFound.push(fx.league);
    }
    return result;
  });
  return { fixtures: enriched, enrichedCount: enriched.filter(f => f.standingsEnriched).length, leaguesFound };
}

export function batchEnrichOddsFixtures(
  fixtures:     OddsFixture[],
  standingsMap: StandingsMap
): { fixtures: OddsFixture[]; enrichedCount: number; leaguesFound: string[] } {
  const leaguesFound: string[] = [];
  const enriched = fixtures.map(fx => {
    const result = enrichOddsFixture(fx, standingsMap);
    if (result.standingsEnriched && !leaguesFound.includes(fx.league)) {
      leaguesFound.push(fx.league);
    }
    return result;
  });
  return { fixtures: enriched, enrichedCount: enriched.filter(f => f.standingsEnriched).length, leaguesFound };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Tries multiple keys to find standings for a league. */
function findStandingsForLeague(
  leagueName: string,
  standingsMap: StandingsMap
): CompetitionStandings | null {
  if (!leagueName) return null;
  const lower = leagueName.toLowerCase();

  // Direct key match
  for (const [key, val] of standingsMap) {
    if (key.toLowerCase() === lower) return val;
  }
  // Name match
  for (const [, val] of standingsMap) {
    if (val.name.toLowerCase() === lower || val.country.toLowerCase() === lower) return val;
    if (lower.includes(val.name.toLowerCase()) || val.name.toLowerCase().includes(lower)) return val;
  }
  return null;
}

/** Returns the unique league names present in a set of fixtures. */
export function extractLeagueNames(fixtures: (Fixture | OddsFixture)[]): string[] {
  return [...new Set(fixtures.map(f => f.league).filter(Boolean))];
}
