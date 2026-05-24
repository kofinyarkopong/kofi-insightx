import React from 'react';
import type { JobStatus } from '../hooks/useScrapeQueue';

interface Props {
  date:          string;
  jobStatus:     JobStatus;
  jobProgress:   string | null;
  jobError:      string | null;
  fixtureCount:  number;
  loading:       boolean;
  onRunScraper:  () => void;
  onRefresh:     () => void;
  onManualPaste: () => void;
}

const FetchPanel: React.FC<Props> = ({
  date, jobStatus, jobProgress, jobError,
  fixtureCount, loading,
  onRunScraper, onRefresh, onManualPaste,
}) => {
  const busy = jobStatus === 'pending' || jobStatus === 'running' || loading;

  // Status label
  let statusLabel = '';
  let statusColour = '';
  if (jobStatus === 'pending') {
    statusLabel  = 'Queued — waiting for job watcher on your Mac…';
    statusColour = 'text-amber-400';
  } else if (jobStatus === 'running') {
    statusLabel  = jobProgress ?? 'Scraper running on your Mac…';
    statusColour = 'text-accent-cyan';
  } else if (jobStatus === 'completed') {
    statusLabel  = jobProgress ?? 'Scrape complete';
    statusColour = 'text-green-400';
  } else if (jobStatus === 'failed') {
    statusLabel  = jobError ?? 'Scrape failed';
    statusColour = 'text-red-400';
  } else if (fixtureCount > 0) {
    statusLabel  = `${fixtureCount} fixtures loaded from Supabase`;
    statusColour = 'text-green-400';
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">

        {/* Run Scraper — triggers job on Mac via Supabase queue */}
        <button
          onClick={onRunScraper}
          disabled={busy}
          className="flex items-center gap-2 px-5 py-2 bg-accent-cyan text-navy-900 text-sm font-bold rounded-lg
            hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg
            hover:shadow-cyan-500/25"
        >
          {busy ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          )}
          {busy ? 'Scraping…' : 'Run Scraper'}
        </button>

        {/* Refresh — reload from Supabase */}
        <button
          onClick={onRefresh}
          disabled={busy}
          title="Reload data from Supabase"
          className="flex items-center gap-1.5 px-3 py-2 border border-navy-400 text-gray-300 text-sm font-medium
            rounded-lg hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>

        {/* Manual paste fallback */}
        <button
          onClick={onManualPaste}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 border border-amber-700/60 text-amber-400 text-sm font-medium
            rounded-lg hover:border-amber-500 hover:bg-amber-900/20 disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          Manual Paste
        </button>
      </div>

      {statusLabel && (
        <p className={`text-sm flex items-center gap-2 ${statusColour}`}>
          {busy && (
            <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {!busy && jobStatus === 'completed' && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
          {!busy && jobStatus === 'failed'    && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
          {!busy && jobStatus === 'idle' && fixtureCount > 0 && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
          {statusLabel}
        </p>
      )}

      {jobStatus === 'idle' && fixtureCount === 0 && (
        <p className="text-sm text-gray-500">
          No data for {date}. Click <span className="text-accent-cyan">Run Scraper</span> to fetch from Forebet,
          or use <span className="text-amber-400">Manual Paste</span> as a fallback.
        </p>
      )}
    </div>
  );
};

export default FetchPanel;
