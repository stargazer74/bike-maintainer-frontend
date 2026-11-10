import { MeasurementStatus, ValveKind, ValveMeasurementResponse } from '../../../api-client';
import {
  dotError,
  emptyBrakes,
  emptyChain,
  emptyTires,
  fromResponse,
  hasMeasurements,
  layoutOf,
  lengthError,
  linksError,
  measurementsError,
  newValveDrafts,
  NO_MEASUREMENTS,
  pressureError,
  toMeasurementsRequest,
  valveLayout,
} from './measurement-draft';

function stored(
  cylinder: number,
  valve: ValveKind,
  index: number,
  values: Partial<ValveMeasurementResponse> = {},
): ValveMeasurementResponse {
  return { cylinder, valve, index, measuredStatus: MeasurementStatus.Unknown, ...values };
}

function positions(drafts: { cylinder: number; valve: ValveKind; index: number }[]): string[] {
  return drafts.map((draft) => `${draft.cylinder}${draft.valve[0]}${draft.index}`);
}

describe('valveLayout', () => {
  it('orders the valves by cylinder, intake before exhaust, then index', () => {
    expect(positions(valveLayout(1, 2))).toEqual(['1I1', '1E1']);
    expect(positions(valveLayout(1, 3))).toEqual(['1I1', '1I2', '1E1']);
    expect(positions(valveLayout(2, 4))).toEqual([
      '1I1',
      '1I2',
      '1E1',
      '1E2',
      '2I1',
      '2I2',
      '2E1',
      '2E2',
    ]);
  });

  it('keeps the values of rows that still exist and drops the others', () => {
    const before = valveLayout(2, 4).map((draft, i) => ({ ...draft, measured: i / 100 }));

    const after = valveLayout(1, 2, before);

    expect(after).toEqual([
      { cylinder: 1, valve: ValveKind.Intake, index: 1, measured: 0, shimOld: null, shimNew: null },
      {
        cylinder: 1,
        valve: ValveKind.Exhaust,
        index: 1,
        measured: 0.02,
        shimOld: null,
        shimNew: null,
      },
    ]);
  });
});

describe('layoutOf', () => {
  it('reads cylinders and valves per cylinder from the rows', () => {
    expect(layoutOf(valveLayout(3, 3))).toEqual({ cylinders: 3, valvesPerCylinder: 3 });
    expect(layoutOf(valveLayout(1, 2))).toEqual({ cylinders: 1, valvesPerCylinder: 2 });
  });
});

describe('newValveDrafts', () => {
  it('uses the engine layout of the vehicle', () => {
    expect(positions(newValveDrafts({ cylinders: 1, valvesPerCylinder: 2 }, undefined))).toEqual([
      '1I1',
      '1E1',
    ]);
  });

  it('falls back to the layout of the last measurement, then to two cylinders with four valves', () => {
    const latest = [stored(1, ValveKind.Intake, 1), stored(1, ValveKind.Exhaust, 1)];

    expect(newValveDrafts({}, latest)).toHaveLength(2);
    expect(newValveDrafts(undefined, undefined)).toHaveLength(8);
  });

  it('prefills the old shim with the one installed last time', () => {
    const latest = [
      stored(1, ValveKind.Intake, 1, { shimOld: 2.5, shimNew: 2.45 }),
      stored(1, ValveKind.Exhaust, 1, { shimOld: 2.6 }),
    ];

    const drafts = newValveDrafts({ cylinders: 1, valvesPerCylinder: 2 }, latest);

    expect(drafts.map((draft) => draft.shimOld)).toEqual([2.45, 2.6]);
    expect(drafts.every((draft) => draft.measured === null && draft.shimNew === null)).toBe(true);
  });
});

describe('emptyChain', () => {
  it('takes the number of links from the wear limit of the vehicle', () => {
    expect(emptyChain({ chainWearLinks: 20 }).wearLinks).toBe(20);
    expect(emptyChain().wearLinks).toBeNull();
  });
});

