import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Message } from '../../components/message/Message';
import { getModelCapabilities } from '../../constants/modelRegistry';
import type { AppSettings, SavedChatSession, Theme } from '../../types';

interface CreateChatExportDomOptions {
  session: SavedChatSession;
  appSettings: AppSettings;
  theme: Theme;
  t: (key: string) => string;
}

interface ChatExportDom {
  content: HTMLElement;
  remove: () => void;
}

const waitForNextPaint = (): Promise<void> => new Promise(resolve => {
  if (typeof requestAnimationFrame !== 'function') {
    resolve();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

const waitForPendingExportContent = (container: HTMLElement, timeoutMs = 15000): Promise<void> => {
  const hasPendingContent = () => !!container.querySelector('[data-export-pending="true"]');
  if (!hasPendingContent()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let timer = 0;
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      observer.disconnect();
      if (error) reject(error);
      else resolve();
    };
    const observer = new MutationObserver(() => {
      if (!hasPendingContent()) finish();
    });
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    timer = window.setTimeout(() => {
      finish(new Error('Timed out while rendering diagrams for chat export.'));
    }, timeoutMs);
  });
};

export const createChatExportDom = async ({
  session,
  appSettings,
  theme,
  t,
}: CreateChatExportDomOptions): Promise<ChatExportDom> => {
  const host = document.createElement('div');
  host.dataset.chatExportHost = 'true';
  host.className = `${document.body.className} theme-${theme.id} is-exporting-png`;
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: '900px',
    height: 'auto',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: '-1',
    backgroundColor: theme.colors.bgPrimary,
    color: theme.colors.textPrimary,
  });
  document.body.appendChild(host);

  const root = createRoot(host);
  const effectiveAppSettings: AppSettings = { ...appSettings, ...session.settings };
  const supportsPerPartResolution = getModelCapabilities(session.settings.modelId).mediaResolution === 'per-part';
  const translate = ((key: string) => t(key)) as React.ComponentProps<typeof Message>['t'];
  const noop = () => undefined;

  try {
    flushSync(() => {
      root.render(
        <div
          data-chat-export-content="true"
          className="w-full px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 md:py-6"
          role="list"
        >
          {session.messages.map((message, index) => (
            <div
              key={message.id}
              className="w-full max-w-7xl mx-auto"
              role="listitem"
              aria-setsize={session.messages.length}
              aria-posinset={index + 1}
              data-message-index={index}
            >
              <Message
                message={message}
                sessionTitle={session.title}
                prevMessage={index > 0 ? session.messages[index - 1] : undefined}
                messageIndex={index}
                onEditMessage={noop}
                onDeleteMessage={noop}
                onRetryMessage={noop}
                onImageClick={noop}
                onOpenHtmlPreview={noop}
                showThoughts={session.settings.showThoughts}
                themeColors={theme.colors}
                themeId={theme.id}
                baseFontSize={appSettings.baseFontSize}
                expandCodeBlocksByDefault={appSettings.expandCodeBlocksByDefault}
                isMermaidRenderingEnabled={appSettings.isMermaidRenderingEnabled}
                isGraphvizRenderingEnabled={appSettings.isGraphvizRenderingEnabled ?? false}
                onTextToSpeech={noop}
                onGenerateCanvas={noop}
                ttsMessageId={null}
                t={translate}
                appSettings={effectiveAppSettings}
                onOpenSidePanel={noop}
                isGemini3={supportsPerPartResolution}
                isThoughtsExpanded={true}
                onThoughtsExpandedChange={noop}
                suppressEntranceAnimation={true}
              />
            </div>
          ))}
        </div>,
      );
    });

    const content = host.querySelector<HTMLElement>('[data-chat-export-content="true"]');
    if (!content) throw new Error('Failed to render chat export content.');

    await waitForPendingExportContent(content);
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForNextPaint();

    return {
      content,
      remove: () => {
        root.unmount();
        host.remove();
      },
    };
  } catch (error) {
    root.unmount();
    host.remove();
    throw error;
  }
};
