import React from 'react';
import type { FetchStatus } from '../hooks/useForebetData';
import StatusBadge from './StatusBadge';

interface Props {
  status: FetchStatus;
  statusMessage: string;
  error: string | null;
  warnings: string[];
  fromCache?: boolean;
  onFetch: () => void;
  onRefresh: () => void;
  onManualPaste: () => void;
  disabled?: boolean;
}

const FetchPanel: React.FC<Props> = ({
  status, statusMessage, error, warnings, fromCache,
  onFetch, onRefresh, onManualPaste, disabled,
}) => {
  const busy = ['fetching', 'expanding', 'parsing', 'deep_verifying'].includes(status);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Primary fetch button */}
        <button
          onClick={onFetch}
          disabled={disabled || busy}
          className="flex items-center gap-2 px-5 py-2 bg-accent-cyan text-navy-900 text-sm font-bold rounded-lg
            hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg
            hover:shadow-cyan-500/25"
        >
          {busy && status !== 'deep_verifying' ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          )}
          Fetch Forebet Games
        </button>

        {/* Refresh cache */}
        <button
          onClick={onRefresh}
          disabled={disabled || busy}
          title="Force re-fetch (bypass cache)"
          className="flex items-center gap-1.5 px-3 py-2 border border-navy-400 text-gray-300 text-sm font-medium
            rounded-lg hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12a8 8 0 00-8-8v4l-3-3 3-3v4a8 8 0 110 16 8 8 0 01-8-8"/>
          </svg>
          Refresh Cache
        </button>

        {/* Manual paste fallback */}
        <button
          onClick={onManualPaste}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 border border-amber-700/60 text-amber-400 text-sm font-medium
            rounded-lg hover:border-amber-500 hover:bg-amber-900/20 disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          Manual Paste Fallback
        </button>

        {fromCache && (
          <span className="text-xs text-gray-500 italic ml-1">Serving from cache</span>
        )}
      </div>

      <StatusBadge status={status} message={statusMessage} error={error} />

      {warnings.length > 0 && (
        <details className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded-lg p-2.5">
          <summary className="cursor-pointer font-medium">{warnings.length} warning(s)</summary>
          <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-amber-500/80">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

export default FetchPanel;
