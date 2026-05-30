// ─────────────────────────────────────────────────────────────────────────────
// Odds Filtering Engine  — v2
//
// Data sources used (in priority order, all already fetched):
//   1. over15Odds        — direct market; most reliable signal
//   2. homeForm/awayForm — from CSV upload or Football-Data.org standings
//   3. homeScoring/awayScoring — from CSV or standings (goals per 10 games × 10)
//   4. homeOdds/drawOdds/awayOdds — always available from Flashscore
//   5. tablePosition     — from standings enrichment
//
// Filter A — odds-range gate:
//   HOME WIN candidates : homeOdds 1.10 – 1.55
//   AWAY WIN candidates : awayOdds 1.10 – 1.39
//   Excludes Belarus, missing/invalid odds.
//
// Filter B — strict confidence gate (HARD GATES + score threshold):
//   HARD FAIL if:
//     • Form data available AND opponent form is clearly better (diff ≤ −4)
//       AND the league is reliable (leagueScore ≥ 7)
//     • Both forms AND scoring AND standings all missing → data too incomplete
//   PENALTY (not fail):
//     • Away scoring data missing for AWAY WIN (-15 pts + note)
//     • Home scoring unavailable (-5 pts + note)
//   PASSES if: no hard-fail AND confidence ≥ minConfidenceScore
//
// Confidence model (100 pts total):
//   Odds strength          /20  (market confidence)
//   Form superiority       /20  (selected team above opponent)
//   Scoring consistency    /20  (team scores in most games)
//   Over 1.5 expected      /15  (multi-signal estimate)
//   Opponent weakness      /10  (opponent's odds/position)
//   League reliability     /10  (data coverage tier)
//   Risk penalty           –0 to –55
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

export function getConfidenceGrade(score: number): ConfidenceGrade {
  if (score >= 85) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 65) return 'Moderate';
  return 'Watchlist';
}

function impliedProb(odds: number): number {
  return odds > 0 ? (1 / odds) * 100 : 0;
}

// Parse form string "WWDLW" or "W,W,D,L,W" → points (last 5 games, W=3 D=1 L=0)
function formPoints(form?: string): number | null {
  if (!form || !form.trim()) return null;
  const chars = form.toUpperCase().replace(/[^WDL]/g, '').slice(0, 5);
  if (chars.length < 3) return null;   // too few results to be meaningful
  return chars.split('').reduce((s, c) => s + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0);
}

// ── 1. Odds Strength (/20) ────────────────────────────────────────────────────

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
  return 4;   // 1.51–1.55 (home) or 1.51–1.39 catch-all
}

// ── 2. Form Superiority (/20) with hard-gate signal ──────────────────────────
// Selected team = home team for HOME WIN, away team for AWAY WIN.
// Returns superiority: 'selected' | 'opponent' | 'equal' | 'unknown'

interface FormResult {
  score:       number;
  missing:     boolean;
  superiority: 'selected' | 'opponent' | 'equal' | 'unknown';
  detail:      string;
}

function formScore(
  pick:      'HOME_WIN' | 'AWAY_WIN',
  homeForm?: string,
  awayForm?: string,
  homeOdds?: number,
  awayOdds?: number
): FormResult {
  const selectedForm = pick === 'HOME_WIN' ? homeForm : awayForm;
  const opponentForm = pick === 'HOME_WIN' ? awayForm  : homeForm;

  const selPts = formPoints(selectedForm);
  const oppPts = formPoints(opponentForm);

  // Both forms available — most accurate judgement
  if (selPts !== null && oppPts !== null) {
    const diff = selPts - oppPts;
    if (diff >= 9)  return { score: 20, missing: false, superiority: 'selected', detail: `Selected form ${selPts}pts vs opp ${oppPts}pts (+${diff})` };
    if (diff >= 6)  return { score: 17, missing: false, superiority: 'selected', detail: `Selected form ${selPts}pts vs opp ${oppPts}pts (+${diff})` };
    if (diff >= 3)  return { score: 14, missing: false, superiority: 'selected', detail: `Selected form ${selPts}pts vs opp ${oppPts}pts (+${diff})` };
    if (diff >= 0)  return { score: 11, missing: false, superiority: 'equal',    detail: `Form level — ${selPts}pts vs ${oppPts}pts` };
    if (diff >= -3) return { score: 5,  missing: false, superiority: 'opponent', detail: `Opponent better form — ${oppPts}pts vs ${selPts}pts (diff ${diff})` };
    return               { score: 0,  missing: false, superiority: 'opponent', detail: `Opponent clearly better form — ${oppPts}pts vs ${selPts}pts (diff ${diff})` };
  }

  // Only selected team's form available — partial credit
  if (selPts !== null) {
    if (selPts >= 10) return { score: 14, missing: false, superiority: 'unknown', detail: `Selected form: ${selPts}/15 pts (opp form unknown)` };
    if (selPts >= 7)  return { score: 10, missing: false, superiority: 'unknown', detail: `Selected form: ${selPts}/15 pts` };
    return                   { score: 6,  missing: false, superiority: 'unknown', detail: `Selected form weak: ${selPts}/15 pts` };
  }

  // No form data — estimate from odds gap (larger gap = likely form advantage)
  const h = homeOdds ?? 2.0;
  const a = awayOdds ?? 3.0;
  const gap = pick === 'HOME_WIN' ? (a - h) : (h - a);
  if (gap >= 4.0) return { score: 13, missing: true, superiority: 'unknown', detail: 'No form data — strong odds gap suggests form advantage' };
  if (gap >= 2.0) return { score: 10, missing: true, superiority: 'unknown', detail: 'No form data — moderate odds gap' };
  if (gap >= 1.0) return { score: 8,  missing: true, superiority: 'unknown', detail: 'No form data — small odds gap' };
  return                 { score: 6,  missing: true, superiority: 'unknown', detail: 'No form data — estimated from odds' };
}

