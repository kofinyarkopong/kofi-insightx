import React from 'react';
import type { FilterSettings } from '../types/Fixture';

interface Props {
  filters: FilterSettings;
  update: <K extends keyof FilterSettings>(key: K, val: FilterSettings[K]) => void;
  onReset: () => void;
  listACounts: number;
  listBCount: number;
  listCCount: number;
}

const Toggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}> = ({ label, value, onChange, hint }) => (
  <label className="flex items-start gap-2.5 cursor-pointer group">
    <div className="relative mt-0.5 flex-shrink-0">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="sr-only" />
      <div className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent-cyan' : 'bg-navy-400'}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </div>
    <div>
      <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors">{label}</span>
      {hint && <p className="text-xs text-gray-600 mt-0.5">{hint}</p>}
    </div>
  </label>
);

const SliderInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-accent-cyan">{value}{suffix}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-brand-600 h-1.5 rounded-full bg-navy-400"
    />
  </div>
);

const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
    <span className="flex-1 h-px bg-navy-400" />
    {children}
    <span className="flex-1 h-px bg-navy-400" />
  </h3>
);

const FiltersPanel: React.FC<Props> = ({ filters, update, onReset, listACounts, listBCount, listCCount }) => (
  <aside className="glass-card rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-navy-400/40 flex items-center justify-between">
      <h2 className="text-xs font-bold tracking-widest uppercase text-gray-400">Filters</h2>
      <button onClick={onReset} className="text-xs text-accent-cyan hover:text-cyan-300 transition-colors font-medium">
        Reset
      </button>
    </div>

    <div className="grid grid-cols-3 divide-x divide-navy-400/40 border-b border-navy-400/40 text-center py-3">
      <div className="px-2">
        <p className="text-xl font-extrabold text-gray-100">{listACounts}</p>
        <p className="text-xs text-gray-500 mt-0.5">List A</p>
      </div>
      <div className="px-2">
        <p className="text-xl font-extrabold text-accent-blue">{listBCount}</p>
        <p className="text-xs text-gray-500 mt-0.5">List B</p>
      </div>
      <div className="px-2">
        <p className="text-xl font-extrabold text-confidence-strong">{listCCount}</p>
        <p className="text-xs text-gray-500 mt-0.5">Best C</p>
      </div>
    </div>

    <div className="p-4 space-y-5">
      <section>
        <SectionHead>Thresholds</SectionHead>
        <div className="space-y-4">
          <SliderInput label="Min Home Win Prob"       value={filters.minHomeWinProb}    min={40} max={80}              onChange={v => update('minHomeWinProb', v)}    suffix="%" />
          <SliderInput label="Min Confidence (List C)" value={filters.minConfidenceScore} min={40} max={95}              onChange={v => update('minConfidenceScore', v)} suffix="/100" />
          <SliderInput label="Best List Size"          value={filters.bestListSize}       min={3}  max={25}              onChange={v => update('bestListSize', v)}       suffix=" games" />
        </div>
      </section>

      <section>
        <SectionHead>Search</SectionHead>
        <input
          type="text"
          placeholder="Filter by league or team…"
          value={filters.leagueSearch}
          onChange={e => update('leagueSearch', e.target.value)}
          className="w-full bg-navy-700 border border-navy-400/50 rounded-lg px-3 py-1.5 text-sm text-gray-200
            placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-cyan focus:border-accent-cyan transition-colors"
        />
      </section>

      <section className="space-y-3">
        <SectionHead>Content</SectionHead>
        <Toggle label="Hide women's fixtures"       value={filters.hideWomens}      onChange={v => update('hideWomens', v)} />
        <Toggle label="Penalise women's (–10 score)" value={filters.penaliseWomens} onChange={v => update('penaliseWomens', v)} />
      </section>
    </div>
  </aside>
);

export default FiltersPanel;
