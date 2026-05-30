// ─────────────────────────────────────────────────────────────────────────────
// useStandings — fetches live league table data and enriches fixtures
//
// Used by both useForebetData and useOddsScanner.
// After fixtures load, call enrichForebetFixtures() or enrichOddsFixtures().
// The hook fetches standings for all recognised leagues, then enriches each
// fixture with real motivation scores and form data.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react';
import type { Fixture }     from '../types/Fixture';
import type { OddsFixture } from '../types/OddsFixture';
import { fetchBatchStandings } from '../api/standingsApi';
import {
  extractLeagueNames,
  batchEnrichForebetFixtures,
  batchEnrichOddsFixtures,
  type StandingsMap,
} from '../utils/motivationEngine';

export type EnrichStatus = 'idle' | 'fetching' | 'done' | 'skipped';

export interface EnrichResult {
  status:         EnrichStatus;
  enrichedCount:  number;
  leaguesFound:   string[];
  leaguesTotal:   number;
  message:        string;
}

export function useStandings() {
  const [status,       setStatus]       = useState<EnrichStatus>('idle');
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);

  // Cache so we don't re-fetch if already loaded for the same leagues
  const standingsCacheRef = useRef<StandingsMap>(new Map());
  const fetchedLeaguesRef = useRef<Set<string>>(new Set());

  // ── Enrich Forebet fixtures ────────────────────────────────────────────────

  const enrichForebetFixtures = useCallback(async (
    fixtures: Fixture[]
  ): Promise<Fixture[]> => {
    if (!fixtures.length) return fixtures;

    setStatus('fetching');

    try {
      // Identify which leagues we haven't fetched yet
      const allLeagues  = extractLeagueNames(fixtures);
      const newLeagues  = allLeagues.filter(l => !fetchedLeaguesRef.current.has(l));

      if (newLeagues.length > 0) {
        const freshMap = await fetchBatchStandings(newLeagues);
        freshMap.forEach((v, k) => standingsCacheRef.current.set(k, v));
        newLeagues.forEach(l => fetchedLeaguesRef.current.add(l));
      }

      if (standingsCacheRef.current.size === 0) {
        setStatus('skipped');
        setEnrichResult({
          status: 'skipped', enrichedCount: 0, leaguesFound: [],
          leaguesTotal: allLeagues.length,
          message: 'FOOTBALL_DATA_API_KEY not configured — using proxy motivation scores.',
        });
        return fixtures;
      }

      const { fixtures: enriched, enrichedCount, leaguesFound } =
        batchEnrichForebetFixtures(fixtures, standingsCacheRef.current);

      setStatus('done');
      setEnrichResult({
        status: 'done',
        enrichedCount,
        leaguesFound,
        leaguesTotal: allLeagues.length,
        message: enrichedCount > 0
          ? `Live table data applied to ${enrichedCount} fixtures across ${leaguesFound.length} league(s).`
          : `No supported leagues found in this fixture set — proxy scores used.`,
      });

      return enriched;

    } catch (err) {
      console.warn('[useStandings] Enrichment failed:', (err as Error).message);
      setStatus('skipped');
      setEnrichResult({
        status: 'skipped', enrichedCount: 0, leaguesFound: [],
        leaguesTotal: 0,
        message: 'Standings fetch failed — using proxy motivation scores.',
      });
      return fixtures;
    }
  }, []);

  // ── Enrich Odds Scanner fixtures ────────────────────────────────────────────

  const enrichOddsFixtures = useCallback(async (
    fixtures: OddsFixture[]
  ): Promise<OddsFixture[]> => {
    if (!fixtures.length) return fixtures;

    setStatus('fetching');

    try {
      const allLeagues = extractLeagueNames(fixtures);
      const newLeagues = allLeagues.filter(l => !fetchedLeaguesRef.current.has(l));

      if (newLeagues.length > 0) {
        const freshMap = await fetchBatchStandings(newLeagues);
        freshMap.forEach((v, k) => standingsCacheRef.current.set(k, v));
        newLeagues.forEach(l => fetchedLeaguesRef.current.add(l));
      }

      if (standingsCacheRef.current.size === 0) {
        setStatus('skipped');
        setEnrichResult({
          status: 'skipped', enrichedCount: 0, leaguesFound: [],
          leaguesTotal: allLeagues.length,
          message: 'FOOTBALL_DATA_API_KEY not configured — using proxy form scores.',
        });
        return fixtures;
      }

      const { fixtures: enriched, enrichedCount, leaguesFound } =
        batchEnrichOddsFixtures(fixtures, standingsCacheRef.current);

      setStatus('done');
      setEnrichResult({
        status: 'done',
        enrichedCount,
        leaguesFound,
        leaguesTotal: allLeagues.length,
        message: enrichedCount > 0
          ? `Live table data applied to ${enrichedCount} fixtures across ${leaguesFound.length} league(s).`
          : `No supported leagues found — proxy form scores used.`,
      });

      return enriched;

    } catch (err) {
      console.warn('[useStandings] Odds enrichment failed:', (err as Error).message);
      setStatus('skipped');
      setEnrichResult({
        status: 'skipped', enrichedCount: 0, leaguesFound: [],
        leaguesTotal: 0,
        message: 'Standings fetch failed — using proxy scores.',
      });
      return fixtures;
    }
  }, []);

  const resetEnrichment = useCallback(() => {
    setStatus('idle');
    setEnrichResult(null);
    standingsCacheRef.current.clear();
    fetchedLeaguesRef.current.clear();
  }, []);

  return {
    enrichStatus: status,
    enrichResult,
    enrichForebetFixtures,
    enrichOddsFixtures,
    resetEnrichment,
  };
}
