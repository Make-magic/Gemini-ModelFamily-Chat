import { expect, test } from '@playwright/test';

test('deleting a session immediately persists a pending sync tombstone intent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('AllModelChatDB', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const session = {
      id: 'pending-delete-session',
      title: 'Pending delete session',
      timestamp: Date.now(),
      updatedAt: Date.now(),
      messages: [{ id: 'message-1', role: 'user', content: 'delete me', timestamp: new Date() }],
      settings: { modelId: 'gemini-3.1-pro-preview', temperature: 1, topP: 0.95, showThoughts: true },
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'keyValueStore'], 'readwrite');
      tx.objectStore('sessions').clear();
      tx.objectStore('sessions').put(session);
      tx.objectStore('keyValueStore').put(session.id, 'activeSessionId');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();
  const sessionItem = page.locator('li').filter({ hasText: 'Pending delete session' });
  await sessionItem.hover();
  await sessionItem.locator('button').last().click();
  await sessionItem.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(sessionItem).toHaveCount(0);

  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('AllModelChatDB', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ pending: boolean; sessionMissing: boolean }>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'keyValueStore'], 'readonly');
      const pendingRequest = tx.objectStore('keyValueStore').get('pendingSyncSessionDeletions');
      const sessionRequest = tx.objectStore('sessions').get('pending-delete-session');
      tx.oncomplete = () => resolve({
        pending: Boolean(pendingRequest.result?.['pending-delete-session']),
        sessionMissing: sessionRequest.result === undefined,
      });
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return result;
  })).toEqual({ pending: true, sessionMissing: true });
});
