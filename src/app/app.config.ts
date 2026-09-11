import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './api-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Empty base path: requests go to the same origin (e.g. /api/v1/vehicles) and
    // are forwarded to the backend via proxy.conf.json in development.
    provideApi('')
  ]
};
