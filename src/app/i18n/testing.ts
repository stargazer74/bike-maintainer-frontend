import { TranslocoTestingModule } from '@jsverse/transloco';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';
import { APP_LANGUAGES, DEFAULT_LANGUAGE } from './language';

/** Transloco for unit tests, backed by the real translation files (no HTTP). */
export function translocoTesting() {
  return TranslocoTestingModule.forRoot({
    langs: { de, en },
    translocoConfig: {
      availableLangs: [...APP_LANGUAGES],
      defaultLang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
      reRenderOnLangChange: true,
    },
    preloadLangs: true,
  });
}
