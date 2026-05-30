import React from 'react';
import type { OddsFixture, OddsSortKey, SortDir } from '../../types/OddsFixture';
import OddsConfidenceBadge from './OddsConfidenceBadge';

interface Props {
  fixtures:       OddsFixture[];
  sortKey:        OddsSortKey;
  sortDir:        SortDir;
  onSort:         (key: OddsSortKey) => void;
  onSelect:       (fx: OddsFixture) => void;
  showFilterBOnly: boolean;
  onToggleFilterB: () => void;
  filterBCount:   number;
}

const PickBadge: React.FC<{ pick: 'HOME_WIN' | 'AWAY_WIN' | null }> = ({ pick }) => {
  if (!pick) return <span className="text-gray-600 text-xs">—</span>;
  const cls = pick === 'HOME_WIN'
    ? 'bg-green-900/60 text-green-300 border-green-700/50'
    : 'bg-blue-900/60  text-blue-300  border-blue-700/50';
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {pick === 'HOME_WIN' ? '🏠 H' : '✈️ A'}
    </span>
  );
};

const FilterBTag: React.FC<{ passes: boolean }> = ({ passes }) =>
  passes
    ? <span className="text-xs font-bold text-green-400 bg-green-950/40 border border-green-800/40 rounded px-1.5 py-0.5">B</span>
    : <span className="text-xs text-navy-400">—</span>;

const OddsResultsTable: React.FC<Props> = ({
  fixtures, sortKey, sortDir, onSort, onSelect,
  showFilterBOnly, onToggleFilterB, filterBCount,
}) => {
  const SortTh: React.FC<{ k: OddsSortKey; label: string; className?: string }> = ({ k, label, className = '' }) => (
    <th
      className={`px-2 sm:px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap hover:text-gray-300 transition-colors ${className}
        ${sortKey === k ? 'text-accent-cyan' : 'text-gray-500'}`}
      onClick={() => onSort(k)}
    >
      {label}
      {sortKey === k && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );

  if (fixtures.length === 0) {
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Header with Filter B button even when empty */}
        <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-100 text-sm">Research Candidates</h2>
            <span className="text-xs bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-full px-2 py-0.5 font-bold">0</span>
          </div>
          <FilterBButton showFilterBOnly={showFilterBOnly} onToggle={onToggleFilterB} filterBCount={filterBCount} />
        </div>
        <div className="p-8 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm text-gray-500 italic">No fixtures match your current filters. Fetch data or adjust the settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-gray-100 text-sm">Research Candidates</h2>
          <span className="text-xs bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-full px-2 py-0.5 font-bold">
            {fixtures.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-600 hidden sm:block">Click a row for full details</p>
          <FilterBButton showFilterBOnly={showFilterBOnly} onToggle={onToggleFilterB} filterBCount={filterBCount} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-navy-400/40 bg-navy-800/60">
              <SortTh k="timeGMT"         label="Time"   />
              <th className="px-2 sm:px-3 py-2.5 text-left text-gray-500">Home</th>
              <th className="px-2 sm:px-3 py-2.5 text-left text-gray-500">Away</th>
              <th className="px-2 sm:px-3 py-2.5 text-center text-gray-500">Pick</th>
              <SortTh k="homeOdds"        label="H Odds" className="text-center" />
              <th className="px-2 sm:px-3 py-2.5 text-center text-gray-500 hidden sm:table-cell">D</th>
              <SortTh k="awayOdds"        label="A Odds" className="text-center hidden sm:table-cell" />
              <SortTh k="confidenceScore" label="Conf"   className="text-center" />
              <th className="px-2 sm:px-3 py-2.5 text-center text-gray-500">B</th>
              {/* Country and League moved to the end */}
              <SortTh k="country"         label="Country" className="hidden sm:table-cell" />
              <SortTh k="league"          label="League"  className="hidden md:table-cell" />
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fx, idx) => (
              <tr
                key={fx.id}
                onClick={() => onSelect(fx)}
                className={`cursor-pointer transition-colors border-b border-navy-700/40 hover:bg-navy-600/40
                  ${fx.passesFilterB ? 'border-l-2 border-l-green-700/50' : ''}
                  ${idx % 2 === 0 ? 'bg-navy-800/30' : 'bg-navy-800/10'}`}
              >
                <td className="px-2 sm:px-3 py-2.5 font-mono text-gray-500 whitespace-nowrap">{fx.timeGMT}</td>
                <td className="px-2 sm:px-3 py-2.5 font-semibold text-gray-100 max-w-[90px] sm:max-w-[130px] truncate">{fx.homeTeam}</td>
                <td className="px-2 sm:px-3 py-2.5 text-gray-400 max-w-[90px] sm:max-w-[130px] truncate">{fx.awayTeam}</td>
                <td className="px-2 sm:px-3 py-2.5 text-center"><PickBadge pick={fx.pick} /></td>
                <td className="px-2 sm:px-3 py-2.5 text-center font-bold text-green-400">{fx.homeOdds.toFixed(2)}</td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-center text-gray-500">{fx.drawOdds.toFixed(2)}</td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-center text-red-400">{fx.awayOdds.toFixed(2)}</td>
                <td className="px-2 sm:px-3 py-2.5 text-center">
                  <OddsConfidenceBadge score={fx.confidenceScore} grade={fx.confidenceGrade} />
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-center"><FilterBTag passes={fx.passesFilterB} /></td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-gray-400 max-w-[100px] truncate">{fx.country}</td>
                <td className="hidden md:table-cell px-3 py-2.5">
                  <span className="text-xs bg-navy-600/60 text-gray-400 rounded px-1.5 py-0.5 whitespace-nowrap">{fx.league || '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Filter B quick-view button ────────────────────────────────────────────────

const FilterBButton: React.FC<{
  showFilterBOnly: boolean;
  onToggle:        () => void;
  filterBCount:    number;
}> = ({ showFilterBOnly, onToggle, filterBCount }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
      ${showFilterBOnly
        ? 'bg-green-800/70 text-green-300 border-green-600/50 shadow-lg shadow-green-900/30'
        : 'text-gray-400 border-navy-400/60 hover:border-green-600/50 hover:text-green-400'
      }`}
  >
    <span className={`w-2 h-2 rounded-full ${showFilterBOnly ? 'bg-green-400' : 'bg-gray-600'}`} />
    Filter B
    <span className={`rounded-full px-1.5 py-0.5 font-extrabold text-[10px]
      ${showFilterBOnly ? 'bg-green-950/60 text-green-200' : 'bg-navy-600/60 text-gray-500'}`}>
      {filterBCount}
    </span>
  </button>
);

export default OddsResultsTable;
