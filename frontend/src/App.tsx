import React, { useState } from 'react';
import DateSelector from './components/DateSelector';
import FetchPanel from './components/FetchPanel';
import FiltersPanel from './components/FiltersPanel';
import FixtureTable from './components/FixtureTable';
import BestListCard from './components/BestListCard';
import ManualPasteModal from './components/ManualPasteModal';
import ExportBar from './components/ExportBar';
import OddsScannerPage from './components/odds/OddsScannerPage';
import { useForebetData } from './hooks/useForebetData';
import { useFilters } from './hooks/useFilters';

type AppMode = 'forebet' | 'odds-scanner';
type Tab = 'listC' | 'listA' | 'listB' | 'review';

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number | string;
  accent?: string;
  sub?: string;
}> = ({ label, value, accent = 'text-gray-100', sub }) => (
  <div className="glass-card rounded-xl px-3 py-2.5 flex flex-col gap-0.5 min-w-0 flex-1">
    <span className={`text-xl sm:text-2xl font-extrabold tracking-tight ${accent}`}>{value}</span>
    <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</span>
    {sub && <span className="text-[10px] text-gray-600">{sub}</span>}
  </div>
);

// ── Confidence tier row ────────────────────────────────────────────────────────
const TierBadge: React.FC<{
  label: string;
  range: string;
  colour: string;
  count?: number;
}> = ({ label, range, colour, count }) => (
  <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${colour}`}>
    <div className="text-center">
      <p className="text-xs font-extrabold tracking-wider">{label}</p>
      <p className="text-xs opacity-60">{range}</p>
    </div>
    {count !== undefined && (
      <span className="ml-auto text-sm font-bold opacity-80">{count}</span>
    )}
  </div>
);

const App: React.FC = () => {
  const [appMode, setAppMode]         = useState<AppMode>('forebet');
  const [showManual, setShowManual]   = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>('listC');
  const [showFilters, setShowFilters] = useState(false);

  const {
    fixtures, status, statusMessage, error, warnings, date, fetchResult, deepVerified,
    setDate, fetch, submitManual, runDeepVerify, refreshCache,
    enrichStatus, enrichResult,
  } = useForebetData();

  const { filters, updateFilter, resetFilters, listA, listB, listC, needsReview } =
    useFilters(fixtures);

  const busy          = ['fetching', 'expanding', 'parsing', 'deep_verifying'].includes(status);
  const deepVerifying = status === 'deep_verifying';

  const handleFetch      = () => fetch(false, filters.penaliseWomens);
  const handleRefresh    = () => refreshCache();
  const handleManual     = (text: string) => submitManual(text, filters.penaliseWomens);
  const handleDeepVerify = () => runDeepVerify(listC.slice(0, 10));

  const strongCount    = fixtures.filter(f => f.confidenceScore >= 80).length;
  const watchlistCount = fixtures.filter(f => f.confidenceScore >= 70 && f.confidenceScore < 80).length;
  const leanCount      = fixtures.filter(f => f.confidenceScore >= 60 && f.confidenceScore < 70).length;

  const tabs: { key: Tab; label: string; shortLabel: string; count: number }[] = [
    { key: 'listC',  label: 'Best Shortlist',       shortLabel: 'Best',    count: listC.length     },
    { key: 'listB',  label: 'Stricter Filter B',    shortLabel: 'List B',  count: listB.length     },
    { key: 'listA',  label: 'Full Qualifying List', shortLabel: 'List A',  count: listA.length     },
    { key: 'review', label: 'Needs Review',         shortLabel: 'Review',  count: needsReview.length },
  ];

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-navy-600/40"
        style={{ background: 'linear-gradient(90deg, #04060f 0%, #0a1428 50%, #04060f 100%)' }}>
        <div className="max-w-[1700px] mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center flex-shrink-0">
              <span className="text-lg sm:text-xl">⚽</span>
            </div>
            <div>
              <h1 className="font-extrabold text-gray-100 text-base sm:text-xl leading-tight tracking-tight">
                Dr Kofi InsightX
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 tracking-widest uppercase hidden sm:block">
                Football Intelligence Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ── App mode switcher ── */}
            <div className="hidden sm:flex gap-1 p-1 bg-navy-800/60 border border-navy-500/40 rounded-lg">
              {([
                { key: 'forebet',      label: '⚽ Forebet',      short: '⚽' },
                { key: 'odds-scanner', label: '📊 Odds Scanner', short: '📊' },
              ] as { key: AppMode; label: string; short: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAppMode(key)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap
                    ${appMode === key ? 'bg-accent-cyan text-navy-900' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Mobile mode switcher */}
            <button
              onClick={() => setAppMode(m => m === 'forebet' ? 'odds-scanner' : 'forebet')}
              className="sm:hidden px-2.5 py-1.5 rounded-lg border border-navy-400/60 text-gray-400 hover:text-accent-cyan text-xs font-medium transition-all"
              title={appMode === 'forebet' ? 'Switch to Odds Scanner' : 'Switch to Forebet'}
            >
              {appMode === 'forebet' ? '📊' : '⚽'}
            </button>
            {appMode === 'forebet' && <DateSelector date={date} onChange={setDate} disabled={busy} />}
            {/* Mobile filter toggle — Forebet mode only */}
            {appMode === 'forebet' && <button
              onClick={() => setShowFilters(true)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-navy-400/60
                text-gray-400 hover:text-accent-cyan hover:border-accent-cyan transition-all text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
              <span>Filters</span>
              {(listCCount => listCCount > 0
                ? <span className="bg-accent-cyan text-navy-900 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-extrabold">{listCCount}</span>
                : null)(listC.length)}
            </button>}
          </div>
        </div>
      </header>

      {/* ── Mobile filter drawer (slide up from bottom) ── */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
          />
          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl overflow-hidden
            flex flex-col" style={{ background: '#0a0e1a' }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-navy-400/60" />
            </div>
            <div className="overflow-y-auto flex-1 pb-safe">
              <FiltersPanel
                filters={filters}
                update={updateFilter}
                onReset={resetFilters}
                listACounts={listA.length}
                listBCount={listB.length}
                listCCount={listC.length}
                onClose={() => setShowFilters(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Odds Scanner mode ── */}
      {appMode === 'odds-scanner' && <OddsScannerPage />}

      {/* ── Forebet mode ── */}
      {appMode === 'forebet' && <div className="max-w-[1700px] mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 sm:space-y-5 flex-1 w-full">

        {/* ── Fetch panel ── */}
        <FetchPanel
          status={status}
          statusMessage={statusMessage}
          error={error}
          warnings={warnings}
          fromCache={fetchResult?.fromCache}
          onFetch={handleFetch}
          onRefresh={handleRefresh}
          onManualPaste={() => setShowManual(true)}
          disabled={busy}
          enrichStatus={enrichStatus}
          enrichResult={enrichResult}
        />

        {/* ── Stats row ── */}
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:flex gap-2">
          <StatCard label="Scraped"    value={fixtures.length}    accent="text-gray-100" />
          <StatCard label="List A"     value={listA.length}       accent="text-accent-cyan" />
          <StatCard label="List B"     value={listB.length}       accent="text-accent-blue" />
          <StatCard label="Best C"     value={listC.length}       accent="text-confidence-strong" />
          <StatCard label="Strong"     value={strongCount}        accent="text-confidence-strong" sub="80-100" />
          <StatCard label="Watchlist"  value={watchlistCount}     accent="text-confidence-watch"  sub="70-79" />
          <StatCard label="Lean"       value={leanCount}          accent="text-confidence-lean"   sub="60-69" />
          <StatCard label="Review"     value={needsReview.length} accent="text-gray-400" />
        </div>

        {/* ── Main layout ── */}
        <div className="flex gap-5 items-start">

          {/* Desktop sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <FiltersPanel
              filters={filters}
              update={updateFilter}
              onReset={resetFilters}
              listACounts={listA.length}
              listBCount={listB.length}
              listCCount={listC.length}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Export bar */}
            {fixtures.length > 0 && (
              <ExportBar listA={listA} listB={listB} listC={listC} date={date} />
            )}

            {/* Confidence tier legend */}
            <div className="glass-card rounded-xl px-3 sm:px-4 py-3">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2.5">
                Confidence Tiers
              </p>
              <div className="flex flex-wrap gap-2">
                <TierBadge label="STRONG"  range="80–100" colour="border-green-700/50 text-green-300   bg-green-950/30"  count={strongCount} />
                <TierBadge label="WATCH"   range="70–79"  colour="border-amber-700/50 text-amber-300   bg-amber-950/30"  count={watchlistCount} />
                <TierBadge label="LEAN"    range="60–69"  colour="border-orange-700/50 text-orange-300 bg-orange-950/30" count={leanCount} />
                <TierBadge label="REJECT"  range="&lt;60" colour="border-red-800/50  text-red-400     bg-red-950/30" />
              </div>
            </div>

            {/* Tabs — horizontally scrollable on mobile */}
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <div className="flex gap-1 p-1 glass-card rounded-xl w-max sm:w-fit min-w-full sm:min-w-0">
                {tabs.map(({ key, label, shortLabel, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap
                      ${activeTab === key
                        ? 'bg-accent-cyan text-navy-900 shadow-lg shadow-cyan-900/30'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-navy-600/60'
                      }`}
                  >
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold
                      ${activeTab === key
                        ? 'bg-navy-900/40 text-navy-900'
                        : 'bg-navy-500/60 text-gray-500'
                      }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'listC' && (
              <BestListCard
                fixtures={listC}
                onDeepVerify={handleDeepVerify}
                deepVerifying={deepVerifying}
                deepVerified={deepVerified}
              />
            )}
            {activeTab === 'listA' && (
              <FixtureTable
                title="Full Qualifying List A — Home Win ≥ 45%"
                fixtures={listA}
                emptyMessage="No fixtures match List A criteria. Try lowering the minimum home win probability."
                showReason
              />
            )}
            {activeTab === 'listB' && (
              <FixtureTable
                title="Stricter Filter B — Goals + Predicted Score + Low Risk"
                fixtures={listB}
                emptyMessage="No fixtures pass the stricter List B filters. Try relaxing some toggles."
                showReason
                highlightBest
              />
            )}
            {activeTab === 'review' && (
              <FixtureTable
                title="Needs Review — Low Parse Confidence"
                fixtures={needsReview}
                emptyMessage="No fixtures flagged for review."
                compact
              />
            )}
          </div>
        </div>
      </div>}

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-navy-600/30 py-4 px-4">
        <p className="text-center text-xs text-gray-600 tracking-wide">
          Dr Kofi InsightX
          <span className="mx-2 opacity-30">·</span>
          Data sourced from forebet.com
          <span className="mx-2 opacity-30">·</span>
          For research use only
        </p>
      </footer>

      {showManual && (
        <ManualPasteModal
          onSubmit={handleManual}
          onClose={() => setShowManual(false)}
          date={date}
        />
      )}
    </div>
  );
};

export default App;
