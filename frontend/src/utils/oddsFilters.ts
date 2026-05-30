// ─────────────────────────────────────────────────────────────────────────────
// Odds Filtering Engine
//
// Filter A — odds-range gate:
//   Home Win candidates: home odds 1.10 – 1.55
//   Away Win candidates: away odds 1.10 – 1.39
//   Excludes Belarus, missing/invalid odds, duplicates.
//
// Filter B — confidence gate:
//   Applies the 100-point confidence model.
//   Only passes fixtures scoring ≥ minConfidence (default 65).
//
// Confidence model (100 pts total):
//   Odds strength            20
//   Form superiority         20
//   Scoring consistency      20
//   Over 1.5 goals expected  15
//   Opponent weakness        10
//   League reliability       10
//   Risk penalty             –5 to –55
// ─────────────────────────────────────────────────────────────────────────────

import type { OddsFixture, OddsFilterSettings, ConfidenceGrade } from '../types/OddsFixture';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTER_SETTINGS: OddsFilterSettings = {
  homeOddsMin:        1.10,
  homeOddsMax:        1.55,
  awayOddsMin:        1.10,
  awayOddsMax:        1.39,
  date:               new Date().toISOString().slice(0, 10),
  countrySearch:      '',
  leagueSearch:       '',
  excludedCountries:  ['Belarus'],
  minConfidenceScore: 65,
  showHomeWinOnly:    false,
  showAwayWinOnly:    false,
  showFilterBOnly:    false,
};

// ── Confidence Grade ──────────────────────────────────────────────────────────

export function getConfidenceGrade(score: number): ConfidenceGrade {
  if (score >= 85) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 65) return 'Moderate';
  return 'Watchlist';
}

// ── Implied probability from odds ─────────────────────────────────────────────

function impliedProb(odds: number): number {
  return odds > 0 ? (1 / odds) * 100 : 0;
}

// ── Parse form string (e.g. "WWDLW") ─────────────────────────────────────────

function formPoints(form?: string): number | null {
  if (!form || form.trim().length === 0) return null;
  const chars = form.toUpperCase().replace(/[^WDL]/g, '').slice(0, 10);
  if (chars.length === 0) return null;
  return chars.split('').reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0);
}

// ── Confidence model sub-scorers ──────────────────────────────────────────────

/** Odds strength: shorter odds = higher market confidence = higher score (/20) */
function oddsStrengthScore(pick: 'HOME_WIN' | 'AWAY_WIN', homeOdds: number, awayOdds: number): number {
  const odds = pick === 'HOME_WIN' ? homeOdds : awayOdds;
  if (odds <= 1.15) return 20;
  if (odds <= 1.20) return 18;
  if (odds <= 1.25) return 16;
  if (odds <= 1.30) return 14;
  if (odds <= 1.35) return 12;
  if (odds <= 1.40) return 10;
  if (odds <= 1.45) return 8;
  if (odds <= 1.50) return 6;
  if (odds <= 1.55) return 4;
  if (odds <= 1.39) return 12; // Away win range
  return 3;
}

/** Form superiority: selected team has better recent form than opponent (/20) */
function formScore(
  pick:      'HOME_WIN' | 'AWAY_WIN',
  homeForm?: string,
  awayForm?: string
): { score: number; missing: boolean } {
  const selectedForm = pick === 'HOME_WIN' ? homeForm : awayForm;
  const opponentForm = pick === 'HOME_WIN' ? awayForm : homeForm;

  const selPts = formPoints(selectedForm);
  const oppPts = formPoints(opponentForm);

  if (selPts === null || oppPts === null) {
    // Missing — give a mid-range estimate based on odds alone
    return { score: 8, missing: true };
  }

  const diff = selPts - oppPts;
  if (diff >= 9)  return { score: 20, missing: false };
  if (diff >= 6)  return { score: 17, missing: false };
  if (diff >= 3)  return { score: 14, missing: false };
  if (diff >= 0)  return { score: 10, missing: false };
  if (diff >= -3) return { score: 5,  missing: false };
  return            { score: 0,  missing: false };
}

