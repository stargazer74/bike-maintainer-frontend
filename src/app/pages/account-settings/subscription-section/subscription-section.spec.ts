import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  AccessStatus,
  Currency,
  Language,
  OperatingMode,
  UserResponse,
  UserRole,
} from '../../../api-client';
import { AppConfigStore } from '../../../config/app-config-store';
import { AuthStore } from '../../../auth/auth-store';
import { LanguageService } from '../../../i18n/language';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import {
  LEAVE_APP,
  PAID_POLL_INTERVAL_MS,
  PAID_POLLS,
  SubscriptionSection,
} from './subscription-section';

const ME_URL = 'http://localhost/api/v1/auth/me';
const CONFIG_URL = 'http://localhost/api/v1/config';
const CHECKOUT_URL = 'http://localhost/api/v1/subscription/checkout';
const PORTAL_URL = 'http://localhost/api/v1/subscription/customer-portal';

const USER: UserResponse = {
  id: 1,
  email: 'rider@example.org',
  role: UserRole.User,
  language: Language.De,
  currency: Currency.Eur,
  active: true,
  emailVerified: true,
  createdAt: '2026-10-09T12:00:00Z',
  accessStatus: AccessStatus.Trial,
  accessUntil: '2026-11-20',
  hasSubscription: false,
};

describe('SubscriptionSection', () => {
  let httpMock: HttpTestingController;
  let assign: ReturnType<typeof vi.fn>;

  async function render(
    user: Partial<UserResponse>,
    url = '/konto',
    config: object | null = null,
  ): Promise<HTMLElement> {
    localStorage.clear();
    assign = vi.fn();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([{ path: 'konto', component: SubscriptionSection }]),
        { provide: LEAVE_APP, useFactory: () => assign },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    await TestBed.inject(LanguageService).use('de', false);
    if (config) {
      const configLoaded = TestBed.inject(AppConfigStore).load();
      httpMock.expectOne(CONFIG_URL).flush(config);
      await configLoaded;
    }
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne(ME_URL).flush({ ...USER, ...user });
    await loaded;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return harness.routeNativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  it('shows the trial with its last day and offers the subscription', async () => {
    const element = await render({});

    expect(element.textContent).toContain('Kostenlose Testphase bis 20.11.2026');
    expect(element.querySelector('.subscription__buy')).not.toBeNull();
    expect(element.querySelector('.subscription__manage')).toBeNull();
    expect(element.textContent).not.toMatch(/€|EUR/);
  });

  it('leaves for the checkout page of the provider', async () => {
    const element = await render({});

    element.querySelector<HTMLButtonElement>('.subscription__buy')!.click();
    const request = httpMock.expectOne(CHECKOUT_URL);
    expect(request.request.method).toBe('POST');
    request.flush({ url: 'https://polar.sh/checkout/1' });

    expect(assign).toHaveBeenCalledWith('https://polar.sh/checkout/1');
  });

  it('explains when the provider cannot be reached', async () => {
    const element = await render({ accessStatus: AccessStatus.Expired, accessUntil: undefined });

    element.querySelector<HTMLButtonElement>('.subscription__buy')!.click();
    httpMock.expectOne(CHECKOUT_URL).flush(null, { status: 503, statusText: 'Unavailable' });
    await TestBed.inject(Router).navigated;
    TestBed.tick();

    expect(element.textContent).toContain('Testphase bzw. Abo abgelaufen');
    expect(element.querySelector('[role=alert]')?.textContent).toContain('nicht erreichbar');
    expect(assign).not.toHaveBeenCalled();
  });

  it('reloads the user when a subscription is already active', async () => {
    const element = await render({});

    element.querySelector<HTMLButtonElement>('.subscription__buy')!.click();
    httpMock.expectOne(CHECKOUT_URL).flush(null, { status: 409, statusText: 'Conflict' });
    httpMock.expectOne(ME_URL).flush({ ...USER, accessStatus: AccessStatus.Active });
    TestBed.tick();

    expect(element.querySelector('[role=alert]')?.textContent).toContain('bereits ein aktives Abo');
    expect(element.querySelector('.subscription__buy')).toBeNull();
  });

  it('opens the customer portal of an active subscription', async () => {
    const element = await render({
      accessStatus: AccessStatus.Active,
      accessUntil: '2027-11-12',
      hasSubscription: true,
    });

    expect(element.textContent).toContain('bezahlt bis 12.11.2027');
    expect(element.querySelector('.subscription__buy')).toBeNull();
    element.querySelector<HTMLButtonElement>('.subscription__manage')!.click();
    httpMock.expectOne(PORTAL_URL).flush({ url: 'https://polar.sh/portal/1' });

    expect(assign).toHaveBeenCalledWith('https://polar.sh/portal/1');
  });

  it('shows unlimited access for administrators', async () => {
    const element = await render({ accessStatus: AccessStatus.Full, accessUntil: undefined });

    expect(element.textContent).toContain('Unbegrenzter Zugang');
    expect(element.querySelector('.subscription__buy')).toBeNull();
  });

  it('back from the payment: waits until the subscription is active', async () => {
    vi.useFakeTimers();
    const rendering = render({}, '/konto?abo=danke');
    await vi.runOnlyPendingTimersAsync();
    const element = await rendering;

    expect(element.textContent).toContain('wird freigeschaltet');
    httpMock.expectOne(ME_URL).flush(USER);
    await vi.advanceTimersByTimeAsync(PAID_POLL_INTERVAL_MS);
    httpMock.expectOne(ME_URL).flush({ ...USER, accessStatus: AccessStatus.Active });
    TestBed.tick();

    expect(element.textContent).toContain('Dein Abo ist aktiv');
    await vi.advanceTimersByTimeAsync(PAID_POLL_INTERVAL_MS * PAID_POLLS);
    httpMock.expectNone(ME_URL);
    expect(TestBed.inject(Router).url).toBe('/konto');
  });

  describe('cancellation link (§ 312k BGB)', () => {
    const portal = { mode: OperatingMode.Portal, websiteUrl: 'https://www.example.com/' };

    it('links to the cancellation form of the website', async () => {
      const element = await render(
        { accessStatus: AccessStatus.Active, hasSubscription: true },
        '/konto',
        portal,
      );

      const link = element.querySelector<HTMLAnchorElement>('.subscription__cancel-link');
      expect(link?.textContent?.trim()).toBe('Verträge hier kündigen');
      expect(link?.getAttribute('href')).toBe('https://www.example.com/kuendigen/');
    });

    it('is also there during the trial', async () => {
      const element = await render({}, '/konto', portal);

      expect(element.querySelector('.subscription__cancel-link')).not.toBeNull();
    });

    it('is missing without a website', async () => {
      const element = await render({}, '/konto', { mode: OperatingMode.Portal });

      expect(element.querySelector('.subscription__cancel-link')).toBeNull();
    });

    it('is missing in household mode', async () => {
      const element = await render({ accessStatus: AccessStatus.Full }, '/konto', {
        mode: OperatingMode.Household,
        websiteUrl: 'https://www.example.com',
      });

      expect(element.querySelector('.subscription__cancel-link')).toBeNull();
    });

    it('is missing for full access without a contract', async () => {
      const element = await render({ accessStatus: AccessStatus.Full }, '/konto', portal);

      expect(element.querySelector('.subscription__cancel-link')).toBeNull();
    });
  });
});
