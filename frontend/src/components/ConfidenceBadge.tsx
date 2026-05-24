import React from 'react';
import { confidenceLabel } from '../utils/filters';

interface Props {
  score: number;
}

const ConfidenceBadge: React.FC<Props> = ({ score }) => {
  const label = confidenceLabel(score);
  const colour = score >= 80 ? 'bg-green-900/60 text-green-300 border border-green-700/50'
               : score >= 70 ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
               : score >= 60 ? 'bg-orange-900/60 text-orange-300 border border-orange-700/50'
               : 'bg-red-900/60 text-red-300 border border-red-700/50';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${colour}`}>
      {score}
      <span className="hidden sm:inline opacity-70">· {label}</span>
    </span>
  );
};

export default ConfidenceBadge;
