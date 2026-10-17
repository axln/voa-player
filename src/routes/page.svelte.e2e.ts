import { expect, test } from '@playwright/test';

test('library lists episodes and opens the player', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Listen and read along.');
	await page.locator('a.card').first().click();
	await expect(page.locator('.transcript .word').first()).toBeVisible();
	await expect(page.locator('.dock')).toBeVisible();
});
