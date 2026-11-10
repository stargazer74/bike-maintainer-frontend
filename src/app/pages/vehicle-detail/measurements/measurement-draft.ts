import {
  MaintenanceMeasurementsRequest,
  MaintenanceMeasurementsResponse,
  ValveKind,
  ValveMeasurementResponse,
  VehicleSpecifications,
  WorksheetTemplate,
} from '../../../api-client';

/** One valve row while recording valve clearance. */
export interface ValveDraft {
  readonly cylinder: number;
  readonly valve: ValveKind;
  /** Number of the valve of this kind in the cylinder (1, or 1–2 with two of a kind). */
  readonly index: number;
  readonly measured: number | null;
  readonly shimOld: number | null;
  readonly shimNew: number | null;
}

export interface BrakeDraft {
  readonly padFront: number | null;
  readonly padRear: number | null;
  readonly discFront: number | null;
  readonly discRear: number | null;
  readonly discConditionFront: string;
  readonly discConditionRear: string;
  readonly fluidCondition: string;
}

export interface ChainDraft {
  readonly slack: number | null;
  readonly wearLength: number | null;
  readonly wearLinks: number | null;
  readonly sprocketCondition: string;
  readonly rearSprocketCondition: string;
  readonly cleaned: boolean;
  readonly lubricated: boolean;
}

export interface TireDraft {
  readonly pressureFront: number | null;
  readonly pressureRear: number | null;
  readonly treadFront: number | null;
  readonly treadRear: number | null;
  readonly dotFront: string;
  readonly dotRear: string;
  readonly conditionFront: string;
  readonly conditionRear: string;
}

/** Measurements of a maintenance log while editing; `null` means the template is not part of the log. */
export interface MeasurementDrafts {
  readonly valveClearance: readonly ValveDraft[] | null;
  readonly brakes: BrakeDraft | null;
  readonly chain: ChainDraft | null;
  readonly tires: TireDraft | null;
}

/** Key of a template in {@link MeasurementDrafts} and in the request/response objects. */
export type MeasurementKey = keyof MeasurementDrafts;

export const MEASUREMENT_KEYS: Readonly<Record<WorksheetTemplate, MeasurementKey>> = {
  [WorksheetTemplate.ValveClearance]: 'valveClearance',
  [WorksheetTemplate.Brakes]: 'brakes',
  [WorksheetTemplate.Chain]: 'chain',
  [WorksheetTemplate.Tires]: 'tires',
};

export const NO_MEASUREMENTS: MeasurementDrafts = {
  valveClearance: null,
  brakes: null,
  chain: null,
  tires: null,
};

/** Default engine layout when neither the vehicle nor an earlier measurement knows it. */
export const DEFAULT_CYLINDERS = 2;
export const DEFAULT_VALVES_PER_CYLINDER = 4;

/** Valves of one cylinder: 2 = intake, exhaust; 3 = two intakes, one exhaust; 4 = two of each. */
function cylinderValves(valvesPerCylinder: number): { valve: ValveKind; index: number }[] {
  const intakes = valvesPerCylinder >= 3 ? 2 : 1;
  const exhausts = valvesPerCylinder >= 4 ? 2 : 1;
  return [
    ...Array.from({ length: intakes }, (_, i) => ({ valve: ValveKind.Intake, index: i + 1 })),
    ...Array.from({ length: exhausts }, (_, i) => ({ valve: ValveKind.Exhaust, index: i + 1 })),
  ];
}

export function valveKey(valve: Pick<ValveDraft, 'cylinder' | 'valve' | 'index'>): string {
  return `${valve.cylinder}-${valve.valve}-${valve.index}`;
}

/**
 * Valve rows for an engine layout, ordered by cylinder, intake before exhaust, then index (like the worksheet).
 * Values of `previous` rows at the same position are kept, so changing the layout loses nothing that still fits.
 */
export function valveLayout(
  cylinders: number,
  valvesPerCylinder: number,
  previous: readonly ValveDraft[] = [],
): ValveDraft[] {
  const kept = new Map(previous.map((draft) => [valveKey(draft), draft]));
  const rows: ValveDraft[] = [];
  for (let cylinder = 1; cylinder <= cylinders; cylinder++) {
    for (const { valve, index } of cylinderValves(valvesPerCylinder)) {
      const position = { cylinder, valve, index };
      rows.push(
        kept.get(valveKey(position)) ?? {
          ...position,
          measured: null,
          shimOld: null,
          shimNew: null,
        },
      );
    }
  }
  return rows;
}

