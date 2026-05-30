import React from 'react';
import type { OddsFixture } from '../../types/OddsFixture';
import OddsConfidenceBadge from './OddsConfidenceBadge';

interface Props {
  total:      number;
  filterA:    number;
  filterB:    number;
  topPick:    OddsFixture | null;
  refreshed:  string | null;
}

const Card: React.FC<{ label: string; value: React.ReactNode; accent?: string; sub?: string }> = ({ label, value, accent = 'text-gray-100', sub }) => (
  <div className="glass-card rounded-xl px-4 py-3 flex flex-col gap-0.5 flex-1 min-w-0">
    <span className={`text-2xl font-extrabold tracking-tight ${accent}`}>{value}</span>
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
    {sub && <span className="text-xs text-gray-600 truncate">{sub}</span>}
  </div>
);

const OddsSummaryCards: React.FC<Props> = ({ total, filterA, filterB, topPick, refreshed }) => (
  <div className="flex flex-wrap gap-3">
    <Card label="Games Scanned"   value={total}   accent="text-gray-100" />
    <Card label="Filter A"        value={filterA} accent="text-accent-cyan"
      sub="Odds within range" />
    <Card label="Filter B"        value={filterB} accent="text-confidence-strong"
      sub="Confidence ≥ threshold" />
    <div className="glass-card rounded-xl px-4 py-3 flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Pick</span>
      {topPick ? (
        <>
          <p className="text-sm font-bold text-gray-100 truncate">
            {topPick.homeTeam} vs {topPick.awayTeam}
          </p>
          <div className="flex items-center gap-2">
            <OddsConfidenceBadge score={topPick.confidenceScore} grade={topPick.confidenceGrade} showGrade />
            <span className="text-xs text-gray-500">{topPick.pick === 'HOME_WIN' ? '🏠 Home' : '✈️ Away'}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-600 italic">No Filter B picks yet</p>
      )}
    </div>
    <Card label="Last Refresh"
      value={refreshed ? new Date(refreshed).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
      accent="text-gray-400"
      sub={refreshed ? new Date(refreshed).toLocaleDateString('en-GB') : 'Upload a CSV to start'} />
  </div>
);

export default OddsSummaryCards;
