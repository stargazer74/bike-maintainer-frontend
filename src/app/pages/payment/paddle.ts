import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/** Address of Paddle.js v2; Paddle requires loading it directly from its CDN. */
export const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

/** Event of Paddle.js, as far as the payment page reads it. */
export interface PaddleEvent {
  name?: string;
}

/** The part of the Paddle.js API the payment page uses. */
export interface PaddleApi {
  Environment: { set(environment: 'sandbox'): void };
  Initialize(options: {
    token: string;
    eventCallback?: (event: PaddleEvent) => void;
    checkout?: { settings?: PaddleCheckoutSettings };
  }): void;
  Checkout: {
    open(options: { transactionId: string; settings?: PaddleCheckoutSettings }): void;
  };
}

export interface PaddleCheckoutSettings {
  displayMode?: 'overlay' | 'inline';
  locale?: string;
  successUrl?: string;
}

/**
 * Loads Paddle.js once and resolves with its global object. Only the payment page uses this, so no other page of the
 * app sends a request to Paddle. Replaced in tests.
 */
export const LOAD_PADDLE = new InjectionToken<() => Promise<PaddleApi>>('LOAD_PADDLE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    let loading: Promise<PaddleApi> | null = null;
    return () => {
      loading ??= new Promise<PaddleApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PADDLE_JS_URL;
        script.async = true;
        script.onload = () => {
          const paddle = (document.defaultView as (Window & { Paddle?: PaddleApi }) | null)?.Paddle;
          if (paddle) {
            resolve(paddle);
          } else {
            reject(new Error('Paddle.js did not define Paddle'));
          }
        };
        script.onerror = () => {
          loading = null;
          reject(new Error('Paddle.js could not be loaded'));
        };
        document.head.appendChild(script);
      });
      return loading;
    };
  },
});