/** Number of cylinders and valves per cylinder of existing valve rows. */
export function layoutOf(valves: readonly Pick<ValveDraft, 'cylinder' | 'valve' | 'index'>[]): {
  cylinders: number;
  valvesPerCylinder: number;
} {
  const cylinders = Math.max(...valves.map((valve) => valve.cylinder));
  const ofFirst = valves.filter((valve) => valve.cylinder === 1).length;
  return {
    cylinders,
    valvesPerCylinder: Math.min(Math.max(ofFirst, 2), 4),
  };
}

/**
 * Valve rows for a new valve clearance measurement. The layout comes from the vehicle, else from the last
 * measurement, else the default; "shim old" is the shim installed last time (its new shim, or the old one if it
 * was not changed).
 */
export function newValveDrafts(
  specification: VehicleSpecifications | undefined,
  latest: readonly ValveMeasurementResponse[] | undefined,
): ValveDraft[] {
  const fromLatest = latest?.length ? layoutOf(latest) : null;
  const cylinders = specification?.cylinders ?? fromLatest?.cylinders ?? DEFAULT_CYLINDERS;
  const valvesPerCylinder =
    specification?.valvesPerCylinder ??
    fromLatest?.valvesPerCylinder ??
    DEFAULT_VALVES_PER_CYLINDER;
  const installed = new Map(
    (latest ?? []).map((valve) => [valveKey(valve), valve.shimNew ?? valve.shimOld ?? null]),
  );
  return valveLayout(cylinders, valvesPerCylinder).map((draft) => ({
    ...draft,
    shimOld: installed.get(valveKey(draft)) ?? null,
  }));
}

export function emptyBrakes(): BrakeDraft {
  return {
    padFront: null,
    padRear: null,
    discFront: null,
    discRear: null,
    discConditionFront: '',
    discConditionRear: '',
    fluidCondition: '',
  };
}

/** The number of links is taken from the vehicle's wear limit, so the measurement can be checked against it. */
export function emptyChain(specification?: VehicleSpecifications): ChainDraft {
  return {
    slack: null,
    wearLength: null,
    wearLinks: specification?.chainWearLinks ?? null,
    sprocketCondition: '',
    rearSprocketCondition: '',
    cleaned: false,
    lubricated: false,
  };
}

export function emptyTires(): TireDraft {
  return {
    pressureFront: null,
    pressureRear: null,
    treadFront: null,
    treadRear: null,
    dotFront: '',
    dotRear: '',
    conditionFront: '',
    conditionRear: '',
  };
}

/** Editable copy of the stored measurements of a log. */
export function fromResponse(
  response: MaintenanceMeasurementsResponse | undefined,
): MeasurementDrafts {
  if (!response) {
    return NO_MEASUREMENTS;
  }
  const { valveClearance, brakes, chain, tires } = response;
  return {
    valveClearance: valveClearance
      ? valveClearance.valves.map((valve) => ({
          cylinder: valve.cylinder,
          valve: valve.valve,
          index: valve.index,
          measured: valve.measured ?? null,
          shimOld: valve.shimOld ?? null,
          shimNew: valve.shimNew ?? null,
        }))
      : null,
    brakes: brakes
      ? {
          padFront: brakes.padFront ?? null,
          padRear: brakes.padRear ?? null,
          discFront: brakes.discFront ?? null,
          discRear: brakes.discRear ?? null,
          discConditionFront: brakes.discConditionFront ?? '',
          discConditionRear: brakes.discConditionRear ?? '',
          fluidCondition: brakes.fluidCondition ?? '',
        }
      : null,
    chain: chain
      ? {
          slack: chain.slack ?? null,
          wearLength: chain.wearLength ?? null,
          wearLinks: chain.wearLinks ?? null,
          sprocketCondition: chain.sprocketCondition ?? '',
          rearSprocketCondition: chain.rearSprocketCondition ?? '',
          cleaned: chain.cleaned ?? false,
          lubricated: chain.lubricated ?? false,
        }
      : null,
    tires: tires
      ? {
          pressureFront: tires.pressureFront ?? null,
          pressureRear: tires.pressureRear ?? null,
          treadFront: tires.treadFront ?? null,
          treadRear: tires.treadRear ?? null,
          dotFront: tires.dotFront ?? '',
          dotRear: tires.dotRear ?? '',
          conditionFront: tires.conditionFront ?? '',
          conditionRear: tires.conditionRear ?? '',
        }
      : null,
  };
}

export function hasMeasurements(drafts: MeasurementDrafts): boolean {
  return Object.values(drafts).some((draft) => draft !== null);
}

function num(value: number | null): number | undefined {
  return value ?? undefined;
}

function text(value: string): string | undefined {
  return value.trim() || undefined;
}

