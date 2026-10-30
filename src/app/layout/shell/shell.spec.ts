import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Currency, Language, OperatingMode, UserResponse, UserRole } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { AppConfigStore } from '../../config/app-config-store';
import { translocoTesting } from '../../i18n/testing';
import { Shell } from './shell';

const ME_URL = 'http://localhost/api/v1/auth/me';
const CONFIG_URL = 'http://localhost/api/v1/config';
const VEHICLES_URL = 'http://localhost/api/v1/vehicles';

const USER: UserResponse = {
  id: 1,
  email: 'admin@example.com',
  role: UserRole.User,
  language: Language.De,
  currency: Currency.Eur,
  active: true,
  emailVerified: true,
  createdAt: '2026-10-09T12:00:00Z',
};

describe('Shell currency menu', () => {
  let httpMock: HttpTestingController;
  let element: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Shell>>;

  async function render(mode: OperatingMode): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne(CONFIG_URL).flush({ mode });
    await config;
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    fixture = TestBed.createComponent(Shell);
    element = fixture.nativeElement;
    fixture.detectChanges();
    httpMock.match(VEHICLES_URL).forEach((request) => request.flush([]));
    await fixture.whenStable();
  }

  async function openCurrencyMenu(): Promise<HTMLElement[]> {
    element.querySelector<HTMLElement>('.shell__user-button')!.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.shell__currency')!.click();
    await fixture.whenStable();
    return Array.from(document.querySelectorAll<HTMLElement>('.shell__currency-option'));
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  for (const mode of [OperatingMode.Portal, OperatingMode.Household]) {
    it(`lists the 9 currencies and marks the current one (${mode})`, async () => {
      await render(mode);
      const options = await openCurrencyMenu();

      expect(options.map((o) => o.dataset['currency'])).toEqual(Object.values(Currency));
      expect(options).toHaveLength(9);
      const checked = options.filter((o) => o.getAttribute('aria-checked') === 'true');
      expect(checked.map((o) => o.dataset['currency'])).toEqual(['EUR']);
      expect(options.every((o) => o.getAttribute('role') === 'menuitemradio')).toBe(true);
    });
  }

  it('shows the hint that the currency only applies to new entries', async () => {
    await render(OperatingMode.Portal);
    await openCurrencyMenu();

    expect(document.querySelector('.shell__currency-hint')?.textContent).toContain(
      'Gilt für neue Wartungseinträge',
    );
  });

  it('saves the chosen currency and marks it afterwards', async () => {
    await render(OperatingMode.Household);
    const options = await openCurrencyMenu();

    options.find((o) => o.dataset['currency'] === 'CHF')!.click();
    const request = httpMock.expectOne(ME_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ currency: 'CHF' });
    request.flush({ ...USER, currency: Currency.Chf });
    await fixture.whenStable();

    const again = await openCurrencyMenu();
    const checked = again.filter((o) => o.getAttribute('aria-checked') === 'true');
    expect(checked.map((o) => o.dataset['currency'])).toEqual(['CHF']);
  });
});