// ── 3. Scoring Consistency (/20) ──────────────────────────────────────────────
// homeScoring / awayScoring = total goals in last 10 home/away games (× 10 if from standings)
// Rule: HOME WIN → home team should score in ≥8 of last 10 home games
//       AWAY WIN → away team should score consistently; missing data → penalise + note

interface ScoringResult {
  score:   number;
  missing: boolean;
  note:    string | null;
  likelyScoredIn8of10: boolean | null;
}

function scoringConsistencyScore(
  pick:         'HOME_WIN' | 'AWAY_WIN',
  homeScoring?: number,
  awayScoring?: number,
  homeOdds?:    number,
  awayOdds?:    number
): ScoringResult {
  const val    = pick === 'HOME_WIN' ? homeScoring : awayScoring;
  const pickedOdds = pick === 'HOME_WIN' ? (homeOdds ?? 1.5) : (awayOdds ?? 1.5);

  if (val !== undefined && val !== null && !isNaN(val) && val > 0) {
    // val = goals in last 10 games
    // ≥15 means avg 1.5/game → likely scored in 9-10 of 10 games
    // ≥10 means avg 1.0/game → likely scored in 8+ of 10 games
    // ≥7  means avg 0.7/game → borderline (maybe 6-7 of 10)
    // <7  means rarely scores → fail criterion
    if (val >= 15) return { score: 20, missing: false, note: null, likelyScoredIn8of10: true };
    if (val >= 10) return { score: 16, missing: false, note: null, likelyScoredIn8of10: true };
    if (val >=  7) return { score: 10, missing: false, note: `Borderline — scored in est. 6-7 of 10 games`, likelyScoredIn8of10: null };
    return               { score:  4, missing: false, note: `Scoring concern — scored in est. <6 of 10 games`, likelyScoredIn8of10: false };
  }

  // Data missing
  if (pick === 'AWAY_WIN') {
    // Spec: explicitly penalise missing away scoring data
    return {
      score:   6,
      missing: true,
      note:    'Away scoring data unavailable — confidence reduced',
      likelyScoredIn8of10: null,
    };
  }

  // HOME WIN — missing, estimate from odds
  if (pickedOdds <= 1.25) return { score: 14, missing: true, note: 'Home scoring estimated from odds (very short favourite)', likelyScoredIn8of10: null };
  if (pickedOdds <= 1.35) return { score: 11, missing: true, note: 'Home scoring estimated from odds', likelyScoredIn8of10: null };
  if (pickedOdds <= 1.45) return { score:  9, missing: true, note: 'Home scoring estimated from odds', likelyScoredIn8of10: null };
  return                         { score:  7, missing: true, note: 'Home scoring data not available', likelyScoredIn8of10: null };
}

// ── 4. Over 1.5 Goals Expected (/15) — multi-signal ──────────────────────────

interface Over15Result {
  score:      number;
  estimated:  boolean;
  detail:     string;
}

