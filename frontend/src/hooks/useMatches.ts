import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Fixture } from '../types/Fixture';

interface UseMatchesResult {
  fixtures:    Fixture[];
  loading:     boolean;
  error:       string | null;
  fetchedAt:   string | null;
  totalParsed: number;
  refresh:     () => void;
}

function rowToFixture(row: Record<string, unknown>): Fixture {
  return {
    id:             String(row.id ?? ''),
    date:           String(row.date ?? '').slice(0, 10),
    kickoffTime:    (row.kickoff_time as string) ?? null,
    homeTeam:       String(row.home_team ?? ''),
    awayTeam:       String(row.away_team ?? ''),
    league:         (row.league as string) ?? null,
    href:           (row.href as string) ?? null,

    homeWinProb:    row.home_win_prob !== null ? Number(row.home_win_prob) : null,
    drawProb:       row.draw_prob    !== null ? Number(row.draw_prob)    : null,
    awayWinProb:    row.away_win_prob !== null ? Number(row.away_win_prob) : null,

    predictedScore: (row.predicted_score as string) ?? null,
    avgGoals:       row.avg_goals !== null ? Number(row.avg_goals) : null,
    prediction:     (row.prediction as string) ?? null,
    odds:           (row.odds as string) ?? null,

    confidenceScore: Number(row.confidence_score ?? 0),
    confidenceTier:  ((row.confidence_tier as Fixture['confidenceTier']) ?? 'reject'),
    scoreBreakdown:  (row.score_breakdown as Fixture['scoreBreakdown']) ?? null,
    riskFlags:       (row.risk_flags as string[]) ?? [],

    filterA:       Boolean(row.filter_a),
    filterB:       Boolean(row.filter_b),
    bestShortlist: Boolean(row.best_shortlist),
    needsReview:   Boolean(row.needs_review),

    enriched:       Boolean(row.enriched),
    enrichmentData: (row.enrichment_data as Fixture['enrichmentData']) ?? null,

    source:    ((row.source as Fixture['source']) ?? 'playwright'),
    scrapedAt: String(row.scraped_at ?? ''),
  };
}

export function useMatches(date: string): UseMatchesResult {
  const [fixtures,    setFixtures]  = useState<Fixture[]>([]);
  const [loading,     setLoading]   = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [fetchedAt,   setFetchedAt] = useState<string | null>(null);
  const [totalParsed, setTotal]     = useState(0);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('matches')
      .select('*')
      .eq('date', date)
      .order('confidence_score', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const mapped = rows.map(rowToFixture);
    setFixtures(mapped);
    setTotal(mapped.length);
    setFetchedAt(new Date().toISOString());
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return { fixtures, loading, error, fetchedAt, totalParsed, refresh: load };
}
