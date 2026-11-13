import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { OperatingMode, VehicleType } from '../../src/app/api-client/model/models';
import { Given, Then } from '../support/fixtures';

/** Default password of seeded accounts; meets the backend rules (10–72 characters). */
export const DEFAULT_PASSWORD = 'Kette-und-Ritzel-42';

// ---- state of the fake backend -----------------------------------------------------------------

Given('the app runs in {word} mode', ({ backend }, mode: string) => {
  backend.mode = mode === 'household' ? OperatingMode.Household : OperatingMode.Portal;
});

Given('an account {string} exists', ({ backend }, email: string) => {
  backend.addAccount(email, DEFAULT_PASSWORD);
});

Given(
  'an account {string} with password {string} exists',
  ({ backend }, email: string, password: string) => {
    backend.addAccount(email, password);
  },
);

Given('an unverified account {string} exists', ({ backend }, email: string) => {
  backend.addAccount(email, DEFAULT_PASSWORD, { emailVerified: false });
});

Given('I am logged in as {string}', ({ backend }, email: string) => {
  if (!backend.accounts.some((account) => account.user.email === email)) {
    backend.addAccount(email, DEFAULT_PASSWORD);
  }
  backend.logIn(email);
});

Given('the household has the profiles:', ({ backend }, table: DataTable) => {
  for (const [name] of table.raw()) {
    backend.addProfile(name);
  }
});

Given(
  'a motorcycle {string} with {int} km exists',
  ({ backend }, name: string, mileage: number) => {
    backend.addVehicle({
      name,
      type: VehicleType.Motorcycle,
      modelYear: 2022,
      firstRegistrationDate: '2022-03-01',
      currentMileage: mileage,
    });
  },
);

Given(
  'the vehicle {string} has the task {string} every {int} km',
  ({ backend }, vehicle: string, task: string, intervalKm: number) => {
    backend.addTask(backend.vehicleByName(vehicle).id, { name: task, intervalKm });
  },
);

Given(
  'the vehicle {string} has the task {string} every {int} km, last done at {int} km on {string}',
  (
    { backend },
    vehicle: string,
    task: string,
    intervalKm: number,
    mileage: number,
    date: string,
  ) => {
    const vehicleId = backend.vehicleByName(vehicle).id;
    const created = backend.addTask(vehicleId, { name: task, intervalKm });
    backend.addLog(vehicleId, {
      performedAt: date,
      mileageAtPerformed: mileage,
      performedTaskIds: [created.id],
    });
  },
);

// ---- what the app sent ---------------------------------------------------------------------------

Then(
  'the backend received a registration for {string} in language {string}',
  ({ backend }, email: string, language: string) => {
    expect(backend.registrations).toEqual([{ email, language }]);
  },
);

Then('the backend received no registration', ({ backend }) => {
  expect(backend.registrations).toEqual([]);
});

Then('the account language was saved as {string}', async ({ backend }, language: string) => {
  await expect
    .poll(() => backend.lastRequest('PATCH', '/api/v1/auth/me')?.body)
    .toEqual({ language });
});

Then(
  'the backend stored a maintenance log for {string} at {int} km with the task {string}',
  ({ backend }, vehicle: string, mileage: number, taskName: string) => {
    const vehicleId = backend.vehicleByName(vehicle).id;
    const task = backend.tasks.find((t) => t.vehicleId === vehicleId && t.name === taskName);
    const log = backend.logs.find(
      (l) => l.vehicleId === vehicleId && l.mileageAtPerformed === mileage,
    );
    expect(task, `task ${taskName}`).toBeDefined();
    expect(log?.performedTaskIds).toEqual([task!.id]);
  },
);
