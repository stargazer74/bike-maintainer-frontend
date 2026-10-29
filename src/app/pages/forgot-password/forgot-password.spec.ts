import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from '../../shared/altcha/altcha';
import { AltchaStub } from '../../shared/altcha/altcha-stub';
import { ForgotPassword } from './forgot-password';

const REQUEST_URL = 'http://localhost/api/v1/auth/password-reset/request';

describe('ForgotPassword', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([{ path: 'passwort-vergessen', component: ForgotPassword }]),
      ],
    }).overrideComponent(ForgotPassword, {
      remove: { imports: [Altcha] },
      add: { imports: [AltchaStub] },
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  async function open(): Promise<HTMLElement> {
    await harness.navigateByUrl('/passwort-vergessen');
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  function altcha(): AltchaStub {
    return harness.fixture.debugElement.query((el) => el.componentInstance instanceof AltchaStub)
      .componentInstance as AltchaStub;
  }

  function type(page: HTMLElement, value: string): void {
    const input = page.querySelector<HTMLInputElement>('#forgot-email')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(page: HTMLElement): void {
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function error(page: HTMLElement): string {
    return page.querySelector('.forgot__error')?.textContent?.trim() ?? '';
  }

  it('requests the link and shows the same notice for every address', async () => {
    const page = await open();
    type(page, '  rider@example.org ');
    submit(page);

    const request = httpMock.expectOne(REQUEST_URL);
    expect(request.request.body).toEqual({ email: 'rider@example.org', altcha: 'solved-payload' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(page.textContent).toContain('Falls zu dieser Adresse ein Konto gehört');
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('a[href="/anmelden"]')).not.toBeNull();
  });

  it('needs an email address', async () => {
    const page = await open();
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(REQUEST_URL);
    expect(error(page)).toContain('Bitte gib deine E-Mail-Adresse ein.');
  });

  it('waits for the solved challenge', async () => {
    const page = await open();
    altcha().payload.set(null);
    type(page, 'rider@example.org');
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(REQUEST_URL);
    expect(error(page)).toContain('Bitte bestätige zuerst');
  });

  it.each([
    [400, 'CAPTCHA_INVALID', 'bitte bestätige erneut'],
    [429, 'MAIL_QUOTA_EXCEEDED', 'Heute können keine weiteren E-Mails versendet werden'],
    [429, undefined, 'Zu viele Versuche, bitte später erneut.'],
    [500, undefined, 'Das hat nicht geklappt'],
  ])('shows an error for %s %s and resets the widget', async (status, code, message) => {
    const page = await open();
    type(page, 'rider@example.org');
    submit(page);
    httpMock.expectOne(REQUEST_URL).flush(code ? { code } : null, { status, statusText: 'Error' });
    await settle();

    expect(error(page)).toContain(message);
    expect(altcha().resets()).toBe(1);
    expect(page.querySelector('form')).not.toBeNull();
  });
});
