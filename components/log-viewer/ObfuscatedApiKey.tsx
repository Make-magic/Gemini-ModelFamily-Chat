import React from 'react';

export const ObfuscatedApiKey: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  if (!apiKey) return null;
  return (
    <code className="font-mono text-[var(--theme-text-secondary)] break-all">
      {apiKey}
    </code>
  );
};
