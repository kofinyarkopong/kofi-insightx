import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type JobStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

export interface ScrapeJob {
  id:             string;
  date:           string;
  status:         JobStatus;
  progress:       string | null;
  fixturesSaved:  number | null;
  fixturesFound:  number | null;
  errorMessage:   string | null;
  createdAt:      string;
}

interface UseScrapeQueueResult {
  job:          ScrapeJob | null;
  status:       JobStatus;
  triggerScrape: (date: string) => Promise<void>;
}

function rowToJob(row: Record<string, unknown>): ScrapeJob {
  return {
    id:            String(row.id),
    date:          String(row.date).slice(0, 10),
    status:        (row.status as JobStatus) ?? 'idle',
    progress:      row.progress as string ?? null,
    fixturesSaved: row.fixtures_saved !== null ? Number(row.fixtures_saved) : null,
    fixturesFound: row.fixtures_found !== null ? Number(row.fixtures_found) : null,
    errorMessage:  row.error_message as string ?? null,
    createdAt:     String(row.created_at),
  };
}

export function useScrapeQueue(date: string, onComplete?: () => void): UseScrapeQueueResult {
  const [job,    setJob]    = useState<ScrapeJob | null>(null);
  const [status, setStatus] = useState<JobStatus>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the active job every 5 seconds while it is pending/running
  useEffect(() => {
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('scrape_queue')
        .select('*')
        .eq('id', job.id)
        .single();

      if (!data) return;
      const updated = rowToJob(data as Record<string, unknown>);
      setJob(updated);
      setStatus(updated.status);

      if (updated.status === 'completed') {
        if (pollRef.current) clearInterval(pollRef.current);
        onComplete?.();
      }
      if (updated.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 5_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.id, job?.status, onComplete]);

  async function triggerScrape(targetDate: string) {
    setStatus('pending');

    const { data, error } = await supabase
      .from('scrape_queue')
      .insert({ date: targetDate, status: 'pending', triggered_by: 'dashboard' })
      .select()
      .single();

    if (error || !data) {
      setStatus('failed');
      console.error('[ScrapeQueue] Insert failed:', error?.message);
      return;
    }

    setJob(rowToJob(data as Record<string, unknown>));
    setStatus('pending');
  }

  return { job, status, triggerScrape };
}
