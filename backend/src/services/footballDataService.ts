// ─────────────────────────────────────────────────────────────────────────────
// Football-Data.org API Service
//
// Fetches live league standings for accurate motivation scoring.
// Free tier: 10 requests/minute, ~20 competitions.
// Docs: https://www.football-data.org/documentation/quickstart
//
// Get a free API key at: https://www.football-data.org/client/register
// Add to backend/.env: FOOTBALL_DATA_API_KEY=your_key_here
//
// Results are cached in memory for 6 hours so the rate limit is never hit
// during normal dashboard usage.
// ─────────────────────────────────────────────────────────────────────────────

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const CACHE_TTL_MS       = 6 * 60 * 60 * 1000;   // 6 hours
const REQUEST_DELAY_MS   = 700;                    // ~1.4 req/s — well under 10/min limit

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StandingEntry {
  position:    number;
  teamId:      number;
  teamName:    string;   // full name e.g. "Arsenal FC"
  shortName:   string;   // e.g. "Arsenal"
  tla:         string;   // 3-letter abbreviation e.g. "ARS"
  points:      number;
  playedGames: number;
  won:         number;
  draw:        number;
  lost:        number;
  goalsFor:    number;
  goalsAgainst:number;
  form:        string;   // e.g. "W,D,W,L,W" most-recent last
}

export interface CompetitionStandings {
  code:          string;
  name:          string;
  country:       string;
  totalTeams:    number;
  matchday:      number;
  season:        string;
  table:         StandingEntry[];
  fetchedAt:     string;
}

// ── Supported competitions (Football-Data.org free tier) ──────────────────────

export const SUPPORTED_COMPETITIONS: Record<string, { name: string; country: string }> = {
  PL:   { name: 'Premier League',        country: 'England'     },
  BL1:  { name: 'Bundesliga',            country: 'Germany'     },
  PD:   { name: 'La Liga',               country: 'Spain'       },
  SA:   { name: 'Serie A',               country: 'Italy'       },
  FL1:  { name: 'Ligue 1',               country: 'France'      },
  DED:  { name: 'Eredivisie',            country: 'Netherlands' },
  PPL:  { name: 'Primeira Liga',         country: 'Portugal'    },
  ELC:  { name: 'Championship',          country: 'England'     },
  EC:   { name: 'Eliteserien',           country: 'Norway'      },
  CL:   { name: 'Champions League',      country: 'Europe'      },
  EL:   { name: 'Europa League',         country: 'Europe'      },
  BSA:  { name: 'Brasileirão Série A',   country: 'Brazil'      },
  CSL:  { name: 'Chinese Super League',  country: 'China'       },
  MLS:  { name: 'MLS',                   country: 'USA'         },
};

// ── League name → competition code mapper ─────────────────────────────────────
// Handles common name variations from Forebet and Flashscore.

const LEAGUE_NAME_MAP: [string[], string][] = [
  [['premier league', 'epl', 'english premier', 'bpl'],                      'PL'  ],
  [['bundesliga', 'german bundesliga', '1. bundesliga', 'bl1'],               'BL1' ],
  [['la liga', 'laliga', 'primera division', 'primera división', 'pd'],       'PD'  ],
  [['serie a', 'serie a tim', 'calcio', 'italian serie a'],                   'SA'  ],
  [['ligue 1', 'ligue1', 'french ligue 1', 'fl1'],                            'FL1' ],
  [['eredivisie', 'dutch eredivisie', 'ded'],                                 'DED' ],
  [['primeira liga', 'liga portugal', 'portuguese liga', 'liga nos', 'ppl'],  'PPL' ],
  [['championship', 'efl championship', 'english championship'],              'ELC' ],
  [['champions league', 'uefa champions league', 'ucl', 'cl'],                'CL'  ],
  [['europa league', 'uefa europa league', 'uel', 'el'],                      'EL'  ],
  [['brasileirao', 'série a', 'serie a brazil', 'bsa'],                       'BSA' ],
  [['mls', 'major league soccer'],                                            'MLS' ],
  [['eliteserien', 'norwegian eliteserien'],                                  'EC'  ],
];

