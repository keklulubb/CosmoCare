import type { MedicationSchedule } from "../types/medication";

export const mockMedications: MedicationSchedule[] = [
  {
    id: "med-1",
    name: "Amoxicillin",
    intervalHours: 8,
    firstDoseUtc: "2026-03-13T21:00:00.000Z",
    homeTimezone: "Europe/Amsterdam",
    notes: "Take after food",
  },
  {
    id: "med-2",
    name: "Vitamin D",
    intervalHours: 24,
    firstDoseUtc: "2026-03-14T08:00:00.000Z",
    homeTimezone: "Europe/Amsterdam",
    notes: "Morning only",
  },
  {
    id: "med-3",
    name: "Melatonin",
    intervalHours: 24,
    firstDoseUtc: "2026-03-14T08:00:00.000Z",
    homeTimezone: "Europe/Amsterdam",
    notes: "Before bedtime only",
  },
];
