import { VehicleType } from '../api-client';
import { vehicleIcon } from './vehicle-format';

describe('vehicleIcon', () => {
  it.each([
    [VehicleType.Motorcycle, 'two_wheeler'],
    [VehicleType.Car, 'directions_car'],
    [VehicleType.Bicycle, 'pedal_bike'],
    [VehicleType.EBike, 'electric_bike'],
    [VehicleType.Quad, 'sports_motorsports'],
    [VehicleType.Scooter, 'moped'],
  ])('%s → %s', (type, icon) => {
    expect(vehicleIcon(type)).toBe(icon);
  });

  it('falls back to the motorcycle icon for a type unknown to this client', () => {
    expect(vehicleIcon('TRIKE' as VehicleType)).toBe('two_wheeler');
  });
});
