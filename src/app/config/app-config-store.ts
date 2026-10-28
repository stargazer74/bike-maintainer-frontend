import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { ConfigService, OperatingMode } from '../api-client';

/**
 * Operating mode of the backend: `portal` (accounts with login) or `household` (profile selection
 * without passwords, home network only).
 */
@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly configService = inject(ConfigService);
  private readonly currentMode = signal<OperatingMode>(OperatingMode.Portal);

  readonly mode = this.currentMode.asReadonly();
  readonly isHousehold = computed(() => this.currentMode() === OperatingMode.Household);

  /**
   * Asks the backend for its mode (runs once at app start). If that fails, the app stays in portal mode:
   * better to show a login page that does not work than to skip one that is needed.
   */
  load(): Promise<void> {
    return firstValueFrom(
      this.configService.getAppConfig().pipe(
        map((config) => config.mode),
        catchError(() => of(OperatingMode.Portal)),
        tap((mode) => this.currentMode.set(mode)),
        map(() => undefined),
      ),
    );
  }
}