function over15Score(
  drawOdds:     number,
  homeOdds:     number,
  awayOdds:     number,
  over15Odds?:  number,
  homeScoring?: number,
  awayScoring?: number
): Over15Result {
  // Signal 1: Direct over 1.5 market (most reliable)
  if (over15Odds && over15Odds > 0 && over15Odds < 50) {
    const prob = impliedProb(over15Odds);
    if (prob >= 85) return { score: 15, estimated: false, detail: `Over 1.5 odds ${over15Odds} (${prob.toFixed(0)}% implied)` };
    if (prob >= 80) return { score: 13, estimated: false, detail: `Over 1.5 odds ${over15Odds} (${prob.toFixed(0)}% implied)` };
    if (prob >= 75) return { score: 11, estimated: false, detail: `Over 1.5 odds ${over15Odds} (${prob.toFixed(0)}% implied)` };
    if (prob >= 70) return { score:  9, estimated: false, detail: `Over 1.5 odds ${over15Odds} (${prob.toFixed(0)}% implied)` };
    if (prob >= 60) return { score:  6, estimated: false, detail: `Over 1.5 odds ${over15Odds} — borderline` };
    return                 { score:  3, estimated: false, detail: `Over 1.5 odds ${over15Odds} — under 1.5 more likely` };
  }

  // Signal 2: Combined scoring records
  const homeSc = homeScoring ?? 0;
  const awaySc = awayScoring ?? 0;
  if (homeSc > 0 && awaySc > 0) {
    const combined = homeSc + awaySc;  // total goals across 20 games = avg per game × 10
    if (combined >= 30) return { score: 14, estimated: true, detail: `Combined scoring: ${homeSc} + ${awaySc} goals (high attack rate)` };
    if (combined >= 22) return { score: 12, estimated: true, detail: `Combined scoring: ${homeSc} + ${awaySc} goals` };
    if (combined >= 16) return { score: 10, estimated: true, detail: `Combined scoring: ${homeSc} + ${awaySc} goals` };
    if (combined >= 10) return { score:  7, estimated: true, detail: `Combined scoring: ${homeSc} + ${awaySc} goals — moderate` };
    return                     { score:  4, estimated: true, detail: `Low combined scoring — over 1.5 uncertain` };
  }

  if (homeSc > 0 || awaySc > 0) {
    const known = homeSc > 0 ? homeSc : awaySc;
    if (known >= 15) return { score: 11, estimated: true, detail: `Partial scoring data: ${known} goals/10 games` };
    if (known >= 10) return { score:  9, estimated: true, detail: `Partial scoring data: ${known} goals/10 games` };
    return                  { score:  7, estimated: true, detail: `Partial scoring: ${known} goals/10 games` };
  }

  // Signal 3: Odds-based inference
  // Short-priced favourite + high draw odds = high-scoring game likely
  // Low draw probability = decisive match = goals expected
  const drawProb = impliedProb(drawOdds);
  // Implied goals boost from short favourite
  const favOdds = Math.min(homeOdds, awayOdds);

  if (drawProb <= 15 && favOdds <= 1.30) return { score: 13, estimated: true, detail: `Draw prob ${drawProb.toFixed(0)}%, short odds → over 1.5 likely` };
  if (drawProb <= 20 && favOdds <= 1.40) return { score: 11, estimated: true, detail: `Draw prob ${drawProb.toFixed(0)}% → goals expected` };
  if (drawProb <= 25) return { score: 9,  estimated: true, detail: `Draw prob ${drawProb.toFixed(0)}% → moderate goal expectation` };
  if (drawProb <= 30) return { score: 7,  estimated: true, detail: `Draw prob ${drawProb.toFixed(0)}% — draw possible` };
  return                     { score: 5,  estimated: true, detail: `Draw probability ${drawProb.toFixed(0)}% — over 1.5 uncertain` };
}

// ── 5. Opponent Weakness (/10) ────────────────────────────────────────────────

function opponentWeaknessScore(
  pick:      'HOME_WIN' | 'AWAY_WIN',
  homeOdds:  number,
  awayOdds:  number,
  drawOdds:  number
): number {
  const opponentOdds = pick === 'HOME_WIN' ? awayOdds : homeOdds;
  if (opponentOdds >= 7.0) return 10;
  if (opponentOdds >= 5.0) return 9;
  if (opponentOdds >= 4.0) return 8;
  if (opponentOdds >= 3.0) return 7;
  if (opponentOdds >= 2.5) return 6;
  if (opponentOdds >= 2.0) return 5;
  const drawProb = impliedProb(drawOdds);
  return drawProb < 20 ? 5 : 3;
}

// ── 6. League Reliability (/10) ───────────────────────────────────────────────

