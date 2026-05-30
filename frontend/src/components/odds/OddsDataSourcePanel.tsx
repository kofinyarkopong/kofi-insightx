import React, { useRef, useState } from 'react';
import type { CsvParseResult } from '../../types/OddsFixture';
import type { FetchStatus } from '../../hooks/useOddsScanner';

interface Props {
  onFetch:      () => void;
  onUploadCSV:  (file: File) => void;
  onClear:      () => void;
  fetchStatus:  FetchStatus;
  fetchError:   string | null;
  warnings:     string[];
  dataSource:   string;
  parseResult:  CsvParseResult | null;
  date:         string;
}

const IS_VERCEL = import.meta.env.VITE_DEPLOY_TARGET === 'vercel';

const SAMPLE_CSV = `date,time,country,league,home_team,away_team,home_odds,draw_odds,away_odds,timezone
2026-05-30,15:00,England,Premier League,Arsenal,Chelsea,1.35,4.50,9.00,GMT
2026-05-30,17:30,Spain,La Liga,Barcelona,Sevilla,1.28,5.00,11.00,Europe/Madrid`;

const OddsDataSourcePanel: React.FC<Props> = ({
  onFetch, onUploadCSV, onClear, fetchStatus, fetchError, warnings,
  dataSource, parseResult, date,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCsv, setShowCsv] = useState(false);
  const [dragging, setDragging] = useState(false);

  const busy = fetchStatus === 'fetching';

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'odds-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sourceLabel =
    dataSource === 'playwright' ? '⚡ Live from Flashscore' :
    dataSource === 'supabase'   ? '☁️  From Supabase (pre-scraped)' :
    dataSource === 'csv'        ? '📂 Uploaded CSV' : '';

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <h3 className="text-sm font-bold text-gray-200">Data Source</h3>
          {sourceLabel && (
            <span className="text-xs text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 rounded-full">
              {sourceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dataSource && (
            <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Primary — Fetch from Flashscore */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onFetch()}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-navy-900 text-sm font-bold
              rounded-xl hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all shadow-lg hover:shadow-cyan-500/25"
          >
            {busy ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Fetching Flashscore…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Fetch from Flashscore
              </>
            )}
          </button>

          <div className="text-xs text-gray-500 leading-relaxed">
            {IS_VERCEL ? (
              <span>
                Reads odds last scraped by your Mac.{' '}
                <code className="text-accent-cyan bg-navy-800/80 px-1.5 py-0.5 rounded font-mono text-xs">
                  npm run scrape-odds
                </code>{' '}
                to refresh.
              </span>
            ) : (
              <span>Launches Playwright on this Mac and scrapes Flashscore live (~20–40 s).</span>
            )}
          </div>
        </div>

        {/* Status message */}
        {fetchStatus === 'fetching' && (
          <div className="flex items-center gap-2 text-xs text-accent-cyan">
            <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {IS_VERCEL
              ? 'Loading odds from Supabase…'
              : 'Playwright is scraping Flashscore — expanding all leagues, extracting 1X2 odds…'}
          </div>
        )}

        {fetchError && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg p-2.5 leading-relaxed">
            {fetchError}
          </div>
        )}

        {warnings.length > 0 && (
          <details className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2.5">
            <summary className="cursor-pointer font-medium">{warnings.length} warning(s)</summary>
            <ul className="mt-1.5 space-y-0.5 list-disc list-inside opacity-80">
              {warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        {/* CSV fallback toggle */}
        <div className="border-t border-navy-500/30 pt-3">
          <button
            onClick={() => setShowCsv(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
          >
            <svg className={`w-3 h-3 transition-transform ${showCsv ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            Manual CSV upload (fallback)
          </button>

          {showCsv && (
            <div className="mt-3 space-y-2">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onUploadCSV(f); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
                  ${dragging ? 'border-accent-cyan bg-accent-cyan/5' : 'border-navy-400/50 hover:border-accent-cyan/50'}`}
              >
                <input ref={inputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onUploadCSV(f); }} />
                <p className="text-xs text-gray-500">
                  <span className="text-accent-cyan">Click to upload</span> or drag a CSV here
                </p>
              </div>
              <button onClick={downloadSample} className="text-xs text-gray-500 hover:text-accent-cyan transition-colors">
                Download sample CSV format
              </button>
              {parseResult && (
                <p className="text-xs text-green-400">
                  CSV loaded: {parseResult.rowsValid} valid / {parseResult.rowsTotal} total rows
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OddsDataSourcePanel;
