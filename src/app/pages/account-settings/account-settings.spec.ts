import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { translocoTesting } from '../../i18n/testing';
import { AccountSettings } from './account-settings';

const PASSWORD_URL = 'http://localhost/api/v1/auth/password';
const CURRENT = 'correct-horse-battery';
const NEW = 'brand-new-password';

@Component({ template: '' })
class LoginStub {}

describe('AccountSettings', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([
          { path: 'konto', component: AccountSettings },
          { path: 'anmelden', component: LoginStub },
        ]),
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

  describe('delete account', () => {
    afterEach(() => TestBed.inject(MatDialog).closeAll());

    async function openDialog(page: HTMLElement): Promise<HTMLElement> {
      page.querySelector<HTMLButtonElement>('.account__delete')!.click();
      const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
      dialogRef.componentRef!.changeDetectorRef.detectChanges();
      // ngModel sets up its control asynchronously.
      await new Promise((resolve) => setTimeout(resolve));
      dialogRef.componentRef!.changeDetectorRef.detectChanges();
      return document.querySelector<HTMLElement>('app-delete-account-dialog')!;
    }

    it('shows the section with its warning', async () => {
      const page = await open();

      expect(page.querySelector('.account__danger')?.textContent).toContain(
        'Das lässt sich nicht rückgängig machen.',
      );
    });

    it('goes to the login page with a notice after the account was deleted', async () => {
      const page = await open();
      const dialog = await openDialog(page);
      const input = dialog.querySelector<HTMLInputElement>('#delete-account-password')!;
      input.value = CURRENT;
      input.dispatchEvent(new Event('input'));
      dialog.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

      httpMock
        .expectOne('http://localhost/api/v1/auth/me')
        .flush(null, { status: 204, statusText: 'No Content' });
      // The dialog reports the result only after its closing animation.
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe('/anmelden?accountDeleted=true'),
      );
    });

    it('stays on the page when the dialog is cancelled', async () => {
      const page = await open();
      const dialog = await openDialog(page);

      dialog.querySelector<HTMLButtonElement>('.delete-account__cancel')!.click();
      await settle();

      expect(TestBed.inject(Router).url).toBe('/konto');
    });
  });
});
