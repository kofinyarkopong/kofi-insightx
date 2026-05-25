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
};
