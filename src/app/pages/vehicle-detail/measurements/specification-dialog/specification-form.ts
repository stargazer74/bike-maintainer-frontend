import { ValveAdjustment, VehicleSpecifications, WorksheetTemplate } from '../../../../api-client';

/** Target values that are entered as a decimal number. */
export type DecimalSpecKey = Exclude<
  keyof VehicleSpecifications,
  'cylinders' | 'valvesPerCylinder' | 'valveAdjustment' | 'chainWearLinks'
>;

/** Form state: every field may be empty. */
export type SpecificationDraft = {
  readonly [K in keyof VehicleSpecifications]-?: K extends 'valveAdjustment'
    ? ValveAdjustment | null
    : number | null;
};

export interface DecimalField {
  readonly key: DecimalSpecKey;
  /** Translation key of the label. */
  readonly label: string;
  readonly unit: 'mm' | 'bar';
  readonly min: number;
  readonly max: number;
  readonly decimals: 2 | 3;
}

export interface SpecificationGroup {
  readonly template: WorksheetTemplate;
  /** Translation key of the heading. */
  readonly title: string;
  readonly fields: readonly DecimalField[];
}

function mm(key: DecimalSpecKey, label: string, max: number, min = 0): DecimalField {
  return { key, label: `specification.fields.${label}`, unit: 'mm', min, max, decimals: 3 };
}

/** Fields per template, with the limits of the API. Engine layout and chain links are handled separately. */
export const SPECIFICATION_GROUPS: readonly SpecificationGroup[] = [
  {
    template: WorksheetTemplate.ValveClearance,
    title: 'measurements.templates.valveClearance',
    fields: [
      mm('intakeClearanceMin', 'intakeClearanceMin', 9.999),
      mm('intakeClearanceMax', 'intakeClearanceMax', 9.999),
      mm('exhaustClearanceMin', 'exhaustClearanceMin', 9.999),
      mm('exhaustClearanceMax', 'exhaustClearanceMax', 9.999),
      mm('shimStep', 'shimStep', 1, 0.001),
      mm('shimMin', 'shimMin', 99.999),
      mm('shimMax', 'shimMax', 99.999),
    ],
  },
  {
    template: WorksheetTemplate.Brakes,
    title: 'measurements.templates.brakes',
    fields: [
      mm('brakePadMinFront', 'brakePadMinFront', 999.999),
      mm('brakePadMinRear', 'brakePadMinRear', 999.999),
      mm('brakeDiscMinFront', 'brakeDiscMinFront', 999.999),
      mm('brakeDiscMinRear', 'brakeDiscMinRear', 999.999),
    ],
  },
  {
    template: WorksheetTemplate.Chain,
    title: 'measurements.templates.chain',
    fields: [
      mm('chainSlackMin', 'chainSlackMin', 999.999),
      mm('chainSlackMax', 'chainSlackMax', 999.999),
      mm('chainWearMaxLength', 'chainWearMaxLength', 999.999),
    ],
  },
  {
    template: WorksheetTemplate.Tires,
    title: 'measurements.templates.tires',
    fields: [
      {
        key: 'tirePressureFront',
        label: 'specification.fields.tirePressureFront',
        unit: 'bar',
        min: 0,
        max: 10,
        decimals: 2,
      },
      {
        key: 'tirePressureRear',
        label: 'specification.fields.tirePressureRear',
        unit: 'bar',
        min: 0,
        max: 10,
        decimals: 2,
      },
      mm('treadDepthMin', 'treadDepthMin', 99.999),
    ],
  },
];

/** Lower and upper limit that must not be swapped. */
const RANGES: readonly (readonly [DecimalSpecKey, DecimalSpecKey])[] = [
  ['intakeClearanceMin', 'intakeClearanceMax'],
  ['exhaustClearanceMin', 'exhaustClearanceMax'],
  ['shimMin', 'shimMax'],
  ['chainSlackMin', 'chainSlackMax'],
];

const ALL_KEYS: readonly (keyof VehicleSpecifications)[] = [
  'cylinders',
  'valvesPerCylinder',
  'valveAdjustment',
  'chainWearLinks',
  ...SPECIFICATION_GROUPS.flatMap((group) => group.fields.map((field) => field.key)),
];

export function toDraft(specification: VehicleSpecifications): SpecificationDraft {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, specification[key] ?? null]),
  ) as SpecificationDraft;
}

/** Request for the backend: empty fields are left out (and so cleared). */
export function toSpecification(draft: SpecificationDraft): VehicleSpecifications {
  return Object.fromEntries(
    ALL_KEYS.filter((key) => draft[key] !== null).map((key) => [key, draft[key]]),
  ) as VehicleSpecifications;
}

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Translation key of the problem with a decimal field, or `null` if it is empty or valid. */
export function fieldError(field: DecimalField, draft: SpecificationDraft): string | null {
  const value = draft[field.key];
  if (value === null) {
    return null;
  }
  if (value < field.min || value > field.max) {
    return 'measurements.errors.range';
  }
  if (!hasAtMostDecimals(value, field.decimals)) {
    return field.decimals === 2 ? 'measurements.errors.decimals2' : 'measurements.errors.decimals3';
  }
  const range = RANGES.find(([min, max]) => min === field.key || max === field.key);
  if (range) {
    const [min, max] = range.map((key) => draft[key]);
    if (min !== null && max !== null && min > max) {
      return 'specification.errors.minAboveMax';
    }
  }
  return null;
}

/** Translation key of the problem with the number of chain links, or `null`. */
export function wearLinksError(draft: SpecificationDraft): string | null {
  const value = draft.chainWearLinks;
  return value === null || (Number.isInteger(value) && value >= 2 && value <= 200)
    ? null
    : 'measurements.errors.links';
}

/** True if any field of the given templates has a problem. */
export function hasErrors(
  draft: SpecificationDraft,
  groups: readonly SpecificationGroup[],
): boolean {
  return (
    wearLinksError(draft) !== null ||
    groups.some((group) => group.fields.some((field) => fieldError(field, draft) !== null))
  );
}
