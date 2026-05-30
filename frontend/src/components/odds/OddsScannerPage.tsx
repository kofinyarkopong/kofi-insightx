import React, { useState } from 'react';
import { useOddsScanner } from '../../hooks/useOddsScanner';
import OddsSummaryCards from './OddsSummaryCards';
import OddsFiltersPanel from './OddsFiltersPanel';
import OddsResultsTable from './OddsResultsTable';
import OddsMatchDrawer from './OddsMatchDrawer';
import OddsDataSourcePanel from './OddsDataSourcePanel';
import {
  exportFilterACSV, exportFilterBCSV, exportAllJSON, copyFixturesToClipboard,
} from '../../utils/oddsExport';

const OddsScannerPage: React.FC = () => {
  const {
    allFixtures, parseResult, fetchStatus, fetchError, fetchWarnings, dataSource,
    filters, filterAList, filterBList, displayList,
    sortKey, sortDir, activeFixture, topPick,
    fetchFromFlashscore, uploadCSV, updateFilter, resetFilters, setSort,
    setActiveFixture, clearData,
  } = useOddsScanner();

  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied]           = useState(false);

  const date = filters.date;

  const handleCopy = async () => {
    const ok = await copyFixturesToClipboard(filterBList);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const refreshAt = allFixtures[0]?.refreshedAt ?? null;

  return (
    <div className="max-w-[1700px] mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 sm:space-y-5 w-full">

      {/* ── Page title ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-100 tracking-tight">Odds Scanner</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Scan 1X2 odds · Filter A (odds range) · Filter B (confidence model) · Export to CSV
          </p>
        </div>
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(true)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-navy-400/60
            text-gray-400 hover:text-accent-cyan hover:border-accent-cyan transition-all text-xs font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
          </svg>
          Filters
        </button>
      </div>

      {/* ── Mobile filter drawer ── */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl overflow-hidden flex flex-col" style={{ background: '#0a0e1a' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-navy-400/60" />
            </div>
            <div className="overflow-y-auto flex-1 pb-safe">
              <OddsFiltersPanel
                filters={filters} update={updateFilter} onReset={resetFilters}
                filterACount={filterAList.length} filterBCount={filterBList.length}
                onClose={() => setShowFilters(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <OddsSummaryCards
        total={allFixtures.length}
        filterA={filterAList.length}
        filterB={filterBList.length}
        topPick={topPick}
        refreshed={refreshAt}
      />

      {/* ── Data Source ── */}
      <OddsDataSourcePanel
        onFetch={fetchFromFlashscore}
        onUploadCSV={uploadCSV}
        onClear={clearData}
        fetchStatus={fetchStatus}
        fetchError={fetchError}
        warnings={fetchWarnings}
        dataSource={dataSource}
        parseResult={parseResult}
        date={filters.date}
      />

      {/* ── Export bar (shown once data is loaded) ── */}
      {allFixtures.length > 0 && (
        <div className="glass-card rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest mr-1">Export</span>
          <button
            onClick={() => exportFilterACSV(allFixtures, date)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-navy-400/60
              text-gray-400 hover:border-accent-cyan hover:text-accent-cyan transition-all"
          >
            ↓ Filter A CSV
          </button>
          <button
            onClick={() => exportFilterBCSV(allFixtures, date)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-navy-400/60
              text-gray-400 hover:border-accent-cyan hover:text-accent-cyan transition-all"
          >
            ↓ Filter B CSV
          </button>
          <button
            onClick={() => exportAllJSON(allFixtures, date)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-navy-400/60
              text-gray-400 hover:border-accent-cyan hover:text-accent-cyan transition-all"
          >
            ↓ JSON (all)
          </button>
          <button
            onClick={handleCopy}
            disabled={filterBList.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
              bg-confidence-strong/20 border border-green-700/50 text-green-300 hover:bg-confidence-strong/30
              disabled:opacity-40 transition-all"
          >
            {copied ? '✓ Copied!' : 'Copy Filter B'}
          </button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex gap-5 items-start">

        {/* Desktop sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <OddsFiltersPanel
            filters={filters} update={updateFilter} onReset={resetFilters}
            filterACount={filterAList.length} filterBCount={filterBList.length}
          />
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          <OddsResultsTable
            fixtures={displayList}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={setSort}
            onSelect={setActiveFixture}
            showFilterBOnly={filters.showFilterBOnly}
            onToggleFilterB={() => updateFilter('showFilterBOnly', !filters.showFilterBOnly)}
            filterBCount={filterBList.length}
          />

          {/* Disclaimer */}
          <p className="text-xs text-gray-600 italic text-center px-4 pb-4">
            Football outcomes are uncertain. All matches are labelled as research candidates only.
            This dashboard is a research tool and does not guarantee results.
          </p>
        </div>
      </div>

      {/* ── Match detail drawer ── */}
      {activeFixture && (
        <OddsMatchDrawer
          fixture={activeFixture}
          onClose={() => setActiveFixture(null)}
        />
      )}
    </div>
  );
};

export default OddsScannerPage;
