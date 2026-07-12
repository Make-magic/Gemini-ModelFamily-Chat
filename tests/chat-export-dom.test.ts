// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/message/Message', () => ({
  Message: ({ message }: { message: { id: string; role: string; content: string } }) => React.createElement(
    'article',
    { 'data-message-id': message.id, 'data-message-role': message.role },
    message.content,
  ),
}));

import { createChatExportDom } from '../utils/export/chatDom';

describe('chat export DOM', () => {
  afterEach(() => {
    document.querySelectorAll('[data-chat-export-host="true"]').forEach(element => element.remove());
  });

  it('renders every session message without a virtualized list', async () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'first question', timestamp: new Date() },
      { id: 'm1', role: 'model', content: 'first answer', timestamp: new Date() },
      { id: 'u2', role: 'user', content: 'last question', timestamp: new Date() },
      { id: 'm2', role: 'model', content: 'last answer', timestamp: new Date() },
    ];
    const result = await createChatExportDom({
      session: {
        id: 'session',
        title: 'Export test',
        messages,
        timestamp: Date.now(),
        groupId: null,
        settings: { modelId: 'gemini-3.1-pro-preview', showThoughts: true },
      } as never,
      appSettings: {
        baseFontSize: 16,
        expandCodeBlocksByDefault: false,
        isMermaidRenderingEnabled: true,
        isGraphvizRenderingEnabled: true,
      } as never,
      theme: {
        id: 'pearl',
        name: 'Pearl',
        colors: { bgPrimary: '#fff', textPrimary: '#111' },
      } as never,
      t: key => key,
    });

    expect(result.content.querySelectorAll('[data-message-id]')).toHaveLength(messages.length);
    expect(result.content.textContent).toContain('first question');
    expect(result.content.textContent).toContain('last answer');
    expect(result.content.querySelector('[data-virtuoso-scroller]')).toBeNull();

    result.remove();
    expect(document.querySelector('[data-chat-export-host="true"]')).toBeNull();
  });
});
