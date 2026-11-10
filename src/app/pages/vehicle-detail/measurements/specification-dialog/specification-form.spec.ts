import { ValveAdjustment } from '../../../../api-client';
import {
  fieldError,
  hasErrors,
  SPECIFICATION_GROUPS,
  toDraft,
  toSpecification,
  wearLinksError,
} from './specification-form';

function field(key: string) {
  const found = SPECIFICATION_GROUPS.flatMap((group) => group.fields).find((f) => f.key === key);
  if (!found) {
    throw new Error(key);
  }
  return found;
}

describe('specification form', () => {
  it('turns stored values into a form with empty fields and back, leaving empty fields out', () => {
    const draft = toDraft({ cylinders: 2, valveAdjustment: ValveAdjustment.Shim, shimStep: 0.05 });

    expect(draft.cylinders).toBe(2);
    expect(draft.treadDepthMin).toBeNull();
    expect(toSpecification({ ...draft, treadDepthMin: 1.6, cylinders: null })).toEqual({
      valveAdjustment: 'SHIM',
      shimStep: 0.05,
      treadDepthMin: 1.6,
    });
  });

  it('checks the limits and decimals of the API', () => {
    const draft = toDraft({});

    expect(fieldError(field('shimStep'), { ...draft, shimStep: 0 })).toBe(
      'measurements.errors.range',
    );
    expect(fieldError(field('shimStep'), { ...draft, shimStep: 0.025 })).toBeNull();
    expect(fieldError(field('tirePressureFront'), { ...draft, tirePressureFront: 2.505 })).toBe(
      'measurements.errors.decimals2',
    );
    expect(fieldError(field('brakePadMinFront'), { ...draft, brakePadMinFront: 1.0005 })).toBe(
      'measurements.errors.decimals3',
    );
  });

  it('marks both limits of a range whose minimum is above the maximum', () => {
    const draft = { ...toDraft({}), intakeClearanceMin: 0.2, intakeClearanceMax: 0.1 };

    expect(fieldError(field('intakeClearanceMin'), draft)).toBe('specification.errors.minAboveMax');
    expect(fieldError(field('intakeClearanceMax'), draft)).toBe('specification.errors.minAboveMax');
    expect(fieldError(field('exhaustClearanceMin'), draft)).toBeNull();
    expect(hasErrors(draft, SPECIFICATION_GROUPS)).toBe(true);
    // Only the offered templates count.
    expect(hasErrors(draft, SPECIFICATION_GROUPS.slice(1))).toBe(false);
  });

  it('accepts 2 to 200 chain links', () => {
    expect(wearLinksError({ ...toDraft({}), chainWearLinks: 20 })).toBeNull();
    expect(wearLinksError({ ...toDraft({}), chainWearLinks: 1 })).toBe('measurements.errors.links');
  });
});
