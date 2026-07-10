import React from 'react';
import { createPortal } from 'react-dom';
import { useWindowContext } from '../../contexts/WindowContext';

export interface LiveAnnouncement {
  id: number;
  message: string;
}

interface AccessibilityLiveRegionsProps {
  polite: LiveAnnouncement;
  assertive: LiveAnnouncement;
}

export const AccessibilityLiveRegions: React.FC<AccessibilityLiveRegionsProps> = ({
  polite,
  assertive,
}) => {
  const { document: targetDocument } = useWindowContext();

  return createPortal(
    <div data-live-region-root="true" className="pointer-events-none">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite.message && <span key={polite.id}>{polite.message}</span>}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive.message && <span key={assertive.id}>{assertive.message}</span>}
      </div>
    </div>,
    targetDocument.body
  );
};
