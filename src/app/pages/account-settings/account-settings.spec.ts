import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '../../i18n/testing';
import { AccountSettings } from './account-settings';

const PASSWORD_URL = 'http://localhost/api/v1/auth/password';
const CURRENT = 'correct-horse-battery';
const NEW = 'brand-new-password';

describe('AccountSettings', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([{ path: 'konto', component: AccountSettings }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  async function open(): Promise<HTMLElement> {
    await harness.navigateByUrl('/konto');
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  function input(page: HTMLElement, id: string): HTMLInputElement {
    return page.querySelector<HTMLInputElement>(`#${id}`)!;
  }

  function type(page: HTMLElement, id: string, value: string): void {
    input(page, id).value = value;
    input(page, id).dispatchEvent(new Event('input'));
  }

  function fill(page: HTMLElement, current: string, password: string, repeat = password): void {
    type(page, 'account-current-password', current);
    type(page, 'account-new-password', password);
    type(page, 'account-new-password-repeat', repeat);
    // Like the browser after an input event, so the bindings know the typed values.
    harness.detectChanges();
  }

  function submit(page: HTMLElement): void {
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function error(page: HTMLElement): string {
    return page.querySelector('.account__error')?.textContent?.trim() ?? '';
  }

  it('changes the password, confirms it and clears the fields', async () => {
    const page = await open();
    fill(page, CURRENT, NEW);
    submit(page);

    const request = httpMock.expectOne(PASSWORD_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ currentPassword: CURRENT, newPassword: NEW });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    // ngModel writes the cleared values into the inputs asynchronously.
    await settle();

    expect(page.querySelector('.account__success')?.textContent).toContain(
      'Dein Passwort wurde geändert.',
    );
    expect(error(page)).toBe('');
    for (const id of [
      'account-current-password',
      'account-new-password',
      'account-new-password-repeat',
    ]) {
      expect(input(page, id).value, id).toBe('');
    }
  });

  it.each([
    [400, 'Das aktuelle Passwort ist falsch.'],
    [429, 'Zu viele Versuche, bitte später erneut.'],
    [500, 'Das hat nicht geklappt'],
  ])('shows an error for %s', async (status, message) => {
    const page = await open();
    fill(page, CURRENT, NEW);
    submit(page);
    httpMock.expectOne(PASSWORD_URL).flush(null, { status, statusText: 'Error' });
    await settle();

    expect(error(page)).toContain(message);
    expect(page.querySelector('.account__success')).toBeNull();
  });

  it.each([
    ['', NEW, NEW, 'Bitte gib dein aktuelles Passwort ein.'],
    [CURRENT, 'too-short', 'too-short', 'Das Passwort muss 10 bis 72 Zeichen lang sein.'],
    [CURRENT, NEW, NEW + 'x', 'Die Passwörter stimmen nicht überein.'],
  ])('does not send invalid input (%s / %s)', async (current, password, repeat, message) => {
    const page = await open();
    fill(page, current, password, repeat);
    submit(page);
    harness.detectChanges();

    httpMock.expectNone(PASSWORD_URL);
    expect(error(page)).toContain(message);
  });
});
