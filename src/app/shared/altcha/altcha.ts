import 'altcha';
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language';

/** Path the widget fetches a new proof-of-work challenge from (portal mode only). */
export const ALTCHA_CHALLENGE_URL = '/api/v1/auth/challenge';

/**
 * ALTCHA proof-of-work widget (web component of the npm package `altcha`). Solves the challenge in the
 * background as soon as it is shown; the solved payload goes into the `altcha` field of the request.
 * Texts come from Transloco (`account.altcha`), registered as the widget's translation of the active language.
 */
@Component({
  selector: 'app-altcha',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<altcha-widget
    #widget
    [attr.challenge]="challengeUrl"
    auto="onload"
    name="altcha"
    [attr.language]="language.lang()"
    (verified)="onVerified($event)"
    (statechange)="onStateChange($event)"
  ></altcha-widget>`,
  styleUrl: './altcha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Altcha {
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly widget = viewChild.required<ElementRef<HTMLElement>>('widget');

  protected readonly challengeUrl = ALTCHA_CHALLENGE_URL;
  private readonly solved = signal<string | null>(null);

  /** Base64 payload of the solved challenge; `null` until solved and again after expiry or reset. */
  readonly payload = this.solved.asReadonly();

  constructor() {
    effect(() => {
      const lang = this.language.lang();
      globalThis.$altcha.i18n.set(lang, this.transloco.translateObject('account.altcha', {}, lang));
    });
  }

  /** After the backend rejected the solution (`CAPTCHA_INVALID`): solve a new challenge. */
  reset(): void {
    this.solved.set(null);
    const element = this.widget().nativeElement as HTMLElement & { reset?: () => void };
    element.reset?.();
  }

  protected onVerified(event: Event): void {
    this.solved.set((event as CustomEvent<{ payload?: string }>).detail?.payload ?? null);
  }

  protected onStateChange(event: Event): void {
    const state = (event as CustomEvent<{ state?: string }>).detail?.state;
    if (state !== 'verified') {
      this.solved.set(null);
    }
  }
}
