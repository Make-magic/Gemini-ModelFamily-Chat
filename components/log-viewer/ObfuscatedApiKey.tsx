import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FOCUS_VISIBLE_RING_CLASS } from '../../constants/appConstants';

export const ObfuscatedApiKey: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  if (!apiKey) return null;
  return (
    <div className="flex items-center gap-2">
      <code className={`font-mono text-[var(--theme-text-secondary)] break-all transition-all duration-200 ${isRevealed ? 'blur-none' : 'blur-sm select-none'}`}>
        {apiKey}
      </code>
      <button
        onClick={() => setIsRevealed(!isRevealed)}
        className={`p-1 flex-shrink-0 rounded-full text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors ${FOCUS_VISIBLE_RING_CLASS}`}
        aria-label={isRevealed ? 'Hide API key' : 'Reveal API key'}
      >
        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};
