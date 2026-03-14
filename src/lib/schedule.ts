import { DateTime } from "luxon";
import type { MedicationSchedule } from "../types/medication";

export function getCurrentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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

export function getUpcomingDoses(
  schedule: MedicationSchedule,
  count: number,
  now = DateTime.utc(),
) {
  const nextDoseUtc = getNextDose(schedule, now);
  const nextDose = DateTime.fromISO(nextDoseUtc, { zone: "utc" });

  if (!nextDose.isValid || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    return (
      nextDose.plus({ hours: schedule.intervalHours * index }).toISO() ??
      nextDoseUtc
    );
  });
}

export function formatDoseForTimezone(doseUtc: string, timezone: string) {
  const dose = DateTime.fromISO(doseUtc, { zone: "utc" });

  if (!dose.isValid) {
    return "Invalid time";
  }

  return dose.setZone(timezone).toFormat("ccc, LLL d 'at' h:mm a");
}
