import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Language, OperatingMode, UserRole } from '../api-client';
import { AppConfigStore } from '../config/app-config-store';
import { authGuard, guestGuard, householdOnlyGuard, portalOnlyGuard } from './auth-guards';
import { AuthStore } from './auth-store';

@Component({ template: 'page' })
class Page {}

describe('auth guards', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        provideRouter([
          { path: 'anmelden', component: Page, canMatch: [portalOnlyGuard, guestGuard] },
          { path: 'person-waehlen', component: Page, canMatch: [householdOnlyGuard, guestGuard] },
          { path: '', canMatch: [authGuard], children: [{ path: '**', component: Page }] },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  async function logIn(): Promise<void> {
    const loaded = TestBed.inject(AuthStore).load();
    TestBed.inject(HttpTestingController).expectOne('http://localhost/api/v1/auth/me').flush({
      id: 1,
      email: 'a@example.com',
      role: UserRole.User,
      language: Language.De,
      active: true,
      emailVerified: true,
      createdAt: '2026-10-09T12:00:00Z',
    });
    await loaded;
  }

  it('redirects logged-out users to the login page with the requested URL', async () => {
    await harness.navigateByUrl('/fahrzeuge/3?tab=log');

    expect(router.url).toBe('/anmelden?returnUrl=%2Ffahrzeuge%2F3%3Ftab%3Dlog');
  });

  it('lets logged-in users through', async () => {
    await logIn();
    await harness.navigateByUrl('/fahrzeuge/3');

    expect(router.url).toBe('/fahrzeuge/3');
  });

  it('shows the login page to logged-out users', async () => {
    await harness.navigateByUrl('/anmelden');

    expect(router.url).toBe('/anmelden');
  });

  it('sends logged-in users away from the login page to the dashboard', async () => {
    await logIn();
    await harness.navigateByUrl('/anmelden');

    expect(router.url).toBe('/dashboard');
  });

  describe('in household mode', () => {
    beforeEach(async () => {
      const loaded = TestBed.inject(AppConfigStore).load();
      TestBed.inject(HttpTestingController)
        .expectOne('http://localhost/api/v1/config')
        .flush({ mode: OperatingMode.Household });
      await loaded;
    });

    it('redirects users without a profile to the profile selection with the requested URL', async () => {
      await harness.navigateByUrl('/fahrzeuge/3');

      expect(router.url).toBe('/person-waehlen?returnUrl=%2Ffahrzeuge%2F3');
    });

    it('has no login page', async () => {
      await harness.navigateByUrl('/anmelden');

      expect(router.url).toBe('/person-waehlen?returnUrl=%2Fanmelden');
    });

    it('shows the profile selection to users without a profile', async () => {
      await harness.navigateByUrl('/person-waehlen');

      expect(router.url).toBe('/person-waehlen');
    });

    it('sends users with a profile away from the profile selection to the dashboard', async () => {
      await logIn();
      await harness.navigateByUrl('/person-waehlen');

      expect(router.url).toBe('/dashboard');
    });
  });

  it('has no profile selection in portal mode', async () => {
    await harness.navigateByUrl('/person-waehlen');

    expect(router.url).toBe('/anmelden?returnUrl=%2Fperson-waehlen');
  });
});
