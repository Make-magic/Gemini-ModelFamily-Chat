
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type ListRange, type VirtuosoHandle } from 'react-virtuoso';
import { ChatMessage, AppSettings, SideViewContent, VideoMetadata } from '../../types';
import { Message } from '../message/Message';
import { translations } from '../../utils/appUtils';
import { HtmlPreviewModal } from '../modals/HtmlPreviewModal';
import { FilePreviewModal } from '../modals/FilePreviewModal';
import { ThemeColors } from '../../types/theme';
import { WelcomeScreen } from './message-list/WelcomeScreen';
import { ScrollNavigation } from './message-list/ScrollNavigation';
import { FileConfigurationModal } from '../modals/FileConfigurationModal';
import { MediaResolution } from '../../types/settings';
import { isGemini3Model } from '../../utils/appUtils';
import { TextSelectionToolbar } from './message-list/TextSelectionToolbar';
import { useMessageListUI } from '../../hooks/useMessageListUI';

export interface MessageListProps {
  messages: ChatMessage[];
  sessionTitle?: string;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  setScrollContainerRef: (node: HTMLDivElement | null) => void;
  onScrollContainerScroll: () => void;
  onEditMessage: (messageId: string, mode?: 'update' | 'resend') => void;
  onDeleteMessage: (messageId: string) => void;
  onRetryMessage: (messageId: string) => void;
  onUpdateMessageFile: (messageId: string, fileId: string, updates: { videoMetadata?: VideoMetadata, mediaResolution?: MediaResolution }) => void;
  showThoughts: boolean;
  themeColors: ThemeColors;
  themeId: string;
  baseFontSize: number;
  expandCodeBlocksByDefault: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  onOrganizeInfoClick?: (suggestion: string) => void;
  onFollowUpSuggestionClick?: (suggestion: string) => void;
  onTextToSpeech: (messageId: string, text: string) => void;
  onGenerateCanvas: (messageId: string, text: string) => void;
  ttsMessageId: string | null;
  t: (key: keyof typeof translations, fallback?: string) => string;
  language: 'en' | 'zh';
  scrollNavVisibility: { up: boolean, down: boolean };
  onScrollToPrevTurn: () => void;
  onScrollToNextTurn: () => void;
  chatInputHeight: number;
  appSettings: AppSettings;
  currentModelId: string;
  onOpenSidePanel: (content: SideViewContent) => void;
  onQuote: (text: string) => void;
  onEditMessageContent: (messageId: string, newContent: string) => void;
  exportStatus?: 'idle' | 'exporting';
}

