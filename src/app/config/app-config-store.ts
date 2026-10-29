import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, map, retry, tap, timer } from 'rxjs';
import { ConfigService, OperatingMode } from '../api-client';

/** Pause before asking the backend again, e.g. while it is still starting after an update. */
export const CONFIG_RETRY_DELAY_MS = 3000;

/**
 * Operating mode of the backend: `portal` (accounts with login) or `household` (profile selection
 * without passwords, home network only).
 */
@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly configService = inject(ConfigService);
  private readonly currentMode = signal<OperatingMode>(OperatingMode.Portal);
  private readonly waiting = signal(false);

  readonly mode = this.currentMode.asReadonly();
  readonly isHousehold = computed(() => this.currentMode() === OperatingMode.Household);
  /** The backend did not answer yet; the app waits instead of starting in a mode it only guessed. */
  readonly waitingForServer = this.waiting.asReadonly();

  /**
   * Asks the backend for its mode (runs once at app start) and asks again until it answers. Guessing would
   * show a household the portal login, or skip a login that is needed.
   */
  load(): Promise<void> {
    return firstValueFrom(
      this.configService.getAppConfig().pipe(
        retry({
          delay: () => {
            this.waiting.set(true);
            return timer(CONFIG_RETRY_DELAY_MS);
          },
        }),
        tap((config) => {
          this.currentMode.set(config.mode);
          this.waiting.set(false);
        }),
        map(() => undefined),
      ),
    );
  }
}
