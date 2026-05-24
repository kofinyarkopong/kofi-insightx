import React, { useState } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  onClose: () => void;
  date: string;
}

const SAMPLE = `15:00 Arsenal Chelsea 62 23 15 1 2-1 2.95 1.55
17:30 Barcelona Getafe 71 17 12 1 3-0 3.20 1.35
20:00 Dortmund Augsburg 58 24 18 1 2-0 2.80 1.65`;

const ManualPasteModal: React.FC<Props> = ({ onSubmit, onClose, date }) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-navy-400/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-400/40">
          <div>
            <h2 className="font-bold text-gray-100 text-lg">Manual Paste Fallback</h2>
            <p className="text-xs text-gray-500 mt-0.5">For {date} — paste Forebet predictions text below</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-4">
          {/* Instructions */}
          <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-3.5 text-xs text-amber-400">
            <p className="font-bold mb-1.5 text-amber-300">How to use:</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-500">
              <li>
                Visit{' '}
                <a
                  href="https://www.forebet.com/en/football-tips-and-predictions-for-today"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-accent-cyan hover:text-cyan-300"
                >
                  forebet.com
                </a>{' '}
                in your browser
              </li>
              <li>Scroll to the bottom until all fixtures have loaded</li>
              <li>Select all text (Ctrl+A / Cmd+A), copy, and paste below</li>
              <li>The parser will extract what it can from the raw text</li>
            </ol>
          </div>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Paste Forebet text here…\n\nExample format:\n${SAMPLE}`}
            rows={14}
            className="w-full bg-navy-700 border border-navy-400/50 rounded-xl px-3 py-2.5 text-sm font-mono
              text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-cyan
              focus:border-accent-cyan resize-none transition-colors"
          />

          <button
            onClick={() => setText(SAMPLE)}
            className="text-xs text-accent-cyan hover:text-cyan-300 transition-colors font-medium"
          >
            Load sample data (for testing)
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-navy-400/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 border border-navy-400/60 rounded-lg hover:border-gray-500 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-5 py-2 text-sm font-bold bg-accent-cyan text-navy-900 rounded-lg
              hover:bg-cyan-400 disabled:opacity-40 transition-all shadow-lg hover:shadow-cyan-500/25"
          >
            Parse Text
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualPasteModal;
