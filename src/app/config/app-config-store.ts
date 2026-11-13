import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, map, retry, tap, timer } from 'rxjs';
import { ConfigService, OperatingMode, PaymentConfig } from '../api-client';

/** Pause before asking the backend again, e.g. while it is still starting after an update. */
export const CONFIG_RETRY_DELAY_MS = 3000;

/**
 * Public configuration of the backend: operating mode – `portal` (accounts with login) or `household` (profile
 * selection without passwords, home network only) – and, in portal mode, the address of the public website and the
 * public values for Paddle.js on the payment page.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly configService = inject(ConfigService);
  private readonly currentMode = signal<OperatingMode>(OperatingMode.Portal);
  private readonly waiting = signal(false);
  private readonly website = signal<string | null>(null);
  private readonly paymentConfig = signal<PaymentConfig | null>(null);

  readonly mode = this.currentMode.asReadonly();
  readonly isHousehold = computed(() => this.currentMode() === OperatingMode.Household);
  /** Address of the public website without trailing slash, `null` if there is none (always in household mode). */
  readonly websiteUrl = this.website.asReadonly();
  /** Client-side token and environment of Paddle.js; `null` without subscription (household mode). */
  readonly payment = this.paymentConfig.asReadonly();
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
          const website = config.mode === OperatingMode.Portal ? config.websiteUrl : null;
          this.website.set(website ? website.replace(/\/+$/, '') : null);
          this.paymentConfig.set(
            config.mode === OperatingMode.Portal && config.payment ? config.payment : null,
          );
          this.waiting.set(false);
        }),
        map(() => undefined),
      ),
    );
  }
}
