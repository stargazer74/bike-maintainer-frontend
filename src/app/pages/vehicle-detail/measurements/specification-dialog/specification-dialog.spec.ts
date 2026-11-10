import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WorksheetTemplate } from '../../../../api-client';
import { translocoTesting } from '../../../../i18n/testing';
import '../../../../i18n/i18n.config';
import { SpecificationDialog, SpecificationDialogData } from './specification-dialog';

const URL = 'http://localhost/api/v1/vehicles/7/specifications';

describe('SpecificationDialog', () => {
  let fixture: ComponentFixture<SpecificationDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();

  async function create(templates: WorksheetTemplate[], stored: object = {}): Promise<void> {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { vehicleId: 7, templates } satisfies SpecificationDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SpecificationDialog);
    fixture.autoDetectChanges();
    // Lets the request go out; `whenStable` would wait for its response.
    await new Promise((resolve) => setTimeout(resolve));
    httpMock.expectOne((req) => req.method === 'GET' && req.url === URL).flush(stored);
    await fixture.whenStable();
  }

  beforeEach(() => close.mockReset());
  afterEach(() => httpMock.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function legends(): string[] {
    return [...page().querySelectorAll('.spec__legend')].map((l) => l.textContent!.trim());
  }

  async function type(id: string, value: string): Promise<void> {
    const input = page().querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function save(): void {
    page().querySelector<HTMLButtonElement>('.spec__save')!.click();
  }

  it('offers only the target values of the templates that fit the vehicle', async () => {
    await create([WorksheetTemplate.Brakes, WorksheetTemplate.Tires]);

    expect(legends()).toEqual(['Bremsen', 'Reifen']);
  });

  it('shows the stored values and saves the changed ones, leaving empty fields out', async () => {
    await create([WorksheetTemplate.Chain], { chainSlackMin: 25, chainWearLinks: 20 });

    expect(legends()).toEqual(['Kette']);
    expect(page().querySelector<HTMLInputElement>('#spec-chainSlackMin')!.value).toBe('25');
    await type('spec-chainSlackMax', '35');
    await type('spec-chainSlackMin', '');
    save();

    const request = httpMock.expectOne((req) => req.method === 'PUT' && req.url === URL);
    expect(request.request.body).toEqual({ chainSlackMax: 35, chainWearLinks: 20 });
    request.flush({ chainSlackMax: 35, chainWearLinks: 20 });
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith({ chainSlackMax: 35, chainWearLinks: 20 });
  });

  it('saves the engine layout and the kind of adjustment', async () => {
    await create([WorksheetTemplate.ValveClearance]);

    expect(legends()).toEqual(['Motor', 'Ventilspiel']);
    const adjustment = page().querySelector<HTMLSelectElement>('#spec-adjustment')!;
    adjustment.value = adjustment.options[1].value;
    adjustment.dispatchEvent(new Event('change'));
    const cylinders = page().querySelector<HTMLSelectElement>('#spec-cylinders')!;
    cylinders.value = cylinders.options[4].value;
    cylinders.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    save();

    const request = httpMock.expectOne((req) => req.method === 'PUT');
    expect(request.request.body).toEqual({ cylinders: 4, valveAdjustment: 'SHIM' });
    request.flush({});
  });

  it('does not save a range whose minimum is above the maximum', async () => {
    await create([WorksheetTemplate.ValveClearance]);
    await type('spec-intakeClearanceMin', '0.2');
    await type('spec-intakeClearanceMax', '0.1');
    save();
    await fixture.whenStable();

    httpMock.expectNone((req) => req.method === 'PUT');
    expect(page().textContent).toContain('Der Mindestwert ist größer als der Höchstwert.');
    expect(page().textContent).toContain('Bitte korrigiere die markierten Werte.');
  });

  it('keeps the dialog open when saving fails', async () => {
    await create([WorksheetTemplate.Tires]);
    await type('spec-treadDepthMin', '1.6');
    save();
    httpMock
      .expectOne((req) => req.method === 'PUT')
      .flush('x', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(page().textContent).toContain('Die Sollwerte konnten nicht gespeichert werden');
  });
});
