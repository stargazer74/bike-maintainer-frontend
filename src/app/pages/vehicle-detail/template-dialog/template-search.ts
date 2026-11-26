import { VehicleType } from '../../../api-client';

export interface TemplateSearchParams {
  make: string;
  type: VehicleType;
  model: string;
  modelYear?: number;
}

/**
 * Search parameters for "is there a template for this vehicle": only with a make of at least two characters and a
 * model. Shared by the hint in the vehicle form and the offer after creating, so both always agree.
 */
export function templateSearchParams(vehicle: {
  make?: string | null;
  model?: string | null;
  type: VehicleType;
  modelYear?: number | null;
}): TemplateSearchParams | null {
  const make = vehicle.make?.trim() ?? '';
  const model = vehicle.model?.trim() ?? '';
  if (make.length < 2 || !model) {
    return null;
  }
  return {
    make,
    type: vehicle.type,
    model,
    modelYear: typeof vehicle.modelYear === 'number' ? vehicle.modelYear : undefined,
  };
}
