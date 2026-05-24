import React, { useState } from 'react';
import type { Fixture } from '../types/Fixture';
import { downloadCsv, toClipboardText } from '../utils/export';

interface Props {
  listA: Fixture[];
  listB: Fixture[];
  listC: Fixture[];
  date: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const ExportBar: React.FC<Props> = ({ listA, listB, listC, date }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const all = [...new Map([...listA, ...listB, ...listC].map(f => [f.id, f])).values()];

  const BtnBase  = 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all';
  const BtnGhost = `${BtnBase} border border-navy-400/60 text-gray-400 hover:border-accent-cyan hover:text-accent-cyan`;

  const DownloadIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
    </svg>
  );

  return (
    <div className="glass-card rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center">
      <span className="text-xs font-bold text-gray-600 uppercase tracking-widest mr-1">Export</span>

      <button onClick={() => downloadCsv(all, `forebet-${date}-all.csv`)} className={BtnGhost}>
        <DownloadIcon /> CSV (all lists)
      </button>

      <button onClick={() => copy(toClipboardText(listA), 'copy-A')} className={BtnGhost}>
        {copied === 'copy-A' ? '✓ Copied!' : 'Copy List A'}
      </button>

      <button onClick={() => copy(toClipboardText(listB), 'copy-B')} className={BtnGhost}>
        {copied === 'copy-B' ? '✓ Copied!' : 'Copy List B'}
      </button>

      <button
        onClick={() => copy(toClipboardText(listC), 'best')}
        disabled={listC.length === 0}
        className={`${BtnBase} bg-confidence-strong/20 border border-green-700/50 text-green-300
          hover:bg-confidence-strong/30 disabled:opacity-40 font-semibold`}
      >
        {copied === 'best' ? '✓ Copied!' : 'Copy Best List C'}
      </button>
    </div>
  );
};

export default ExportBar;
