import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatingMode } from '../api-client';
import { AppConfigStore, CONFIG_RETRY_DELAY_MS } from './app-config-store';

const CONFIG_URL = 'http://localhost/api/v1/config';

describe('AppConfigStore', () => {
  let store: AppConfigStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    store = TestBed.inject(AppConfigStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts in portal mode', () => {
    expect(store.mode()).toBe(OperatingMode.Portal);
    expect(store.isHousehold()).toBe(false);
  });

  it('load() takes the mode from the backend', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Household });
    await loaded;

    expect(store.mode()).toBe(OperatingMode.Household);
    expect(store.isHousehold()).toBe(true);
    expect(store.payment()).toBeNull();
  });

  it('load() keeps the payment config of the portal', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush({
      mode: OperatingMode.Portal,
      payment: { clientToken: 'test_token', sandbox: true },
    });
    await loaded;

    expect(store.payment()).toEqual({ clientToken: 'test_token', sandbox: true });
  });

  it('load() ignores a payment config in household mode', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush({
      mode: OperatingMode.Household,
      payment: { clientToken: 'test_token', sandbox: true },
    });
    await loaded;

    expect(store.payment()).toBeNull();
  });

  describe('when the backend cannot be asked', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('load() waits and asks again instead of guessing the mode', async () => {
      let done = false;
      const loaded = store.load().then(() => (done = true));
      httpMock.expectOne(CONFIG_URL).flush(null, { status: 502, statusText: 'Bad Gateway' });
      await vi.advanceTimersByTimeAsync(0);

      expect(done).toBe(false);
      expect(store.waitingForServer()).toBe(true);

      await vi.advanceTimersByTimeAsync(CONFIG_RETRY_DELAY_MS);
      httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Household });
      await loaded;

      expect(store.mode()).toBe(OperatingMode.Household);
      expect(store.waitingForServer()).toBe(false);
    });

    it('does not ask again before the delay', async () => {
      store.load();
      httpMock.expectOne(CONFIG_URL).flush(null, { status: 503, statusText: 'Unavailable' });
      await vi.advanceTimersByTimeAsync(CONFIG_RETRY_DELAY_MS - 1);

      httpMock.expectNone(CONFIG_URL);
      await vi.advanceTimersByTimeAsync(1);
      httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal });
    });
  });

  it('has no website before loading', () => {
    expect(store.websiteUrl()).toBeNull();
  });

  it('load() takes the website address without trailing slash', async () => {
    const loaded = store.load();
    httpMock
      .expectOne(CONFIG_URL)
      .flush({ mode: OperatingMode.Portal, websiteUrl: 'https://www.example.com/' });
    await loaded;

    expect(store.websiteUrl()).toBe('https://www.example.com');
  });

  it('load() ignores a website address in household mode', async () => {
    const loaded = store.load();
    httpMock
      .expectOne(CONFIG_URL)
      .flush({ mode: OperatingMode.Household, websiteUrl: 'https://www.example.com' });
    await loaded;

    expect(store.websiteUrl()).toBeNull();
  });

  it('load() without website address leaves it empty', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal, websiteUrl: null });
    await loaded;

    expect(store.websiteUrl()).toBeNull();
  });

  it('is not waiting while the first request is still open', () => {
    store.load();

    expect(store.waitingForServer()).toBe(false);
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal });
  });
});
