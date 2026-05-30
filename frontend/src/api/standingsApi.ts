// ─────────────────────────────────────────────────────────────────────────────
// Standings API client — calls the backend /api/standings proxy
// ─────────────────────────────────────────────────────────────────────────────

import type { CompetitionStandings } from '../utils/motivationEngine';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/standings`
  : '/api/standings';

/** Fetches standings for multiple leagues in one batch request. */
export async function fetchBatchStandings(
  leagueNames: string[]
): Promise<Map<string, CompetitionStandings>> {
  if (!leagueNames.length) return new Map();

  const param = encodeURIComponent(leagueNames.join(','));
  const res   = await fetch(`${API_BASE}/batch?leagues=${param}`);

  if (!res.ok) {
    // 503 = API key not configured — return empty map, caller handles gracefully
    return new Map();
  }

  const data = await res.json() as {
    standings: Record<string, CompetitionStandings>;
  };

  const result = new Map<string, CompetitionStandings>();
  Object.entries(data.standings ?? {}).forEach(([code, s]) => {
    // Index by both competition code AND competition name so lookups work either way
    result.set(code,   s);
    result.set(s.name, s);
    result.set(s.country, s);
  });

  return result;
}

/** Returns the list of competitions covered by the backend. */
export async function fetchSupportedCompetitions(): Promise<Record<string, { name: string; country: string }>> {
  try {
    const res  = await fetch(`${API_BASE}/supported`);
    if (!res.ok) return {};
    const data = await res.json() as { competitions: Record<string, { name: string; country: string }> };
    return data.competitions ?? {};
  } catch {
    return {};
  }
}
