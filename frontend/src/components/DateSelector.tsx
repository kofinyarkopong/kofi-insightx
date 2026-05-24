import React from 'react';

interface Props {
  date: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

const DateSelector: React.FC<Props> = ({ date, onChange, disabled }) => {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
        Date (GMT)
      </label>
      <input
        type="date"
        value={date}
        max={today}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="bg-navy-700 border border-navy-400/60 rounded-lg px-3 py-1.5 text-sm text-gray-200
          focus:outline-none focus:ring-1 focus:ring-accent-cyan focus:border-accent-cyan
          disabled:opacity-40 transition-colors"
      />
      {date !== today && (
        <button
          onClick={() => onChange(today)}
          disabled={disabled}
          className="text-xs text-accent-cyan hover:text-cyan-300 font-medium disabled:opacity-40 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
};

export default DateSelector;
