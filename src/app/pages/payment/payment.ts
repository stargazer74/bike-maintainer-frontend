import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigStore } from '../../config/app-config-store';
import { LanguageService } from '../../i18n/language';
import { PAID_PARAM } from '../account-settings/subscription-section/subscription-section';
import { LOAD_PADDLE, PaddleApi, PaddleEvent } from './paddle';

type PaymentState = 'loading' | 'open' | 'closed' | 'invalid' | 'error';

/**
 * Payment page of the subscription (`/abo/bezahlen?_ptxn=txn_…`), Paddle's "default payment link": the checkout the
 * backend created and payment method updates from Paddle's emails open here in Paddle's overlay. The only page that
 * loads a third-party script – a documented exception to "no requests to third parties", with its own CSP in nginx.
 * Paddle Retain is not used (no customer is passed to Paddle.js).
 */
@Component({
  selector: 'app-payment',
  imports: [MatCardModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './payment.html',
  styleUrl: './payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payment implements OnInit {
  /** Transaction of the checkout (query parameter `_ptxn`, named by Paddle). */
  private readonly transactionId = inject(ActivatedRoute).snapshot.queryParamMap.get('_ptxn');
  private readonly config = inject(AppConfigStore);
  private readonly language = inject(LanguageService);
  private readonly loadPaddle = inject(LOAD_PADDLE);
  private readonly document = inject(DOCUMENT);

  protected readonly state = signal<PaymentState>('loading');
  private paddle: PaddleApi | null = null;

  ngOnInit(): void {
    const transactionId = this.transactionId;
    const payment = this.config.payment();
    if (!transactionId || !payment) {
      this.state.set('invalid');
      return;
    }
    this.loadPaddle().then(
      (paddle) => {
        if (payment.sandbox) {
          paddle.Environment.set('sandbox');
        }
        paddle.Initialize({
          token: payment.clientToken,
          eventCallback: (event) => this.onEvent(event),
        });
        this.paddle = paddle;
        this.open();
      },
      () => this.state.set('error'),
    );
  }

  /** Opens the overlay explicitly, which takes priority over Paddle's own handling of `_ptxn`. */
  protected open(): void {
    const transactionId = this.transactionId;
    if (!this.paddle || !transactionId) {
      return;
    }
    this.state.set('open');
    this.paddle.Checkout.open({
      transactionId,
      settings: {
        displayMode: 'overlay',
        locale: this.language.lang(),
        // A full page load leaves this page, its relaxed CSP and Paddle.js behind.
        successUrl: `${this.document.location.origin}/konto?${PAID_PARAM}=danke`,
      },
    });
  }

  private onEvent(event: PaddleEvent): void {
    if (event.name === 'checkout.closed') {
      this.state.set('closed');
    }
  }
}