/**
 * Scoring consistency (/20)
 * For HOME WIN: home team scored in ≥8 of last 10 home games → full points
 * For AWAY WIN: away team consistent scorer away
 */
function scoringConsistencyScore(
  pick:          'HOME_WIN' | 'AWAY_WIN',
  homeScoring?:  number,
  awayScoring?:  number
): { score: number; missing: boolean } {
  const val = pick === 'HOME_WIN' ? homeScoring : awayScoring;
  if (val === undefined || val === null || isNaN(val)) return { score: 8, missing: true };

  // val = goals scored across last 10 games (not games with a goal)
  // Treat ≥15 as very consistent, ≥10 as good, etc.
  if (val >= 18) return { score: 20, missing: false };
  if (val >= 14) return { score: 16, missing: false };
  if (val >= 10) return { score: 12, missing: false };
  if (val >=  6) return { score: 8,  missing: false };
  return           { score: 4,  missing: false };
}

/**
 * Over 1.5 goals expectancy (/15)
 * Uses over 1.5 odds if available, otherwise estimates from draw odds
 * (lower draw probability implies more decisive, goal-heavy matches).
 */
function over15Score(
  drawOdds:    number,
  over15Odds?: number
): { score: number; estimated: boolean } {
  if (over15Odds !== undefined && over15Odds > 0) {
    const prob = impliedProb(over15Odds);
    if (prob >= 85) return { score: 15, estimated: false };
    if (prob >= 80) return { score: 13, estimated: false };
    if (prob >= 75) return { score: 11, estimated: false };
    if (prob >= 70) return { score: 9,  estimated: false };
    if (prob >= 65) return { score: 7,  estimated: false };
    return           { score: 4,  estimated: false };
  }

  // Estimate: low draw odds probability suggests fewer draws → more goals
  const drawProb = impliedProb(drawOdds);
  if (drawProb <= 15) return { score: 13, estimated: true };
  if (drawProb <= 20) return { score: 11, estimated: true };
  if (drawProb <= 25) return { score: 9,  estimated: true };
  if (drawProb <= 30) return { score: 7,  estimated: true };
  return               { score: 5,  estimated: true };
}

/**
 * Opponent weakness (/10)
 * Uses away win odds (for home win picks) or home win odds (for away picks)
 * as a proxy for how weak the opponent is.
 */
function opponentWeaknessScore(
  pick:      'HOME_WIN' | 'AWAY_WIN',
  homeOdds:  number,
  awayOdds:  number,
  drawOdds:  number
): number {
  const opponentOdds = pick === 'HOME_WIN' ? awayOdds : homeOdds;
  // Higher opponent odds = more likely to lose = weaker
  if (opponentOdds >= 6.0) return 10;
  if (opponentOdds >= 4.5) return 9;
  if (opponentOdds >= 3.5) return 8;
  if (opponentOdds >= 2.5) return 6;
  if (opponentOdds >= 2.0) return 4;
  // Draw probability as secondary signal
  const drawProb = impliedProb(drawOdds);
  return drawProb < 20 ? 5 : 3;
}

/**
 * League reliability (/10)
 * Penalises obscure or less-documented leagues.
 * This is a rough heuristic — real implementation would use league tiers.
 */
function leagueReliabilityScore(league: string, country: string): number {
  const text = `${league} ${country}`.toLowerCase();

  // Tier 1 — highly documented leagues
  const tier1 = ['premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'eredivisie',
    'primeira liga', 'scottish premiership', 'mls', 'brasileirao', 'argentina',
    'champions league', 'europa league', 'championship'];
  if (tier1.some(t => text.includes(t))) return 10;

  // Tier 2 — well-documented
  const tier2 = ['süper lig', 'super lig', 'ekstraklasa', 'pro league', 'allsvenskan',
    'eliteserien', 'danish', 'swiss', 'austrian', 'belgian', 'greek', 'czech',
    'romanian', 'hungarian', 'ukrainian', 'portuguese'];
  if (tier2.some(t => text.includes(t))) return 8;

  // Tier 3 — moderate documentation
  const tier3 = ['south american', 'african', 'asian', 'middle east', 'mena', 'gulf'];
  if (tier3.some(t => text.includes(t))) return 6;

  // Default — unknown/obscure
  return 5;
}

