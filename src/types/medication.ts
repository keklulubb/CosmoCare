export type MedicationSchedule = {
  id: string; // to differentiate between multiple medications
  name: string; // name of your medication or reminder
  intervalHours: number; // how often you need to take the medication in hours
  firstDoseUtc: string; // UTC time of the first dose
  homeTimezone: string; // timezone of the user's home location
  notes?: string; // additional notes about the medication
};
