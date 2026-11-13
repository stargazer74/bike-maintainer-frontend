import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { FakeBackend } from './fake-backend';

/**
 * Every scenario gets its own fake backend, attached to the page before the first step. After the scenario it
 * checks that the app called no endpoint the fake does not know – otherwise the scenario would pass against a
 * 501 answer without anyone noticing.
 */
export const test = base.extend<{ backend: FakeBackend }>({
  backend: async ({ page }, use) => {
    const backend = new FakeBackend();
    await backend.attach(page);
    await use(backend);
    expect(backend.unhandled, 'API calls the FakeBackend does not implement').toEqual([]);
  },
});

export const { Given, When, Then } = createBdd(test);
