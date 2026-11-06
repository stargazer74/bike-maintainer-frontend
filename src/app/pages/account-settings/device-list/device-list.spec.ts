import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { DeviceResponse } from '../../../api-client';
import { LanguageService } from '../../../i18n/language';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { DeviceList } from './device-list';

const DEVICES_URL = 'http://localhost/api/v1/auth/devices';

const PHONE: DeviceResponse = {
  id: 7,
  name: 'Pixel 8',
  createdAt: '2026-10-01T10:00:00Z',
  lastUsedAt: '2026-11-05T18:30:00Z',
  current: false,
};

describe('DeviceList', () => {
  let fixture: ComponentFixture<DeviceList>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    await TestBed.inject(LanguageService).use('de', false);
    fixture = TestBed.createComponent(DeviceList);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    httpMock.verify();
  });

  /** Answers the (next) list request; after a reload the resource sends it only on the next change detection. */
  async function load(devices: DeviceResponse[]): Promise<HTMLElement> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      request = httpMock.expectOne(DEVICES_URL);
    });
    request!.flush(devices);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function confirmDialog(): Promise<HTMLElement> {
    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    dialogRef.componentRef!.changeDetectorRef.detectChanges();
    return document.querySelector<HTMLElement>('app-confirm-dialog')!;
  }

  /** The dialog reports its result only after the closing animation, so the request comes a bit later. */
  async function deleteRequest(): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request = httpMock.expectOne({ method: 'DELETE', url: `${DEVICES_URL}/7` });
    });
    return request!;
  }

  it('shows name, login date and last use of each device', async () => {
    const element = await load([PHONE]);

    const item = element.querySelector('.devices__item')!;
    expect(item.textContent).toContain('Pixel 8');
    expect(item.textContent).toContain('01.10.2026');
    expect(item.textContent).toContain('05.11.2026');
  });

  it('explains where devices come from when there are none', async () => {
    const element = await load([]);

    expect(element.querySelector('.devices__empty')?.textContent).toContain(
      'Keine Geräte angemeldet.',
    );
  });

  it('logs out a device after confirmation and reloads the list', async () => {
    const element = await load([PHONE]);

    element.querySelector<HTMLButtonElement>('.devices__remove')!.click();
    const dialog = await confirmDialog();
    expect(dialog.textContent).toContain('„Pixel 8“ abmelden?');
    dialog.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.click();

    (await deleteRequest()).flush(null, { status: 204, statusText: 'No Content' });
    const reloaded = await load([]);

    expect(reloaded.querySelector('.devices__empty')).not.toBeNull();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const element = await load([PHONE]);

    element.querySelector<HTMLButtonElement>('.devices__remove')!.click();
    const dialog = await confirmDialog();
    dialog.querySelector<HTMLButtonElement>('.confirm-dialog__cancel')!.click();
    await fixture.whenStable();

    httpMock.expectNone({ method: 'DELETE' });
  });

  it('treats an already removed device as done', async () => {
    const element = await load([PHONE]);

    element.querySelector<HTMLButtonElement>('.devices__remove')!.click();
    (await confirmDialog()).querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.click();
    (await deleteRequest()).flush(null, { status: 404, statusText: 'Not Found' });
    const reloaded = await load([]);

    expect(reloaded.querySelector('.devices__error')).toBeNull();
  });

  it('shows an error when the list cannot be loaded', async () => {
    httpMock.expectOne(DEVICES_URL).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.devices__error')?.textContent,
    ).toContain('Das hat nicht geklappt');
  });
});
