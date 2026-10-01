const ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/zündkerze|spark/i, 'bolt'],
  [/öl|filter|oil/i, 'oil_barrel'],
  [/kette|antrieb|chain|drivetrain/i, 'link'],
  [/brems|brake/i, 'adjust'],
  [/reifen|felge|speiche|tire|tyre|wheel/i, 'tire_repair'],
  [/motor|ventil|engine/i, 'settings'],
  [/tüv|hauptuntersuchung|inspection/i, 'fact_check'],
  [/gasdrehgriff|leerlauf|drehzahl|throttle|idle/i, 'speed'],
  [/lenkung|steuerkopf|steering/i, 'rotate_right'],
  [/stoßdämpfer|gabel|federung|suspension|fork|shock/i, 'compress'],
  [/kupplung|clutch/i, 'tune'],
  [/kühl|schmier|coolant|lubri|grease/i, 'water_drop'],
];

/** Best-effort icon for a free-text maintenance task name; the API has no category field. */
export function resolveTaskIcon(name: string | undefined): string {
  if (!name) {
    return 'build';
  }
  const match = ICON_RULES.find(([pattern]) => pattern.test(name));
  return match ? match[1] : 'build';
}
