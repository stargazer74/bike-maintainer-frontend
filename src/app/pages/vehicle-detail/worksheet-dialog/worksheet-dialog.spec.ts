import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { WorksheetTemplate, WorksheetTemplateResponse } from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { WorksheetDialog, WorksheetDialogData } from './worksheet-dialog';

const LIST_URL = 'http://localhost/api/v1/vehicles/7/worksheets';
const ALL: WorksheetTemplateResponse[] = [
  { template: WorksheetTemplate.ValveClearance },
  { template: WorksheetTemplate.Brakes },
  { template: WorksheetTemplate.Chain },
  { template: WorksheetTemplate.Tires },
];

describe('WorksheetDialog', () => {
  let fixture: ComponentFixture<WorksheetDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();
  const originalUrl = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

  async function create(templates: WorksheetTemplateResponse[] = ALL): Promise<void> {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { vehicleId: 7 } satisfies WorksheetDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorksheetDialog);
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url === LIST_URL).flush(templates);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => close.mockReset());
  afterEach(() => {
    httpMock.verify();
    Object.assign(URL, {
      createObjectURL: originalUrl.create,
      revokeObjectURL: originalUrl.revoke,
    });
    vi.restoreAllMocks();
  });

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function names(): string[] {
    return [...page().querySelectorAll('.worksheet__name')].map((name) => name.textContent!.trim());
  }

  function choose(index: number): void {
    page().querySelectorAll<HTMLInputElement>('input[type=radio]')[index].click();
    fixture.detectChanges();
  }

  function createButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.worksheet__create')!;
  }

  function mockDownload() {
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  }

  it('offers only the templates the backend lists for the vehicle', async () => {
    await create([{ template: WorksheetTemplate.Brakes }, { template: WorksheetTemplate.Tires }]);

    expect(names()).toEqual(['Bremsen', 'Reifen']);
    expect(page().textContent).not.toContain('Ventilspiel');
  });

  it('cannot create a PDF before a template is chosen', async () => {
    await create();

    expect(createButton().disabled).toBe(true);
    choose(1);
    expect(createButton().disabled).toBe(false);
  });

  it('asks for cylinders and valves only for the valve clearance', async () => {
    await create();

    expect(page().querySelector('#ws-cylinders')).toBeNull();
    choose(0);
    expect(page().querySelector('#ws-cylinders')).not.toBeNull();
    expect(page().querySelector('#ws-valves')).not.toBeNull();
    choose(1);
    expect(page().querySelector('#ws-cylinders')).toBeNull();
  });

  it('downloads the valve clearance sheet with the engine layout and closes', async () => {
    await create();
    const click = mockDownload();
    choose(0);
    const cylinders = page().querySelector<HTMLSelectElement>('#ws-cylinders')!;
    cylinders.value = cylinders.options[3].value;
    cylinders.dispatchEvent(new Event('change'));
    const valves = page().querySelector<HTMLSelectElement>('#ws-valves')!;
    valves.value = valves.options[0].value;
    valves.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    createButton().click();
    const request = httpMock.expectOne((req) => req.url === `${LIST_URL}/VALVE_CLEARANCE`);
    expect(request.request.params.get('cylinders')).toBe('4');
    expect(request.request.params.get('valvesPerCylinder')).toBe('2');
    request.flush(new Blob(['%PDF-']), {
      headers: { 'Content-Disposition': 'attachment; filename="arbeitsblatt-ventilspiel.pdf"' },
    });
    await fixture.whenStable();

    expect(click).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('sends no engine layout for the other templates', async () => {
    await create();
    mockDownload();
    choose(0);
    choose(2);

    createButton().click();
    const request = httpMock.expectOne((req) => req.url === `${LIST_URL}/CHAIN`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(new Blob(['%PDF-']));
    await fixture.whenStable();

    expect(close).toHaveBeenCalled();
  });

  it.each([
    [400, 'passt nicht zum Fahrzeug'],
    [500, 'Das Arbeitsblatt konnte nicht erstellt werden'],
  ])('shows an error for %s and stays open', async (status, message) => {
    await create();
    choose(1);
    createButton().click();
    httpMock
      .expectOne((req) => req.url === `${LIST_URL}/BRAKES`)
      .flush(new Blob(['{}']), { status, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page().querySelector('.worksheet__error')?.textContent).toContain(message);
    expect(close).not.toHaveBeenCalled();
    expect(createButton().disabled).toBe(false);
  });

  it('says so when the templates cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { vehicleId: 7 } satisfies WorksheetDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorksheetDialog);
    fixture.detectChanges();
    httpMock
      .expectOne((req) => req.url === LIST_URL)
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page().textContent).toContain('Die Vorlagen konnten nicht geladen werden');
    expect(createButton().disabled).toBe(true);
  });
});
