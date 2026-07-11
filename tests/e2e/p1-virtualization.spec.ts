import { expect, test } from '@playwright/test';

test('1000 messages stay virtualized and the streaming tail remains mounted', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('AllModelChatDB', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const messages = Array.from({ length: 1000 }, (_, index) => ({
      id: `virtual-message-${index}`,
      role: index % 2 === 0 ? 'user' : 'model',
      content: index === 999 ? 'TAIL_STREAMING_MARKER' : `Message ${index}`,
      timestamp: new Date(Date.now() + index),
      isLoading: index === 999,
    }));
    const session = {
      id: 'virtual-session',
      title: 'Virtualized session',
      timestamp: Date.now(),
      updatedAt: Date.now(),
      messages,
      settings: {
        modelId: 'gemini-3.1-pro-preview', temperature: 1, topP: 0.95, showThoughts: true,
        systemInstruction: '', ttsVoice: 'Zephyr', thinkingBudget: -1,
      },
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'keyValueStore'], 'readwrite');
      tx.objectStore('sessions').clear();
      tx.objectStore('sessions').put(session);
      tx.objectStore('keyValueStore').put('virtual-session', 'activeSessionId');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();
  await expect(page.getByText('TAIL_STREAMING_MARKER')).toBeAttached();
  const list = page.getByRole('list', { name: 'Chat messages' });
  await expect(list).toBeVisible();
  expect(await list.getByRole('listitem').count()).toBeLessThan(100);

  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
  const initialScrollTop = await list.evaluate(element => element.scrollTop);
  const upButton = page.getByRole('button', { name: 'Scroll to previous turn' });
  await expect(upButton).toBeVisible();
  await upButton.click();
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeLessThan(initialScrollTop - 10);
  await page.waitForTimeout(700);

  const afterUp = await list.evaluate(element => element.scrollTop);
  const downButton = page.getByRole('button', { name: 'Scroll to next turn or bottom' });
  await expect(downButton).toBeVisible();
  await downButton.click();
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(afterUp + 10);
  await page.waitForTimeout(700);

  await list.evaluate(element => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(300);
  expect(await list.getByRole('listitem').count()).toBeLessThan(100);
  await expect(page.getByText('TAIL_STREAMING_MARKER')).toBeAttached();
});
