/**
 * Class Groups types. A "group" is a pricing/membership bundle that ties one or
 * more classes to a tiered price card. Real, RLS-scoped reads/writes live in
 * lib/classes-server.ts and app/(app)/classes/groups/actions.ts.
 */

export type Group = {
  id: string;
  name: string;
  /** ids of public.classes linked to this group */
  classIds: string[];
  price1m: number;
  price2m: number;
  price3m: number;
  price4m: number;
  price6m: number;
  priceYearly: number;
  notes: string;
  isActive: boolean;
};

/** A selectable class for the group's multi-select. Drawn from public.classes. */
export type GroupClassOption = { id: string; name: string };
