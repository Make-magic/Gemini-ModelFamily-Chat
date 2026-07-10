
import React, { useRef } from 'react';
import { useHtmlPreviewModal } from '../../hooks/useHtmlPreviewModal';
import { HtmlPreviewHeader } from './html-preview/HtmlPreviewHeader';
import { HtmlPreviewContent } from './html-preview/HtmlPreviewContent';
import { Modal } from '../shared/Modal';

interface HtmlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string | null;
  initialTrueFullscreenRequest?: boolean;
}

export const HtmlPreviewModal: React.FC<HtmlPreviewModalProps> = ({
  isOpen,
  onClose,
  htmlContent,
  initialTrueFullscreenRequest,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
      isActuallyOpen,
      isTrueFullscreen,
      isDirectFullscreenLaunch,
      scale,
      isScreenshotting,
      handleZoomIn,
      handleZoomOut,
      handleDownload,
      handleScreenshot,
      handleRefresh,
      enterTrueFullscreen,
      exitTrueFullscreen,
      getPreviewTitle,
      MIN_ZOOM,
      MAX_ZOOM
  } = useHtmlPreviewModal({
      isOpen,
      onClose,
      htmlContent,
      initialTrueFullscreenRequest,
      iframeRef
  });

  if (!isActuallyOpen || !htmlContent) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isTrueFullscreen ? () => {} : onClose}
      noPadding
      ariaLabelledBy="html-preview-modal-title"
      backdropClassName={isDirectFullscreenLaunch ? 'opacity-0 pointer-events-none' : 'bg-black/80 backdrop-blur-sm'}
      contentClassName="bg-[var(--theme-bg-secondary)] w-full h-full flex flex-col overflow-hidden"
    >
        <HtmlPreviewHeader 
            title={getPreviewTitle()}
            scale={scale}
            isTrueFullscreen={isTrueFullscreen}
            isScreenshotting={isScreenshotting}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRefresh={handleRefresh}
            onDownload={handleDownload}
            onScreenshot={handleScreenshot}
            onToggleFullscreen={isTrueFullscreen ? exitTrueFullscreen : enterTrueFullscreen}
            onClose={onClose}
        />

        <HtmlPreviewContent 
            iframeRef={iframeRef}
            htmlContent={htmlContent}
            scale={scale}
        />
    </Modal>
  );
};
