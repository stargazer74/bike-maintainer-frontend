import { Component, signal } from '@angular/core';
import { AltchaControl } from './altcha';

/** Test double for `<app-altcha>`: jsdom has no Web Crypto workers, so tests set the payload directly. */
@Component({ selector: 'app-altcha', template: '' })
export class AltchaStub implements AltchaControl {
  readonly payload = signal<string | null>('solved-payload');
  readonly resets = signal(0);

  reset(): void {
    this.payload.set(null);
    this.resets.update((count) => count + 1);
  }
}
