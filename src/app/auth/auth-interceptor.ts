import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AppConfigStore } from '../config/app-config-store';
import { entryUrlTree } from './auth-guards';
import { AuthStore } from './auth-store';

/**
 * Auth calls whose 401 is an expected answer and handled by the caller: a failed login, the start-up
 * check whether anyone is logged in, and logging out of a session that has already expired.
 */
function handlesOwn401(request: HttpRequest<unknown>): boolean {
  const path = new URL(request.url, 'http://localhost').pathname;
  return (
    path === '/api/v1/auth/login' ||
    path === '/api/v1/auth/logout' ||
    (path === '/api/v1/auth/me' && request.method === 'GET')
  );
}

/**
 * A 401 on any other call means the session has expired: back to the login page (portal) or the profile
 * selection (household), then return here.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const config = inject(AppConfigStore);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !handlesOwn401(request)) {
        store.clear();
        void router.navigateByUrl(entryUrlTree(router, config, router.url));
      }
      return throwError(() => error);
    }),
  );
};
