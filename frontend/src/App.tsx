import React, { useState } from 'react';
import DateSelector from './components/DateSelector';
import FetchPanel from './components/FetchPanel';
import FiltersPanel from './components/FiltersPanel';
import FixtureTable from './components/FixtureTable';
import BestListCard from './components/BestListCard';
import ManualPasteModal from './components/ManualPasteModal';
import ExportBar from './components/ExportBar';
import { useForebetData } from './hooks/useForebetData';
import { useFilters } from './hooks/useFilters';

type Tab = 'listC' | 'listA' | 'listB' | 'review';

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number | string;
  accent?: string;
  sub?: string;
}> = ({ label, value, accent = 'text-gray-100', sub }) => (
  <div className="glass-card rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-[100px] flex-1">
    <span className={`text-2xl font-extrabold tracking-tight ${accent}`}>{value}</span>
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
    {sub && <span className="text-xs text-gray-600">{sub}</span>}
  </div>
);

// ── Confidence tier row ────────────────────────────────────────────────────────
const TierBadge: React.FC<{
  label: string;
  range: string;
  colour: string;
  count?: number;
}> = ({ label, range, colour, count }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colour}`}>
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
  const [showManual, setShowManual] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('listC');

  const {
    fixtures, status, statusMessage, error, warnings, date, fetchResult, deepVerified,
    setDate, fetch, submitManual, runDeepVerify, refreshCache,
  } = useForebetData();

  const { filters, updateFilter, resetFilters, listA, listB, listC, needsReview } =
    useFilters(fixtures);

  const busy = ['fetching', 'expanding', 'parsing', 'deep_verifying'].includes(status);
  const deepVerifying = status === 'deep_verifying';

  const handleFetch       = () => fetch(false, filters.penaliseWomens);
  const handleRefresh     = () => refreshCache();
  const handleManual      = (text: string) => submitManual(text, filters.penaliseWomens);
  const handleDeepVerify  = () => runDeepVerify(listC.slice(0, 10));

  // Derived confidence counts
  const strongCount    = fixtures.filter(f => f.confidenceScore >= 80).length;
  const watchlistCount = fixtures.filter(f => f.confidenceScore >= 70 && f.confidenceScore < 80).length;
  const leanCount      = fixtures.filter(f => f.confidenceScore >= 60 && f.confidenceScore < 70).length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'listC', label: 'Best Shortlist',      count: listC.length    },
    { key: 'listB', label: 'Stricter Filter B',   count: listB.length    },
    { key: 'listA', label: 'Full Qualifying List', count: listA.length   },
    { key: 'review', label: 'Needs Review',        count: needsReview.length },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-navy-600/40"
        style={{ background: 'linear-gradient(90deg, #04060f 0%, #0a1428 50%, #04060f 100%)' }}>
        <div className="max-w-[1700px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚽</span>
            </div>
            <div>
              <h1 className="font-extrabold text-gray-100 text-xl leading-tight tracking-tight">
                Dr Kofi InsightX
              </h1>
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Football Intelligence Platform
              </p>
            </div>
          </div>
          <DateSelector date={date} onChange={setDate} disabled={busy} />
        </div>
      </header>

      <div className="max-w-[1700px] mx-auto px-4 py-5 space-y-5 flex-1 w-full">

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
        />

        {/* ── Stats row ── */}
        <div className="flex flex-wrap gap-3">
          <StatCard label="Total Scraped"  value={fixtures.length}    accent="text-gray-100" />
          <StatCard label="Filter A ≥45%"  value={listA.length}       accent="text-accent-cyan" />
          <StatCard label="Filter B"       value={listB.length}       accent="text-accent-blue" />
          <StatCard label="Strong"         value={strongCount}        accent="text-confidence-strong" sub="80-100" />
          <StatCard label="Watchlist"      value={watchlistCount}     accent="text-confidence-watch"  sub="70-79" />
          <StatCard label="Lean"           value={leanCount}          accent="text-confidence-lean"   sub="60-69" />
          <StatCard label="Needs Review"   value={needsReview.length} accent="text-gray-400" />
        </div>

        {/* ── Main layout ── */}
        <div className="flex gap-5 items-start">
          {/* Sidebar filters */}
          <div className="w-64 flex-shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
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
            <div className="glass-card rounded-xl px-4 py-3">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2.5">
                Confidence Model — Tier Thresholds
              </p>
              <div className="flex flex-wrap gap-2">
                <TierBadge label="STRONG"    range="80–100" colour="border-green-700/50 text-green-300   bg-green-950/30"  count={strongCount} />
                <TierBadge label="WATCH"     range="70–79"  colour="border-amber-700/50 text-amber-300   bg-amber-950/30"  count={watchlistCount} />
                <TierBadge label="LEAN"      range="60–69"  colour="border-orange-700/50 text-orange-300 bg-orange-950/30" count={leanCount} />
                <TierBadge label="REJECT"    range="&lt;60" colour="border-red-800/50  text-red-400     bg-red-950/30" />
                <span className="ml-auto self-center text-xs text-gray-600 italic">
                  Weighted model · form proxies only
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
              {tabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                    ${activeTab === key
                      ? 'bg-accent-cyan text-navy-900 shadow-lg shadow-cyan-900/30'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-navy-600/60'
                    }`}
                >
                  {label}
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
      </div>

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

      {/* Manual paste modal */}
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
