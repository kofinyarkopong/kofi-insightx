// ─────────────────────────────────────────────────────────────────────────────
// useOddsScanner — central state for the Odds Scanner dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback } from 'react';
import type { OddsFixture, OddsFilterSettings, OddsSortKey, SortDir, CsvParseResult } from '../types/OddsFixture';
import { DEFAULT_FILTER_SETTINGS, applyFilterA, applyFilterB, applyUiFilters, scoreOddsFixture } from '../utils/oddsFilters';
import { parseCsvUpload } from '../utils/csvParser';
import { useStandings } from './useStandings';

export type FetchStatus = 'idle' | 'fetching' | 'done' | 'error';

// Resolve the backend API base URL
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/odds`
  : '/api/odds';

export function useOddsScanner() {
  const { enrichOddsFixtures, enrichStatus, enrichResult, resetEnrichment } = useStandings();

  const [allFixtures,   setAllFixtures]   = useState<OddsFixture[]>([]);
  const [parseResult,   setParseResult]   = useState<CsvParseResult | null>(null);
  const [fetchStatus,   setFetchStatus]   = useState<FetchStatus>('idle');
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [fetchWarnings, setFetchWarnings] = useState<string[]>([]);
  const [dataSource,    setDataSource]    = useState<string>('');
  const [filters,       setFilters]       = useState<OddsFilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [sortKey,       setSortKey]       = useState<OddsSortKey>('confidenceScore');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');
  const [activeFixture, setActiveFixture] = useState<OddsFixture | null>(null);

  // ── Helper: take raw rows from API and score them ─────────────────────────

  function scoreRawRows(rows: unknown[]): OddsFixture[] {
    return (rows as Array<Partial<OddsFixture>>).map(raw => {
      // Raw rows from Playwright have no scoring fields — score them now
      if (raw.confidenceScore !== undefined) return raw as OddsFixture; // already scored
      return scoreOddsFixture(raw as Parameters<typeof scoreOddsFixture>[0]);
    });
  }

  // ── Fetch from Flashscore via backend API ──────────────────────────────────

  const fetchFromFlashscore = useCallback(async (date?: string) => {
    // Guard: ensure date is a valid YYYY-MM-DD string (not a MouseEvent or undefined)
    const isValidDate = (d?: string) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const targetDate = isValidDate(date) ? date! : (isValidDate(filters.date) ? filters.date : new Date().toISOString().slice(0, 10));
    setFetchStatus('fetching');
    setFetchError(null);
    setFetchWarnings([]);
    setDataSource('');

    try {
      const url = `${API_BASE}?date=${targetDate}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        // Handle "no data yet" gracefully — show helpful message, not an error state
        if (res.status === 404 && (body as { noData?: boolean }).noData) {
          setFetchError(
            `No Flashscore odds found for ${targetDate}. ` +
            (import.meta.env.VITE_DEPLOY_TARGET === 'vercel'
              ? 'Run "npm run scrape-odds" on your Mac first.'
              : 'Scraping now — this takes ~30 seconds...')
          );
          setFetchStatus('error');
          return;
        }
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as {
        fixtures:   unknown[];
        totalFound: number;
        scrapedAt:  string;
        source:     string;
        warnings:   string[];
      };

      const scored = scoreRawRows(data.fixtures);
      // Show initial results immediately, then enrich with real standings
      setAllFixtures(scored);
      setFetchWarnings(data.warnings ?? []);
      setDataSource(data.source ?? 'api');
      setFetchStatus('done');

      // Enrich in background — updates confidence with live table data
      const enriched = await enrichOddsFixtures(scored);
      setAllFixtures(enriched);

      console.log(`[OddsScanner] Loaded ${scored.length} fixtures from ${data.source} (${targetDate})`);

    } catch (err) {
      setFetchError((err as Error).message);
      setFetchStatus('error');
    }
  }, [filters.date]);

  // ── CSV upload fallback ────────────────────────────────────────────────────

  const uploadCSV = useCallback(async (file: File) => {
    setFetchStatus('fetching');
    setFetchError(null);
    try {
      const text   = await file.text();
      const result = parseCsvUpload(text, filters.excludedCountries);
      setAllFixtures(result.fixtures);
      setParseResult(result);
      setFetchWarnings(result.warnings);
      setDataSource('csv');
      setFetchStatus('done');

      // Enrich CSV fixtures with live standings too
      const enriched = await enrichOddsFixtures(result.fixtures);
      setAllFixtures(enriched);
      console.log(`[OddsScanner] CSV: ${result.rowsValid}/${result.rowsTotal} rows imported.`);
    } catch (err) {
      setFetchError((err as Error).message);
      setFetchStatus('error');
    }
  }, [filters.excludedCountries]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const filterAList = useMemo(() => applyFilterA(allFixtures), [allFixtures]);
  const filterBList = useMemo(() => applyFilterB(allFixtures, filters.minConfidenceScore), [allFixtures, filters.minConfidenceScore]);

  const displayList = useMemo(() => {
    const base = applyUiFilters(allFixtures.filter(f => f.passesFilterA), filters);
    return [...base].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'timeGMT':         diff = a.timeGMT.localeCompare(b.timeGMT); break;
        case 'homeOdds':        diff = a.homeOdds - b.homeOdds;            break;
        case 'awayOdds':        diff = a.awayOdds - b.awayOdds;            break;
        case 'confidenceScore': diff = a.confidenceScore - b.confidenceScore; break;
        case 'country':         diff = a.country.localeCompare(b.country); break;
        case 'league':          diff = a.league.localeCompare(b.league);   break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [allFixtures, filters, sortKey, sortDir]);

  // ── Filter settings ────────────────────────────────────────────────────────

  const updateFilter = useCallback(<K extends keyof OddsFilterSettings>(key: K, val: OddsFilterSettings[K]) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTER_SETTINGS), []);

  // ── Sort ───────────────────────────────────────────────────────────────────

  const setSort = useCallback((key: OddsSortKey) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('desc');
      return key;
    });
  }, []);

  // ── Clear ──────────────────────────────────────────────────────────────────

  const clearData = useCallback(() => {
    setAllFixtures([]);
    setParseResult(null);
    setFetchStatus('idle');
    setFetchError(null);
    setFetchWarnings([]);
    setDataSource('');
    setActiveFixture(null);
  }, []);

  const topPick = useMemo(() =>
    filterBList.length > 0
      ? filterBList.reduce((best, f) => f.confidenceScore > best.confidenceScore ? f : best)
      : null,
  [filterBList]);

  return {
    allFixtures, parseResult, fetchStatus, fetchError, fetchWarnings, dataSource,
    filters, filterAList, filterBList, displayList,
    sortKey, sortDir, activeFixture, topPick,
    enrichStatus, enrichResult,
    fetchFromFlashscore, uploadCSV, updateFilter, resetFilters, setSort,
    setActiveFixture, clearData: () => { clearData(); resetEnrichment(); },
  };
}