/**
 * Request for the backend. The object always lists every template of the log, so templates removed while editing
 * are deleted; empty fields are left out.
 */
export function toMeasurementsRequest(drafts: MeasurementDrafts): MaintenanceMeasurementsRequest {
  const { valveClearance, brakes, chain, tires } = drafts;
  return {
    valveClearance: valveClearance
      ? {
          valves: valveClearance.map((valve) => ({
            cylinder: valve.cylinder,
            valve: valve.valve,
            index: valve.index,
            measured: num(valve.measured),
            shimOld: num(valve.shimOld),
            shimNew: num(valve.shimNew),
          })),
        }
      : undefined,
    brakes: brakes
      ? {
          padFront: num(brakes.padFront),
          padRear: num(brakes.padRear),
          discFront: num(brakes.discFront),
          discRear: num(brakes.discRear),
          discConditionFront: text(brakes.discConditionFront),
          discConditionRear: text(brakes.discConditionRear),
          fluidCondition: text(brakes.fluidCondition),
        }
      : undefined,
    chain: chain
      ? {
          slack: num(chain.slack),
          wearLength: num(chain.wearLength),
          wearLinks: num(chain.wearLinks),
          sprocketCondition: text(chain.sprocketCondition),
          rearSprocketCondition: text(chain.rearSprocketCondition),
          cleaned: chain.cleaned,
          lubricated: chain.lubricated,
        }
      : undefined,
    tires: tires
      ? {
          pressureFront: num(tires.pressureFront),
          pressureRear: num(tires.pressureRear),
          treadFront: num(tires.treadFront),
          treadRear: num(tires.treadRear),
          dotFront: text(tires.dotFront),
          dotRear: text(tires.dotRear),
          conditionFront: text(tires.conditionFront),
          conditionRear: text(tires.conditionRear),
        }
      : undefined,
  };
}

/** True if `value` has at most `decimals` decimal places (tolerant to floating point noise). */
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Translation key of the problem with a length in mm (3 decimals) up to `max`, or `null` if empty or valid. */
export function lengthError(value: number | null, max: number): string | null {
  if (value === null) {
    return null;
  }
  if (value < 0 || value > max) {
    return 'measurements.errors.range';
  }
  return hasAtMostDecimals(value, 3) ? null : 'measurements.errors.decimals3';
}

/** Translation key of the problem with a tyre pressure in bar (0–10, 2 decimals), or `null`. */
export function pressureError(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  if (value < 0 || value > 10) {
    return 'measurements.errors.range';
  }
  return hasAtMostDecimals(value, 2) ? null : 'measurements.errors.decimals2';
}

/** Translation key of the problem with the number of links (whole number 2–200), or `null`. */
export function linksError(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return Number.isInteger(value) && value >= 2 && value <= 200 ? null : 'measurements.errors.links';
}

/** Translation key of the problem with a DOT code (week and year, four digits), or `null`. */
export function dotError(value: string): string | null {
  const trimmed = value.trim();
  return !trimmed || /^[0-9]{4}$/.test(trimmed) ? null : 'measurements.errors.dot';
}

/** Highest values the backend accepts. */
export const MAX_CLEARANCE = 9.999;
export const MAX_SHIM = 99.999;
export const MAX_LENGTH = 999.999;
export const MAX_TREAD = 99.999;

/** Translation key of the first problem in the measurements, or `null` if they can be saved. */
export function measurementsError(drafts: MeasurementDrafts): string | null {
  const errors: (string | null)[] = [];
  for (const valve of drafts.valveClearance ?? []) {
    errors.push(
      lengthError(valve.measured, MAX_CLEARANCE),
      lengthError(valve.shimOld, MAX_SHIM),
      lengthError(valve.shimNew, MAX_SHIM),
    );
  }
  const { brakes, chain, tires } = drafts;
  if (brakes) {
    errors.push(
      ...[brakes.padFront, brakes.padRear, brakes.discFront, brakes.discRear].map((value) =>
        lengthError(value, MAX_LENGTH),
      ),
    );
  }
  if (chain) {
    errors.push(
      lengthError(chain.slack, MAX_LENGTH),
      lengthError(chain.wearLength, MAX_LENGTH),
      linksError(chain.wearLinks),
    );
  }
  if (tires) {
    errors.push(
      pressureError(tires.pressureFront),
      pressureError(tires.pressureRear),
      lengthError(tires.treadFront, MAX_TREAD),
      lengthError(tires.treadRear, MAX_TREAD),
      dotError(tires.dotFront),
      dotError(tires.dotRear),
    );
  }
  return errors.find((error) => error !== null) ?? null;
}
