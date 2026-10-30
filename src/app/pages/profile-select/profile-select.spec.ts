import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { Currency, Language, ProfileResponse, UserResponse, UserRole } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { translocoTesting } from '../../i18n/testing';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { ProfileSelect } from './profile-select';

@Component({ template: 'target' })
class Target {}

const PROFILES_URL = 'http://localhost/api/v1/profiles';

const PROFILES: ProfileResponse[] = [
  { id: 1, displayName: 'Admin' },
  { id: 2, displayName: 'Anna' },
];

const ANNA: UserResponse = {
  id: 2,
  displayName: 'Anna',
  role: UserRole.User,
  language: Language.De,
  currency: Currency.Eur,
  active: true,
  emailVerified: false,
  createdAt: '2026-10-26T12:00:00Z',
};

describe('ProfileSelect', () => {
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
            { path: 'person-waehlen', component: ProfileSelect },
            { path: '**', component: Target },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    httpMock.verify();
  });

  async function open(url = '/person-waehlen', profiles = PROFILES): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    httpMock.expectOne(PROFILES_URL).flush(profiles);
    await settle();
    return harness.routeNativeElement!;
  }

  /** Waits for pending work, renders, and lets ngModel write the new values into the inputs. */
  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  function card(page: HTMLElement, name: string): HTMLElement {
    const found = [...page.querySelectorAll<HTMLElement>('.profile')].find((element) =>
      element.querySelector('.profile__select')?.textContent?.includes(name),
    );
    if (!found) {
      throw new Error(`no profile card for ${name}`);
    }
    return found;
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /** Answers the confirmation dialog with `confirmed` and returns the spy to inspect how it was opened. */
  function answerConfirmation(confirmed: boolean) {
    return vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(confirmed) } as ReturnType<MatDialog['open']>);
  }

  function errorText(page: HTMLElement): string {
    return page.querySelector('.profile-select__error')?.textContent?.trim() ?? '';
  }

  it('shows the profiles', async () => {
    const page = await open();

    expect(page.textContent).toContain('Wer bist du?');
    expect([...page.querySelectorAll('.profile__name')].map((e) => e.textContent?.trim())).toEqual([
      'Admin',
      'Anna',
    ]);
  });

  it('selects a profile and returns to the requested page', async () => {
    const page = await open('/person-waehlen?returnUrl=%2Ffahrzeuge%2F3');
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__select')!.click();

    const request = httpMock.expectOne(`${PROFILES_URL}/2/select`);
    expect(request.request.method).toBe('POST');
    request.flush(ANNA);
    await settle();

    expect(TestBed.inject(AuthStore).currentUser()).toEqual(ANNA);
    expect(TestBed.inject(Router).url).toBe('/fahrzeuge/3');
  });

  it('goes to the dashboard without a safe return URL', async () => {
    const page = await open('/person-waehlen?returnUrl=%2F%2Fevil.example');
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__select')!.click();
    httpMock.expectOne(`${PROFILES_URL}/2/select`).flush(ANNA);
    await settle();

    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('adds a profile and reloads the list', async () => {
    const page = await open();
    type(page.querySelector<HTMLInputElement>('#profile-new-name')!, '  Ben ');
    await settle();
    page.querySelector<HTMLFormElement>('.profile-select__add')!.dispatchEvent(new Event('submit'));

    const request = httpMock.expectOne(PROFILES_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ displayName: 'Ben' });
    request.flush({ id: 3, displayName: 'Ben' });
    TestBed.tick();

    httpMock.expectOne(PROFILES_URL).flush([...PROFILES, { id: 3, displayName: 'Ben' }]);
    await settle();
    expect(page.textContent).toContain('Ben');
    expect(page.querySelector<HTMLInputElement>('#profile-new-name')!.value).toBe('');
  });

  it('does not add a profile without a name', async () => {
    const page = await open();
    type(page.querySelector<HTMLInputElement>('#profile-new-name')!, '   ');
    page.querySelector<HTMLFormElement>('.profile-select__add')!.dispatchEvent(new Event('submit'));
    await settle();

    httpMock.expectNone(PROFILES_URL);
    expect(errorText(page)).toBe('Bitte einen Namen eingeben.');
  });

  it('reports a name that is already taken', async () => {
    const page = await open();
    type(page.querySelector<HTMLInputElement>('#profile-new-name')!, 'anna');
    page.querySelector<HTMLFormElement>('.profile-select__add')!.dispatchEvent(new Event('submit'));
    httpMock.expectOne(PROFILES_URL).flush(null, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(errorText(page)).toBe('Dieser Name ist schon vergeben.');
  });

  it('renames a profile', async () => {
    const page = await open();
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__rename')!.click();
    await settle();
    const input = page.querySelector<HTMLInputElement>('.profile__name-input')!;
    expect(input.value).toBe('Anna');
    type(input, 'Anna-Lena');
    page.querySelector<HTMLFormElement>('.profile__edit')!.dispatchEvent(new Event('submit'));

    const request = httpMock.expectOne(`${PROFILES_URL}/2`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ displayName: 'Anna-Lena' });
    request.flush({ id: 2, displayName: 'Anna-Lena' });
    TestBed.tick();

    httpMock.expectOne(PROFILES_URL).flush([PROFILES[0], { id: 2, displayName: 'Anna-Lena' }]);
    await settle();
    expect(page.querySelector('.profile__name-input')).toBeNull();
    expect(page.textContent).toContain('Anna-Lena');
  });

  it('deletes a profile after confirmation in the styled dialog', async () => {
    const page = await open();
    const open$ = answerConfirmation(true);
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__delete')!.click();

    expect(open$).toHaveBeenCalledWith(ConfirmDialog, {
      data: {
        title: 'profiles.deleteTitle',
        message: 'profiles.confirmDelete',
        params: { name: 'Anna' },
        confirm: 'common.delete',
      },
    });
    const request = httpMock.expectOne(`${PROFILES_URL}/2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();

    httpMock.expectOne(PROFILES_URL).flush([PROFILES[0]]);
    await settle();
    expect(page.textContent).not.toContain('Anna');
  });

  it('does not delete without confirmation', async () => {
    const page = await open();
    answerConfirmation(false);
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__delete')!.click();

    httpMock.expectNone(`${PROFILES_URL}/2`);
  });

  it('explains that a profile with vehicles cannot be deleted', async () => {
    const page = await open();
    answerConfirmation(true);
    card(page, 'Anna').querySelector<HTMLButtonElement>('.profile__delete')!.click();
    httpMock.expectOne(`${PROFILES_URL}/2`).flush(null, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(errorText(page)).toBe(
      'Diese Person hat noch Fahrzeuge. Bitte zuerst die Fahrzeuge löschen.',
    );
  });
});
