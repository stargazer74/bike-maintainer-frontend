import { computed, inject, Signal } from '@angular/core';
import { AppLanguage, LanguageService } from '../i18n/language';
import { AppConfigStore } from './app-config-store';

/** Links to the public website of the portal (WordPress, see bike-maintainer-portal). */
export interface WebsiteLinks {
  home: string;
  imprint: string;
  privacy: string;
  /** Form "Verträge hier kündigen" (§ 312k BGB) of the subscription. */
  cancel: string;
}

/** Paths of the website per language (Polylang: German without prefix, English under /en/). */
const PATHS: Record<AppLanguage, WebsiteLinks> = {
  de: { home: '/', imprint: '/impressum/', privacy: '/datenschutz/', cancel: '/kuendigen/' },
  en: {
    home: '/en/',
    imprint: '/en/legal-notice/',
    privacy: '/en/privacy/',
    cancel: '/en/cancel/',
  },
};

/** Links into the website at `baseUrl` (without trailing slash) in the given language. */
export function websiteLinks(baseUrl: string, lang: AppLanguage): WebsiteLinks {
  const paths = PATHS[lang];
  return {
    home: baseUrl + paths.home,
    imprint: baseUrl + paths.imprint,
    privacy: baseUrl + paths.privacy,
    cancel: baseUrl + paths.cancel,
  };
}

/**
 * Links in the active language, or `null` without a website (household mode or not configured) – then the app shows
 * no such links. Call in an injection context.
 */
export function injectWebsiteLinks(): Signal<WebsiteLinks | null> {
  const config = inject(AppConfigStore);
  const language = inject(LanguageService);
  return computed(() => {
    const baseUrl = config.websiteUrl();
    return baseUrl ? websiteLinks(baseUrl, language.lang()) : null;
  });
}
