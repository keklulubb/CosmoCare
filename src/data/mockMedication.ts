import type { MedicationSchedule } from "../types/medication";

export const mockMedication: MedicationSchedule = {
  id: "med-1",
  name: "Amoxicillin",
  intervalHours: 8,
  firstDoseUtc: "2026-03-14T21:00:00.000Z",
  homeTimezone: "Europe/Amsterdam",
  notes: "Take after food",
};