import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, switchMap, take, takeWhile, timer } from 'rxjs';
import { AccessStatus, RedirectResponse, SubscriptionService } from '../../../api-client';
import { AuthStore } from '../../../auth/auth-store';
import { LocalDatePipe } from '../../../i18n/localized-pipes';

/** Query parameter Polar returns with after a successful payment (`/konto?abo=danke`). */
export const PAID_PARAM = 'abo';
/** How often and how far apart the status is asked again after the payment; the webhook usually takes seconds. */
export const PAID_POLLS = 6;
export const PAID_POLL_INTERVAL_MS = 2000;

/** Leaves the app for a page of the payment provider; replaced in tests. */
export const LEAVE_APP = new InjectionToken<(url: string) => void>('LEAVE_APP', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return (url: string) => document.location.assign(url);
  },
});

/** Translation key of the message for a failed checkout or customer portal. */
function errorKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return 'subscription.errors.alreadySubscribed';
    }
    if (error.status === 503) {
      return 'subscription.errors.providerUnavailable';
    }
  }
  return 'account.errors.unknown';
}

/**
 * Trial and subscription of the account (portal mode): the status, buying the yearly subscription and the customer
 * portal of the payment provider. Payment happens on the provider's own page; no script of the provider is loaded here.
 */
@Component({
  selector: 'app-subscription-section',
  imports: [MatProgressSpinnerModule, TranslocoPipe, LocalDatePipe],
  templateUrl: './subscription-section.html',
  styleUrl: './subscription-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionSection implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leaveApp = inject(LEAVE_APP);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly AccessStatus = AccessStatus;
  protected readonly user = this.authStore.currentUser;
  protected readonly status = computed(() => this.user()?.accessStatus);
  protected readonly until = computed(() => this.user()?.accessUntil);
  protected readonly canBuy = computed(
    () => this.status() === AccessStatus.Trial || this.status() === AccessStatus.Expired,
  );
  protected readonly canManage = computed(() => this.user()?.hasSubscription === true);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  /** Back from the payment: `waiting` until the subscription is active, then `active`. */
  protected readonly paid = signal<'waiting' | 'active' | null>(null);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get(PAID_PARAM) === null) {
      return;
    }
    // The parameter goes, so a reload of the page does not show the thanks again.
    void this.router.navigate([], { queryParams: { [PAID_PARAM]: null }, replaceUrl: true });
    this.paid.set(this.status() === AccessStatus.Active ? 'active' : 'waiting');
    if (this.paid() === 'active') {
      return;
    }
    timer(0, PAID_POLL_INTERVAL_MS)
      .pipe(
        take(PAID_POLLS),
        switchMap(() => this.authStore.reload()),
        takeWhile((user) => user?.accessStatus !== AccessStatus.Active, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((user) => {
        if (user?.accessStatus === AccessStatus.Active) {
          this.paid.set('active');
        }
      });
  }

  protected onBuy(): void {
    this.go(this.subscriptionService.createSubscriptionCheckout());
  }

  protected onManage(): void {
    this.go(this.subscriptionService.createSubscriptionCustomerPortal());
  }

  /** Leaves the app for the provider's page; the button stays busy until the browser has left. */
  private go(request: Observable<RedirectResponse>): void {
    this.busy.set(true);
    this.errorKey.set(null);
    request.subscribe({
      next: (redirect) => this.leaveApp(redirect.url),
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorKey.set(errorKey(error));
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.authStore.reload().subscribe();
        }
      },
    });
  }
}
