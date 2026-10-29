import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../../i18n/language';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from '../../shared/altcha/altcha';
import { AltchaStub } from '../../shared/altcha/altcha-stub';
import { Register } from './register';

@Component({ template: 'target' })
class Target {}

const REGISTER_URL = 'http://localhost/api/v1/auth/register';
const PASSWORD = 'correct-horse-battery';

describe('Register', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([
          { path: 'registrieren', component: Register },
          { path: '**', component: Target },
        ]),
      ],
    }).overrideComponent(Register, {
      remove: { imports: [Altcha] },
      add: { imports: [AltchaStub] },
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  async function open(): Promise<HTMLElement> {
    await harness.navigateByUrl('/registrieren');
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  function altcha(): AltchaStub {
    return harness.fixture.debugElement.query((el) => el.componentInstance instanceof AltchaStub)
      .componentInstance as AltchaStub;
  }

  function type(page: HTMLElement, id: string, value: string): void {
    const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fill(page: HTMLElement, email: string, password: string, repeat = password): void {
    type(page, 'register-email', email);
    type(page, 'register-password', password);
    type(page, 'register-password-repeat', repeat);
  }

  function submit(page: HTMLElement): void {
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function error(page: HTMLElement): string {
    return page.querySelector('.register__error')?.textContent?.trim() ?? '';
  }

  it('registers and asks to check the inbox', async () => {
    const page = await open();
    fill(page, '  new@example.org ', PASSWORD);
    submit(page);

    const request = httpMock.expectOne(REGISTER_URL);
    expect(request.request.body).toEqual({
      email: 'new@example.org',
      password: PASSWORD,
      language: 'de',
      altcha: 'solved-payload',
      website: '',
    });
    request.flush(null, { status: 202, statusText: 'Accepted' });
    await settle();

    expect(page.textContent).toContain('Bitte prüfe dein Postfach');
    expect(page.textContent).toContain('new@example.org');
    expect(page.querySelector('form')).toBeNull();
  });

  it('sends the active UI language', async () => {
    await TestBed.inject(LanguageService).use('en', false);
    const page = await open();
    fill(page, 'new@example.org', PASSWORD);
    submit(page);

    expect(httpMock.expectOne(REGISTER_URL).request.body.language).toBe('en');
  });

  it('sends the honeypot field unchanged', async () => {
    const page = await open();
    fill(page, 'new@example.org', PASSWORD);
    type(page, 'register-website', 'https://spam.example');
    submit(page);

    expect(httpMock.expectOne(REGISTER_URL).request.body.website).toBe('https://spam.example');
  });

  it('hides the honeypot from people', async () => {
    const page = await open();
    const honeypot = page.querySelector<HTMLElement>('.register__honeypot')!;

    expect(honeypot.getAttribute('aria-hidden')).toBe('true');
    const input = honeypot.querySelector<HTMLInputElement>('#register-website')!;
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it.each([
    ['', PASSWORD, PASSWORD, 'Bitte gib deine E-Mail-Adresse ein.'],
    ['new@example.org', 'too-short', 'too-short', 'Das Passwort muss 10 bis 72 Zeichen lang sein.'],
    [
      'new@example.org',
      'x'.repeat(73),
      'x'.repeat(73),
      'Das Passwort muss 10 bis 72 Zeichen lang sein.',
    ],
    ['new@example.org', 'ä'.repeat(40), 'ä'.repeat(40), 'Das Passwort ist zu lang'],
    ['new@example.org', PASSWORD, PASSWORD + 'x', 'Die Passwörter stimmen nicht überein.'],
  ])('does not send invalid input (%s / %s)', async (email, password, repeat, message) => {
    const page = await open();
    fill(page, email, password, repeat);
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(REGISTER_URL);
    expect(error(page)).toContain(message);
  });

  it('waits for the solved challenge', async () => {
    const page = await open();
    altcha().payload.set(null);
    fill(page, 'new@example.org', PASSWORD);
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(REGISTER_URL);
    expect(error(page)).toContain('Bitte bestätige zuerst');
  });

  it('resets the widget when the solution was rejected', async () => {
    const page = await open();
    fill(page, 'new@example.org', PASSWORD);
    submit(page);
    httpMock
      .expectOne(REGISTER_URL)
      .flush({ code: 'CAPTCHA_INVALID' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(error(page)).toContain('bitte bestätige erneut');
    expect(altcha().resets()).toBe(1);
    expect(page.querySelector('form')).not.toBeNull();
  });

  it.each([
    [429, 'MAIL_QUOTA_EXCEEDED', 'Heute können keine weiteren E-Mails versendet werden'],
    [429, undefined, 'Zu viele Versuche, bitte später erneut.'],
    [400, undefined, 'Bitte prüfe deine Eingaben.'],
    [500, undefined, 'Das hat nicht geklappt'],
  ])('shows an error for %s %s', async (status, code, message) => {
    const page = await open();
    fill(page, 'new@example.org', PASSWORD);
    submit(page);
    httpMock.expectOne(REGISTER_URL).flush(code ? { code } : null, { status, statusText: 'Error' });
    await settle();

    expect(error(page)).toContain(message);
  });

  it('links to the login page', async () => {
    const page = await open();

    expect(page.querySelector('a[href="/anmelden"]')?.textContent).toContain('Anmelden');
  });
});
