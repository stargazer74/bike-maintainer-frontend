import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PaymentConfig } from '../../api-client';
import { AppConfigStore } from '../../config/app-config-store';
import { translocoTesting } from '../../i18n/testing';
import { LOAD_PADDLE, PaddleApi, PaddleEvent } from './paddle';
import { Payment } from './payment';

describe('Payment', () => {
  let harness: RouterTestingHarness;
  let payment: ReturnType<typeof signal<PaymentConfig | null>>;
  let load: ReturnType<typeof vi.fn<() => Promise<PaddleApi>>>;
  let paddle: {
    Environment: { set: ReturnType<typeof vi.fn> };
    Initialize: ReturnType<typeof vi.fn>;
    Checkout: { open: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    payment = signal<PaymentConfig | null>({ clientToken: 'test_token', sandbox: true });
    paddle = {
      Environment: { set: vi.fn() },
      Initialize: vi.fn(),
      Checkout: { open: vi.fn() },
    };
    load = vi.fn(() => Promise.resolve(paddle as unknown as PaddleApi));
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([{ path: 'abo/bezahlen', component: Payment }], withComponentInputBinding()),
        { provide: AppConfigStore, useValue: { payment } },
        { provide: LOAD_PADDLE, useValue: load },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  async function open(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  function eventCallback(): (event: PaddleEvent) => void {
    return paddle.Initialize.mock.calls[0][0].eventCallback;
  }

  it('opens the checkout of the transaction in the sandbox, without a customer for Retain', async () => {
    const page = await open('/abo/bezahlen?_ptxn=txn_1');

    expect(paddle.Environment.set).toHaveBeenCalledWith('sandbox');
    expect(paddle.Initialize).toHaveBeenCalledWith({
      token: 'test_token',
      eventCallback: expect.any(Function),
    });
    expect(paddle.Checkout.open).toHaveBeenCalledWith({
      transactionId: 'txn_1',
      settings: {
        displayMode: 'overlay',
        locale: 'de',
        successUrl: `${document.location.origin}/konto?abo=danke`,
      },
    });
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Bezahlfenster');
    expect(page.textContent).toContain('Paddle.com Market Ltd');
  });

  it('stays in the live environment outside the sandbox', async () => {
    payment.set({ clientToken: 'live_token', sandbox: false });

    await open('/abo/bezahlen?_ptxn=txn_1');

    expect(paddle.Environment.set).not.toHaveBeenCalled();
    expect(paddle.Initialize.mock.calls[0][0].token).toBe('live_token');
  });

  it('offers to open the closed checkout again', async () => {
    const page = await open('/abo/bezahlen?_ptxn=txn_1');

    eventCallback()({ name: 'checkout.loaded' });
    eventCallback()({ name: 'checkout.closed' });
    harness.detectChanges();
    expect(page.textContent).toContain('geschlossen');
    expect(page.querySelector('a[href="/konto"]')).not.toBeNull();

    (page.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(paddle.Checkout.open).toHaveBeenCalledTimes(2);
    expect(page.querySelector('button')).toBeNull();
  });

  it('does not load Paddle.js without a transaction', async () => {
    const page = await open('/abo/bezahlen');

    expect(load).not.toHaveBeenCalled();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('unvollständig');
  });

  it('does not load Paddle.js without payment config', async () => {
    payment.set(null);

    const page = await open('/abo/bezahlen?_ptxn=txn_1');

    expect(load).not.toHaveBeenCalled();
    expect(page.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('reports when Paddle.js cannot be loaded', async () => {
    load.mockReturnValue(Promise.reject(new Error('blocked')));

    const page = await open('/abo/bezahlen?_ptxn=txn_1');

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('nicht geladen');
  });
});
