import { VehicleResponse } from '../api-client';

export function vehicleIcon(type: VehicleResponse['type']): string {
  return type === 'CAR' ? 'directions_car' : 'two_wheeler';
}

export function vehicleSubtitle(
  vehicle: Pick<VehicleResponse, 'make' | 'model' | 'modelYear'>,
): string {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return [makeModel, vehicle.modelYear ? `Baujahr ${vehicle.modelYear}` : '']
    .filter(Boolean)
    .join(' • ');
}
