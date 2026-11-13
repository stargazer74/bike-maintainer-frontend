import { TestBed } from '@angular/core/testing';
import { LOAD_PADDLE, PADDLE_JS_URL, PaddleApi } from './paddle';

describe('LOAD_PADDLE', () => {
  afterEach(() => {
    document.head.querySelectorAll(`script[src="${PADDLE_JS_URL}"]`).forEach((s) => s.remove());
    delete (window as Window & { Paddle?: unknown }).Paddle;
  });

  function script(): HTMLScriptElement {
    return document.head.querySelector(`script[src="${PADDLE_JS_URL}"]`) as HTMLScriptElement;
  }

  it('adds Paddle.js once and resolves with its global object', async () => {
    const load = TestBed.inject(LOAD_PADDLE);
    const first = load();
    const second = load();
    const paddle = {} as PaddleApi;
    (window as Window & { Paddle?: PaddleApi }).Paddle = paddle;
    script().dispatchEvent(new Event('load'));

    await expect(first).resolves.toBe(paddle);
    expect(second).toBe(first);
    expect(document.head.querySelectorAll(`script[src="${PADDLE_JS_URL}"]`)).toHaveLength(1);
  });

  it('fails when the script defines nothing', async () => {
    const loaded = TestBed.inject(LOAD_PADDLE)();
    script().dispatchEvent(new Event('load'));

    await expect(loaded).rejects.toThrow('did not define');
  });

  it('fails when the script is blocked and tries again on the next call', async () => {
    const load = TestBed.inject(LOAD_PADDLE);
    const loaded = load();
    script().dispatchEvent(new Event('error'));

    await expect(loaded).rejects.toThrow('could not be loaded');
    script().remove();
    void load().catch(() => undefined);
    expect(script()).not.toBeNull();
  });
});
