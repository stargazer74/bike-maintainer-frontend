import { VehicleResponse, VehicleType } from '../api-client';
import { TranslatableText } from '../i18n/translatable-text';

/** Material Symbol per vehicle type; `material-symbols` has no ATV icon, so the quad uses the helmet `sports_motorsports`. */
const VEHICLE_ICONS: Record<VehicleType, string> = {
  [VehicleType.Motorcycle]: 'two_wheeler',
  [VehicleType.Car]: 'directions_car',
  [VehicleType.Bicycle]: 'pedal_bike',
  [VehicleType.EBike]: 'electric_bike',
  [VehicleType.Quad]: 'sports_motorsports',
  [VehicleType.Scooter]: 'moped',
};

export function vehicleIcon(type: VehicleResponse['type']): string {
  return VEHICLE_ICONS[type] ?? 'two_wheeler';
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
