import React from 'react';
import type { OddsFixture } from '../../types/OddsFixture';
import OddsConfidenceBadge from './OddsConfidenceBadge';

interface Props {
  fixture: OddsFixture;
  onClose: () => void;
}

const Row: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-navy-700/40 last:border-0">
    <span className="text-xs text-gray-500 flex-shrink-0 w-40">{label}</span>
    <span className={`text-xs font-medium text-right ${accent ?? 'text-gray-200'}`}>{value}</span>
  </div>
);

const ScoreBar: React.FC<{ label: string; score: number; max: number; colour: string }> = ({ label, score, max, colour }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-gray-200">{score}/{max}</span>
    </div>
    <div className="h-1.5 bg-navy-600/60 rounded-full overflow-hidden">
      <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${(score / max) * 100}%` }} />
    </div>
  </div>
);

const OddsMatchDrawer: React.FC<Props> = ({ fixture: fx, onClose }) => (
  <div className="fixed inset-0 z-50 flex">
    {/* Backdrop */}
    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

    {/* Panel */}
    <div className="w-full max-w-md bg-[#0a0e1a] border-l border-navy-400/30 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-4 border-b border-navy-400/40 bg-[#0a0e1a] flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">{fx.country} · {fx.league}</p>
          <h2 className="font-extrabold text-gray-100 text-base leading-tight mt-1">
            {fx.homeTeam} <span className="text-gray-500 font-normal">vs</span> {fx.awayTeam}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{fx.date} · {fx.timeGMT} GMT</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-100 p-1.5 rounded-lg hover:bg-navy-600/60 transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5 flex-1">

        {/* Pick + confidence */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-navy-700/50 border border-navy-400/30">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-extrabold border
            ${fx.pick === 'HOME_WIN'
              ? 'bg-green-900/60 text-green-300 border-green-700/50'
              : 'bg-blue-900/60 text-blue-300 border-blue-700/50'
            }`}>
            {fx.pick === 'HOME_WIN' ? '🏠 HOME WIN' : '✈️ AWAY WIN'}
          </span>
          <OddsConfidenceBadge score={fx.confidenceScore} grade={fx.confidenceGrade} showGrade />
          {fx.passesFilterB
            ? <span className="text-xs text-green-400 font-semibold">✓ Filter B</span>
            : <span className="text-xs text-gray-500">Filter A only</span>}
        </div>

        {/* Odds */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Odds</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Home Win', odds: fx.homeOdds, accent: 'text-green-400' },
              { label: 'Draw',     odds: fx.drawOdds, accent: 'text-gray-400' },
              { label: 'Away Win', odds: fx.awayOdds, accent: 'text-red-400' },
            ].map(({ label, odds, accent }) => (
              <div key={label} className="bg-navy-700/60 rounded-xl py-3">
                <p className={`text-xl font-extrabold ${accent}`}>{odds.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                <p className="text-xs text-gray-600">{(100 / odds).toFixed(1)}%</p>
              </div>
            ))}
          </div>
          {fx.over15Odds && (
            <p className="text-xs text-gray-500 mt-2 text-center">Over 1.5 market: <strong className="text-gray-300">{fx.over15Odds.toFixed(2)}</strong></p>
          )}
        </section>

        {/* Why it passed Filter A */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Filter A — Why Included</h3>
          <p className="text-xs text-green-400 bg-green-950/30 border border-green-800/40 rounded-lg p-2.5">{fx.filterAReason}</p>
        </section>

        {/* Filter B reasoning */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Filter B — Confidence Breakdown</h3>
          <div className="space-y-2.5">
            <ScoreBar label="Odds Strength"       score={fx.oddsStrengthScore}       max={20} colour="bg-accent-cyan" />
            <ScoreBar label="Form Superiority"    score={fx.formScore}               max={20} colour="bg-blue-500" />
            <ScoreBar label="Scoring Consistency" score={fx.scoringConsistencyScore} max={20} colour="bg-green-500" />
            <ScoreBar label="Over 1.5 Expected"   score={fx.over15Score}             max={15} colour="bg-amber-500" />
            <ScoreBar label="Opponent Weakness"   score={fx.opponentWeaknessScore}   max={10} colour="bg-orange-500" />
            <ScoreBar label="League Reliability"  score={fx.leagueReliabilityScore}  max={10} colour="bg-purple-500" />
          </div>
          {fx.riskPenalty > 0 && (
            <p className="text-xs text-red-400 mt-2">Risk penalty: −{fx.riskPenalty}</p>
          )}
          <p className="text-xs text-gray-500 mt-2 border-t border-navy-700/50 pt-2">{fx.filterBReason}</p>
        </section>

        {/* Form */}
        {(fx.homeForm || fx.awayForm) && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Form</h3>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: fx.homeTeam, form: fx.homeForm }, { label: fx.awayTeam, form: fx.awayForm }].map(({ label, form }) => (
                <div key={label} className="bg-navy-700/50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1.5 truncate">{label}</p>
                  <div className="flex gap-1 flex-wrap">
                    {form ? form.toUpperCase().split('').map((c, i) => (
                      <span key={i} className={`w-6 h-6 rounded text-xs font-extrabold flex items-center justify-center
                        ${c === 'W' ? 'bg-green-700/80 text-green-200' : c === 'D' ? 'bg-amber-700/60 text-amber-200' : 'bg-red-800/60 text-red-300'}`}>
                        {c}
                      </span>
                    )) : <span className="text-xs text-gray-600 italic">Not in CSV</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Risk flags */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Risk Flags</h3>
          {fx.riskFlags.length > 0
            ? <div className="flex flex-wrap gap-1.5">
                {fx.riskFlags.map(f => (
                  <span key={f} className="text-xs bg-amber-950/50 text-amber-400 border border-amber-800/40 rounded px-2 py-0.5">{f}</span>
                ))}
              </div>
            : <p className="text-xs text-green-400">No risk flags</p>
          }
        </section>

        {/* Notes */}
        {fx.notes && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Notes</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{fx.notes}</p>
          </section>
        )}

        {/* Metadata */}
        <section className="space-y-1">
          <Row label="Market source"  value={fx.marketSource} />
          <Row label="Data refreshed" value={new Date(fx.refreshedAt).toLocaleString('en-GB')} />
          <Row label="Timezone (src)" value={fx.timezone} />
        </section>

        {/* Disclaimer */}
        <p className="text-xs text-gray-600 italic text-center pt-2">
          Football outcomes are uncertain. This dashboard is a research tool and does not guarantee results.
        </p>
      </div>
    </div>
  </div>
);

export default OddsMatchDrawer;
