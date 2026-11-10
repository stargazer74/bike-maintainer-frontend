import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MaintenanceMeasurementsResponse,
  MeasurementStatus,
  ValveKind,
} from '../../../../api-client';
import { translocoTesting } from '../../../../i18n/testing';
import '../../../../i18n/i18n.config';
import { MeasurementView, outOfRangeCount } from './measurement-view';

const { Ok, OutOfRange, Unknown } = MeasurementStatus;

// The backend sends missing values as null.
const MEASUREMENTS = {
  valveClearance: {
    valves: [
      {
        cylinder: 1,
        valve: ValveKind.Intake,
        index: 1,
        measured: 0.08,
        shimOld: 2.55,
        shimNew: 2.5,
        measuredStatus: OutOfRange,
      },
      {
        cylinder: 1,
        valve: ValveKind.Exhaust,
        index: 1,
        measured: 0.22,
        shimOld: null,
        shimNew: null,
        measuredStatus: Ok,
      },
      { cylinder: 2, valve: ValveKind.Intake, index: 1, measuredStatus: Unknown },
      { cylinder: 2, valve: ValveKind.Exhaust, index: 1, shimOld: 2.6, measuredStatus: Unknown },
    ],
  },
  brakes: {
    padFront: 1.5,
    fluidCondition: 'dunkel',
    padFrontStatus: OutOfRange,
    padRearStatus: Unknown,
    discFrontStatus: Unknown,
    discRearStatus: Unknown,
  },
  chain: {
    slack: null,
    wearLinks: 20,
    lubricated: true,
    slackStatus: Unknown,
    wearLengthStatus: Unknown,
  },
} as unknown as MaintenanceMeasurementsResponse;

describe('MeasurementView', () => {
  let fixture: ComponentFixture<MeasurementView>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    fixture = TestBed.createComponent(MeasurementView);
    fixture.componentRef.setInput('measurements', MEASUREMENTS);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function rows(): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('.measure-view__row')].map(
      // Label and value are separate boxes; join their texts with a space like the layout does.
      (row) =>
        [...row.childNodes]
          .map((node) => node.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
    );
  }

  it('lists only the measured values with their check against the target', () => {
    expect(rows()).toEqual([
      'Zyl. 1 Einlass 0,08 mm Shim 2,550 → 2,500 außerhalb Soll',
      'Zyl. 1 Auslass 0,22 mm ok',
      'Zyl. 2 Auslass Shim 2,600 (unverändert)',
      'Belag vorne 1,5 mm außerhalb Soll',
      'Bremsflüssigkeit dunkel',
      'Über Glieder 20',
      'Geschmiert',
    ]);
  });

  it('counts the values outside the target', () => {
    expect(outOfRangeCount(MEASUREMENTS)).toBe(2);
    expect(outOfRangeCount(undefined)).toBe(0);
  });
});
