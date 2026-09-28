import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './api-client';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // App is German-only; drives DecimalPipe/DatePipe defaults (e.g. "20.500" instead of "20,500").
    { provide: LOCALE_ID, useValue: 'de-DE' },
    // Empty base path: requests go to the same origin (e.g. /api/v1/vehicles) and
    // are forwarded to the backend via proxy.conf.json in development.
    provideApi('')
  ]
};
