import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../api-client';
import { ResendVerification } from '../../shared/resend-verification/resend-verification';

type VerifyState = 'verifying' | 'success' | 'invalid';

/**
 * Target of the link in the confirmation email (`/email-bestaetigen?token=…`). Confirms the address once on
 * opening; a used, expired or unknown token leads to the option of requesting a new email.
 */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, MatCardModule, MatProgressSpinnerModule, TranslocoPipe, ResendVerification],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmail implements OnInit {
  /** Token from the link (query parameter). */
  readonly token = input<string>();

  private readonly authService = inject(AuthService);

  protected readonly state = signal<VerifyState>('verifying');

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.authService.verifyEmail({ token }).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('invalid'),
    });
  }
}
