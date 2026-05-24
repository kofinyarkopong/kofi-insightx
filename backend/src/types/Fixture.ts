// ─────────────────────────────────────────────────────────────────────────────
// Core Fixture data model
// ─────────────────────────────────────────────────────────────────────────────

export interface Fixture {
  id: string;
  source: 'forebet';
  sourceUrl: string;
  date: string;          // YYYY-MM-DD
  timeGMT: string;       // HH:mm
  league: string;        // e.g. "ENG P", "ESP 1"
  competition?: string;  // Full competition name if available
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;   // 0–100
  drawProb: number;
  awayWinProb: number;
  prediction: string;    // "1" | "X" | "2" | "1X" | "X2" | "12"
  correctScore: string;  // e.g. "2-1"
  avgGoals: number;
  odds?: number;
  status: 'upcoming' | 'live' | 'half_time' | 'finished' | 'unknown';
  minute?: string;       // live minute string e.g. "67'"

  // Risk flags
  isCup: boolean;
  isDerbyRisk: boolean;
  isSecondLegRisk: boolean;
  isRelegationTrapRisk: boolean;
  isYouthOrReserve: boolean;
  isWomen: boolean;

  // Scoring sub-components (0–100 each)
  lowBlockRisk: number;
  motivationScore: number;
  formProxyScore: number;
  homeScoringScore: number;
  awayConcedingScore: number;
  awayWeaknessScore: number;
  riskPenalty: number;
  confidenceScore: number;
  parseConfidence: number;  // 0–100: how reliable the parse was

  // Human-readable output
  flags: string[];
  reason: string;

  // For deep-verify
  matchUrl?: string;
  deepVerified?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchResult {
  fixtures: Fixture[];
  fetchedAt: string;
  date: string;
  totalParsed: number;
  fromCache: boolean;
  method: 'playwright' | 'cheerio' | 'manual' | 'cache';
  warnings: string[];
}

export interface DeepVerifyResult {
  id: string;
  updatedReason: string;
  updatedConfidence: number;
  trendData: {
    homeScoring?: string;
    awayConceding?: string;
    recentForm?: string;
    overTwoFiveTrend?: string;
    leaguePosition?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter settings (mirrored in frontend)
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterSettings {
  minHomeWinProb: number;        // default 45
  minAvgGoals: number;           // default 2.5
  minConfidenceScore: number;    // default 70
  bestListSize: number;          // default 8
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