function leagueReliabilityScore(league: string, country: string): number {
  const text = `${league} ${country}`.toLowerCase();
  const tier1 = ['premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
    'eredivisie', 'primeira liga', 'scottish premiership', 'mls', 'brasileirao',
    'champions league', 'europa league', 'championship'];
  if (tier1.some(t => text.includes(t))) return 10;
  const tier2 = ['süper lig', 'super lig', 'ekstraklasa', 'pro league', 'allsvenskan',
    'eliteserien', 'danish', 'swiss', 'austrian', 'belgian', 'greek', 'czech',
    'romanian', 'hungarian', 'ukrainian', 'portuguese', 'turkish'];
  if (tier2.some(t => text.includes(t))) return 8;
  const tier3 = ['south american', 'african', 'asian', 'middle east', 'gulf'];
  if (tier3.some(t => text.includes(t))) return 6;
  return 5;
}

// ── Risk penalties ────────────────────────────────────────────────────────────

function calcRiskPenalty(flags: string[]): number {
  let penalty = 0;
  for (const f of flags) {
    if (f.includes('form data missing'))              penalty += 8;
    if (f.includes('away scoring data unavailable'))  penalty += 15;  // spec: explicit penalty
    if (f.includes('home scoring data not available'))penalty += 5;
    if (f.includes('obscure league'))                 penalty += 10;
    if (f.includes('odds too short, weak form'))      penalty += 10;
    if (f.includes('stale data'))                     penalty += 20;
    if (f.includes('borderline'))                     penalty += 5;
  }
  return Math.min(penalty, 55);
}

// ── Hard gate: is Filter B a hard fail? ──────────────────────────────────────
// Returns a reason string if it hard-fails, null if it may proceed.

function hardFailReason(
  formResult:    FormResult,
  scoringResult: ScoringResult,
  leagueScore:   number,
  pick:          'HOME_WIN' | 'AWAY_WIN',
  formMissing:   boolean
): string | null {

  // Opponent form clearly better AND we have reliable data → hard fail
  if (
    formResult.superiority === 'opponent' &&
    formResult.score === 0 &&          // biggest form gap
    !formMissing &&                    // we actually have the form data
    leagueScore >= 7                   // reliable league, data trustworthy
  ) {
    return `Hard fail — opponent has clearly stronger form (${formResult.detail})`;
  }

  // Away Win with zero scoring evidence is too incomplete to judge
  if (
    pick === 'AWAY_WIN' &&
    scoringResult.missing &&
    formMissing
  ) {
    return 'Insufficient away data — away scoring and form both unavailable';
  }

  // Scoring data shows team almost never scores
  if (scoringResult.likelyScoredIn8of10 === false && leagueScore >= 7) {
    return `Scoring criterion failed — team scores in estimated <6 of 10 games`;
  }

  return null;
}

// ── Master scorer ─────────────────────────────────────────────────────────────

