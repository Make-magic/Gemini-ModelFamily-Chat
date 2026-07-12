import React from 'react';
import type { Components } from 'react-virtuoso';
import type { ChatMessage } from '../../../types';

export interface MessageListVirtuosoContext {
  streamingTail: ChatMessage | null;
  streamingIndex: number;
  renderMessage: (message: ChatMessage, index: number) => React.ReactNode;
  bottomPadding: string;
}

export const StreamingMessageFooter: React.FC<{ context: MessageListVirtuosoContext }> = React.memo(({ context }) => (
  <>
    {context.streamingTail && context.renderMessage(context.streamingTail, context.streamingIndex)}
    <div aria-hidden="true" style={{ height: context.bottomPadding }} />
  </>
));

export const VIRTUOSO_COMPONENTS: Components<ChatMessage, MessageListVirtuosoContext> = {
  Footer: StreamingMessageFooter,
};
