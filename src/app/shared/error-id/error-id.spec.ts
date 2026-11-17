import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ErrorIdStore, errorIdInterceptor } from './error-id';

const URL = '/api/v1/vehicles';
const REQUEST_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

describe('errorIdInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: ErrorIdStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ErrorIdStore);
  });

  afterEach(() => httpMock.verify());

  /** Answers a request with `status` and the given headers; resolves with the error the caller got. */
  async function answer(status: number, headers: Record<string, string> = {}): Promise<unknown> {
    const response = firstValueFrom(http.get(URL)).catch((error: unknown) => error);
    httpMock.expectOne(URL).flush(null, { status, statusText: 'x', headers });
    return response;
  }

  it('reports the first 8 characters of the request ID of a server error', async () => {
    const error = await answer(500, { 'X-Request-Id': REQUEST_ID });

    expect(store.errorId()).toBe('4bf92f35');
    expect((error as { status: number }).status).toBe(500);
  });

  it('also reports errors of nginx itself, e.g. while the backend is down', async () => {
    await answer(502, { 'X-Request-Id': REQUEST_ID });

    expect(store.errorId()).toBe('4bf92f35');
  });

  it('ignores client errors', async () => {
    await answer(404, { 'X-Request-Id': REQUEST_ID });

    expect(store.errorId()).toBeNull();
  });

  it('ignores server errors without request ID', async () => {
    await answer(500);

    expect(store.errorId()).toBeNull();
  });

  it('keeps the last error ID until dismissed', async () => {
    await answer(500, { 'X-Request-Id': REQUEST_ID });
    await answer(503, { 'X-Request-Id': 'abcdef0123456789abcdef0123456789' });

    expect(store.errorId()).toBe('abcdef01');

    store.dismiss();

    expect(store.errorId()).toBeNull();
  });
});
