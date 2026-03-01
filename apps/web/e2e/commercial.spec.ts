import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Commercial Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display quotes page', async ({ page }) => {
    await page.goto('/commercial/quotes');
    await expect(page.locator('h1, h2').first()).toContainText(/devis/i);
  });

  test('should display invoices page', async ({ page }) => {
    await page.goto('/commercial/invoices');
    await expect(page.locator('h1, h2').first()).toContainText(/facture/i);
  });

  test('should display attachments page', async ({ page }) => {
    await page.goto('/commercial/attachments');
    await expect(page.locator('h1, h2').first()).toContainText(/attachement|situation/i);
  });

  test('should open create quote dialog', async ({ page }) => {
    await page.goto('/commercial/quotes');
    const createBtn = page.locator('button').filter({ hasText: /nouveau|créer|ajouter/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });
});
