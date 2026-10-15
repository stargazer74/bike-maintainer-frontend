import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

export const APP_LANGUAGES = ['de', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'de';

/** Angular locale (registered in i18n.config.ts) used for number/date formatting per UI language. */
const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  de: 'de-DE',
  en: 'en-GB',
};

const STORAGE_KEY = 'bm.language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (APP_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Single source of truth for the active UI language. Components read {@link lang}/{@link locale} as
 * signals; Transloco is kept in sync. Switching loads the translation file first and only then flips
 * the signal, so templates never render untranslated keys.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<AppLanguage>(DEFAULT_LANGUAGE);

  readonly lang = this.current.asReadonly();
  readonly locale = computed(() => LOCALE_BY_LANGUAGE[this.current()]);

  /** Initial language before login: stored choice, then browser language, then German. */
  initialize(): Promise<void> {
    return this.use(this.detectInitialLanguage(), false);
  }

  async use(lang: AppLanguage, remember = true): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.current.set(lang);
    this.document.documentElement.lang = lang;
    if (remember) {
      this.storage()?.setItem(STORAGE_KEY, lang);
    }
  }

  private detectInitialLanguage(): AppLanguage {
    const stored = this.storage()?.getItem(STORAGE_KEY);
    if (isAppLanguage(stored)) {
      return stored;
    }
    const browserLanguages = this.document.defaultView?.navigator.languages ?? [];
    const match = browserLanguages.map((tag) => tag.slice(0, 2).toLowerCase()).find(isAppLanguage);
    return match ?? DEFAULT_LANGUAGE;
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      // Storage can be unavailable (privacy mode); the language then simply isn't remembered.
      return null;
    }
  }
}
