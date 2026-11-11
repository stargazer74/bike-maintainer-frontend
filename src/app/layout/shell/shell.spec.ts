import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
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

describe('Shell footer', () => {
  let httpMock: HttpTestingController;

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  async function render(config: object): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const loaded = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne(CONFIG_URL).flush(config);
    await loaded;

    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('links to website, legal notice and privacy policy', async () => {
    const element = await render({
      mode: OperatingMode.Portal,
      websiteUrl: 'https://www.example.com',
    });

    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.shell__footer-link'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.example.com/',
      'https://www.example.com/impressum/',
      'https://www.example.com/datenschutz/',
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Website',
      'Impressum',
      'Datenschutz',
    ]);
  });

  it('has no footer without a website', async () => {
    const element = await render({ mode: OperatingMode.Portal });

    expect(element.querySelector('.shell__footer')).toBeNull();
  });

  it('has no footer in household mode', async () => {
    const element = await render({
      mode: OperatingMode.Household,
      websiteUrl: 'https://www.example.com',
    });

    expect(element.querySelector('.shell__footer')).toBeNull();
  });
});

describe('Shell user management link', () => {
  async function userMenu(role: UserRole): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal });
    await config;
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne(ME_URL).flush({ ...USER, role });
    await loaded;
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    httpMock.match(VEHICLES_URL).forEach((request) => request.flush([]));
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('.shell__user-button')!
      .click();
    await fixture.whenStable();
    return document.body;
  }

  afterEach(() => localStorage.clear());

  it('is shown to admins', async () => {
    const body = await userMenu(UserRole.Admin);

    expect(body.querySelector('.shell__admin-users')?.textContent).toContain('Nutzerverwaltung');
  });

  it('is hidden from normal users', async () => {
    const body = await userMenu(UserRole.User);

    expect(body.querySelector('.shell__admin-users')).toBeNull();
  });
});

describe('Shell vehicle import', () => {
  let httpMock: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<Shell>>;

  async function render(): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal });
    await config;
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    httpMock.expectOne(VEHICLES_URL).flush([{ id: 3, name: 'Die Rote' }]);
    await fixture.whenStable();
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  async function chooseImport(): Promise<void> {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('.shell__user-button')!
      .click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.shell__import-vehicle')!.click();
  }

  it('opens the imported vehicle and reloads the vehicle list', async () => {
    await render();
    const dialog = TestBed.inject(MatDialog);
    const open = vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ id: 9, name: 'Die Rote' }),
    } as MatDialogRef<unknown>);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await chooseImport();

    expect(open.mock.calls[0][1]?.data).toEqual({ existingNames: ['Die Rote'] });
    TestBed.tick();
    httpMock.expectOne(VEHICLES_URL).flush([]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/fahrzeuge', 9]);
  });

  it('stays where it is when the import is cancelled', async () => {
    await render();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(undefined),
    } as MatDialogRef<unknown>);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await chooseImport();

    expect(navigate).not.toHaveBeenCalled();
  });
});
