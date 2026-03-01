import { type Page } from '@playwright/test';

const TEST_USER = {
  email: 'admin@exeteam.fr',
  password: 'Test123!@#',
};

export async function login(page: Page, email?: string, password?: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email ?? TEST_USER.email);
  await page.fill('input[name="password"]', password ?? TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

export async function logout(page: Page) {
  // Click user menu and logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout"]');
  await page.waitForURL('**/login');
}

export { TEST_USER };
