import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('mobile overflow menus, touch targets, keyboard access and field errors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Chat message input')).toBeVisible();

  const headerMore = page.locator('header').getByRole('button', { name: 'More actions' });
  await expect(headerMore).toBeVisible();
  const headerBox = await headerMore.boundingBox();
  expect(headerBox?.width).toBeGreaterThanOrEqual(44);
  expect(headerBox?.height).toBeGreaterThanOrEqual(44);

  await headerMore.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: /Pull from hub/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Push to hub/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await headerMore.click();

  const attach = page.getByRole('button', { name: 'Attach file menu' });
  const attachBox = await attach.boundingBox();
  expect(attachBox?.width).toBeGreaterThanOrEqual(44);
  expect(attachBox?.height).toBeGreaterThanOrEqual(44);
  await attach.click();
  await page.getByRole('menuitem', { name: 'Add by File ID' }).click();

  const fileId = page.getByLabel('File ID input');
  await fileId.fill('invalid-id');
  await fileId.blur();
  await expect(fileId).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await fileId.getAttribute('aria-describedby');
  expect(describedBy).toContain('add-file-id-error');
  await expect(page.locator('#add-file-id-error')).toBeVisible();

  const inputMore = page.locator('form').getByRole('button', { name: 'More actions' });
  await inputMore.click();
  await expect(page.getByRole('menuitem', { name: 'Scenario Presets' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Expand Input' })).toBeVisible();
});
