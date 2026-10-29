import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from '../altcha/altcha';
import { AltchaStub } from '../altcha/altcha-stub';
import { ResendVerification } from './resend-verification';

const RESEND_URL = 'http://localhost/api/v1/auth/verify-email/resend';
const SENT_TEXT = 'Falls zu dieser Adresse ein unbestätigtes Konto gehört';

describe('ResendVerification', () => {
  let fixture: ComponentFixture<ResendVerification>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    }).overrideComponent(ResendVerification, {
      remove: { imports: [Altcha] },
      add: { imports: [AltchaStub] },
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResendVerification);
  });

  afterEach(() => httpMock.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function altcha(): AltchaStub {
    return fixture.debugElement.query((el) => el.componentInstance instanceof AltchaStub)
      .componentInstance as AltchaStub;
  }

  function setEmail(value: string): void {
    const input = page().querySelector<HTMLInputElement>('#resend-email')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    page().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** First render; ngModel writes the initial value asynchronously, so wait before typing. */
  async function render(): Promise<void> {
    fixture.detectChanges();
    await settle();
  }

  it('prefills the email and sends it with the ALTCHA payload', async () => {
    fixture.componentRef.setInput('email', 'new@example.org');
    await render();
    expect(page().querySelector<HTMLInputElement>('#resend-email')!.value).toBe('new@example.org');

    submit();
    const request = httpMock.expectOne(RESEND_URL);
    expect(request.request.body).toEqual({ email: 'new@example.org', altcha: 'solved-payload' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(page().textContent).toContain(SENT_TEXT);
    expect(page().querySelector('form')).toBeNull();
  });

  it('trims the email', async () => {
    await render();
    setEmail('  new@example.org ');
    submit();

    expect(httpMock.expectOne(RESEND_URL).request.body.email).toBe('new@example.org');
  });

  it('does not send without email or solved challenge', async () => {
    await render();
    submit();
    httpMock.expectNone(RESEND_URL);

    setEmail('new@example.org');
    altcha().payload.set(null);
    submit();
    httpMock.expectNone(RESEND_URL);
    await settle();
    expect(page().querySelector('.field__error')?.textContent).toContain('Bitte bestätige zuerst');
  });

  it('asks to confirm again and resets the widget when the solution was rejected', async () => {
    await render();
    setEmail('new@example.org');
    submit();
    httpMock
      .expectOne(RESEND_URL)
      .flush({ code: 'CAPTCHA_INVALID' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page().querySelector('.field__error')?.textContent).toContain('bitte bestätige erneut');
    expect(altcha().resets()).toBe(1);
  });

  it('explains the daily email limit', async () => {
    await render();
    setEmail('new@example.org');
    submit();
    httpMock
      .expectOne(RESEND_URL)
      .flush({ code: 'MAIL_QUOTA_EXCEEDED' }, { status: 429, statusText: 'Too Many Requests' });
    await settle();

    expect(page().querySelector('.field__error')?.textContent).toContain(
      'Heute können keine weiteren E-Mails versendet werden',
    );
  });
});
