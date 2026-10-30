import { MaintenanceMaterialRequest, MaterialUnit } from '../../../api-client';

/** One material row while recording maintenance. */
export interface MaterialDraft {
  /** Local identity for the list; not sent. */
  readonly key: number;
  readonly name: string;
  readonly partNumber: string;
  readonly quantity: number | null;
  readonly unit: MaterialUnit;
  readonly price: number | null;
  /** Performed task this material belongs to; must be one of the checked tasks of the log. */
  readonly taskId: number | null;
}

let nextKey = 1;

export function emptyMaterial(): MaterialDraft {
  return {
    key: nextKey++,
    name: '',
    partNumber: '',
    quantity: 1,
    unit: MaterialUnit.Piece,
    price: null,
    taskId: null,
  };
}

/** True if `value` has at most `decimals` decimal places (tolerant to floating point noise). */
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Translation key of the problem with a row, or `null` if it can be saved. */
export function materialDraftError(draft: MaterialDraft): string | null {
  if (!draft.name.trim()) {
    return 'materialForm.errors.nameRequired';
  }
  if (draft.quantity === null || !(draft.quantity > 0)) {
    return 'materialForm.errors.quantityRequired';
  }
  if (draft.quantity > MAX_QUANTITY) {
    return 'materialForm.errors.quantityTooHigh';
  }
  if (!hasAtMostDecimals(draft.quantity, 3)) {
    return 'materialForm.errors.quantityDecimals';
  }
  return amountError(draft.price);
}

/** Highest price / labor cost and quantity the backend accepts. */
export const MAX_AMOUNT = 99999.99;
export const MAX_QUANTITY = 999999.999;

/** Translation key of the problem with a price or labor cost (empty is fine), or `null` if it is valid. */
export function amountError(amount: number | null): string | null {
  if (amount === null) {
    return null;
  }
  if (amount < 0) {
    return 'materialForm.errors.priceNegative';
  }
  if (amount > MAX_AMOUNT) {
    return 'materialForm.errors.priceTooHigh';
  }
  if (!hasAtMostDecimals(amount, 2)) {
    return 'materialForm.errors.priceDecimals';
  }
  return null;
}

/** Request entries for the backend; empty part numbers and missing price/task are left out. */
export function toMaterialRequests(drafts: readonly MaterialDraft[]): MaintenanceMaterialRequest[] {
  return drafts.map((draft) => ({
    name: draft.name.trim(),
    partNumber: draft.partNumber.trim() || undefined,
    quantity: draft.quantity ?? 0,
    unit: draft.unit,
    price: draft.price ?? undefined,
    taskId: draft.taskId ?? undefined,
  }));
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Sum of all prices plus labor cost in integer cents (no floating point drift), or `null` if neither a price nor
 * labor cost is set. The price is the total for the row, not per unit.
 */
export function draftTotalCents(
  drafts: readonly MaterialDraft[],
  laborCost: number | null,
): number | null {
  const amounts = drafts.map((draft) => draft.price).filter((price) => price !== null);
  if (laborCost !== null) {
    amounts.push(laborCost);
  }
  if (amounts.length === 0) {
    return null;
  }
  return amounts.reduce((sum, amount) => sum + cents(amount), 0);
}
