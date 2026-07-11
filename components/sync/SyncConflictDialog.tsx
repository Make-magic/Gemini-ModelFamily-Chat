import React, { useEffect, useRef } from 'react';
import type { SyncConflictChoice, SyncConflictRequest } from '../../types';
import type { translations } from '../../utils/appUtils';

interface SyncConflictDialogProps {
  conflict: SyncConflictRequest;
  onResolve: (choice: SyncConflictChoice) => void;
  t: (key: keyof typeof translations) => string;
}

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({ conflict, onResolve, t }) => {
  const defaultButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => defaultButtonRef.current?.focus(), [conflict.id]);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="presentation">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
        aria-describedby="sync-conflict-description"
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] p-5 shadow-2xl"
      >
        <h2 id="sync-conflict-title" className="text-lg font-semibold text-[var(--theme-text-primary)]">
          {t('sync_conflict_title')}
        </h2>
        <p id="sync-conflict-description" className="mt-2 text-sm leading-6 text-[var(--theme-text-secondary)]">
          {t('sync_conflict_description')}
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--theme-text-primary)]">{conflict.title}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">{conflict.detail}</p>
        <p className="mt-2 text-xs text-[var(--theme-text-tertiary)]">
          {t('sync_conflict_item')}: {conflict.itemType}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            ref={defaultButtonRef}
            type="button"
            onClick={() => onResolve('keep_both')}
            className="min-h-11 rounded-xl bg-[var(--theme-bg-accent)] px-3 py-2 text-sm font-semibold text-[var(--theme-text-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)]"
          >
            {t('sync_conflict_keep_both')}
          </button>
          <button type="button" onClick={() => onResolve('use_remote')} className="min-h-11 rounded-xl border border-[var(--theme-border-secondary)] px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]">
            {t('sync_conflict_use_remote')}
          </button>
          <button type="button" onClick={() => onResolve('overwrite_remote')} className="min-h-11 rounded-xl border border-[var(--theme-border-secondary)] px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]">
            {t('sync_conflict_overwrite_remote')}
          </button>
        </div>
      </section>
    </div>
  );
};
