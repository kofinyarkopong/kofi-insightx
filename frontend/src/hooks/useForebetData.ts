// ─────────────────────────────────────────────────────────────────────────────
// useForebetData — central state management for fixture fetching
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import type { Fixture, FetchResult } from '../types/Fixture';
import { fetchFixtures, submitManualPaste, deepVerify, clearCache } from '../api/forebetApi';
import { useStandings } from './useStandings';

export type FetchStatus =
  | 'idle'
  | 'fetching'
  | 'expanding'
  | 'parsing'
  | 'complete'
  | 'failed'
  | 'deep_verifying';

export interface ForebetDataState {
  fixtures: Fixture[];
  fetchResult: FetchResult | null;
  status: FetchStatus;
  statusMessage: string;
  error: string | null;
  warnings: string[];
  date: string;
  deepVerified: boolean;
}

const todayGMT = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export function useForebetData() {
  const { enrichForebetFixtures, enrichStatus, enrichResult, resetEnrichment } = useStandings();

  const [state, setState] = useState<ForebetDataState>({
    fixtures: [],
    fetchResult: null,
    status: 'idle',
    statusMessage: 'Ready. Select a date and click "Fetch Forebet Games".',
    error: null,
    warnings: [],
    date: todayGMT(),
    deepVerified: false,
  });

  const setDate = useCallback((date: string) => {
    setState(prev => ({ ...prev, date, fixtures: [], status: 'idle', error: null, warnings: [] }));
  }, []);

  const fetch = useCallback(async (refresh = false, penaliseWomens = false) => {
    setState(prev => ({
      ...prev,
      status: 'fetching',
      statusMessage: 'Connecting to Forebet…',
      error: null,
      warnings: [],
      deepVerified: false,
    }));

    try {
      setState(prev => ({ ...prev, statusMessage: 'Expanding "More" catalogue…', status: 'expanding' }));

      const result = await fetchFixtures(state.date, refresh, penaliseWomens);

      setState(prev => ({ ...prev, statusMessage: 'Parsing fixture rows…', status: 'parsing' }));
      await new Promise(r => setTimeout(r, 100));

      // Initial render with proxy scores
      setState(prev => ({
        ...prev,
        fixtures: result.fixtures,
        fetchResult: result,
        status: 'complete',
        statusMessage: `Loaded ${result.totalParsed} fixtures — enriching with live table data…`,
        warnings: result.warnings,
        error: null,
      }));

      // Enrich with real standings in the background
      const enriched = await enrichForebetFixtures(result.fixtures);
      setState(prev => ({
        ...prev,
        fixtures: enriched,
        statusMessage: `Loaded ${result.totalParsed} fixtures (${result.fromCache ? 'from cache' : result.method}).`,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'failed',
        statusMessage: 'Fetch failed — use manual paste fallback.',
        error: (err as Error).message,
        warnings: [],
      }));
    }
  }, [state.date]);

  const submitManual = useCallback(async (text: string, penaliseWomens = false) => {
    setState(prev => ({
      ...prev,
      status: 'parsing',
      statusMessage: 'Parsing manual paste…',
      error: null,
    }));

    try {
      const result = await submitManualPaste(text, state.date, penaliseWomens);
      setState(prev => ({
        ...prev,
        fixtures: result.fixtures,
        fetchResult: result,
        status: 'complete',
        statusMessage: `Parsed ${result.totalParsed} fixtures from manual paste.`,
        warnings: result.warnings,
        error: null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'failed',
        statusMessage: 'Manual parse failed.',
        error: (err as Error).message,
      }));
    }
  }, [state.date]);

  const runDeepVerify = useCallback(async (shortlist: Fixture[]) => {
    setState(prev => ({
      ...prev,
      status: 'deep_verifying',
      statusMessage: `Deep-verifying ${shortlist.length} shortlisted fixtures…`,
    }));

    try {
      const { results } = await deepVerify(shortlist);

      setState(prev => {
        const updated = prev.fixtures.map(fx => {
          const r = results.find(x => x.id === fx.id);
          if (!r) return fx;
          return {
            ...fx,
            confidenceScore: r.updatedConfidence,
            reason: r.updatedReason,
            deepVerified: true,
          };
        });
        return {
          ...prev,
          fixtures: updated,
          status: 'complete',
          statusMessage: `Deep verification complete for ${results.length} fixtures.`,
          deepVerified: true,
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'complete',
        statusMessage: 'Deep verification encountered errors — partial results may apply.',
        error: (err as Error).message,
      }));
    }
  }, []);

  const refreshCache = useCallback(async () => {
    await clearCache(state.date).catch(() => null);
    await fetch(true);
  }, [state.date, fetch]);

  return {
    ...state,
    setDate,
    fetch,
    submitManual,
    runDeepVerify,
    refreshCache,
    enrichStatus,
    enrichResult,
    resetEnrichment,
  };
}
