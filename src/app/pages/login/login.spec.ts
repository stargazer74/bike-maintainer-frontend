import { Component } from '@angular/core';
import { DeferBlockState, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Currency, Language, UserResponse, UserRole } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from '../../shared/altcha/altcha';
import { AltchaStub } from '../../shared/altcha/altcha-stub';
import { ResendVerification } from '../../shared/resend-verification/resend-verification';
import { Login } from './login';

@Component({ template: 'target' })
class Target {}

const LOGIN_URL = 'http://localhost/api/v1/auth/login';

const USER: UserResponse = {
  id: 1,
  email: 'admin@example.com',
  role: UserRole.Admin,
  language: Language.De,
  currency: Currency.Eur,
  active: true,
  emailVerified: true,
  createdAt: '2026-10-09T12:00:00Z',
};

describe('Login', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'anmelden', component: Login },
            { path: '**', component: Target },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).overrideComponent(ResendVerification, {
      remove: { imports: [Altcha] },
      add: { imports: [AltchaStub] },
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  async function open(url = '/anmelden'): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    return harness.routeNativeElement!;
  }

  function fill(page: HTMLElement, email: string, password: string): void {
    for (const [id, value] of [
      ['login-email', email],
      ['login-password', password],
    ]) {
      const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  function submit(page: HTMLElement): void {
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function loginFailsWith(status: number, code?: string): Promise<string> {
    const page = await open();
    fill(page, 'admin@example.com', 'secret');
    submit(page);
    httpMock
      .expectOne(LOGIN_URL)
      .flush(code ? { status, code } : null, { status, statusText: 'Error' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    return page.querySelector('.login__error')?.textContent?.trim() ?? '';
  }

  it('shows the login form in German', async () => {
    const page = await open();

    expect(page.textContent).toContain('E-Mail');
    expect(page.textContent).toContain('Passwort');
    expect(page.querySelector('button[type=submit]')?.textContent).toContain('Anmelden');
  });

  it('logs in and returns to the requested page', async () => {
    const page = await open('/anmelden?returnUrl=%2Ffahrzeuge%2F3');
    fill(page, 'admin@example.com', 'secret');
    submit(page);

    const request = httpMock.expectOne(LOGIN_URL);
    expect(request.request.body).toEqual({ email: 'admin@example.com', password: 'secret' });
    request.flush(USER);
    await harness.fixture.whenStable();

    expect(TestBed.inject(AuthStore).currentUser()).toEqual(USER);
    expect(TestBed.inject(Router).url).toBe('/fahrzeuge/3');
  });

  it('goes to the dashboard without a return URL', async () => {
    const page = await open();
    fill(page, 'admin@example.com', 'secret');
    submit(page);
    httpMock.expectOne(LOGIN_URL).flush(USER);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('ignores return URLs that lead to another site', async () => {
    const page = await open('/anmelden?returnUrl=%2F%2Fevil.example');
    fill(page, 'admin@example.com', 'secret');
    submit(page);
    httpMock.expectOne(LOGIN_URL).flush(USER);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('does not send the form while a field is empty', async () => {
    const page = await open();
    fill(page, 'admin@example.com', '');
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(LOGIN_URL);
    expect(page.querySelector('.login__error')?.textContent).toContain(
      'Bitte E-Mail und Passwort eingeben.',
    );
  });

  it('disables the button while logging in', async () => {
    const page = await open();
    fill(page, 'admin@example.com', 'secret');
    submit(page);
    harness.detectChanges();

    expect(page.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
    httpMock.expectOne(LOGIN_URL).flush(USER);
  });

  it('reports wrong credentials', async () => {
    expect(await loginFailsWith(401)).toBe('E-Mail oder Passwort falsch.');
  });

  it('reports a disabled account', async () => {
    expect(await loginFailsWith(403, 'ACCOUNT_DISABLED')).toBe('Dein Konto wurde gesperrt.');
  });

  it('reports an unverified email address', async () => {
    expect(await loginFailsWith(403, 'EMAIL_NOT_VERIFIED')).toBe(
      'Deine E-Mail-Adresse ist noch nicht bestätigt.',
    );
  });

  it('reports too many attempts', async () => {
    expect(await loginFailsWith(429)).toBe('Zu viele Versuche, bitte später erneut.');
  });

  it('reports other failures generically', async () => {
    expect(await loginFailsWith(500)).toBe(
      'Anmeldung fehlgeschlagen, bitte später erneut versuchen.',
    );
  });
  it('links to the registration', async () => {
    const page = await open();

    expect(page.querySelector('a[href="/registrieren"]')?.textContent).toContain('Konto anlegen');
  });

  it('links to the forgotten password page', async () => {
    const page = await open();

    expect(page.querySelector('a[href="/passwort-vergessen"]')?.textContent).toContain(
      'Passwort vergessen?',
    );
  });

  it('confirms a reset password', async () => {
    const page = await open('/anmelden?passwordReset=true');

    expect(page.querySelector('.login__notice')?.textContent).toContain(
      'Dein Passwort wurde geändert.',
    );
  });

  it('shows no notice on a normal visit', async () => {
    const page = await open();

    expect(page.querySelector('.login__notice')).toBeNull();
  });

  it('offers to resend the confirmation email for an unverified address', async () => {
    const page = await open();
    fill(page, 'new@example.org', 'secret');
    submit(page);
    httpMock
      .expectOne(LOGIN_URL)
      .flush({ status: 403, code: 'EMAIL_NOT_VERIFIED' }, { status: 403, statusText: 'Forbidden' });
    await harness.fixture.whenStable();
    harness.detectChanges();
    // The resend form is a deferred block (keeps ALTCHA out of the login chunk).
    for (const block of await harness.fixture.getDeferBlocks()) {
      await block.render(DeferBlockState.Complete);
    }
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page.querySelector('app-resend-verification')).not.toBeNull();
    expect(page.querySelector<HTMLInputElement>('#resend-email')!.value).toBe('new@example.org');
  });

  it('does not offer to resend for other login errors', async () => {
    await loginFailsWith(401);

    expect(harness.routeNativeElement!.querySelector('app-resend-verification')).toBeNull();
  });
});
