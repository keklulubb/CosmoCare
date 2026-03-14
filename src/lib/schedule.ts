import { DateTime } from "luxon";
import type { MedicationSchedule } from "../types/medication";

export function getCurrentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getNextDose(
  schedule: MedicationSchedule,
  now = DateTime.utc(),
) {
  const firstDose = DateTime.fromISO(schedule.firstDoseUtc, { zone: "utc" });

  if (!firstDose.isValid) {
    throw new Error("Invalid firstDoseUtc value");
  }

  if (now.toMillis() <= firstDose.toMillis()) {
    return firstDose.toISO() ?? schedule.firstDoseUtc;
  }

  const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
  const elapsedMs = now.toMillis() - firstDose.toMillis();
  const intervalsElapsed = Math.ceil(elapsedMs / intervalMs);

  return (
    firstDose.plus({ milliseconds: intervalsElapsed * intervalMs }).toISO() ??
    schedule.firstDoseUtc
  );
}

export function formatDoseForTimezone(doseUtc: string, timezone: string) {
  return DateTime.fromISO(doseUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("ccc, LLL d 'at' h:mm a");
}
