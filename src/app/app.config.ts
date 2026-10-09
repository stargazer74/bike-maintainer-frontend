import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './api-client';
import { provideI18n } from './i18n/i18n.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // German and English UI via Transloco; numbers/dates are formatted with the locale of the
    // active language through the localNumber/localDate pipes (see i18n/).
    provideI18n(),
    // Empty base path: requests go to the same origin (e.g. /api/v1/vehicles) and
    // are forwarded to the backend via proxy.conf.json in development.
    provideApi('')
  ]
};
