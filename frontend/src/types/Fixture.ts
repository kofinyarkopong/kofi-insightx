// ─────────────────────────────────────────────────────────────────────────────
// Core Fixture data model  (mirrors backend/src/types/Fixture.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface Fixture {
  id: string;
  source: 'forebet';
  sourceUrl: string;
  date: string;
  timeGMT: string;
  league: string;
  competition?: string;
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  prediction: string;
  correctScore: string;
  avgGoals: number;
  odds?: number;
  status: 'upcoming' | 'live' | 'half_time' | 'finished' | 'unknown';
  minute?: string;

  isCup: boolean;
  isDerbyRisk: boolean;
  isSecondLegRisk: boolean;
  isRelegationTrapRisk: boolean;
  isYouthOrReserve: boolean;
  isWomen: boolean;

  lowBlockRisk: number;
  motivationScore: number;
  formProxyScore: number;
  homeScoringScore: number;
  awayConcedingScore: number;
  awayWeaknessScore: number;
  riskPenalty: number;
  confidenceScore: number;
  parseConfidence: number;

  flags: string[];
  reason: string;

  matchUrl?: string;
  deepVerified?: boolean;

  // ── Live standings enrichment (populated after Football-Data.org lookup) ──
  // ── Flashscore 1X2 odds (attached after cross-referencing) ─────────────────
  homeOdds1X2?: number;
  drawOdds1X2?: number;
  awayOdds1X2?: number;
  oddsAttached?: boolean;   // true when odds were successfully matched

  // ── Live standings enrichment ────────────────────────────────────────────
  standingsEnriched?:       boolean;
  homeTablePosition?:       number;   // 1 = league leader
  homeTablePoints?:         number;
  homeMatchesPlayed?:       number;
  homeMatchesRemaining?:    number;
  homeActualForm?:          string;   // e.g. "W,D,W,L,W" from standings
  awayTablePosition?:       number;
  awayTablePoints?:         number;
  awayActualForm?:          string;
  leaderPoints?:            number;   // points of the league leader
  totalTeamsInLeague?:      number;
}

export interface FetchResult {
  fixtures: Fixture[];
  fetchedAt: string;
  date: string;
  totalParsed: number;
  fromCache: boolean;
  method: 'playwright' | 'cheerio' | 'manual' | 'cache';
  warnings: string[];
}

export interface FilterSettings {
  minHomeWinProb: number;
  minAvgGoals: number;
  minConfidenceScore: number;
  bestListSize: number;
  upcomingOnly: boolean;
  excludeDerbies: boolean;
  excludeCupsAndSecondLegs: boolean;
  excludeRelegationTraps: boolean;
  requirePredictedHomeWin: boolean;
  requireOverTwoFive: boolean;
  hideYouthReserve: boolean;
  hideWomens: boolean;
  includeCups: boolean;
  includeLowConfidenceParsed: boolean;
  leagueSearch: string;
  penaliseWomens: boolean;
  // ── Odds filters (from Flashscore cross-reference) ──
  minHomeOdds:     number;   // 1.00 = no filter
  maxHomeOdds:     number;   // 0 = no filter
  showOnlyWithOdds: boolean;
}

export const DEFAULT_FILTERS: FilterSettings = {
  minHomeWinProb: 45,
  minAvgGoals: 2.5,
  minConfidenceScore: 70,
  bestListSize: 8,
  upcomingOnly: true,
  excludeDerbies: true,
  excludeCupsAndSecondLegs: true,
  excludeRelegationTraps: true,
  requirePredictedHomeWin: true,
  requireOverTwoFive: true,
  hideYouthReserve: true,
  hideWomens: false,
  includeCups: false,
  includeLowConfidenceParsed: false,
  leagueSearch: '',
  penaliseWomens: false,
  minHomeOdds:     1.00,
  maxHomeOdds:     0,      // 0 = no upper limit
  showOnlyWithOdds: false,
};
