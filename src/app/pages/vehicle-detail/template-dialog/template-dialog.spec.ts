import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  VehicleResponse,
  VehicleTemplateResponse,
  VehicleTemplateSourceQuality,
  VehicleTemplateSourceKind,
  VehicleTemplateSummaryResponse,
  VehicleType,
} from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { TemplateDialog, TemplateDialogData, TODAY } from './template-dialog';

const SEARCH_URL = 'http://localhost/api/v1/vehicle-templates';
const DISCLAIMER_DE =
  'Die Vorlagen sind Richtwerte ohne Gewähr. Wir übernehmen keine Haftung für die Richtigkeit der Daten; die Nutzung erfolgt auf eigene Gefahr. Maßgeblich ist das Handbuch deines Fahrzeugs.';

const VEHICLE: VehicleResponse = {
  id: 7,
  name: 'Meine CB',
  type: VehicleType.Motorcycle,
  make: 'Honda',
  model: 'CB 650 R',
  modelYear: 2019,
  firstRegistrationDate: '2019-05-01',
  currentMileage: 12000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const SUMMARY: VehicleTemplateSummaryResponse = {
  id: 'honda-cb650r-2019',
  type: VehicleType.Motorcycle,
  make: 'Honda',
  model: 'CB650R',
  yearFrom: 2019,
  taskCount: 2,
  sourceQuality: VehicleTemplateSourceQuality.Manufacturer,
};

const TEMPLATE: VehicleTemplateResponse = {
  ...SUMMARY,
  notes: 'Gilt für Europa.',
  sources: [
    {
      id: 's1',
      kind: VehicleTemplateSourceKind.Manufacturer,
      title: 'Handbuch',
      url: 'https://example.org/handbuch.pdf',
      retrieved: '2026-01-05',
    },
  ],
  tasks: [
    {
      key: 'oil',
      name: 'Ölwechsel',
      intervalKm: 6000,
      intervalMonths: 12,
      oneTime: false,
      sourceIds: ['s1'],
      details: [{ label: 'Ölmenge', value: '3,4', quantity: 'l', sourceIds: ['s1'] }],
    },
    {
      key: 'inspection',
      name: 'Erstinspektion',
      firstDueKm: 1000,
      oneTime: true,
      sourceIds: [],
      details: [],
    },
  ],
};

describe('TemplateDialog', () => {
  let fixture: ComponentFixture<TemplateDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();

  function create(vehicle: VehicleResponse = VEHICLE, existingKeys: string[] = []): void {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        { provide: TODAY, useValue: () => '2026-11-26' },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { vehicle, existingKeys } satisfies TemplateDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TemplateDialog);
    fixture.detectChanges();
  }

  beforeEach(() => close.mockReset());
  afterEach(() => httpMock.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Answers the automatic search with the given hits. */
  async function answerSearch(hits: VehicleTemplateSummaryResponse[]): Promise<void> {
    const req = httpMock.expectOne((r) => r.url === SEARCH_URL);
    req.flush(hits);
    await settle();
  }

  async function answerTemplate(template = TEMPLATE): Promise<void> {
    httpMock.expectOne(`${SEARCH_URL}/${template.id}`).flush(template);
    await settle();
  }

  function applyButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.template-dialog__apply')!;
  }

  function disclaimerCheckbox(): HTMLInputElement {
    return page().querySelector<HTMLInputElement>('.template-dialog__confirm input')!;
  }

  async function openApplyStep(vehicle = VEHICLE, existing: string[] = []): Promise<void> {
    create(vehicle, existing);
    await answerSearch([SUMMARY]);
    page().querySelector<HTMLButtonElement>('.template-dialog__result')!.click();
    await answerTemplate();
  }

  it('searches with make, model, type and year of the vehicle', async () => {
    create();
    const req = httpMock.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.get('make')).toBe('Honda');
    expect(req.request.params.get('model')).toBe('CB%20650%20R');
    expect(req.request.params.get('type')).toBe('MOTORCYCLE');
    expect(req.request.params.get('year')).toBe('2019');
    req.flush([]);
    await settle();
    const inputs = page().querySelectorAll<HTMLInputElement>('.template-dialog__search input');
    expect(inputs[0].value).toBe('Honda');
    expect(inputs[1].value).toBe('CB 650 R');
  });

  it('does not search without a make and shows the empty search form', async () => {
    create({ ...VEHICLE, make: undefined, model: undefined });
    await settle();
    expect(page().querySelector('.template-dialog__search')).not.toBeNull();
    expect(page().textContent).not.toContain('Keine Vorlage gefunden');
  });

  it('shows "no template found" when nothing matches', async () => {
    create();
    await answerSearch([]);
    expect(page().textContent).toContain('Keine Vorlage gefunden');
  });

  it('shows a search error and allows searching again', async () => {
    create();
    httpMock
      .expectOne((r) => r.url === SEARCH_URL)
      .flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(page().querySelector('[role=alert]')!.textContent).toContain('Suche ist fehlgeschlagen');
    page().querySelector<HTMLButtonElement>('.template-dialog__search button')!.click();
    await answerSearch([]);
    expect(page().textContent).toContain('Keine Vorlage gefunden');
  });

  it('lets the user change make and model and search again', async () => {
    create();
    await answerSearch([]);
    const [make, model] = [
      ...page().querySelectorAll<HTMLInputElement>('.template-dialog__search input'),
    ];
    make.value = 'Moto Guzzi';
    make.dispatchEvent(new Event('input'));
    model.value = '';
    model.dispatchEvent(new Event('input'));
    page().querySelector<HTMLButtonElement>('.template-dialog__search button')!.click();
    const req = httpMock.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.get('make')).toBe('Moto%20Guzzi');
    expect(req.request.params.has('model')).toBe(false);
    req.flush([]);
    await settle();
  });

  it('lists a single hit instead of opening it, and opens it on click', async () => {
    create();
    await answerSearch([SUMMARY]);
    expect(page().querySelector('.template-dialog__search')).not.toBeNull();
    expect(page().querySelectorAll('.template-dialog__result').length).toBe(1);
    expect(page().querySelector('.template-dialog__task')).toBeNull();
    page().querySelector<HTMLButtonElement>('.template-dialog__result')!.click();
    await answerTemplate();
    expect(page().querySelector('.template-dialog__results')).toBeNull();
    expect(page().querySelector('.template-dialog__head')!.textContent).toContain('CB650R');
    expect(page().querySelector('.template-dialog__head')!.textContent).toContain(
      'Herstellerangaben',
    );
    expect(page().querySelector('.template-dialog__head')!.textContent).toContain(
      'Gilt für Europa.',
    );
    expect(page().querySelectorAll('.template-dialog__task').length).toBe(2);
  });

  it('shows a pick list for several hits and loads the chosen template', async () => {
    create();
    await answerSearch([SUMMARY, { ...SUMMARY, id: 'honda-cb650r-2021', yearFrom: 2021 }]);
    const items = page().querySelectorAll<HTMLButtonElement>('.template-dialog__result');
    expect(items.length).toBe(2);
    items[1].click();
    await answerTemplate({ ...TEMPLATE, id: 'honda-cb650r-2021' });
    expect(page().querySelectorAll('.template-dialog__task').length).toBe(2);
  });

  it('shows a load error when the template cannot be fetched', async () => {
    create();
    await answerSearch([SUMMARY]);
    page().querySelector<HTMLButtonElement>('.template-dialog__result')!.click();
    httpMock
      .expectOne(`${SEARCH_URL}/${SUMMARY.id}`)
      .flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(page().querySelector('[role=alert]')!.textContent).toContain('nicht geladen');
  });

  it('shows the disclaimer verbatim directly above the apply button, with the checkbox below', async () => {
    await openApplyStep();
    const disclaimer = page().querySelector('.template-dialog__disclaimer')!;
    expect(disclaimer.textContent!.trim()).toBe(DISCLAIMER_DE);
    expect(disclaimer.nextElementSibling!.classList).toContain('template-dialog__confirm');
    expect(page().querySelector('.template-dialog__confirm')!.textContent).toContain(
      'Ich habe den Hinweis gelesen.',
    );
  });

  it('enables "Übernehmen" only with the checkbox and starts unchecked on every opening', async () => {
    await openApplyStep();
    expect(disclaimerCheckbox().checked).toBe(false);
    expect(applyButton().disabled).toBe(true);
    disclaimerCheckbox().click();
    await settle();
    expect(applyButton().disabled).toBe(false);
    disclaimerCheckbox().click();
    await settle();
    expect(applyButton().disabled).toBe(true);

    // a freshly opened dialog starts unchecked again
    fixture.destroy();
    TestBed.resetTestingModule();
    await openApplyStep();
    expect(disclaimerCheckbox().checked).toBe(false);
    expect(applyButton().disabled).toBe(true);
  });

  it('shows "last done" fields only for vehicles with mileage', async () => {
    await openApplyStep();
    expect(page().querySelectorAll('.template-dialog__lastdone input').length).toBe(4);
    expect(page().querySelector('.template-dialog__fill')).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await openApplyStep({ ...VEHICLE, currentMileage: 0 });
    expect(page().querySelectorAll('.template-dialog__lastdone input').length).toBe(0);
    expect(page().querySelector('.template-dialog__fill')).toBeNull();
  });

  it('fills empty fields with the current mileage and today', async () => {
    await openApplyStep();
    page().querySelector<HTMLButtonElement>('.template-dialog__fill')!.click();
    await settle();
    const inputs = page().querySelectorAll<HTMLInputElement>('.template-dialog__lastdone input');
    expect(inputs[0].value).toBe('12000');
    expect(inputs[1].value).toBe('2026-11-26');
  });

  it('preselects, greys out existing tasks and unselects a one-time task whose first due has passed', async () => {
    await openApplyStep(VEHICLE, ['oil']);
    const tasks = page().querySelectorAll<HTMLElement>('.template-dialog__task');
    const oil = tasks[0].querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect(oil.disabled).toBe(true);
    expect(oil.checked).toBe(false);
    expect(tasks[0].textContent).toContain('schon vorhanden');
    const inspection = tasks[1].querySelector<HTMLInputElement>('input[type=checkbox]')!;
    expect(inspection.checked).toBe(false);
  });

  it('shows the interval and the details of a task', async () => {
    await openApplyStep();
    const oil = page().querySelectorAll<HTMLElement>('.template-dialog__task')[0];
    expect(oil.textContent).toContain('Alle 6.000 km oder 12 Monate');
    expect(oil.textContent).toContain('Ölmenge');
    expect(oil.textContent).toContain('3,4');
  });

  it('opens source and report links in a new tab without opener', async () => {
    await openApplyStep();
    const links = [...page().querySelectorAll<HTMLAnchorElement>('a')];
    const source = links.find((a) => a.href === 'https://example.org/handbuch.pdf')!;
    expect(source).toBeDefined();
    const reports = links.filter((a) => a.href.startsWith('https://github.com/stargazer74/'));
    expect(reports.length).toBe(3);
    expect(reports.some((a) => a.href.endsWith('&vorlage=honda-cb650r-2019'))).toBe(true);
    expect(reports.some((a) => a.href.endsWith('&aufgabe=oil'))).toBe(true);
    for (const link of [source, ...reports]) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
  });

  it('applies the selection and closes with the response', async () => {
    await openApplyStep({ ...VEHICLE, currentMileage: 0 });
    disclaimerCheckbox().click();
    await settle();
    applyButton().click();
    const req = httpMock.expectOne('http://localhost/api/v1/vehicles/7/template');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      templateId: 'honda-cb650r-2019',
      tasks: [{ key: 'oil' }, { key: 'inspection' }],
    });
    req.flush({ created: 2, skipped: 0 });
    expect(close).toHaveBeenCalledWith({ created: 2, skipped: 0 });
  });

  it('does not send twice on a double click', async () => {
    await openApplyStep({ ...VEHICLE, currentMileage: 0 });
    disclaimerCheckbox().click();
    await settle();
    applyButton().click();
    applyButton().click();
    httpMock.expectOne('http://localhost/api/v1/vehicles/7/template').flush({
      created: 1,
      skipped: 0,
    });
  });

  it('shows the read-only text on 403', async () => {
    await openApplyStep({ ...VEHICLE, currentMileage: 0 });
    disclaimerCheckbox().click();
    await settle();
    applyButton().click();
    httpMock
      .expectOne('http://localhost/api/v1/vehicles/7/template')
      .flush('x', { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(page().querySelector('[role=alert]')!.textContent).toContain(
      'Deine Testphase bzw. dein Abo ist abgelaufen',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('shows a generic error on other failures', async () => {
    await openApplyStep({ ...VEHICLE, currentMileage: 0 });
    disclaimerCheckbox().click();
    await settle();
    applyButton().click();
    httpMock
      .expectOne('http://localhost/api/v1/vehicles/7/template')
      .flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(page().querySelector('[role=alert]')!.textContent).toContain('nicht übernommen');
    expect(applyButton().disabled).toBe(false);
  });

  it('goes back to the search from the apply step', async () => {
    await openApplyStep();
    page().querySelector<HTMLButtonElement>('.template-dialog__back')!.click();
    await settle();
    expect(page().querySelector('.template-dialog__search')).not.toBeNull();
    expect(page().querySelectorAll('.template-dialog__result').length).toBe(1);
    expect(page().querySelector('.template-dialog__subtitle')).toBeNull();
  });

  async function enterKm(value: string): Promise<void> {
    const km = page().querySelector<HTMLInputElement>(
      '.template-dialog__lastdone input[type=number]',
    )!;
    km.value = value;
    km.dispatchEvent(new Event('input'));
    await settle();
  }

  it('limits last done km and date and blocks applying outside the limits', async () => {
    await openApplyStep();
    const inputs = page().querySelectorAll<HTMLInputElement>('.template-dialog__lastdone input');
    expect(inputs[0].max).toBe('12000');
    expect(inputs[1].min).toBe('2019-05-01');
    expect(inputs[1].max).toBe('2026-11-26');
    disclaimerCheckbox().click();
    await settle();
    expect(applyButton().disabled).toBe(false);
    await enterKm('12001');
    expect(applyButton().disabled).toBe(true);
    expect(page().querySelector('.template-dialog__lastdone .field__error')).not.toBeNull();
    await enterKm('12000');
    expect(applyButton().disabled).toBe(false);
    inputs[1].value = '2026-11-27';
    inputs[1].dispatchEvent(new Event('input'));
    await settle();
    expect(applyButton().disabled).toBe(true);
    inputs[1].value = '2019-04-30';
    inputs[1].dispatchEvent(new Event('input'));
    await settle();
    expect(applyButton().disabled).toBe(true);
  });

  it('shows a specific message on 400', async () => {
    await openApplyStep();
    disclaimerCheckbox().click();
    await settle();
    applyButton().click();
    httpMock
      .expectOne('http://localhost/api/v1/vehicles/7/template')
      .flush('x', { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(page().querySelector('[role=alert]')!.textContent).toContain('passt nicht zum Fahrzeug');
  });

  it('shows quantity in parentheses', async () => {
    await openApplyStep();
    expect(page().querySelector('.template-dialog__details')!.textContent).toMatch(
      /Ölmenge: .+\(.+\)/,
    );
  });
});