describe('request and response', () => {
  it('sends only the templates of the log and leaves empty fields out', () => {
    const request = toMeasurementsRequest({
      ...NO_MEASUREMENTS,
      brakes: { ...emptyBrakes(), padFront: 3.5, fluidCondition: '  ' },
      tires: { ...emptyTires(), dotFront: ' 2324 ' },
    });

    expect(request.valveClearance).toBeUndefined();
    expect(request.chain).toBeUndefined();
    expect(JSON.parse(JSON.stringify(request))).toEqual({
      brakes: { padFront: 3.5 },
      tires: { dotFront: '2324' },
    });
  });

  it('sends an empty object when all templates were removed', () => {
    expect(JSON.parse(JSON.stringify(toMeasurementsRequest(NO_MEASUREMENTS)))).toEqual({});
    expect(hasMeasurements(NO_MEASUREMENTS)).toBe(false);
  });

  it('sends the chain boxes as they are', () => {
    const request = toMeasurementsRequest({
      ...NO_MEASUREMENTS,
      chain: { ...emptyChain(), lubricated: true },
    });

    expect(request.chain).toEqual(expect.objectContaining({ cleaned: false, lubricated: true }));
  });

  it('turns stored measurements into an editable copy that is sent back unchanged', () => {
    const response = {
      valveClearance: {
        valves: [stored(1, ValveKind.Intake, 1, { measured: 0.12, shimOld: 2.5, shimNew: 2.45 })],
      },
      chain: {
        slack: 30,
        wearLinks: 20,
        cleaned: true,
        slackStatus: MeasurementStatus.Ok,
        wearLengthStatus: MeasurementStatus.Unknown,
      },
    };

    const drafts = fromResponse(response);

    expect(drafts.brakes).toBeNull();
    expect(drafts.tires).toBeNull();
    expect(drafts.chain).toEqual({ ...emptyChain(), slack: 30, wearLinks: 20, cleaned: true });
    expect(JSON.parse(JSON.stringify(toMeasurementsRequest(drafts)))).toEqual({
      valveClearance: {
        valves: [
          { cylinder: 1, valve: 'INTAKE', index: 1, measured: 0.12, shimOld: 2.5, shimNew: 2.45 },
        ],
      },
      chain: { slack: 30, wearLinks: 20, cleaned: true, lubricated: false },
    });
    expect(fromResponse(undefined)).toBe(NO_MEASUREMENTS);
  });
});

describe('validation', () => {
  it('accepts lengths with up to three decimals within the limit', () => {
    expect(lengthError(null, 9.999)).toBeNull();
    expect(lengthError(0.125, 9.999)).toBeNull();
    expect(lengthError(0.1255, 9.999)).toBe('measurements.errors.decimals3');
    expect(lengthError(10, 9.999)).toBe('measurements.errors.range');
    expect(lengthError(-1, 9.999)).toBe('measurements.errors.range');
  });

  it('accepts pressures from 0 to 10 bar with two decimals', () => {
    expect(pressureError(2.25)).toBeNull();
    expect(pressureError(2.255)).toBe('measurements.errors.decimals2');
    expect(pressureError(10.5)).toBe('measurements.errors.range');
  });

  it('accepts whole numbers of links from 2 to 200', () => {
    expect(linksError(null)).toBeNull();
    expect(linksError(20)).toBeNull();
    expect(linksError(1)).toBe('measurements.errors.links');
    expect(linksError(20.5)).toBe('measurements.errors.links');
  });

  it('accepts an empty DOT or four digits', () => {
    expect(dotError('')).toBeNull();
    expect(dotError('2324')).toBeNull();
    expect(dotError('23/24')).toBe('measurements.errors.dot');
  });

  it('reports the first problem of all templates', () => {
    expect(
      measurementsError({
        ...NO_MEASUREMENTS,
        valveClearance: valveLayout(1, 2),
        brakes: emptyBrakes(),
        chain: emptyChain(),
        tires: emptyTires(),
      }),
    ).toBeNull();
    expect(
      measurementsError({
        ...NO_MEASUREMENTS,
        valveClearance: valveLayout(1, 2).map((draft) => ({ ...draft, shimNew: 100 })),
      }),
    ).toBe('measurements.errors.range');
    expect(
      measurementsError({ ...NO_MEASUREMENTS, brakes: { ...emptyBrakes(), discRear: 4.0001 } }),
    ).toBe('measurements.errors.decimals3');
    expect(
      measurementsError({ ...NO_MEASUREMENTS, chain: { ...emptyChain(), wearLinks: 300 } }),
    ).toBe('measurements.errors.links');
    expect(
      measurementsError({ ...NO_MEASUREMENTS, tires: { ...emptyTires(), dotRear: 'x' } }),
    ).toBe('measurements.errors.dot');
  });
});
