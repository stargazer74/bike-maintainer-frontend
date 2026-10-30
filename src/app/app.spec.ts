import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { Language, OperatingMode, UserRole } from './api-client';
import { App } from './app';
import { routes } from './app.routes';
import { AuthStore } from './auth/auth-store';
import { AppConfigStore } from './config/app-config-store';
import { translocoTesting } from './i18n/testing';
import './i18n/i18n.config';

const VEHICLES_URL = 'http://localhost/api/v1/vehicles';
const VEHICLE_LISTS_URL = /\/api\/v1\/vehicles\/\d+\/maintenance-(tasks|logs)$/;

describe('App', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  async function logIn(): Promise<void> {
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne('http://localhost/api/v1/auth/me').flush({
      id: 1,
      email: 'admin@example.com',
      role: UserRole.Admin,
      language: Language.De,
      active: true,
      emailVerified: true,
      createdAt: '2026-10-09T12:00:00Z',
    });
    await loaded;
  }

  /**
   * Renders the app at `url`, answering the vehicle list requests (shell and page) with `vehicles` and
   * the dashboard's task and log requests per vehicle with empty lists.
   */
  async function render(url: string, vehicles: unknown[] = []): Promise<ComponentFixture<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.autoDetectChanges();
    await router.navigateByUrl(url);
    // The lazily loaded page sends its own request a tick after the shell's.
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      httpMock.match(VEHICLES_URL).forEach((request) => request.flush(vehicles));
      httpMock
        .match((request) => VEHICLE_LISTS_URL.test(request.url))
        .forEach((request) => request.flush([]));
    }
    await fixture.whenStable();
    return fixture;
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sends logged-out users to the login page and loads no vehicles', async () => {
    const page = (await render('/dashboard')).nativeElement as HTMLElement;

    expect(router.url).toBe('/anmelden?returnUrl=%2Fdashboard');
    expect(page.textContent).toContain('Bike Maintainer');
    expect(page.querySelector('#login-email')).not.toBeNull();
    expect(page.textContent).not.toContain('Bike hinzufügen');
    httpMock.expectNone(VEHICLES_URL);
  });

  it('shows the vehicle selection and the user menu when logged in', async () => {
    await logIn();
    const page = (await render('/dashboard')).nativeElement as HTMLElement;

    expect(router.url).toBe('/dashboard');
    expect(page.textContent).toContain('Bike hinzufügen');
    expect(page.querySelector('.shell__user-button')?.getAttribute('aria-label')).toBe(
      'Benutzermenü',
    );
  });

  it('logs out, hides the vehicle data and shows the login page', async () => {
    await logIn();
    const fixture = await render('/dashboard', [{ id: 7, name: 'Tenere' }]);
    const page = fixture.nativeElement as HTMLElement;

    page.querySelector<HTMLButtonElement>('.shell__user-button')!.click();
    await fixture.whenStable();
    const logout = document.querySelector<HTMLButtonElement>('.shell__logout')!;
    expect(document.querySelector('.shell__user-email')?.textContent).toContain(
      'admin@example.com',
    );
    logout.click();
    httpMock.expectOne('http://localhost/api/v1/auth/logout').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await fixture.whenStable();

    expect(router.url).toBe('/anmelden');
    expect(TestBed.inject(AuthStore).isLoggedIn()).toBe(false);
    expect(page.textContent).not.toContain('Bike hinzufügen');
    expect(page.querySelector('.shell__vehicle-select')).toBeNull();
  });

  it('switches the UI to English via the language switcher', async () => {
    const fixture = await render('/anmelden');
    const page = fixture.nativeElement as HTMLElement;

    const englishButton = [
      ...page.querySelectorAll<HTMLButtonElement>('.shell__language-option'),
    ].find((button) => button.textContent?.trim() === 'EN')!;
    englishButton.click();
    await fixture.whenStable();

    expect(page.textContent).toContain('Log in');
    expect(page.textContent).not.toContain('Anmelden');
    expect(englishButton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('bm.language')).toBe('en');
  });

  it('saves the language in the account when switching while logged in', async () => {
    await logIn();
    const fixture = await render('/dashboard');
    const page = fixture.nativeElement as HTMLElement;

    [...page.querySelectorAll<HTMLButtonElement>('.shell__language-option')]
      .find((button) => button.textContent?.trim() === 'EN')!
      .click();
    const request = httpMock.expectOne('http://localhost/api/v1/auth/me');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ language: 'en' });
    request.flush({ id: 1, role: UserRole.Admin, language: Language.En, createdAt: '' });
    await fixture.whenStable();

    expect(document.documentElement.lang).toBe('en');
    expect(TestBed.inject(AuthStore).currentUser()?.language).toBe(Language.En);
  });

  it('lets logged-out users open the registration', async () => {
    const page = (await render('/registrieren')).nativeElement as HTMLElement;

    expect(router.url).toBe('/registrieren');
    expect(page.querySelector('#register-email')).not.toBeNull();
  });

  it('sends logged-in users from the registration to the dashboard', async () => {
    await logIn();
    await render('/registrieren');

    expect(router.url).toBe('/dashboard');
  });

  it('confirms the email from the link without a session', async () => {
    const fixture = await render('/email-bestaetigen?token=abc');

    expect(router.url).toBe('/email-bestaetigen?token=abc');
    httpMock.expectOne('http://localhost/api/v1/auth/verify-email').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Deine E-Mail-Adresse ist bestätigt.',
    );
  });

  it('lets logged-out users request a new password', async () => {
    const page = (await render('/passwort-vergessen')).nativeElement as HTMLElement;

    expect(router.url).toBe('/passwort-vergessen');
    expect(page.querySelector('#forgot-email')).not.toBeNull();
  });

  it('opens the password reset link without a session', async () => {
    const page = (await render('/passwort-zuruecksetzen?token=abc')).nativeElement as HTMLElement;

    expect(router.url).toBe('/passwort-zuruecksetzen?token=abc');
    expect(page.querySelector('#reset-password')).not.toBeNull();
  });

  it('opens the account page from the user menu', async () => {
    await logIn();
    const fixture = await render('/dashboard');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.shell__user-button')!
      .click();
    await fixture.whenStable();
    document.querySelector<HTMLAnchorElement>('.shell__account')!.click();
    await fixture.whenStable();

    expect(router.url).toBe('/konto');
    expect(document.querySelector('#account-current-password')).not.toBeNull();
  });

  it('has no account page in household mode', async () => {
    const configLoaded = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne('http://localhost/api/v1/config').flush({ mode: OperatingMode.Household });
    await configLoaded;
    await logIn();
    const fixture = await render('/konto');

    expect(router.url).toBe('/dashboard');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.shell__user-button')!
      .click();
    await fixture.whenStable();
    expect(document.querySelector('.shell__account')).toBeNull();
  });

  it('shows that it waits for the server while the mode is unknown', async () => {
    vi.useFakeTimers();
    try {
      const config = TestBed.inject(AppConfigStore);
      const loaded = config.load();
      httpMock
        .expectOne('http://localhost/api/v1/config')
        .flush(null, { status: 502, statusText: 'Bad Gateway' });
      await vi.advanceTimersByTimeAsync(0);
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const page = fixture.nativeElement as HTMLElement;

      expect(page.querySelector('.shell__waiting')?.textContent).toContain(
        'Verbindung zum Server wird hergestellt',
      );

      await vi.advanceTimersByTimeAsync(3000);
      httpMock.expectOne('http://localhost/api/v1/config').flush({ mode: OperatingMode.Portal });
      await loaded;
      fixture.detectChanges();

      expect(page.querySelector('.shell__waiting')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
