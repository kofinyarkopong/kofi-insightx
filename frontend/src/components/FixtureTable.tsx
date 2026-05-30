import React, { useState } from 'react';
import type { Fixture } from '../types/Fixture';
import ConfidenceBadge from './ConfidenceBadge';

interface Props {
  title: string;
  fixtures: Fixture[];
  emptyMessage?: string;
  highlightBest?: boolean;
  showReason?: boolean;
  compact?: boolean;
}

const FLAG_EMOJI: Record<string, string> = {
  'Derby risk':              '⚡',
  'Cup competition':         '🏆',
  'Second leg':              '🔁',
  'Relegation trap risk':    '⚠️',
  'Low-block away side':     '🧱',
  'Youth/reserve fixture':   '🔰',
  'Low parse confidence':    '❓',
  'Missing avg goals':       '📊',
  'Unclear motivation':      '🤷',
  'Form proxy used':         '📐',
};

function flagChip(flag: string) {
  const icon = FLAG_EMOJI[flag] ?? '🚩';
  return (
    <span
      key={flag}
      title={flag}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs
        bg-amber-950/50 text-amber-400 border border-amber-800/40"
    >
      {icon} {flag}
    </span>
  );
}

const PredBadge: React.FC<{ pred: string }> = ({ pred }) => {
  const colour = pred === '1' ? 'bg-green-900/70 text-green-300 border-green-700/50' :
                 pred === '2' ? 'bg-red-900/70 text-red-300 border-red-700/50' :
                 'bg-navy-600 text-gray-400 border-navy-400/50';
  return (
    <span className={`px-2 py-0.5 rounded border font-bold text-xs ${colour}`}>
      {pred || '—'}
    </span>
  );
};

