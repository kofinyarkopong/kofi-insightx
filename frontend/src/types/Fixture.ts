// ─────────────────────────────────────────────────────────────────────────────
// Fixture data model — mirrors the Supabase `matches` table schema
// ─────────────────────────────────────────────────────────────────────────────

export interface Fixture {
  id:             string;
  date:           string;
  kickoffTime:    string | null;
  homeTeam:       string;
  awayTeam:       string;
  league:         string | null;
  href:           string | null;

  homeWinProb:    number | null;
  drawProb:       number | null;
  awayWinProb:    number | null;

  predictedScore: string | null;
  avgGoals:       number | null;
  prediction:     string | null;
  odds:           string | null;

  confidenceScore: number;
  confidenceTier:  'strong' | 'watch' | 'lean' | 'reject';
  scoreBreakdown:  Record<string, number> | null;
  riskFlags:       string[];

  filterA:       boolean;
  filterB:       boolean;
  bestShortlist: boolean;
  needsReview:   boolean;

  enriched:       boolean;
  enrichmentData: Record<string, unknown> | null;

  source:    'playwright' | 'manual';
  scrapedAt: string;
}

// ── Legacy API result (used by manual paste backend route) ────────────────────

export interface FetchResult {
  fixtures:    Fixture[];
  fetchedAt:   string;
  date:        string;
  totalParsed: number;
  fromCache:   boolean;
  method:      'playwright' | 'cheerio' | 'manual' | 'cache';
  warnings:    string[];
}

// ── Filter settings ───────────────────────────────────────────────────────────

export interface FilterSettings {
  minHomeWinProb:    number;
  minConfidenceScore: number;
  bestListSize:      number;
  hideWomens:        boolean;
  leagueSearch:      string;
  penaliseWomens:    boolean;
}

export const DEFAULT_FILTERS: FilterSettings = {
  minHomeWinProb:    45,
  minConfidenceScore: 60,
  bestListSize:      15,
  hideWomens:        false,
  leagueSearch:      '',
  penaliseWomens:    false,
};
