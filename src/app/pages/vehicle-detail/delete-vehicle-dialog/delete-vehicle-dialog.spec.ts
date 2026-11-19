import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, Observable } from 'rxjs';
import { translocoTesting } from '../../../i18n/testing';
import { DeleteVehicleDialogData, openDeleteVehicleDialog } from './delete-vehicle-dialog';

const VEHICLE_URL = 'http://localhost/api/v1/vehicles/7';

describe('DeleteVehicleDialog', () => {
  let httpMock: HttpTestingController;
  let exportVehicle: ReturnType<typeof vi.fn<() => void>>;
  let exporting: ReturnType<typeof signal<boolean>>;
  let exportErrorKey: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    exportVehicle = vi.fn<() => void>();
    exporting = signal(false);
    exportErrorKey = signal<string | null>(null);
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    httpMock.verify();
  });

  function open(): { result: Promise<boolean>; element: HTMLElement } {
    const data: DeleteVehicleDialogData = {
      vehicleId: 7,
      name: 'Tenere',
      taskCount: 4,
      logCount: 12,
      exportVehicle,
      exporting,
      exportErrorKey,
    };
    const closed: Observable<boolean> = openDeleteVehicleDialog(TestBed.inject(MatDialog), data);
    const result = firstValueFrom(closed);
    detectChanges();
    return { result, element: document.querySelector<HTMLElement>('app-delete-vehicle-dialog')! };
  }

  function detectChanges(): void {
    TestBed.inject(MatDialog).openDialogs[0]?.componentRef!.changeDetectorRef.detectChanges();
  }

  function click(element: HTMLElement, selector: string): void {
    element.querySelector<HTMLButtonElement>(selector)!.click();
    detectChanges();
  }

  it('names the vehicle, what goes with it and that it cannot be undone', () => {
    const { element } = open();

    const text = element.textContent ?? '';
    expect(text).toContain('„Tenere“ wird mit allem gelöscht');
    expect(text).toContain('Wartungsaufgaben: 4');
    expect(text).toContain('Wartungseinträge: 12');
    expect(text).toContain('nicht rückgängig');
  });

  it('deletes the vehicle and closes with true', async () => {
    const { result, element } = open();

    click(element, '.delete-vehicle__confirm');
    const request = httpMock.expectOne(VEHICLE_URL);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toBe(true);
  });

  it('changes nothing on cancel', async () => {
    const { result, element } = open();

    click(element, '.delete-vehicle__cancel');

    httpMock.expectNone(VEHICLE_URL);
    expect(await result).toBe(false);
  });

  it('changes nothing on Escape', async () => {
    const { result } = open();

    // The CDK overlay reacts to keydown on the document and checks the legacy keyCode.
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );

    httpMock.expectNone(VEHICLE_URL);
    expect(await result).toBe(false);
  });

  it('exports first and stays open', () => {
    const { element } = open();

    click(element, '.delete-vehicle__export');

    expect(exportVehicle).toHaveBeenCalledOnce();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    httpMock.expectNone(VEHICLE_URL);
  });

  it('disables the export while it runs and shows its error', () => {
    const { element } = open();

    exporting.set(true);
    detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.delete-vehicle__export')!.disabled).toBe(
      true,
    );

    exporting.set(false);
    exportErrorKey.set('vehicleDetail.exportError');
    detectChanges();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('keeps the dialog open with a message when the vehicle is gone', () => {
    const { element } = open();

    click(element, '.delete-vehicle__confirm');
    httpMock.expectOne(VEHICLE_URL).flush(null, { status: 404, statusText: 'Not Found' });
    detectChanges();

    expect(element.querySelector('.delete-vehicle__error')?.textContent).toContain(
      'gibt es nicht mehr',
    );
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
  });

  it('keeps the dialog open with a message on other errors and allows a retry', () => {
    const { element } = open();

    click(element, '.delete-vehicle__confirm');
    httpMock.expectOne(VEHICLE_URL).error(new ProgressEvent('error'));
    detectChanges();

    expect(element.querySelector('.delete-vehicle__error')?.textContent).toContain(
      'konnte nicht gelöscht werden',
    );
    expect(element.querySelector<HTMLButtonElement>('.delete-vehicle__confirm')!.disabled).toBe(
      false,
    );
  });
});
