import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Import Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display import page with entity selection', async ({ page }) => {
    await page.goto('/import');
    await expect(page.locator('h1, h2').first()).toContainText(/import/i);
  });

  test('should show upload step after selecting entity', async ({ page }) => {
    await page.goto('/import');
    // Select an entity type (e.g., clients)
    const entityOption = page.locator('button, [role="radio"]').filter({ hasText: /client/i });
    if (await entityOption.isVisible()) {
      await entityOption.click();
      // Should proceed to upload step
      await expect(page.locator('text=/upload|télécharger|fichier/i')).toBeVisible();
    }
  });
});
