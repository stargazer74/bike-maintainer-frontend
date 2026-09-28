const ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/öl|filter|oil/i, 'oil_barrel'],
  [/kette|antrieb|chain|drivetrain/i, 'link'],
  [/brems|brake/i, 'adjust'],
  [/reifen|tire|tyre/i, 'tire_repair'],
  [/motor|ventil|engine/i, 'settings'],
  [/tüv|hauptuntersuchung|inspection/i, 'fact_check'],
];

/** Best-effort icon for a free-text maintenance task name; the API has no category field. */
export function resolveTaskIcon(name: string | undefined): string {
  if (!name) {
    return 'build';
  }
  const match = ICON_RULES.find(([pattern]) => pattern.test(name));
  return match ? match[1] : 'build';
}
