import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  LatestMeasurementsResponse,
  MeasurementStatus,
  ShimHint,
  ValveAdjustment,
  ValveKind,
  VehicleSpecifications,
  WorksheetTemplate,
} from '../../../../api-client';
import { translocoTesting } from '../../../../i18n/testing';
import '../../../../i18n/i18n.config';
import { MeasurementDrafts, NO_MEASUREMENTS } from '../measurement-draft';
import { MeasurementEditor } from './measurement-editor';

const SHIM_URL = 'http://localhost/api/v1/vehicles/7/shim-calculation';

const SPEC: VehicleSpecifications = {
  cylinders: 1,
  valvesPerCylinder: 2,
  valveAdjustment: ValveAdjustment.Shim,
  intakeClearanceMin: 0.1,
  intakeClearanceMax: 0.15,
  exhaustClearanceMin: 0.2,
  exhaustClearanceMax: 0.25,
  shimStep: 0.05,
  brakePadMinFront: 2,
};

const LATEST: LatestMeasurementsResponse = {
  measurements: {
    brakes: {
      padFront: 3.5,
      padFrontStatus: MeasurementStatus.Ok,
      padRearStatus: MeasurementStatus.Unknown,
      discFrontStatus: MeasurementStatus.Unknown,
      discRearStatus: MeasurementStatus.Unknown,
    },
    valveClearance: {
      valves: [
        {
          cylinder: 1,
          valve: ValveKind.Intake,
          index: 1,
          measured: 0.08,
          shimOld: 2.6,
          shimNew: 2.55,
          measuredStatus: MeasurementStatus.OutOfRange,
        },
      ],
    },
  },
  sources: {
    brakes: { logId: 3, performedAt: '2026-05-01', mileageAtPerformed: 20000 },
    valveClearance: { logId: 3, performedAt: '2026-05-01', mileageAtPerformed: 20000 },
  },
};

@Component({
  imports: [MeasurementEditor],
  template: `<app-measurement-editor
    [(drafts)]="drafts"
    [vehicleId]="7"
    [templates]="templates()"
    [specification]="specification()"
    [latest]="latest()"
    [editingLogId]="editingLogId()"
    [showErrors]="showErrors()"
  />`,
})
class Host {
  readonly drafts = signal<MeasurementDrafts>(NO_MEASUREMENTS);
  readonly templates = signal<WorksheetTemplate[]>([
    WorksheetTemplate.ValveClearance,
    WorksheetTemplate.Brakes,
    WorksheetTemplate.Tires,
  ]);
  readonly specification = signal<VehicleSpecifications | undefined>(SPEC);
  readonly latest = signal<LatestMeasurementsResponse | undefined>(LATEST);
  readonly editingLogId = signal<number | null>(null);
  readonly showErrors = signal(false);
}

/** Longer than the debounce of the shim calculation. */
function debounce(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 350));
}

