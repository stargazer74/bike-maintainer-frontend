import { expect, type Page } from '@playwright/test';
import { Given, Then, When } from '../support/fixtures';

/**
 * Generic steps that act like a user: by visible text, labels and roles (German UI unless a scenario switches
 * the language), so a scenario reads like what someone does in the browser.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Buttons, links, menu entries and tabs with exactly this name. */
function clickable(page: Page, name: string) {
  const options = { name, exact: true };
  return page
    .getByRole('button', options)
    .or(page.getByRole('link', options))
    .or(page.getByRole('menuitem', options))
    .or(page.getByRole('tab', options));
}

// ---- navigation ----------------------------------------------------------------------------------

Given('I open the app', async ({ page }) => {
  await page.goto('/');
});

When('I open the page {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

When('I reload the page', async ({ page }) => {
  await page.reload();
});

// ---- input ---------------------------------------------------------------------------------------

When('I fill in {string} with {string}', async ({ page }, label: string, value: string) => {
  await page.getByLabel(label, { exact: true }).fill(value);
});

When('I select {string} in {string}', async ({ page }, option: string, label: string) => {
  await page.getByLabel(label, { exact: true }).selectOption({ label: option });
});

When('I check {string}', async ({ page }, label: string) => {
  await page.getByRole('checkbox', { name: label }).check();
});

When('I click {string}', async ({ page }, name: string) => {
  await clickable(page, name).click();
});

When('I open the tab {string}', async ({ page }, name: string) => {
  // Tab labels may carry a counter, e.g. "Wartungshistorie (1)".
  await page.getByRole('tab', { name: new RegExp('^' + escapeRegExp(name)) }).click();
});

When('I open the user menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Benutzermenü' }).click();
});

When('I switch the language to {string}', async ({ page }, code: string) => {
  await page.getByRole('button', { name: code.toUpperCase(), exact: true }).click();
});

When('I open the vehicle {string}', async ({ page }, name: string) => {
  await page.getByRole('link', { name: new RegExp(escapeRegExp(name)) }).click();
});

When('the captcha has been solved', async ({ page }) => {
  // The widget solves the proof of work on its own as soon as it is shown.
  await expect(page.locator('input[name="altcha"]')).toHaveValue(/.+/, { timeout: 15_000 });
});

// ---- expectations --------------------------------------------------------------------------------

Then('I am on the page {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path) + '(\\?.*)?$'));
});

Then('I see the heading {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible();
});

Then('I see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
});

Then('I do not see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
});

Then('I see the error {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
});

Then('I see a button {string}', async ({ page }, name: string) => {
  await expect(clickable(page, name)).toBeVisible();
});

Then('the dialog is closed', async ({ page }) => {
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

Then(
  'the dashboard card of {string} shows {string}',
  async ({ page }, vehicle: string, text: string) => {
    const card = page.locator('.vehicle-summary').filter({ hasText: vehicle });
    await expect(card).toContainText(text);
  },
);

Then('the task card {string} shows {string}', async ({ page }, task: string, text: string) => {
  const card = page.locator('.task-card').filter({ hasText: task });
  await expect(card).toContainText(text);
});

Then('I am on the page of the vehicle {string}', async ({ page, backend }, name: string) => {
  await expect(page).toHaveURL(new RegExp(`/fahrzeuge/${backend.vehicleByName(name).id}$`));
});