export const MessageList: React.FC<MessageListProps> = ({
  messages, sessionTitle, scrollContainerRef, setScrollContainerRef, onScrollContainerScroll,
  onEditMessage, onDeleteMessage, onRetryMessage, onUpdateMessageFile, showThoughts, themeColors, baseFontSize,
  expandCodeBlocksByDefault, isMermaidRenderingEnabled, isGraphvizRenderingEnabled, onSuggestionClick, onOrganizeInfoClick, onFollowUpSuggestionClick, onTextToSpeech, onGenerateCanvas, ttsMessageId, t, language, themeId,
  scrollNavVisibility, onScrollToPrevTurn, onScrollToNextTurn,
  chatInputHeight, appSettings, currentModelId, onOpenSidePanel, onQuote, onEditMessageContent,
  exportStatus
}) => {
  const {
    previewFile,
    isHtmlPreviewModalOpen,
    htmlToPreview,
    initialTrueFullscreenRequest,
    configuringFile,
    setConfiguringFile,
    handleFileClick,
    closeFilePreviewModal,
    allImages,
    currentImageIndex,
    handlePrevImage,
    handleNextImage,
    handleOpenHtmlPreview,
    handleCloseHtmlPreview,
    handleConfigureFile,
    handleSaveFileConfig,
  } = useMessageListUI({ messages, onUpdateMessageFile });

  // Determine if current model is Gemini 3 to enable per-part resolution
  const isGemini3 = useMemo(() => {
    return isGemini3Model(currentModelId);
  }, [currentModelId]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const activeScrollerRef = useRef<HTMLElement | null>(null);
  const [visibleRange, setVisibleRange] = useState<ListRange>({ startIndex: 0, endIndex: 0 });
  const streamingTail = messages.at(-1)?.isLoading ? messages.at(-1)! : null;
  const virtualizedMessages = streamingTail ? messages.slice(0, -1) : messages;

  const setVirtuosoScrollerRef = useCallback((node: HTMLElement | Window | null) => {
    if (activeScrollerRef.current) {
      activeScrollerRef.current.removeEventListener('scroll', onScrollContainerScroll);
    }
    const element = node instanceof HTMLElement ? node : null;
    activeScrollerRef.current = element;
    setScrollContainerRef(element as HTMLDivElement | null);
    element?.addEventListener('scroll', onScrollContainerScroll, { passive: true });
  }, [onScrollContainerScroll, setScrollContainerRef]);

  useEffect(() => () => {
    activeScrollerRef.current?.removeEventListener('scroll', onScrollContainerScroll);
  }, [onScrollContainerScroll]);

  const turnIndexes = useMemo(() => messages.reduce<number[]>((indexes, message, index) => {
    const previous = messages[index - 1];
    if (index > 0 && previous?.role === 'user' && (message.role === 'model' || message.role === 'error')) indexes.push(index);
    return indexes;
  }, []), [messages]);

  const scrollToMessageIndex = useCallback((index: number) => {
    if (streamingTail && index === messages.length - 1) {
      activeScrollerRef.current?.scrollTo({ top: activeScrollerRef.current.scrollHeight, behavior: 'smooth' });
      return;
    }
    const scroller = activeScrollerRef.current;
    const renderedTarget = scroller?.querySelector<HTMLElement>(`[data-message-index="${index}"]`);
    if (scroller && renderedTarget) {
      const targetTop = scroller.scrollTop + renderedTarget.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return;
    }
    virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
  }, [messages.length, streamingTail]);

  const getViewportAnchorIndex = useCallback(() => {
    const scroller = activeScrollerRef.current;
    if (!scroller) return visibleRange.startIndex;
    const scrollerRect = scroller.getBoundingClientRect();
    const renderedMessages = Array.from(scroller.querySelectorAll<HTMLElement>('[data-message-index]'));
    const firstVisible = renderedMessages.find(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > scrollerRect.top + 4 && rect.top < scrollerRect.bottom - 4;
    });
    const index = Number(firstVisible?.dataset.messageIndex);
    return Number.isInteger(index) ? index : visibleRange.startIndex;
  }, [visibleRange.startIndex]);

  const handleVirtualPrevTurn = useCallback(() => {
    const anchorIndex = getViewportAnchorIndex();
    const target = [...turnIndexes].reverse().find(index => index < anchorIndex);
    if (target === undefined) virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
    else scrollToMessageIndex(target);
  }, [getViewportAnchorIndex, scrollToMessageIndex, turnIndexes]);

  const handleVirtualNextTurn = useCallback(() => {
    const anchorIndex = getViewportAnchorIndex();
    const target = turnIndexes.find(index => index > anchorIndex);
    if (target === undefined) activeScrollerRef.current?.scrollTo({ top: activeScrollerRef.current.scrollHeight, behavior: 'smooth' });
    else scrollToMessageIndex(target);
  }, [getViewportAnchorIndex, scrollToMessageIndex, turnIndexes]);

  const renderMessage = useCallback((msg: ChatMessage, index: number) => (
    <div className="w-full max-w-7xl mx-auto" role="listitem" aria-setsize={messages.length} aria-posinset={index + 1} data-message-index={index}>
      <Message
        message={msg}
        sessionTitle={sessionTitle}
        prevMessage={index > 0 ? messages[index - 1] : undefined}
        messageIndex={index}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onRetryMessage={onRetryMessage}
        onImageClick={handleFileClick}
        onOpenHtmlPreview={handleOpenHtmlPreview}
        showThoughts={showThoughts}
        themeColors={themeColors}
        themeId={themeId}
        baseFontSize={baseFontSize}
        expandCodeBlocksByDefault={expandCodeBlocksByDefault}
        isMermaidRenderingEnabled={isMermaidRenderingEnabled}
        isGraphvizRenderingEnabled={isGraphvizRenderingEnabled}
        onTextToSpeech={onTextToSpeech}
        onGenerateCanvas={onGenerateCanvas}
        ttsMessageId={ttsMessageId}
        onSuggestionClick={onFollowUpSuggestionClick}
        t={t}
        appSettings={appSettings}
        onOpenSidePanel={onOpenSidePanel}
        onConfigureFile={msg.role === 'user' ? handleConfigureFile : undefined}
        isGemini3={isGemini3}
      />
    </div>
  ), [appSettings, baseFontSize, expandCodeBlocksByDefault, handleConfigureFile, handleFileClick, handleOpenHtmlPreview, isGemini3, isGraphvizRenderingEnabled, isMermaidRenderingEnabled, messages, onDeleteMessage, onEditMessage, onFollowUpSuggestionClick, onGenerateCanvas, onOpenSidePanel, onRetryMessage, onTextToSpeech, sessionTitle, showThoughts, t, themeColors, themeId, ttsMessageId]);

  return (
    <>
      <div className={`relative flex-grow min-h-0 ${themeId === 'pearl' ? 'bg-[var(--theme-bg-primary)]' : 'bg-[var(--theme-bg-secondary)]'}`}>
        <TextSelectionToolbar onQuote={onQuote} containerRef={scrollContainerRef} />

        {messages.length === 0 ? (
          <div
            ref={setScrollContainerRef}
            onScroll={onScrollContainerScroll}
            className="h-full overflow-y-auto px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 md:py-6 custom-scrollbar"
          >
            <WelcomeScreen
              t={t}
              onSuggestionClick={onSuggestionClick}
              onOrganizeInfoClick={onOrganizeInfoClick}
              showSuggestions={appSettings.showWelcomeSuggestions ?? true}
              themeId={themeId}
            />
          </div>
        ) : exportStatus === 'exporting' ? (
          <div
            ref={setScrollContainerRef}
            onScroll={onScrollContainerScroll}
            className="h-full overflow-y-auto px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 md:py-6 custom-scrollbar"
            style={{ paddingBottom: chatInputHeight ? `${chatInputHeight + 16}px` : '160px' }}
            role="list"
          >
            {messages.map((message, index) => <React.Fragment key={message.id}>{renderMessage(message, index)}</React.Fragment>)}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            scrollerRef={setVirtuosoScrollerRef}
            data={virtualizedMessages}
            computeItemKey={(_, message) => message.id}
            itemContent={(index, message) => renderMessage(message, index)}
            initialTopMostItemIndex={Math.max(0, virtualizedMessages.length - 1)}
            followOutput={scrollNavVisibility.down ? false : 'auto'}
            increaseViewportBy={{ top: 900, bottom: 1200 }}
            rangeChanged={setVisibleRange}
            className="h-full px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 md:py-6 custom-scrollbar"
            role="list"
            aria-label="Chat messages"
            components={{
              Footer: () => (
                <>
                  {streamingTail && renderMessage(streamingTail, messages.length - 1)}
                  <div aria-hidden="true" style={{ height: chatInputHeight ? `${chatInputHeight + 16}px` : '160px' }} />
                </>
              ),
            }}
          />
        )}

        <ScrollNavigation
          showUp={scrollNavVisibility.up}
          showDown={scrollNavVisibility.down}
          onScrollToPrev={exportStatus === 'exporting' ? onScrollToPrevTurn : handleVirtualPrevTurn}
          onScrollToNext={exportStatus === 'exporting' ? onScrollToNextTurn : handleVirtualNextTurn}
          bottomOffset={Math.max(16, chatInputHeight + 16)}
        />
      </div>

      <FilePreviewModal
        file={previewFile}
        onClose={closeFilePreviewModal}
        t={t}
        onPrev={handlePrevImage}
        onNext={handleNextImage}
        hasPrev={currentImageIndex > 0}
        hasNext={currentImageIndex !== -1 && currentImageIndex < allImages.length - 1}
      />

      {isHtmlPreviewModalOpen && htmlToPreview !== null && (
        <HtmlPreviewModal
          isOpen={isHtmlPreviewModalOpen}
          onClose={handleCloseHtmlPreview}
          htmlContent={htmlToPreview}
          initialTrueFullscreenRequest={initialTrueFullscreenRequest}
          t={t}
        />
      )}

      <FileConfigurationModal
        isOpen={!!configuringFile}
        onClose={() => setConfiguringFile(null)}
        file={configuringFile?.file || null}
        onSave={handleSaveFileConfig}
        t={t}
        isGemini3={isGemini3}
      />
    </>
  );
};
