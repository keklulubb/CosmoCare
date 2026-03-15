import type { MedicationSchedule } from "../types/medication";

export const mockMedications: MedicationSchedule[] = [
  {
    id: "med-1",
    name: "Amoxicillin",
    intervalHours: 8,
    firstDoseUtc: "2026-03-14T06:00:00.000Z",
    homeTimezone: "Europe/Amsterdam",
    notes: "Take after food",
  },
  {
    id: "med-2",
    name: "Vitamin D",
    intervalHours: 24,
    firstDoseUtc: "2026-03-14T14:00:00.000Z",
    homeTimezone: "America/Vancouver",
    notes: "With breakfast",
  },
  {
    id: "med-3",
    name: "Melatonin",
    intervalHours: 24,
    firstDoseUtc: "2026-03-14T22:00:00.000Z",
    homeTimezone: "Asia/Tokyo",
    notes: "30 minutes before sleep",
  },
];
