// ─────────────────────────────────────────────────────────────────────────────
// Odds Attacher
//
// Cross-references Forebet fixtures with Flashscore 1X2 odds already stored
// in Supabase.  Matches by team name (normalised fuzzy match) so we can display
// H Odds / A Odds alongside the Forebet probability columns.
//
// Data flow:
//   GET /api/odds?date=YYYY-MM-DD  →  RawOddsRow[]  →  attachOddsToFixtures()
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture } from '../types/Fixture';

export interface OddsRow {
  homeTeam:  string;
  awayTeam:  string;
  homeOdds:  number;
  drawOdds:  number;
  awayOdds:  number;
}

// ── Name normaliser ───────────────────────────────────────────────────────────

const STRIP = [
  / fc$/i, / afc$/i, / cf$/i, / sc$/i, / ac$/i, / bc$/i, / bk$/i,
  / united$/i, / utd$/i, / city$/i, / town$/i, / rovers$/i,
  / wanderers$/i, / athletic$/i, / albion$/i, /\bfc\b/i,
];

function norm(name: string): string {
  let s = name.toLowerCase().trim();
  for (const p of STRIP) s = s.replace(p, '').trim();
  return s.replace(/\s+/g, ' ');
}

/** Returns true if the two team names are likely the same club. */
function teamsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Handle common abbreviations e.g. "Man City" ↔ "Manchester City"
  const shortA = na.split(' ')[0];
  const shortB = nb.split(' ')[0];
  if (shortA.length >= 4 && shortB.startsWith(shortA)) return true;
  if (shortB.length >= 4 && shortA.startsWith(shortB)) return true;
  return false;
}

/** Finds a matching odds row for a Forebet fixture. */
function findOddsRow(
  homeTeam: string,
  awayTeam: string,
  rows: OddsRow[]
): OddsRow | null {
  for (const row of rows) {
    if (teamsMatch(homeTeam, row.homeTeam) && teamsMatch(awayTeam, row.awayTeam)) {
      return row;
    }
  }
  return null;
}

/** Fetches odds for a given date from the backend and returns them as OddsRow[]. */
export async function fetchOddsForDate(date: string): Promise<OddsRow[]> {
  const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/odds`
    : '/api/odds';

  try {
    const res = await fetch(`${API_BASE}?date=${date}`);
    if (!res.ok) return [];   // 404 = no data for this date — silent skip
    const data = await res.json() as { fixtures: OddsRow[] };
    return Array.isArray(data.fixtures) ? data.fixtures : [];
  } catch {
    return [];
  }
}

/**
 * Attaches Flashscore odds to Forebet fixtures via team-name matching.
 * Returns a new array — original fixtures are unchanged.
 */
export function attachOddsToFixtures(
  fixtures: Fixture[],
  oddsRows: OddsRow[]
): Fixture[] {
  if (!oddsRows.length) return fixtures;

  let matched = 0;
  const result = fixtures.map(fx => {
    const row = findOddsRow(fx.homeTeam, fx.awayTeam, oddsRows);
    if (!row) return fx;
    matched++;
    return {
      ...fx,
      homeOdds1X2:  row.homeOdds,
      drawOdds1X2:  row.drawOdds,
      awayOdds1X2:  row.awayOdds,
      oddsAttached: true,
    };
  });

  console.log(`[OddsAttacher] Matched ${matched}/${fixtures.length} fixtures with Flashscore odds.`);
  return result;
}
