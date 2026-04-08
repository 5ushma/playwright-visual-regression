import { expect, test } from '@playwright/test';

test.describe('Real workflow with visual regression', () => {
  test('todo workflow visual validation', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');

    const input = page.getByPlaceholder('What needs to be done?');

    await input.fill('Analyze blueprint');
    await input.press('Enter');

    await input.fill('Compare structures');
    await input.press('Enter');

    await input.fill('Export results');
    await input.press('Enter');

    await expect(page.locator('.todo-list li')).toHaveCount(3);

    await page.locator('.todo-list li input.toggle').first().check();

    await expect(page).toHaveScreenshot('workflow-initial.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01
    });

    await page.getByRole('link', { name: 'Active' }).click();

    await expect(page).toHaveScreenshot('workflow-active-filter.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01
    });

    await page.getByRole('link', { name: 'Completed' }).click();

    await expect(page).toHaveScreenshot('workflow-completed-filter.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01
    });

    await expect(page.locator('.todo-list li')).toHaveCount(1);
  });
});