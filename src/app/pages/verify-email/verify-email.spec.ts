import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from '../../shared/altcha/altcha';
import { AltchaStub } from '../../shared/altcha/altcha-stub';
import { ResendVerification } from '../../shared/resend-verification/resend-verification';
import { VerifyEmail } from './verify-email';

const VERIFY_URL = 'http://localhost/api/v1/auth/verify-email';

describe('VerifyEmail', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'email-bestaetigen', component: VerifyEmail }],
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

  async function open(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    return harness.routeNativeElement!;
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('confirms the address from the link and offers the login', async () => {
    const page = await open('/email-bestaetigen?token=abc_DEF-123');

    const request = httpMock.expectOne(VERIFY_URL);
    expect(request.request.body).toEqual({ token: 'abc_DEF-123' });
    expect(page.textContent).toContain('wird bestätigt');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(page.textContent).toContain('Deine E-Mail-Adresse ist bestätigt.');
    expect(page.querySelector('a[href="/anmelden"]')).not.toBeNull();
    expect(page.querySelector('app-resend-verification')).toBeNull();
  });

  it('offers a new email for an invalid or expired link', async () => {
    const page = await open('/email-bestaetigen?token=expired');
    httpMock
      .expectOne(VERIFY_URL)
      .flush({ status: 400 }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page.textContent).toContain('Dieser Link ist ungültig oder abgelaufen.');
    expect(page.querySelector('app-resend-verification')).not.toBeNull();
  });

  it('treats a link without token as invalid without asking the backend', async () => {
    const page = await open('/email-bestaetigen');
    await settle();

    httpMock.expectNone(VERIFY_URL);
    expect(page.textContent).toContain('Dieser Link ist ungültig oder abgelaufen.');
  });
});
