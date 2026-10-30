import { formatCurrency, formatDate, formatNumber, getCurrencySymbol } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language';

/**
 * `date` pipe that follows the active UI language. Impure on purpose: a pure pipe would cache the
 * result and not react when only the language changes.
 */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | Date | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return formatDate(value, format, this.language.locale());
  }
}

/** `number` pipe that follows the active UI language (impure for the same reason as {@link LocalDatePipe}). */
@Pipe({ name: 'localNumber', pure: false })
export class LocalNumberPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, digitsInfo?: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    return formatNumber(value, this.language.locale(), digitsInfo);
  }
}

/** Currency amount in the style of the active language, e.g. `12,50 €` / `€12.50` (impure, see {@link LocalDatePipe}). */
@Pipe({ name: 'localCurrency', pure: false })
export class LocalCurrencyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, currency: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    const locale = this.language.locale();
    return formatCurrency(value, locale, getCurrencySymbol(currency, 'narrow', locale), currency);
  }
}
