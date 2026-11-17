import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';

/** Response header with the request's trace ID, set by the image's nginx for every /api/ request. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Shown characters of the trace ID: short enough to read out, still unique within the 14 days of kept logs. */
export const ERROR_ID_LENGTH = 8;

/**
 * Error ID of the last server error (5xx), shown in the shell until dismissed. Users can quote it in a report; the
 * logs of nginx (`trace_id=…`) and backend (`traceId`) contain the full ID.
 */
@Injectable({ providedIn: 'root' })
export class ErrorIdStore {
  private readonly id = signal<string | null>(null);

  readonly errorId = this.id.asReadonly();

  report(id: string): void {
    this.id.set(id);
  }

  dismiss(): void {
    this.id.set(null);
  }
}

/** Error ID of a server error, or null for other errors or without the header (e.g. the dev server's proxy). */
export function errorIdOf(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status < 500) {
    return null;
  }
  const requestId = error.headers?.get(REQUEST_ID_HEADER)?.trim();
  return requestId ? requestId.slice(0, ERROR_ID_LENGTH) : null;
}

/** Reports the error ID of every server error; the page's own error handling stays as it is. */
export const errorIdInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(ErrorIdStore);
  return next(request).pipe(
    catchError((error: unknown) => {
      const id = errorIdOf(error);
      if (id) {
        store.report(id);
      }
      return throwError(() => error);
    }),
  );
};
