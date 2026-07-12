// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  StreamingMessageFooter,
  type MessageListVirtuosoContext,
} from '../components/chat/message-list/StreamingMessageFooter';

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  while (roots.length) roots.pop()?.unmount();
  document.body.innerHTML = '';
});

const message = (content: string): ChatMessage => ({
  id: 'streaming-message',
  role: 'model',
  content,
  thoughts: 'reasoning',
  timestamp: new Date(),
  isLoading: true,
});

describe('streaming message footer', () => {
  it('updates streamed content without replacing the mounted message subtree', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    const renderMessage = (item: ChatMessage) => React.createElement(
      'details',
      { open: true, 'data-testid': 'streaming-details' },
      React.createElement('summary', null, 'Thoughts'),
      React.createElement('div', null, item.content),
    );
    const context = (item: ChatMessage): MessageListVirtuosoContext => ({
      streamingTail: item,
      streamingIndex: 1,
      renderMessage,
      bottomPadding: '160px',
    });

    await act(async () => root.render(React.createElement(StreamingMessageFooter, { context: context(message('first')) })));
    const mountedDetails = container.querySelector('details');
    expect(mountedDetails?.open).toBe(true);

    await act(async () => root.render(React.createElement(StreamingMessageFooter, { context: context(message('first second')) })));
    expect(container.querySelector('details')).toBe(mountedDetails);
    expect(container.textContent).toContain('first second');
    expect(mountedDetails?.open).toBe(true);
  });
});
