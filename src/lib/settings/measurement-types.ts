/**
 * Measurement Types types (Settings · Measurement Types). Defines the
 * body-measurement fields tracked per client (weight, BMI, body fat %, …) that
 * drive the client profile's "Measurements" tab. The sort_order is a manual,
 * drag-to-reorder sequence. Real, RLS-scoped reads/writes live in
 * lib/settings/measurement-types-server.ts and the matching actions.
 */

export const MEASUREMENT_UNITS = ["cm", "Meter", "kg", "gr", "%", "None"] as const;

export type MeasurementType = {
  id: string;
  name: string;
  /** Display unit; "" / "None" → blank cell. */
  unit: string;
  notes: string;
  order: number;
  isActive: boolean;
};

// getMeasurementTypes() is a real, RLS-scoped query — see
// lib/settings/measurement-types-server.ts.
