import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { translocoTesting } from '../../i18n/testing';
import '../../i18n/i18n.config';
import { VehicleImportDialog, VehicleImportDialogData } from './vehicle-import-dialog';
import { MAX_IMPORT_BYTES } from './vehicle-import';

const IMPORT_URL = 'http://localhost/api/v1/vehicles/import';
const VALID = JSON.stringify({
  formatVersion: 1,
  exportedAt: '2026-11-11T10:00:00Z',
  vehicle: {
    name: 'Die Rote',
    type: 'MOTORCYCLE',
    maintenanceTasks: [{ ref: 't1', name: 'Öl' }],
    maintenanceLogs: [],
  },
});

describe('VehicleImportDialog', () => {
  let fixture: ComponentFixture<VehicleImportDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();

  function create(existingNames: string[] = []): void {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { existingNames } satisfies VehicleImportDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VehicleImportDialog);
    fixture.detectChanges();
  }

  beforeEach(() => close.mockReset());
  afterEach(() => httpMock.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function submit(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.vehicle-import__submit')!;
  }

  async function choose(file: File | null): Promise<void> {
    const input = page().querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function chooseValid(): Promise<void> {
    await choose(new File([VALID], 'vehicle-die-rote.json', { type: 'application/json' }));
  }

  function error(): string {
    return page().querySelector('[role=alert]')?.textContent ?? '';
  }

  it('can only import once a readable file is chosen', () => {
    create();

    expect(submit().disabled).toBe(true);
  });

  it('shows what the file contains before importing', async () => {
    create();
    await chooseValid();

    expect(page().querySelector('.vehicle-import__file-name')!.textContent).toContain(
      'vehicle-die-rote.json',
    );
    const preview = page().querySelector('.vehicle-import__preview')!.textContent!;
    expect(preview).toContain('Die Rote');
    expect(preview).toContain('Motorrad');
    expect(preview).toContain('1 Aufgaben, 0 Einträge');
    expect(preview).toContain('11.11.2026');
    expect(page().querySelector('.vehicle-import__hint')).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it('points out that a vehicle of the same name exists', async () => {
    create(['Die Rote']);
    await chooseValid();

    expect(page().querySelector('.vehicle-import__hint')!.textContent).toContain(
      'Ein Fahrzeug „Die Rote“ gibt es schon',
    );
  });

  it('does not even read a file over 5 MB', async () => {
    create();
    const huge = new File(['x'], 'huge.json');
    Object.defineProperty(huge, 'size', { value: MAX_IMPORT_BYTES + 1 });
    const text = vi.spyOn(huge, 'text');
    await choose(huge);

    expect(text).not.toHaveBeenCalled();
    expect(error()).toContain('größer als 5 MB');
    expect(submit().disabled).toBe(true);
  });

  it('rejects a file that is no export file', async () => {
    create();
    await choose(new File(['hello'], 'notes.txt'));

    expect(error()).toContain('keine Exportdatei');
    expect(submit().disabled).toBe(true);
  });

  it('forgets the previous file when the choice is cancelled', async () => {
    create();
    await chooseValid();
    await choose(null);

    expect(page().querySelector('.vehicle-import__preview')).toBeNull();
    expect(submit().disabled).toBe(true);
  });

  it('imports the file and closes with the new vehicle', async () => {
    create();
    await chooseValid();

    submit().click();
    fixture.detectChanges();
    expect(submit().disabled).toBe(true);
    const request = httpMock.expectOne(IMPORT_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.vehicle.name).toBe('Die Rote');
    request.flush({ id: 9, name: 'Die Rote' }, { status: 201, statusText: 'Created' });

    expect(close).toHaveBeenCalledWith({ id: 9, name: 'Die Rote' });
  });

  it('lists the problems the backend found, the first five of them', async () => {
    create();
    await chooseValid();

    submit().click();
    httpMock
      .expectOne(IMPORT_URL)
      .flush(
        { code: 'IMPORT_INVALID', details: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();

    expect(error()).toContain('Die Datei enthält Fehler');
    const details = [...page().querySelectorAll('.vehicle-import__details li')].map(
      (item) => item.textContent,
    );
    expect(details).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(error()).toContain('+2');
    expect(close).not.toHaveBeenCalled();
    expect(submit().disabled).toBe(false);
  });

  it.each([
    [400, { code: 'IMPORT_INVALID' }, 'Die Datei enthält Fehler'],
    [400, { code: 'IMPORT_FORMAT_UNSUPPORTED' }, 'neueren Version'],
    [413, null, 'größer als 5 MB'],
    [400, null, 'Import fehlgeschlagen'],
    [500, null, 'Import fehlgeschlagen'],
  ])('explains a rejected import (%i %o)', async (status, body, message) => {
    create();
    await chooseValid();

    submit().click();
    httpMock.expectOne(IMPORT_URL).flush(body, { status, statusText: 'Error' });
    fixture.detectChanges();

    expect(error()).toContain(message);
    expect(page().querySelector('.vehicle-import__details')).toBeNull();
  });
});
