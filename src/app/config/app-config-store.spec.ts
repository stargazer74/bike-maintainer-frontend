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

  it('is not waiting while the first request is still open', () => {
    store.load();

    expect(store.waitingForServer()).toBe(false);
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Portal });
  });
});
