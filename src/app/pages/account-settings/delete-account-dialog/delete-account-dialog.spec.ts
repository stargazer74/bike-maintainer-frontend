import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../auth/auth-store';
import { translocoTesting } from '../../../i18n/testing';
import { DeleteAccountDialog, openDeleteAccountDialog } from './delete-account-dialog';

const ME_URL = 'http://localhost/api/v1/auth/me';

describe('DeleteAccountDialog', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    httpMock.verify();
  });

  /** ngModel sets up its control asynchronously, so typing only reaches the signal afterwards. */
  async function openDialog(): Promise<{
    ref: MatDialogRef<DeleteAccountDialog, boolean>;
    element: HTMLElement;
  }> {
    const ref = TestBed.inject(MatDialog).open<DeleteAccountDialog, void, boolean>(
      DeleteAccountDialog,
    );
    detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    detectChanges();
    const element = document.querySelector<HTMLElement>('app-delete-account-dialog')!;
    return { ref, element };
  }

  function detectChanges(): void {
    TestBed.inject(MatDialog).openDialogs[0]?.componentRef!.changeDetectorRef.detectChanges();
  }

  function typePassword(element: HTMLElement, value: string): void {
    const input = element.querySelector<HTMLInputElement>('#delete-account-password')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    detectChanges();
  }

  function submit(element: HTMLElement): void {
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    detectChanges();
  }

  function error(element: HTMLElement): string {
    return element.querySelector('.delete-account__error')?.textContent?.trim() ?? '';
  }

  it('explains what is deleted', async () => {
    const { element } = await openDialog();

    expect(element.querySelector('h2')?.textContent).toContain('Konto endgültig löschen?');
    expect(element.textContent).toContain('allen Fahrzeugen');
    expect(element.querySelector('.delete-account__confirm')?.textContent?.trim()).toBe(
      'Konto endgültig löschen',
    );
  });

  it('deletes the account with the password, clears the user and closes with true', async () => {
    const store = TestBed.inject(AuthStore);
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush({ id: 1, email: 'rider@example.org', role: 'USER' });
    await loaded;
    const { ref, element } = await openDialog();
    const result = firstValueFrom(ref.afterClosed());

    typePassword(element, 'correct-horse-battery');
    submit(element);
    const request = httpMock.expectOne(ME_URL);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ password: 'correct-horse-battery' });
    expect(ref.disableClose).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toBe(true);
    expect(store.isLoggedIn()).toBe(false);
  });

  it('asks for the password before sending anything', async () => {
    const { element } = await openDialog();

    submit(element);

    httpMock.expectNone(ME_URL);
    expect(error(element)).toBe('Bitte gib dein Passwort ein.');
  });

  it.each([
    [403, { code: 'WRONG_PASSWORD' }, 'Das Passwort ist falsch.'],
    [409, { code: 'LAST_ADMIN' }, 'Du bist der einzige aktive Admin'],
    [429, null, 'Zu viele Versuche, bitte später erneut.'],
    [403, null, 'Das hat nicht geklappt'],
    [500, null, 'Das hat nicht geklappt'],
  ])('shows an error for %s and stays open', async (status, body, message) => {
    const { ref, element } = await openDialog();

    typePassword(element, 'some-password');
    submit(element);
    httpMock.expectOne(ME_URL).flush(body, { status, statusText: 'Error' });
    detectChanges();

    expect(error(element)).toContain(message);
    expect(ref.disableClose).toBe(false);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
  });

  it('closes with false when cancelled', async () => {
    const { ref, element } = await openDialog();
    const result = firstValueFrom(ref.afterClosed());

    element.querySelector<HTMLButtonElement>('.delete-account__cancel')!.click();

    expect(await result).toBe(false);
  });

  it('openDeleteAccountDialog() emits false when dismissed', async () => {
    const result = firstValueFrom(openDeleteAccountDialog(TestBed.inject(MatDialog)));

    TestBed.inject(MatDialog).closeAll();

    expect(await result).toBe(false);
  });
});
