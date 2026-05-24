import React from 'react';
import type { FetchStatus } from '../hooks/useForebetData';

interface Props {
  status: FetchStatus;
  message: string;
  error?: string | null;
}

const dots: Record<FetchStatus, { dot: string; label: string }> = {
  idle:           { dot: 'bg-gray-500',                      label: 'Idle'           },
  fetching:       { dot: 'bg-accent-cyan animate-pulse',     label: 'Fetching'       },
  expanding:      { dot: 'bg-accent-indigo animate-pulse',   label: 'Expanding'      },
  parsing:        { dot: 'bg-accent-blue animate-pulse',     label: 'Parsing'        },
  complete:       { dot: 'bg-confidence-strong',             label: 'Complete'       },
  failed:         { dot: 'bg-confidence-reject',             label: 'Failed'         },
  deep_verifying: { dot: 'bg-confidence-watch animate-pulse', label: 'Deep Verifying' },
};

const StatusBadge: React.FC<Props> = ({ status, message, error }) => {
  const { dot, label } = dots[status];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className="font-medium text-gray-300">{label}</span>
        <span className="text-gray-500 truncate">{message}</span>
      </div>
      {error && (
        <p className="text-xs text-red-400 pl-4">{error}</p>
      )}
    </div>
  );
};

export default StatusBadge;