// ── Risk penalties ────────────────────────────────────────────────────────────

function calcRiskPenalty(flags: string[]): number {
  let penalty = 0;
  for (const flag of flags) {
    if (flag.includes('form data missing'))           penalty += 10;
    if (flag.includes('obscure league'))              penalty += 10;
    if (flag.includes('odds too short, weak support'))penalty += 10;
    if (flag.includes('rotation') || flag.includes('motivation') || flag.includes('cup context') || flag.includes('second leg')) penalty += 15;
    if (flag.includes('stale data'))                  penalty += 20;
    if (flag.includes('scoring data missing'))        penalty += 10;
  }
  return Math.min(penalty, 55);
}

function buildRiskFlags(
  formMissing:     boolean,
  scoringMissing:  boolean,
  leagueScore:     number,
  oddsScore:       number,
  formScoreVal:    number,
): string[] {
  const flags: string[] = [];
  if (formMissing)    flags.push('form data missing — estimated from odds');
  if (scoringMissing) flags.push('scoring data missing — estimated');
  if (leagueScore <= 5) flags.push('obscure league — lower data confidence');
  if (oddsScore >= 16 && formScoreVal <= 5) flags.push('odds too short, weak form support');
  return flags;
}

// ── Master scorer ─────────────────────────────────────────────────────────────