export function scoreOddsFixture(
  raw: Omit<OddsFixture,
    'pick' | 'passesFilterA' | 'passesFilterB' | 'filterAReason' | 'filterBReason' |
    'notes' | 'riskFlags' | 'confidenceScore' | 'confidenceGrade' | 'oddsStrengthScore' |
    'formScore' | 'scoringConsistencyScore' | 'over15Score' | 'opponentWeaknessScore' |
    'leagueReliabilityScore' | 'riskPenalty'>
): OddsFixture {

  // ── Filter A ──────────────────────────────────────────────────────────────
  let pick: 'HOME_WIN' | 'AWAY_WIN' | null = null;
  let passesFilterA = false;
  let filterAReason = '';

  if (raw.country.toLowerCase().includes('belarus')) {
    filterAReason = 'Excluded — Belarus';
  } else if (raw.homeOdds >= 1.10 && raw.homeOdds <= 1.55) {
    pick = 'HOME_WIN';
    passesFilterA = true;
    filterAReason = `Home odds ${raw.homeOdds} within 1.10–1.55`;
  } else if (raw.awayOdds >= 1.10 && raw.awayOdds <= 1.39) {
    pick = 'AWAY_WIN';
    passesFilterA = true;
    filterAReason = `Away odds ${raw.awayOdds} within 1.10–1.39`;
  } else {
    filterAReason = `Odds outside Filter A range (home: ${raw.homeOdds}, away: ${raw.awayOdds})`;
  }

  if (!passesFilterA || !pick) {
    return {
      ...raw, pick, passesFilterA, passesFilterB: false,
      filterAReason, filterBReason: '', notes: '', riskFlags: [],
      confidenceScore: 0, confidenceGrade: 'Watchlist',
      oddsStrengthScore: 0, formScore: 0, scoringConsistencyScore: 0,
      over15Score: 0, opponentWeaknessScore: 0, leagueReliabilityScore: 0, riskPenalty: 0,
    };
  }

  // ── Score all components ──────────────────────────────────────────────────
  const oddsS    = oddsStrengthScore(pick, raw.homeOdds, raw.awayOdds);
  const formR    = formScore(pick, raw.homeForm, raw.awayForm, raw.homeOdds, raw.awayOdds);
  const scoringR = scoringConsistencyScore(pick, raw.homeScoring, raw.awayScoring, raw.homeOdds, raw.awayOdds);
  const o15R     = over15Score(raw.drawOdds, raw.homeOdds, raw.awayOdds, raw.over15Odds, raw.homeScoring, raw.awayScoring);
  const leagueS  = leagueReliabilityScore(raw.league, raw.country);
  const oppS     = opponentWeaknessScore(pick, raw.homeOdds, raw.awayOdds, raw.drawOdds);

  // Build flags and notes
  const flags: string[] = [];
  const notes: string[] = [];

  if (formR.missing)                         flags.push('form data missing — estimated from odds');
  if (scoringR.note)                         flags.push(scoringR.note);
  if (leagueS <= 5)                          flags.push('obscure league — lower data confidence');
  if (oddsS >= 14 && formR.score <= 5)       flags.push('odds too short, weak form support');
  if (o15R.estimated)                        notes.push(`Over 1.5: ${o15R.detail}.`);
  if (scoringR.missing && pick === 'AWAY_WIN') notes.push('Away scoring data unavailable — confidence reduced.');
  if (formR.superiority === 'opponent')      notes.push(`Form concern: ${formR.detail}.`);

  const penalty = calcRiskPenalty(flags);

  const rawScore = oddsS + formR.score + scoringR.score + o15R.score + oppS + leagueS - penalty;
  const confidenceScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const confidenceGrade = getConfidenceGrade(confidenceScore);

  // ── Filter B hard gate ────────────────────────────────────────────────────
  const hardFail = hardFailReason(formR, scoringR, leagueS, pick, formR.missing);
  const passesFilterB = hardFail === null && confidenceScore >= 65;

  // ── Build reason text ─────────────────────────────────────────────────────
  const filterBParts: string[] = [
    `Odds: ${oddsS}/20`,
    `Form: ${formR.score}/20 (${formR.superiority}${formR.missing ? ', est.' : ''})`,
    `Scoring: ${scoringR.score}/20${scoringR.missing ? ' (est.)' : ''}`,
    `Over1.5: ${o15R.score}/15${o15R.estimated ? ' (est.)' : ''}`,
    `OppWeak: ${oppS}/10`,
    `League: ${leagueS}/10`,
  ];
  if (penalty > 0) filterBParts.push(`Penalty: −${penalty}`);
  filterBParts.push(`= ${confidenceScore}/100 (${confidenceGrade})`);
  if (hardFail) filterBParts.push(`⛔ ${hardFail}`);

  return {
    ...raw,
    pick,
    passesFilterA,
    passesFilterB,
    filterAReason,
    filterBReason:           filterBParts.join(' | '),
    notes:                   notes.join(' '),
    riskFlags:               flags,
    confidenceScore,
    confidenceGrade,
    oddsStrengthScore:       oddsS,
    formScore:               formR.score,
    scoringConsistencyScore: scoringR.score,
    over15Score:             o15R.score,
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

export function applyFilterB(fixtures: OddsFixture[], minConfidence = 65): OddsFixture[] {
  return fixtures.filter(f => f.passesFilterA && f.passesFilterB && f.confidenceScore >= minConfidence);
}

// ── Apply UI filter settings ──────────────────────────────────────────────────

export function applyUiFilters(fixtures: OddsFixture[], settings: OddsFilterSettings): OddsFixture[] {
  return fixtures.filter(f => {
    if (settings.excludedCountries.some(ex => f.country.toLowerCase().includes(ex.toLowerCase()))) return false;
    if (settings.countrySearch && !f.country.toLowerCase().includes(settings.countrySearch.toLowerCase())) return false;
    if (settings.leagueSearch  && !f.league.toLowerCase().includes(settings.leagueSearch.toLowerCase()))   return false;
    if (settings.showFilterBOnly  && !f.passesFilterB) return false;
    if (settings.showHomeWinOnly  && f.pick !== 'HOME_WIN') return false;
    if (settings.showAwayWinOnly  && f.pick !== 'AWAY_WIN') return false;
    return true;
  });
}
