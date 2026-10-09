import { VehicleResponse } from '../api-client';
import { TranslatableText } from '../i18n/translatable-text';

export function vehicleIcon(type: VehicleResponse['type']): string {
  return type === 'CAR' ? 'directions_car' : 'two_wheeler';
}

/** "Make Model • Baujahr 2022"; null if the vehicle has neither make/model nor model year. */
export function vehicleSubtitle(
  vehicle: Pick<VehicleResponse, 'make' | 'model' | 'modelYear'>,
): TranslatableText | null {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const year = vehicle.modelYear;
  if (makeModel && year) {
    return { key: 'vehicle.subtitleMakeModelYear', params: { makeModel, year } };
  }
  if (year) {
    return { key: 'vehicle.subtitleYear', params: { year } };
  }
  return makeModel ? { key: 'vehicle.subtitleMakeModel', params: { makeModel } } : null;
}
