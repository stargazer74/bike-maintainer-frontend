import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { Language, UserRole } from './api-client';
import { App } from './app';
import { routes } from './app.routes';
import { AuthStore } from './auth/auth-store';
import { translocoTesting } from './i18n/testing';
import './i18n/i18n.config';

const VEHICLES_URL = 'http://localhost/api/v1/vehicles';

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

  /** Renders the app at `url`, answering the vehicle list requests (shell and page) with `vehicles`. */
  async function render(url: string, vehicles: unknown[] = []): Promise<ComponentFixture<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.autoDetectChanges();
    await router.navigateByUrl(url);
    // The lazily loaded page sends its own request a tick after the shell's.
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      httpMock.match(VEHICLES_URL).forEach((request) => request.flush(vehicles));
    }
    await fixture.whenStable();
    return fixture;
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sends logged-out users to the login page and loads no vehicles', async () => {
    const page = (await render('/fahrzeuge')).nativeElement as HTMLElement;

    expect(router.url).toBe('/anmelden?returnUrl=%2Ffahrzeuge');
    expect(page.textContent).toContain('Bike Maintainer');
    expect(page.querySelector('#login-email')).not.toBeNull();
    expect(page.textContent).not.toContain('Bike hinzufügen');
    httpMock.expectNone(VEHICLES_URL);
  });

  it('shows the vehicle selection and the user menu when logged in', async () => {
    await logIn();
    const page = (await render('/fahrzeuge')).nativeElement as HTMLElement;

    expect(router.url).toBe('/fahrzeuge');
    expect(page.textContent).toContain('Bike hinzufügen');
    expect(page.querySelector('.shell__user-button')?.getAttribute('aria-label')).toBe(
      'Benutzermenü',
    );
  });

  it('logs out, hides the vehicle data and shows the login page', async () => {
    await logIn();
    const fixture = await render('/fahrzeuge', [{ id: 7, name: 'Tenere' }]);
    const page = fixture.nativeElement as HTMLElement;

    page.querySelector<HTMLButtonElement>('.shell__user-button')!.click();
    await fixture.whenStable();
    const logout = document.querySelector<HTMLButtonElement>('.shell__logout')!;
    expect(document.querySelector('.shell__user-email')?.textContent).toContain('admin@example.com');
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
});
