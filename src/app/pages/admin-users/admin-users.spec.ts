import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AccessStatus, Currency, Language, UserResponse, UserRole } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import '../../i18n/i18n.config';
import { LanguageService } from '../../i18n/language';
import { translocoTesting } from '../../i18n/testing';
import { AdminUsers } from './admin-users';

const USERS_URL = 'http://localhost/api/v1/admin/users';

function user(id: number, email: string, role: UserRole, active = true): UserResponse {
  return {
    id,
    email,
    role,
    active,
    emailVerified: true,
    language: Language.De,
    currency: Currency.Eur,
    createdAt: '2026-10-01T10:00:00Z',
    accessStatus: AccessStatus.Trial,
    hasSubscription: false,
  };
}

const ADMIN = user(1, 'admin@example.org', UserRole.Admin);
const RIDER = user(7, 'rider@example.org', UserRole.User);

describe('AdminUsers', () => {
  let fixture: ComponentFixture<AdminUsers>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    await TestBed.inject(LanguageService).use('de', false);
    const loaded = TestBed.inject(AuthStore).load();
    httpMock.expectOne('http://localhost/api/v1/auth/me').flush(ADMIN);
    await loaded;
    fixture = TestBed.createComponent(AdminUsers);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    httpMock.verify();
  });

  async function load(users: UserResponse[]): Promise<HTMLElement> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      request = httpMock.expectOne({ method: 'GET', url: USERS_URL });
    });
    request!.flush(users);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function row(element: HTMLElement, email: string): HTMLElement {
    return Array.from(element.querySelectorAll<HTMLElement>('.admin-users__row')).find((r) =>
      r.textContent?.includes(email),
    )!;
  }

  async function confirm(): Promise<void> {
    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    dialogRef.componentRef!.changeDetectorRef.detectChanges();
    document.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.click();
  }

  async function patchRequest(id: number): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request = httpMock.expectOne({ method: 'PATCH', url: `${USERS_URL}/${id}` });
    });
    return request!;
  }

  it('lists email, role, status and registration date', async () => {
    const element = await load([ADMIN, user(7, 'rider@example.org', UserRole.User, false)]);

    const rider = row(element, 'rider@example.org');
    expect(rider.textContent).toContain('Nutzer');
    expect(rider.textContent).toContain('Gesperrt');
    expect(rider.textContent).toContain('01.10.2026');
    expect(row(element, 'admin@example.org').textContent).toContain('Admin');
  });

  it('offers no way to deactivate yourself', async () => {
    const element = await load([ADMIN, RIDER]);

    expect(
      row(element, 'admin@example.org').querySelector('.admin-users__toggle-active'),
    ).toBeNull();
    expect(
      row(element, 'rider@example.org').querySelector('.admin-users__toggle-active'),
    ).not.toBeNull();
  });

  it('deactivates a user after confirmation and reloads the list', async () => {
    const element = await load([ADMIN, RIDER]);

    row(element, 'rider@example.org')
      .querySelector<HTMLButtonElement>('.admin-users__toggle-active')!
      .click();
    await confirm();
    const request = await patchRequest(7);
    expect(request.request.body).toEqual({ active: false });
    request.flush(user(7, 'rider@example.org', UserRole.User, false));
    const reloaded = await load([ADMIN, user(7, 'rider@example.org', UserRole.User, false)]);

    expect(row(reloaded, 'rider@example.org').textContent).toContain('Gesperrt');
  });

  it('makes a user an admin after confirmation', async () => {
    const element = await load([ADMIN, RIDER]);

    row(element, 'rider@example.org')
      .querySelector<HTMLButtonElement>('.admin-users__toggle-role')!
      .click();
    await confirm();
    const request = await patchRequest(7);
    expect(request.request.body).toEqual({ role: UserRole.Admin });
    request.flush(user(7, 'rider@example.org', UserRole.Admin));
    await load([ADMIN, user(7, 'rider@example.org', UserRole.Admin)]);
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    const element = await load([ADMIN, RIDER]);

    row(element, 'rider@example.org')
      .querySelector<HTMLButtonElement>('.admin-users__toggle-active')!
      .click();
    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    dialogRef.componentRef!.changeDetectorRef.detectChanges();
    document.querySelector<HTMLButtonElement>('.confirm-dialog__cancel')!.click();
    await fixture.whenStable();

    httpMock.expectNone({ method: 'PATCH' });
  });

  it('explains a rejected change (last admin)', async () => {
    const element = await load([ADMIN, RIDER]);

    row(element, 'admin@example.org')
      .querySelector<HTMLButtonElement>('.admin-users__toggle-role')!
      .click();
    await confirm();
    (await patchRequest(1)).flush(null, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.admin-users__error')?.textContent).toContain(
      'letzte aktive Admin',
    );
  });

  it('shows an error when the list cannot be loaded', async () => {
    httpMock.expectOne(USERS_URL).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.admin-users__error')?.textContent,
    ).toContain('Das hat nicht geklappt');
  });
});
