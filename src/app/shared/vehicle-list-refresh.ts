import { Injectable, signal } from '@angular/core';

/** Key in the navigation state to the dashboard: name of the vehicle that was just deleted, to confirm it there. */
export const DELETED_VEHICLE_STATE = 'deletedVehicle';

/**
 * Tells lists of vehicles outside the current page (the shell's vehicle navigation) that the vehicles changed, e.g.
 * after one was deleted on its own page. Lists read {@link version} in their resource params and reload on a change.
 */
@Injectable({ providedIn: 'root' })
export class VehicleListRefresh {
  private readonly counter = signal(0);
  readonly version = this.counter.asReadonly();

  notify(): void {
    this.counter.update((count) => count + 1);
  }
}
