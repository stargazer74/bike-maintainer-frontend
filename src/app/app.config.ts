import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withDisabledInitialNavigation,
} from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './api-client';
import { startApp } from './app-init';
import { authInterceptor } from './auth/auth-interceptor';
import { provideI18n } from './i18n/i18n.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The first navigation starts in startApp(), once the mode and the session are known.
    provideRouter(routes, withComponentInputBinding(), withDisabledInitialNavigation()),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Spring Security's cookie/header names for the CSRF token.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    provideAppInitializer(() => {
      void startApp();
    }),
    // German and English UI via Transloco; numbers/dates are formatted with the locale of the
    // active language through the localNumber/localDate pipes (see i18n/).
    provideI18n(),
    // Empty base path: requests go to the same origin (e.g. /api/v1/vehicles) and
    // are forwarded to the backend via proxy.conf.json in development.
    provideApi(''),
  ],
};