export function findCompetitionCode(leagueName: string): string | null {
  if (!leagueName) return null;
  const lower = leagueName.toLowerCase().trim();
  for (const [aliases, code] of LEAGUE_NAME_MAP) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) {
      return code;
    }
  }
  return null;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, CompetitionStandings>();

function isCacheValid(entry: CompetitionStandings): boolean {
  return Date.now() - new Date(entry.fetchedAt).getTime() < CACHE_TTL_MS;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Core API fetch ────────────────────────────────────────────────────────────

export async function fetchStandings(
  competitionCode: string
): Promise<CompetitionStandings | null> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn('[FootballData] FOOTBALL_DATA_API_KEY not set — standings unavailable.');
    return null;
  }

  // Serve from cache
  const cached = cache.get(competitionCode);
  if (cached && isCacheValid(cached)) {
    console.log(`[FootballData] Cache hit: ${competitionCode}`);
    return cached;
  }

  try {
    console.log(`[FootballData] Fetching standings: ${competitionCode}`);
    await delay(REQUEST_DELAY_MS); // polite rate limiting

    const res = await fetch(`${FOOTBALL_DATA_BASE}/competitions/${competitionCode}/standings`, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (res.status === 429) {
      console.warn(`[FootballData] Rate limited on ${competitionCode} — skipping.`);
      return null;
    }
    if (res.status === 403) {
      console.warn(`[FootballData] ${competitionCode} not in your subscription tier.`);
      return null;
    }
    if (!res.ok) {
      console.warn(`[FootballData] HTTP ${res.status} for ${competitionCode}`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const rawTable  = json.standings?.[0]?.table ?? [];
    const season    = json.season;
    const matchday  = season?.currentMatchday ?? 0;

    const table: StandingEntry[] = rawTable.map((row: {
      position: number; team: { id: number; name: string; shortName: string; tla: string };
      points: number; playedGames: number; won: number; draw: number; lost: number;
      goalsFor: number; goalsAgainst: number; form?: string;
    }) => ({
      position:     row.position,
      teamId:       row.team.id,
      teamName:     row.team.name,
      shortName:    row.team.shortName,
      tla:          row.team.tla,
      points:       row.points,
      playedGames:  row.playedGames,
      won:          row.won,
      draw:         row.draw,
      lost:         row.lost,
      goalsFor:     row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      form:         row.form ?? '',
    }));

    const result: CompetitionStandings = {
      code:       competitionCode,
      name:       SUPPORTED_COMPETITIONS[competitionCode]?.name ?? competitionCode,
      country:    SUPPORTED_COMPETITIONS[competitionCode]?.country ?? '',
      totalTeams: table.length,
      matchday,
      season:     `${season?.startDate?.slice(0,4)}/${season?.endDate?.slice(0,4)}` || '',
      table,
      fetchedAt:  new Date().toISOString(),
    };

    cache.set(competitionCode, result);
    return result;

  } catch (err) {
    console.error(`[FootballData] Error fetching ${competitionCode}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetches standings for multiple leagues at once.
 * Respects the rate limit by spacing out requests.
 * Returns a map: competitionCode → CompetitionStandings
 */
export async function fetchMultipleStandings(
  leagueNames: string[]
): Promise<Map<string, CompetitionStandings>> {
  const result = new Map<string, CompetitionStandings>();

  // Deduplicate + resolve codes
  const codes = [...new Set(
    leagueNames.map(findCompetitionCode).filter((c): c is string => c !== null)
  )];

  for (const code of codes) {
    const standings = await fetchStandings(code);
    if (standings) result.set(code, standings);
  }

  return result;
}

/** Returns cached standings without a network call. Useful for checking if data is fresh. */
export function getCachedStandings(competitionCode: string): CompetitionStandings | null {
  const c = cache.get(competitionCode);
  return c && isCacheValid(c) ? c : null;
}

/** Clears the entire standings cache (useful in tests). */
export function clearStandingsCache(): void {
  cache.clear();
}
