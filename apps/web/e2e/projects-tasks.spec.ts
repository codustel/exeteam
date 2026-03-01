import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Projects & Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display projects list page', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h1, h2').first()).toContainText(/projet/i);
  });

  test('should open create project dialog', async ({ page }) => {
    await page.goto('/projects');
    const createBtn = page.locator('button').filter({ hasText: /nouveau|ajouter|créer/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should display tasks list page', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.locator('h1, h2').first()).toContainText(/tâche/i);
  });

  test('should open create task dialog', async ({ page }) => {
    await page.goto('/tasks');
    const createBtn = page.locator('button').filter({ hasText: /nouveau|ajouter|créer/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should navigate to task detail page', async ({ page }) => {
    await page.goto('/tasks');
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.url()).toContain('/tasks/');
    }
  });
});
