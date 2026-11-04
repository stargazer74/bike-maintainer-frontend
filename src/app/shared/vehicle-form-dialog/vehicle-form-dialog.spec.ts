import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VehicleResponse, VehicleType } from '../../api-client';
import { translocoTesting } from '../../i18n/testing';
import { VehicleFormDialog, VehicleFormDialogData } from './vehicle-form-dialog';

const API = 'http://localhost/api/v1/vehicles';

const VEHICLE: VehicleResponse = {
  id: 7,
  name: 'Kawasaki VN800',
  type: VehicleType.Motorcycle,
  make: 'Kawasaki',
  model: 'VN800',
  modelYear: 1999,
  firstRegistrationDate: '1999-04-01',
  currentMileage: 42664,
  createdAt: '2026-01-01T00:00:00Z',
} as VehicleResponse;

describe('VehicleFormDialog', () => {
  let fixture: ComponentFixture<VehicleFormDialog>;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;

  async function render(data: VehicleFormDialogData | null): Promise<void> {
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VehicleFormDialog);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function input(id: string): HTMLInputElement {
    return page().querySelector<HTMLInputElement>(`#${id}`)!;
  }

  async function type(id: string, value: string): Promise<void> {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  function errors(): string[] {
    return [...page().querySelectorAll('.field__error')].map((error) => error.textContent!.trim());
  }

  afterEach(() => httpMock.verify());

  it('creates a new vehicle without empty make and model', async () => {
    await render(null);
    expect(page().textContent).toContain('Neues Fahrzeug anlegen');
    await type('av-name', 'Africa Twin');
    await type('av-mileage', '1200');

    await submit();
    const request = httpMock.expectOne((req) => req.method === 'POST' && req.url === API);
    expect(request.request.body).toEqual(
      expect.objectContaining({
        name: 'Africa Twin',
        type: VehicleType.Motorcycle,
        make: undefined,
        model: undefined,
        currentMileage: 1200,
      }),
    );
    request.flush({ ...VEHICLE, id: 8, name: 'Africa Twin' });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 8 }));
  });

  it('offers every vehicle type and saves the selected one', async () => {
    await render(null);
    const select = page().querySelector<HTMLSelectElement>('#av-type')!;
    expect([...select.options].map((option) => option.textContent!.trim())).toEqual([
      'Motorrad',
      'Auto',
      'Fahrrad',
      'E-Bike',
      'Quad',
      'Roller',
    ]);
    select.value = VehicleType.EBike;
    select.dispatchEvent(new Event('change'));
    await type('av-name', 'Cube Stereo');
    await type('av-mileage', '300');

    await submit();
    const request = httpMock.expectOne((req) => req.method === 'POST' && req.url === API);
    expect(request.request.body).toEqual(expect.objectContaining({ type: VehicleType.EBike }));
    request.flush({ ...VEHICLE, id: 9, type: VehicleType.EBike });
    await fixture.whenStable();
  });

  it('shows the validation errors and sends nothing while the form is invalid', async () => {
    await render(null);
    await type('av-year', '1800');
    await type('av-mileage', '-1');
    await type('av-first-registration', '');

    await submit();

    httpMock.expectNone(API);
    expect(errors()).toEqual([
      'Name ist erforderlich.',
      'Bitte ein gültiges Jahr angeben.',
      'Darf nicht negativ sein.',
      'Erstzulassung ist erforderlich.',
    ]);
    await type('av-name', 'x'.repeat(256));
    expect(errors()).toContain('Maximal 255 Zeichen.');
  });

  it('prefills and updates an existing vehicle', async () => {
    await render({ vehicle: VEHICLE });
    expect(page().textContent).toContain('Fahrzeug bearbeiten');
    expect(input('av-name').value).toBe('Kawasaki VN800');
    expect(input('av-make').value).toBe('Kawasaki');
    await type('av-mileage', '43000');

    await submit();
    const request = httpMock.expectOne((req) => req.method === 'PUT' && req.url === `${API}/7`);
    expect(request.request.body).toEqual(
      expect.objectContaining({ name: 'Kawasaki VN800', make: 'Kawasaki', currentMileage: 43000 }),
    );
    request.flush({ ...VEHICLE, currentMileage: 43000 });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ currentMileage: 43000 }));
  });

  it('shows an error when saving fails and keeps the dialog open', async () => {
    await render({ vehicle: VEHICLE });

    await submit();
    httpMock.expectOne(`${API}/7`).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page().querySelector('.add-vehicle__error')!.textContent).toContain(
      'Fahrzeug konnte nicht aktualisiert werden',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('names the create error for a new vehicle', async () => {
    await render(null);
    await type('av-name', 'Africa Twin');

    await submit();
    httpMock.expectOne(API).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page().querySelector('.add-vehicle__error')!.textContent).toContain(
      'Fahrzeug konnte nicht angelegt werden',
    );
  });

  it('closes without a result on cancel', async () => {
    await render(null);

    page().querySelector<HTMLButtonElement>('.btn--ghost')!.click();

    expect(close).toHaveBeenCalledWith();
  });
});
