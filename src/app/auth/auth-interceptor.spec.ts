import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { Language, OperatingMode, UserRole } from '../api-client';
import { AppConfigStore } from '../config/app-config-store';
import { authInterceptor } from './auth-interceptor';
import { AuthStore } from './auth-store';

@Component({ template: 'page' })
class Page {}

const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let store: AuthStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Page }]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    store = TestBed.inject(AuthStore);

    const loaded = store.load();
    httpMock.expectOne('http://localhost/api/v1/auth/me').flush({
      id: 1,
      email: 'a@example.com',
      role: UserRole.User,
      language: Language.De,
      active: true,
      emailVerified: true,
      createdAt: '2026-10-09T12:00:00Z',
    });
    await loaded;

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/fahrzeuge/3');
  });

  afterEach(() => httpMock.verify());

  /** Sends a request, answers it with `status` and waits until the error has passed the interceptor. */
  async function failRequest(url: string, status = UNAUTHORIZED): Promise<void> {
    const response = firstValueFrom(http.get(url)).catch(() => undefined);
    httpMock.expectOne(url).flush(null, status);
    await response;
    // Let a redirect triggered by the interceptor finish.
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('on 401 clears the user and sends them to the login page with the current URL', async () => {
    await failRequest('/api/v1/vehicles');

    expect(store.isLoggedIn()).toBe(false);
    expect(router.url).toBe('/anmelden?returnUrl=%2Ffahrzeuge%2F3');
  });

  it('in household mode sends them to the profile selection instead', async () => {
    const loaded = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne('http://localhost/api/v1/config').flush({ mode: OperatingMode.Household });
    await loaded;

    await failRequest('/api/v1/vehicles');

    expect(router.url).toBe('/person-waehlen?returnUrl=%2Ffahrzeuge%2F3');
  });

  it('passes the error on to the caller', async () => {
    const response = firstValueFrom(http.get('/api/v1/vehicles'));
    httpMock.expectOne('/api/v1/vehicles').flush(null, UNAUTHORIZED);

    await expect(response).rejects.toMatchObject({ status: 401 });
  });

  it('leaves a failed login to the login page', async () => {
    await failRequest('/api/v1/auth/login');

    expect(store.isLoggedIn()).toBe(true);
    expect(router.url).toBe('/fahrzeuge/3');
  });

  it('leaves the start-up check of GET /auth/me alone', async () => {
    await failRequest('/api/v1/auth/me');

    expect(router.url).toBe('/fahrzeuge/3');
  });

  it('leaves a logout of an expired session to the logout handler', async () => {
    const response = firstValueFrom(http.post('/api/v1/auth/logout', null)).catch(() => undefined);
    httpMock.expectOne('/api/v1/auth/logout').flush(null, UNAUTHORIZED);
    await response;
    await new Promise((resolve) => setTimeout(resolve));

    expect(router.url).toBe('/fahrzeuge/3');
  });

  it('ignores other errors', async () => {
    await failRequest('/api/v1/vehicles', { status: 500, statusText: 'Server Error' });

    expect(store.isLoggedIn()).toBe(true);
    expect(router.url).toBe('/fahrzeuge/3');
  });
});