describe('MeasurementEditor', () => {
  let fixture: ComponentFixture<Host>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function host(): Host {
    return fixture.componentInstance;
  }

  function addButtons(): string[] {
    return [...page().querySelectorAll('.measure-add__button')].map((b) => b.textContent!.trim());
  }

  async function add(name: string): Promise<void> {
    [...page().querySelectorAll<HTMLButtonElement>('.measure-add__button')]
      .find((button) => button.textContent!.includes(name))!
      .click();
    await fixture.whenStable();
  }

  /** `whenStable` would wait for a pending shim calculation, so only the change detection is awaited. */
  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve));
  }

  function valveInputs(): HTMLInputElement[] {
    return [...page().querySelectorAll<HTMLInputElement>('.valve-table__input')];
  }

  it('offers only the templates of the vehicle that are not recorded yet', async () => {
    expect(addButtons()).toEqual(['add Ventilspiel', 'add Bremsen', 'add Reifen']);

    await add('Bremsen');

    expect(addButtons()).toEqual(['add Ventilspiel', 'add Reifen']);
    expect(host().drafts().brakes).not.toBeNull();
  });

  it('shows the target value and the last measurement next to a field', async () => {
    await add('Bremsen');

    expect(page().textContent).toContain('Letzte Messung: 01.05.2026, 20.000 km');
    const hint = page().querySelector('#measure-pad-front')!.parentElement!.textContent!;
    expect(hint).toContain('min. 2');
    expect(hint).toContain('zuletzt 3,5');
  });

  it('shows no empty hints for values the backend sends as null', async () => {
    host().specification.set({
      ...SPEC,
      brakePadMinRear: null,
    } as unknown as VehicleSpecifications);
    host().latest.set({
      ...LATEST,
      measurements: {
        brakes: { ...LATEST.measurements.brakes!, padRear: null },
      },
    } as unknown as LatestMeasurementsResponse);
    await add('Bremsen');

    const hint = page().querySelector('#measure-pad-rear')!.parentElement!;
    expect(hint.querySelector('.measure-field__hint')).toBeNull();
  });

  it('does not show the values of the log being edited as the last measurement', async () => {
    host().editingLogId.set(3);
    await add('Bremsen');

    expect(page().textContent).not.toContain('Letzte Messung');
    expect(page().textContent).not.toContain('zuletzt');
  });

  it('removes a template again', async () => {
    await add('Reifen');
    page().querySelector<HTMLButtonElement>('.measure-set__remove')!.click();
    await fixture.whenStable();

    expect(host().drafts().tires).toBeNull();
    expect(addButtons()).toContain('add Reifen');
  });

  it('builds the valve rows from the vehicle and prefills the shims installed last time', async () => {
    await add('Ventilspiel');

    const rows = [...page().querySelectorAll('.valve-table tbody tr')];
    expect(rows.map((row) => row.querySelector('th')!.textContent!.trim())).toEqual([
      'Zyl. 1 Einlass Soll 0,1–0,15',
      'Zyl. 1 Auslass Soll 0,2–0,25',
    ]);
    expect(
      host()
        .drafts()
        .valveClearance!.map((valve) => valve.shimOld),
    ).toEqual([2.55, null]);
    expect(rows[0].textContent).toContain('zuletzt 0,08');
  });

  it('changes the engine layout and keeps the values that still fit', async () => {
    await add('Ventilspiel');
    const select = page().querySelector<HTMLSelectElement>('#measure-cylinders')!;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(host().drafts().valveClearance).toHaveLength(4);
    expect(host().drafts().valveClearance![0].shimOld).toBe(2.55);
  });

  it('suggests a shim after typing pauses and takes it over with one click', async () => {
    await add('Ventilspiel');
    await type(valveInputs()[0], '0.05');
    await debounce();

    const request = httpMock.expectOne(SHIM_URL);
    expect(request.request.body).toEqual({
      valves: [
        { valve: 'INTAKE', measured: 0.05, shimOld: 2.55 },
        { valve: 'EXHAUST', measured: undefined, shimOld: undefined },
      ],
    });
    request.flush({
      results: [
        { suggestedShim: 2.475, resultingClearance: 0.125 },
        // The backend sends missing values as null.
        { suggestedShim: null, resultingClearance: null, hint: ShimHint.MissingInput },
      ],
    });
    await fixture.whenStable();

    expect(page().querySelectorAll('.valve-table__take')).toHaveLength(1);

    const suggestion = page().querySelector('.valve-table__suggestion')!;
    expect(suggestion.textContent).toContain('2,475');
    expect(suggestion.textContent).toContain('Spiel danach 0,125');
    suggestion.querySelector<HTMLButtonElement>('.valve-table__take')!.click();
    await fixture.whenStable();

    expect(host().drafts().valveClearance![0].shimNew).toBe(2.475);
    // Taking over changes only the new shim, which needs no new calculation.
    await debounce();
    httpMock.expectNone(SHIM_URL);
  });

  it('shows the hints of the calculation', async () => {
    await add('Ventilspiel');
    await type(valveInputs()[0], '0.12');
    await debounce();
    httpMock.expectOne(SHIM_URL).flush({
      results: [
        { suggestedShim: 2.55, resultingClearance: 0.12, hint: ShimHint.NoChangeNeeded },
        { suggestedShim: 3, resultingClearance: 0.2, hint: ShimHint.OutsideAvailableSizes },
      ],
    });
    await fixture.whenStable();

    const cells = page().querySelectorAll('.valve-table__suggestion');
    expect(cells[0].textContent).toContain('kein Tausch nötig');
    expect(cells[0].querySelector('.valve-table__take')).toBeNull();
    expect(cells[1].textContent).toContain('Außerhalb der erhältlichen Shim-Größen');
  });

  it('asks for the target values instead of calculating without them', async () => {
    host().specification.set({ cylinders: 1, valvesPerCylinder: 2 });
    await add('Ventilspiel');
    await type(valveInputs()[0], '0.05');
    await type(valveInputs()[1], '2.5');
    await debounce();

    httpMock.expectNone(SHIM_URL);
    expect(page().textContent).toContain('Für einen Shim-Vorschlag Sollbereich');
  });

  it('has no shim columns for an engine with adjusting screws', async () => {
    host().specification.set({ ...SPEC, valveAdjustment: ValveAdjustment.Screw });
    await add('Ventilspiel');

    expect(valveInputs()).toHaveLength(2);
    expect(page().textContent).not.toContain('Shim alt');
  });

  it('marks invalid values once errors are shown', async () => {
    await add('Reifen');
    await type(page().querySelector<HTMLInputElement>('#measure-dot-front')!, '23/24');

    expect(page().querySelector('.field__error')).toBeNull();
    host().showErrors.set(true);
    await fixture.whenStable();

    expect(page().querySelector('.field__error')!.textContent).toContain('Vier Ziffern');
  });
});
