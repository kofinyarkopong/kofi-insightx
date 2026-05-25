import React from 'react';
import type { Fixture } from '../types/Fixture';
import ConfidenceBadge from './ConfidenceBadge';

interface Props {
  fixtures: Fixture[];
  onDeepVerify: () => void;
  deepVerifying: boolean;
  deepVerified: boolean;
}

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const styles = [
    'bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-950',
    'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800',
    'bg-gradient-to-br from-amber-600 to-orange-600 text-amber-50',
  ];
  const cls = styles[rank - 1] ?? 'bg-navy-500 border border-navy-400/60 text-gray-300';
  return (
    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 shadow-lg ${cls}`}>
      {rank}
    </span>
  );
};

const BestListCard: React.FC<Props> = ({ fixtures, onDeepVerify, deepVerifying, deepVerified }) => {
  if (fixtures.length === 0) {
    return (
      <section className="glass-card rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⚽</div>
        <p className="text-gray-500 italic text-sm">
          Best Shortlist will appear once fixtures are loaded and filters applied.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-navy-400/40
        bg-gradient-to-r from-green-950/60 via-navy-800/60 to-navy-800/60">
        <div>
          <h2 className="font-extrabold text-green-300 text-lg tracking-tight">Best Shortlist C</h2>
          <p className="text-xs text-green-600 mt-0.5">Top {fixtures.length} ranked by confidence score</p>
        </div>

        <button
          onClick={onDeepVerify}
          disabled={deepVerifying || fixtures.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg
            ${deepVerifying
              ? 'bg-amber-800/60 text-amber-300 cursor-wait'
              : deepVerified
              ? 'bg-green-800/70 text-green-300 border border-green-600/50'
              : 'bg-accent-cyan text-navy-900 hover:bg-cyan-400 hover:shadow-cyan-500/30'
            } disabled:opacity-50`}
        >
          {deepVerifying ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Verifying…
            </>
          ) : deepVerified ? (
            '✓ Deep Verified'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Deep Verify List
            </>
          )}
        </button>
      </div>

      {/* Fixture cards */}
      <div className="divide-y divide-navy-700/50">
        {fixtures.map((fx, idx) => {
          const barWidth = Math.min(100, fx.confidenceScore);
          const barColour = fx.confidenceScore >= 80 ? 'bg-confidence-strong'
                          : fx.confidenceScore >= 70 ? 'bg-confidence-watch'
                          : fx.confidenceScore >= 60 ? 'bg-confidence-lean'
                          : 'bg-confidence-reject';
          const glowClass  = fx.confidenceScore >= 80 ? 'glow-green' : '';

          return (
            <div
              key={fx.id}
              className={`px-5 py-4 transition-colors hover:bg-navy-700/30 ${glowClass}`}
            >
              <div className="flex items-start gap-3">
                <RankBadge rank={idx + 1} />

                <div className="flex-1 min-w-0">
                  {/* Match title */}
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-bold text-gray-100 text-sm">
                      {fx.homeTeam}
                      <span className="text-gray-500 font-normal mx-1.5">vs</span>
                      {fx.awayTeam}
                    </span>
                    <span className="text-xs text-gray-600 font-mono">{fx.timeGMT} GMT</span>
                    {fx.league && (
                      <span className="text-xs bg-navy-600/80 text-gray-500 px-1.5 py-0.5 rounded font-mono border border-navy-400/30">
                        {fx.league}
                      </span>
                    )}
                    {fx.deepVerified && (
                      <span className="text-xs text-accent-cyan font-semibold">✓ Verified</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs mb-2.5">
                    <span className="font-bold text-green-400">Home: {fx.homeWinProb}%</span>
                    <span className="text-gray-500">Goals avg: {fx.avgGoals > 0 ? fx.avgGoals.toFixed(2) : '—'}</span>
                    <span className="text-gray-400">Predicted: <strong className="text-gray-200">{fx.correctScore || '—'}</strong></span>
                    <span className="text-gray-600">Draw: {fx.drawProb}%</span>
                    {fx.odds && <span className="text-gray-600">Odds: {fx.odds}</span>}
                  </div>

                  {/* Confidence bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 bg-navy-600/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${barColour}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <ConfidenceBadge score={fx.confidenceScore} />
                  </div>

                  {/* Reason */}
                  {fx.reason && (
                    <p className="text-xs text-gray-500 leading-relaxed">{fx.reason}</p>
                  )}

                  {/* Risk flags */}
                  {fx.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {fx.flags.map(f => (
                        <span
                          key={f}
                          className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded px-1.5 py-0.5"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BestListCard;