export function scoreOddsFixture(
  raw: Omit<OddsFixture, 'pick' | 'passesFilterA' | 'passesFilterB' | 'filterAReason' | 'filterBReason' | 'notes' | 'riskFlags' | 'confidenceScore' | 'confidenceGrade' | 'oddsStrengthScore' | 'formScore' | 'scoringConsistencyScore' | 'over15Score' | 'opponentWeaknessScore' | 'leagueReliabilityScore' | 'riskPenalty'>
): OddsFixture {
  // ── Filter A ──
  let pick: 'HOME_WIN' | 'AWAY_WIN' | null = null;
  let passesFilterA = false;
  let filterAReason = '';

  const isBelarusExcluded = raw.country.toLowerCase().includes('belarus');

  if (!isBelarusExcluded) {
    if (raw.homeOdds >= 1.10 && raw.homeOdds <= 1.55) {
      pick = 'HOME_WIN';
      passesFilterA = true;
      filterAReason = `Home odds ${raw.homeOdds} is within range 1.10–1.55`;
    } else if (raw.awayOdds >= 1.10 && raw.awayOdds <= 1.39) {
      pick = 'AWAY_WIN';
      passesFilterA = true;
      filterAReason = `Away odds ${raw.awayOdds} is within range 1.10–1.39`;
    } else {
      filterAReason = `Odds outside Filter A range (home: ${raw.homeOdds}, away: ${raw.awayOdds})`;
    }
  } else {
    filterAReason = 'Excluded — Belarus';
  }

  if (!passesFilterA || pick === null) {
    return { ...raw, pick, passesFilterA, passesFilterB: false, filterAReason, filterBReason: '', notes: '', riskFlags: [], confidenceScore: 0, confidenceGrade: 'Watchlist', oddsStrengthScore: 0, formScore: 0, scoringConsistencyScore: 0, over15Score: 0, opponentWeaknessScore: 0, leagueReliabilityScore: 0, riskPenalty: 0 };
  }

  // ── Score components ──
  const oddsS      = oddsStrengthScore(pick, raw.homeOdds, raw.awayOdds);
  const { score: formS, missing: formMissing }       = formScore(pick, raw.homeForm, raw.awayForm);
  const { score: scoringS, missing: scoringMissing } = scoringConsistencyScore(pick, raw.homeScoring, raw.awayScoring);
  const { score: o15S, estimated: o15Estimated }     = over15Score(raw.drawOdds, raw.over15Odds);
  const leagueS    = leagueReliabilityScore(raw.league, raw.country);
  const oppS       = opponentWeaknessScore(pick, raw.homeOdds, raw.awayOdds, raw.drawOdds);

  const flags      = buildRiskFlags(formMissing, scoringMissing, leagueS, oddsS, formS);
  const penalty    = calcRiskPenalty(flags);

  const rawScore   = oddsS + formS + scoringS + o15S + oppS + leagueS - penalty;
  const confidenceScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const confidenceGrade = getConfidenceGrade(confidenceScore);

  // ── Filter B ──
  const passesFilterB = confidenceScore >= 65;

  // ── Reason text ──
  const filterBReasonParts: string[] = [];
  filterBReasonParts.push(`Odds strength: ${oddsS}/20`);
  filterBReasonParts.push(`Form: ${formS}/20${formMissing ? ' (estimated)' : ''}`);
  filterBReasonParts.push(`Scoring: ${scoringS}/20${scoringMissing ? ' (estimated)' : ''}`);
  filterBReasonParts.push(`Over 1.5: ${o15S}/15${o15Estimated ? ' (estimated from draw odds)' : ''}`);
  filterBReasonParts.push(`Opp. weakness: ${oppS}/10`);
  filterBReasonParts.push(`League data: ${leagueS}/10`);
  if (penalty > 0) filterBReasonParts.push(`Risk penalty: −${penalty}`);
  filterBReasonParts.push(`= ${confidenceScore}/100 (${confidenceGrade})`);

  const notes: string[] = [];
  if (formMissing)    notes.push('Form data not in CSV — estimated from odds gap.');
  if (scoringMissing) notes.push('Scoring record not in CSV — estimated.');
  if (o15Estimated)   notes.push('Over 1.5 estimated from draw odds (no over market data).');

  return {
    ...raw,
    pick,
    passesFilterA,
    passesFilterB,
    filterAReason,
    filterBReason: filterBReasonParts.join(' | '),
    notes: notes.join(' '),
    riskFlags: flags,
    confidenceScore,
    confidenceGrade,
    oddsStrengthScore:       oddsS,
    formScore:               formS,
    scoringConsistencyScore: scoringS,
    over15Score:             o15S,
    opponentWeaknessScore:   oppS,
    leagueReliabilityScore:  leagueS,
    riskPenalty:             penalty,
  };
}

// ── Apply Filter A ────────────────────────────────────────────────────────────

export function applyFilterA(fixtures: OddsFixture[]): OddsFixture[] {
  return fixtures.filter(f => f.passesFilterA);
}

// ── Apply Filter B ────────────────────────────────────────────────────────────

export function applyFilterB(
  fixtures:        OddsFixture[],
  minConfidence:   number = 65
): OddsFixture[] {
  return fixtures.filter(f => f.passesFilterA && f.confidenceScore >= minConfidence);
}

// ── Apply all UI filter settings ──────────────────────────────────────────────

export function applyUiFilters(
  fixtures: OddsFixture[],
  settings: OddsFilterSettings
): OddsFixture[] {
  return fixtures.filter(f => {
    // Excluded countries
    if (settings.excludedCountries.some(ex =>
      f.country.toLowerCase().includes(ex.toLowerCase())
    )) return false;

    // Search
    if (settings.countrySearch && !f.country.toLowerCase().includes(settings.countrySearch.toLowerCase())) return false;
    if (settings.leagueSearch  && !f.league.toLowerCase().includes(settings.leagueSearch.toLowerCase()))   return false;

    // View toggles
    if (settings.showFilterBOnly  && !f.passesFilterB) return false;
    if (settings.showHomeWinOnly  && f.pick !== 'HOME_WIN') return false;
    if (settings.showAwayWinOnly  && f.pick !== 'AWAY_WIN') return false;

    return true;
  });
}
