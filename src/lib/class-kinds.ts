/**
 * Class Kinds types. A "class kind" is the catalog entry for a type of class
 * (Yoga, HIIT, …). Real, RLS-scoped reads/writes live in lib/classes-server.ts
 * (getClassKinds) and app/(app)/classes/class-kinds-actions.ts.
 */

export type ClassKind = {
  id: string;
  name: string;
  description: string;
  minParticipants: number;
  maxParticipants: number;
  imageUrl: string | null;
  isActive: boolean;
};
