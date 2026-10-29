import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '../../i18n/testing';
import { ResetPassword } from './reset-password';

@Component({ template: 'target' })
class Target {}

const CONFIRM_URL = 'http://localhost/api/v1/auth/password-reset/confirm';
const PASSWORD = 'brand-new-password';

describe('ResetPassword', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'passwort-zuruecksetzen', component: ResetPassword },
            { path: '**', component: Target },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  async function open(url = '/passwort-zuruecksetzen?token=abc_DEF-123'): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  function type(page: HTMLElement, id: string, value: string): void {
    const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fill(page: HTMLElement, password: string, repeat = password): void {
    type(page, 'reset-password', password);
    type(page, 'reset-password-repeat', repeat);
  }

  function submit(page: HTMLElement): void {
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function error(page: HTMLElement): string {
    return page.querySelector('.reset__error')?.textContent?.trim() ?? '';
  }

  it('sets the new password and continues to the login with a notice', async () => {
    const page = await open();
    fill(page, PASSWORD);
    submit(page);

    const request = httpMock.expectOne(CONFIRM_URL);
    expect(request.request.body).toEqual({ token: 'abc_DEF-123', newPassword: PASSWORD });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(TestBed.inject(Router).url).toBe('/anmelden?passwordReset=true');
  });

  it('offers a new link when the token is invalid, expired or used', async () => {
    const page = await open();
    fill(page, PASSWORD);
    submit(page);
    httpMock.expectOne(CONFIRM_URL).flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page.textContent).toContain('Dieser Link ist ungültig');
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('a[href="/passwort-vergessen"]')).not.toBeNull();
  });

  it('keeps the form when the server could not be reached', async () => {
    const page = await open();
    fill(page, PASSWORD);
    submit(page);
    httpMock.expectOne(CONFIRM_URL).flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(error(page)).toContain('Das hat nicht geklappt');
    expect(page.querySelector('form')).not.toBeNull();
  });

  it('shows the invalid link message without a token', async () => {
    const page = await open('/passwort-zuruecksetzen');

    httpMock.expectNone(CONFIRM_URL);
    expect(page.textContent).toContain('Dieser Link ist ungültig');
    expect(page.querySelector('form')).toBeNull();
  });

  it.each([
    ['too-short', 'too-short', 'Das Passwort muss 10 bis 72 Zeichen lang sein.'],
    ['ä'.repeat(40), 'ä'.repeat(40), 'Das Passwort ist zu lang'],
    [PASSWORD, PASSWORD + 'x', 'Die Passwörter stimmen nicht überein.'],
  ])('does not send an invalid password (%s / %s)', async (password, repeat, message) => {
    const page = await open();
    fill(page, password, repeat);
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(CONFIRM_URL);
    expect(error(page)).toContain(message);
  });
});