const FixtureTable: React.FC<Props> = ({
  title, fixtures, emptyMessage, highlightBest, showReason = false, compact = false,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'time' | 'confidence' | 'homeWin' | 'goals'>('confidence');

  const sorted = [...fixtures].sort((a, b) => {
    switch (sortKey) {
      case 'time':    return a.timeGMT.localeCompare(b.timeGMT);
      case 'homeWin': return b.homeWinProb - a.homeWinProb;
      case 'goals':   return b.avgGoals - a.avgGoals;
      default:        return b.confidenceScore - a.confidenceScore;
    }
  });

  const SortBtn: React.FC<{ k: typeof sortKey; label: string }> = ({ k, label }) => (
    <button
      onClick={() => setSortKey(k)}
      className={`text-xs px-2.5 py-1 rounded transition-all font-medium ${
        sortKey === k
          ? 'bg-accent-cyan text-navy-900'
          : 'text-gray-500 hover:text-gray-300 hover:bg-navy-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-navy-400/40">
        <div className="flex items-center gap-2.5">
          <h2 className="font-bold text-gray-100">{title}</h2>
          <span className="text-xs bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-full px-2 py-0.5 font-bold">
            {fixtures.length}
          </span>
        </div>
        <div className="flex gap-1">
          <SortBtn k="confidence" label="Confidence" />
          <SortBtn k="time"       label="Time" />
          <SortBtn k="homeWin"    label="Home %" />
          <SortBtn k="goals"      label="Goals" />
        </div>
      </div>

      {fixtures.length === 0 ? (
        <p className="text-sm text-gray-500 italic p-6 text-center">
          {emptyMessage ?? 'No fixtures in this list.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-navy-400/40 bg-navy-800/60">
                <th className="px-2 sm:px-3 py-2.5 text-left whitespace-nowrap">Time</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-left whitespace-nowrap">League</th>
                <th className="px-2 sm:px-3 py-2.5 text-left">Home</th>
                <th className="px-2 sm:px-3 py-2.5 text-left">Away</th>
                <th className="px-2 sm:px-3 py-2.5 text-center">H%</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-center">D%</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-center">A%</th>
                <th className="hidden md:table-cell px-3 py-2.5 text-center text-amber-400/80">H Odds</th>
                <th className="hidden md:table-cell px-3 py-2.5 text-center text-amber-400/80">A Odds</th>
                <th className="px-2 sm:px-3 py-2.5 text-center">Pred</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-center">Score</th>
                {!compact && <th className="hidden md:table-cell px-3 py-2.5 text-center">Avg G</th>}
                <th className="px-2 sm:px-3 py-2.5 text-center">Conf</th>
                {!compact && <th className="hidden md:table-cell px-3 py-2.5 text-left">Flags</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((fx, idx) => {
                const isTop = highlightBest && idx === 0;
                const isExpanded = expanded === fx.id;
                return (
                  <React.Fragment key={fx.id}>
                    <tr
                      onClick={() => setExpanded(isExpanded ? null : fx.id)}
                      className={`cursor-pointer transition-colors border-b border-navy-700/50
                        ${isTop
                          ? 'bg-green-950/40 hover:bg-green-950/60'
                          : 'table-row-dark hover:bg-navy-600/40'
                        }`}
                    >
                      <td className="px-2 sm:px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{fx.timeGMT}</td>
                      <td className="hidden sm:table-cell px-3 py-2.5">
                        <span className="text-xs bg-navy-600/80 text-gray-400 rounded px-1.5 py-0.5 font-mono whitespace-nowrap">
                          {fx.league || '—'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 font-semibold text-gray-100 max-w-[90px] sm:max-w-[140px] truncate text-xs sm:text-sm">{fx.homeTeam}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-400 max-w-[90px] sm:max-w-[140px] truncate text-xs sm:text-sm">{fx.awayTeam}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-center font-bold text-green-400 text-xs sm:text-sm">{fx.homeWinProb}%</td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center text-gray-500">{fx.drawProb}%</td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center text-red-400">{fx.awayWinProb}%</td>
                      <td className="hidden md:table-cell px-3 py-2.5 text-center">
                        {fx.homeOdds1X2
                          ? <span className="font-bold text-amber-400 text-xs">{fx.homeOdds1X2.toFixed(2)}</span>
                          : <span className="text-gray-700 text-xs">—</span>}
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5 text-center">
                        {fx.awayOdds1X2
                          ? <span className="font-bold text-amber-400/80 text-xs">{fx.awayOdds1X2.toFixed(2)}</span>
                          : <span className="text-gray-700 text-xs">—</span>}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-center"><PredBadge pred={fx.prediction} /></td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center font-mono text-xs font-bold text-gray-300">{fx.correctScore || '—'}</td>
                      {!compact && (
                        <td className="hidden md:table-cell px-3 py-2.5 text-center text-gray-500">
                          {fx.avgGoals > 0 ? fx.avgGoals.toFixed(2) : '—'}
                        </td>
                      )}
                      <td className="px-2 sm:px-3 py-2.5 text-center"><ConfidenceBadge score={fx.confidenceScore} /></td>
                      {!compact && (
                        <td className="hidden md:table-cell px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {fx.flags.slice(0, 2).map(flagChip)}
                            {fx.flags.length > 2 && (
                              <span className="text-xs text-gray-600">+{fx.flags.length - 2}</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {isExpanded && (
                      <tr className="bg-navy-700/60">
                        <td colSpan={compact ? 9 : 14} className="px-4 py-4">
                          <div className="space-y-2.5 text-sm">
                            {/* Flashscore 1X2 odds */}
                            {fx.oddsAttached && (
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-gray-500 font-semibold uppercase tracking-wider">Flashscore Odds</span>
                                <span className="text-amber-400 font-bold">H {fx.homeOdds1X2?.toFixed(2)}</span>
                                <span className="text-gray-400">D {fx.drawOdds1X2?.toFixed(2)}</span>
                                <span className="text-amber-400/70 font-bold">A {fx.awayOdds1X2?.toFixed(2)}</span>
                              </div>
                            )}
                            {fx.reason && (
                              <p className="text-gray-400">
                                <span className="font-semibold text-gray-300">Reason: </span>{fx.reason}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {fx.flags.map(flagChip)}
                              {fx.flags.length === 0 && (
                                <span className="text-xs text-green-400">No risk flags</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 pt-1">
                              <span>Motivation: <strong className="text-gray-300">{fx.motivationScore}/100</strong></span>
                              <span>Form proxy: <strong className="text-gray-300">{fx.formProxyScore}/100</strong></span>
                              <span>Away weakness: <strong className="text-gray-300">{fx.awayWeaknessScore}/100</strong></span>
                              <span>Low-block: <strong className="text-gray-300">{fx.lowBlockRisk}/100</strong></span>
                              <span>Parse conf: <strong className="text-gray-300">{fx.parseConfidence}/100</strong></span>
                              <span>Risk penalty: <strong className="text-red-400">-{fx.riskPenalty}</strong></span>
                              {fx.deepVerified && (
                                <span className="text-accent-cyan font-semibold">✓ Deep verified</span>
                              )}
                            </div>
                            {fx.matchUrl && (
                              <a
                                href={fx.matchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-xs text-accent-cyan hover:text-cyan-300 hover:underline transition-colors"
                              >
                                View on Forebet →
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default FixtureTable;
