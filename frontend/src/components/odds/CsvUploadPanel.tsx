import React, { useRef, useState } from 'react';
import type { CsvParseResult } from '../../types/OddsFixture';
import type { FetchStatus as UploadStatus } from '../../hooks/useOddsScanner';

interface Props {
  onUpload:     (file: File) => void;
  onClear:      () => void;
  status:       UploadStatus;
  parseResult:  CsvParseResult | null;
  error:        string | null;
}

const SAMPLE_CSV = `date,time,country,league,home_team,away_team,home_odds,draw_odds,away_odds,timezone
2026-05-30,15:00,England,Premier League,Arsenal,Chelsea,1.35,4.50,9.00,GMT
2026-05-30,17:30,Spain,La Liga,Barcelona,Sevilla,1.28,5.00,11.00,Europe/Madrid
2026-05-30,20:00,Germany,Bundesliga,Bayern Munich,Dortmund,1.45,4.20,7.50,Europe/Berlin`;

const CsvUploadPanel: React.FC<Props> = ({ onUpload, onClear, status, parseResult, error }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    onUpload(file);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'odds-scanner-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📂</span>
          <h3 className="text-sm font-bold text-gray-200">Data Source — CSV Upload</h3>
          <span className="text-xs text-gray-500 bg-navy-600/60 px-2 py-0.5 rounded-full">MVP</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadSample}
            className="text-xs text-accent-cyan hover:text-cyan-300 transition-colors font-medium"
          >
            Download sample CSV
          </button>
          {parseResult && (
            <button
              onClick={onClear}
              className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            ${dragging ? 'border-accent-cyan bg-accent-cyan/5' : 'border-navy-400/50 hover:border-accent-cyan/50 hover:bg-navy-700/30'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {status === 'fetching' ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-accent-cyan animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-sm text-gray-400">Parsing CSV…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-sm text-gray-400">
                <span className="text-accent-cyan font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-600">CSV files only · columns: date, time, country, league, home_team, away_team, home_odds, draw_odds, away_odds</p>
            </div>
          )}
        </div>

        {/* Parse result summary */}
        {parseResult && status === 'done' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Rows total',    value: parseResult.rowsTotal,   colour: 'text-gray-300' },
              { label: 'Rows valid',    value: parseResult.rowsValid,   colour: 'text-green-400' },
              { label: 'Skipped',       value: parseResult.rowsSkipped, colour: 'text-amber-400' },
              { label: 'Warnings',      value: parseResult.warnings.length, colour: 'text-amber-400' },
            ].map(({ label, value, colour }) => (
              <div key={label} className="bg-navy-700/60 rounded-lg px-3 py-2 text-center">
                <p className={`text-lg font-extrabold ${colour}`}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warnings / errors */}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg p-2">{error}</p>
        )}
        {parseResult?.warnings && parseResult.warnings.length > 0 && (
          <details className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2">
            <summary className="cursor-pointer font-medium">{parseResult.warnings.length} warning(s)</summary>
            <ul className="mt-1.5 space-y-0.5 list-disc list-inside opacity-80">
              {parseResult.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        {/* API hook note */}
        <p className="text-xs text-gray-600 italic">
          To connect a live data API (Football-Data.org, Flashscore export, etc.),
          implement the <code className="text-gray-500">OddsDataProvider</code> interface
          in <code className="text-gray-500">src/types/OddsFixture.ts</code>.
        </p>
      </div>
    </div>
  );
};

export default CsvUploadPanel;
