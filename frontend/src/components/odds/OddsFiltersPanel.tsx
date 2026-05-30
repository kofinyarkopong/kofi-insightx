import React from 'react';
import type { OddsFilterSettings } from '../../types/OddsFixture';

interface Props {
  filters:  OddsFilterSettings;
  update:   <K extends keyof OddsFilterSettings>(key: K, val: OddsFilterSettings[K]) => void;
  onReset:  () => void;
  onClose?: () => void;
  filterACount: number;
  filterBCount: number;
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs text-gray-400">{children}</span>
);

const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2.5 flex items-center gap-2">
    <span className="flex-1 h-px bg-navy-400/60" />
    {children}
    <span className="flex-1 h-px bg-navy-400/60" />
  </h3>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2.5 cursor-pointer">
    <div className="relative flex-shrink-0">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="sr-only" />
      <div className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent-cyan' : 'bg-navy-400'}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </div>
    <span className="text-sm text-gray-300">{label}</span>
  </label>
);

const OddsFiltersPanel: React.FC<Props> = ({ filters, update, onReset, onClose, filterACount, filterBCount }) => (
  <aside className="glass-card rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between">
      <h2 className="text-xs font-bold tracking-widest uppercase text-gray-400">Filters</h2>
      <div className="flex items-center gap-3">
        <button onClick={onReset} className="text-xs text-accent-cyan hover:text-cyan-300 transition-colors font-medium">Reset</button>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 p-1 rounded-lg hover:bg-navy-600/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>

    {/* Count pills */}
    <div className="grid grid-cols-2 divide-x divide-navy-400/40 border-b border-navy-400/40 text-center py-3">
      <div className="px-2">
        <p className="text-xl font-extrabold text-accent-cyan">{filterACount}</p>
        <p className="text-xs text-gray-500 mt-0.5">Filter A</p>
      </div>
      <div className="px-2">
        <p className="text-xl font-extrabold text-confidence-strong">{filterBCount}</p>
        <p className="text-xs text-gray-500 mt-0.5">Filter B</p>
      </div>
    </div>

    <div className="p-4 space-y-5">

      {/* Odds ranges */}
      <section className="space-y-3">
        <SectionHead>Odds Ranges</SectionHead>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label>Home Win Min</Label><span className="text-xs font-bold text-accent-cyan">{filters.homeOddsMin.toFixed(2)}</span></div>
          <input type="range" min={1.01} max={1.60} step={0.01} value={filters.homeOddsMin}
            onChange={e => update('homeOddsMin', parseFloat(e.target.value))}
            className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400" />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label>Home Win Max</Label><span className="text-xs font-bold text-accent-cyan">{filters.homeOddsMax.toFixed(2)}</span></div>
          <input type="range" min={1.10} max={2.00} step={0.01} value={filters.homeOddsMax}
            onChange={e => update('homeOddsMax', parseFloat(e.target.value))}
            className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400" />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label>Away Win Min</Label><span className="text-xs font-bold text-accent-cyan">{filters.awayOddsMin.toFixed(2)}</span></div>
          <input type="range" min={1.01} max={1.50} step={0.01} value={filters.awayOddsMin}
            onChange={e => update('awayOddsMin', parseFloat(e.target.value))}
            className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400" />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label>Away Win Max</Label><span className="text-xs font-bold text-accent-cyan">{filters.awayOddsMax.toFixed(2)}</span></div>
          <input type="range" min={1.10} max={2.00} step={0.01} value={filters.awayOddsMax}
            onChange={e => update('awayOddsMax', parseFloat(e.target.value))}
            className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400" />
        </div>
      </section>

      {/* Confidence threshold */}
      <section>
        <SectionHead>Confidence</SectionHead>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label>Min Score (Filter B)</Label><span className="text-xs font-bold text-accent-cyan">{filters.minConfidenceScore}/100</span></div>
          <input type="range" min={40} max={95} step={1} value={filters.minConfidenceScore}
            onChange={e => update('minConfidenceScore', parseInt(e.target.value, 10))}
            className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400" />
        </div>
      </section>

      {/* Search */}
      <section className="space-y-2">
        <SectionHead>Search</SectionHead>
        <input type="text" placeholder="Filter by country…" value={filters.countrySearch}
          onChange={e => update('countrySearch', e.target.value)}
          className="w-full bg-navy-700 border border-navy-400/50 rounded-lg px-3 py-1.5 text-sm text-gray-200
            placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-colors" />
        <input type="text" placeholder="Filter by league…" value={filters.leagueSearch}
          onChange={e => update('leagueSearch', e.target.value)}
          className="w-full bg-navy-700 border border-navy-400/50 rounded-lg px-3 py-1.5 text-sm text-gray-200
            placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-colors" />
      </section>

      {/* View toggles */}
      <section className="space-y-3">
        <SectionHead>View</SectionHead>
        <Toggle label="Show Filter B only"   value={filters.showFilterBOnly}  onChange={v => update('showFilterBOnly', v)} />
        <Toggle label="Show Home Win only"   value={filters.showHomeWinOnly}  onChange={v => update('showHomeWinOnly', v)} />
        <Toggle label="Show Away Win only"   value={filters.showAwayWinOnly}  onChange={v => update('showAwayWinOnly', v)} />
      </section>

    </div>
  </aside>
);

export default OddsFiltersPanel;
