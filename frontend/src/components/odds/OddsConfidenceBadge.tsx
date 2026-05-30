import React from 'react';
import type { ConfidenceGrade } from '../../types/OddsFixture';

interface Props {
  score: number;
  grade: ConfidenceGrade;
  showGrade?: boolean;
}

const COLOURS: Record<ConfidenceGrade, string> = {
  'Elite':     'bg-green-900/70  text-green-300  border-green-700/50',
  'Strong':    'bg-cyan-900/70   text-cyan-300   border-cyan-700/50',
  'Moderate':  'bg-amber-900/70  text-amber-300  border-amber-700/50',
  'Watchlist': 'bg-red-900/60    text-red-300    border-red-700/50',
};

const OddsConfidenceBadge: React.FC<Props> = ({ score, grade, showGrade = false }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${COLOURS[grade]}`}>
    {score}
    {showGrade && <span className="opacity-70">· {grade}</span>}
  </span>
);

export default OddsConfidenceBadge;
