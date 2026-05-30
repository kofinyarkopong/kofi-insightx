// ─────────────────────────────────────────────────────────────────────────────
// Odds Scanner — Data Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Core fixture with odds ────────────────────────────────────────────────────

export interface OddsFixture {
  id: string;

  // Scheduling
  date:     string;   // YYYY-MM-DD
  timeGMT:  string;   // HH:MM (always GMT)
  timezone: string;   // source timezone, e.g. "Europe/London"

  // Location
  country: string;
  league:  string;

  // Teams
  homeTeam: string;
  awayTeam: string;

  // 1X2 odds
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;

  // Optional enrichment
  over15Odds?:    number;   // over 1.5 goals market odds
  homeForm?:      string;   // e.g. "WWDLW" most-recent first
  awayForm?:      string;
  homeScoring?:   number;   // home goals scored across last 10 home games
  awayScoring?:   number;   // away goals scored across last 10 away games
  homeConceeded?: number;   // goals conceded last 10 home games
  awayConceeded?: number;

  // Provenance
  marketSource: string;   // e.g. "CSV Upload", "Football-Data.org"
  refreshedAt:  string;   // ISO timestamp

  // ── Derived by the filtering engine ──────────────────────────────────────
  pick:          'HOME_WIN' | 'AWAY_WIN' | null;
  passesFilterA: boolean;
  passesFilterB: boolean;

  filterAReason: string;
  filterBReason: string;
  notes:         string;
  riskFlags:     string[];

  // Confidence model breakdown
  confidenceScore:           number;
  confidenceGrade:           ConfidenceGrade;
  oddsStrengthScore:         number;   // /20
  formScore:                 number;   // /20
  scoringConsistencyScore:   number;   // /20
  over15Score:               number;   // /15
  opponentWeaknessScore:     number;   // /10
  leagueReliabilityScore:    number;   // /10
  riskPenalty:               number;   // subtracted

  // ── Live standings enrichment (populated after Football-Data.org lookup) ──
  standingsEnriched?:  boolean;
  homeTablePosition?:  number;
  awayTablePosition?:  number;
  homeTablePoints?:    number;
  awayTablePoints?:    number;
  leaderPoints?:       number;
  totalTeamsInLeague?: number;
}

export type ConfidenceGrade = 'Elite' | 'Strong' | 'Moderate' | 'Watchlist';

// ── Filter settings ───────────────────────────────────────────────────────────

export interface OddsFilterSettings {
  // Odds ranges
  homeOddsMin:  number;
  homeOddsMax:  number;
  awayOddsMin:  number;
  awayOddsMax:  number;

  // Date
  date: string;   // YYYY-MM-DD

  // Country / league search
  countrySearch:      string;
  leagueSearch:       string;
  excludedCountries:  string[];   // always includes "Belarus"

  // Confidence threshold for Filter B
  minConfidenceScore: number;

  // View toggles
  showHomeWinOnly:  boolean;
  showAwayWinOnly:  boolean;
  showFilterBOnly:  boolean;
}

// ── Raw row from CSV upload ───────────────────────────────────────────────────

export interface RawCsvRow {
  date?:         string;
  time?:         string;
  country?:      string;
  league?:       string;
  home_team?:    string;
  away_team?:    string;
  home_odds?:    string;
  draw_odds?:    string;
  away_odds?:    string;
  over_15_odds?: string;
  home_form?:    string;
  away_form?:    string;
  home_scoring?: string;
  away_scoring?: string;
  timezone?:     string;
  [key: string]: string | undefined;
}

// ── Data provider abstraction ─────────────────────────────────────────────────
// Implement this interface to plug in any data source:
//   - CSV upload (current MVP)
//   - Football-Data.org API
//   - Flashscore export
//   - Manual entry
//
// The filtering engine operates only on OddsFixture[], so the source is
// fully interchangeable.

export interface OddsDataProvider {
  /**
   * Returns normalised fixtures with odds for the given date.
   * For CSV upload, this just returns the already-parsed fixtures.
   */
  getFixturesWithOdds(date: string): Promise<OddsFixture[]>;

  /**
   * Optional: returns a form string like "WWDLW" for a team.
   * If unavailable, return null — the scorer handles missing data gracefully.
   */
  getTeamForm?(teamId: string): Promise<string | null>;

  /** Optional: goals scored in last N home/away games. */
  getTeamScoringRecord?(teamId: string, venue: 'home' | 'away', lastN: number): Promise<number | null>;

  /** Human-readable provider name shown in the UI. */
  providerName: string;
}

// ── Upload parse result ───────────────────────────────────────────────────────

export interface CsvParseResult {
  fixtures:   OddsFixture[];
  rowsTotal:  number;
  rowsValid:  number;
  rowsSkipped: number;
  skippedReasons: string[];
  warnings:   string[];
}

// ── Sort config ───────────────────────────────────────────────────────────────

export type OddsSortKey = 'timeGMT' | 'homeOdds' | 'awayOdds' | 'confidenceScore' | 'country' | 'league';
export type SortDir = 'asc' | 'desc';
