export function getCurrentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}