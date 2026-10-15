/**
 * A translation key plus interpolation params, returned by pure formatting helpers so that the
 * template renders it with `| transloco` in the active language.
 */
export interface TranslatableText {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}
