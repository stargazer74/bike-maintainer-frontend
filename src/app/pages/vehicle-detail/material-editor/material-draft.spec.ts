import { MaterialUnit } from '../../../api-client';
import {
  draftTotalCents,
  emptyMaterial,
  MaterialDraft,
  amountError,
  materialDraftError,
  toMaterialRequests,
} from './material-draft';

function draft(changes: Partial<MaterialDraft>): MaterialDraft {
  return { ...emptyMaterial(), name: 'Öl', ...changes };
}

describe('material drafts', () => {
  it('starts with one piece and gives every row its own key', () => {
    const first = emptyMaterial();
    expect(first).toEqual(expect.objectContaining({ quantity: 1, unit: MaterialUnit.Piece }));
    expect(first.key).not.toBe(emptyMaterial().key);
  });

  it.each([
    [draft({ name: '  ' }), 'materialForm.errors.nameRequired'],
    [draft({ quantity: null }), 'materialForm.errors.quantityRequired'],
    [draft({ quantity: 0 }), 'materialForm.errors.quantityRequired'],
    [draft({ quantity: -1 }), 'materialForm.errors.quantityRequired'],
    [draft({ quantity: 0.0005 }), 'materialForm.errors.quantityDecimals'],
    [draft({ quantity: 1.125 }), null],
    [draft({ price: -0.01 }), 'materialForm.errors.priceNegative'],
    [draft({ price: 1.005 }), 'materialForm.errors.priceDecimals'],
    [draft({ price: 100000 }), 'materialForm.errors.priceTooHigh'],
    [draft({ price: 99999.99 }), null],
    [draft({ quantity: 1000000 }), 'materialForm.errors.quantityTooHigh'],
    [draft({ quantity: 999999.999 }), null],
    [draft({ price: 0 }), null],
    [draft({ price: 12.9 }), null],
    [draft({}), null],
  ])('checks %o', (value, expected) => {
    expect(materialDraftError(value)).toBe(expected);
  });

  it('builds requests without empty part number, price and task', () => {
    expect(
      toMaterialRequests([
        draft({ name: ' Motoröl ', partNumber: '  ', quantity: 1.5, unit: MaterialUnit.Liter }),
        draft({ partNumber: ' 123-A ', price: 9.9, taskId: 4 }),
      ]),
    ).toEqual([
      {
        name: 'Motoröl',
        partNumber: undefined,
        quantity: 1.5,
        unit: MaterialUnit.Liter,
        price: undefined,
        taskId: undefined,
      },
      {
        name: 'Öl',
        partNumber: '123-A',
        quantity: 1,
        unit: MaterialUnit.Piece,
        price: 9.9,
        taskId: 4,
      },
    ]);
  });

  it('sums in cents without floating point drift', () => {
    expect(draftTotalCents([draft({ price: 0.1 }), draft({ price: 0.2 })], null)).toBe(30);
    expect(draftTotalCents([draft({ price: 10 }), draft({})], 25.5)).toBe(3550);
  });

  it('has no sum without any price or labor cost', () => {
    expect(draftTotalCents([draft({})], null)).toBeNull();
    expect(draftTotalCents([], null)).toBeNull();
    expect(draftTotalCents([], 0)).toBe(0);
  });

  it('validates a labor cost like a price', () => {
    expect(amountError(null)).toBeNull();
    expect(amountError(0)).toBeNull();
    expect(amountError(-1)).toBe('materialForm.errors.priceNegative');
    expect(amountError(100000)).toBe('materialForm.errors.priceTooHigh');
    expect(amountError(1.005)).toBe('materialForm.errors.priceDecimals');
  });
});
