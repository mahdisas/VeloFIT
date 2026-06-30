"use client";

import { Clock, Dumbbell, Users } from "lucide-react";

import { vibrantColor } from "@/lib/mobile";

/**
 * The shared class card for the member Schedule + Upcoming lists. Spacious layout:
 * a prominent colorful logo squircle at the start, a bold name with the trainer
 * stacked beneath it, and the time (+ optional participant count) at the opposite
 * edge. Flex + logical alignment keep it tidy in RTL. The participant count shows
 * only when the class lets members see it (showParticipants → show_enroll_list).
 */
export function MobileClassCard({
  name,
  color,
  from,
  to,
  trainerName,
  enrolled,
  capacity,
  showParticipants = false,
  onClick,
}: {
  name: string;
  color: string;
  from: string;
  to: string;
  trainerName?: string;
  enrolled?: number;
  capacity?: number;
  showParticipants?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-start shadow-sm transition-colors hover:border-primary/40 active:bg-muted/50"
    >
      <span
        className="grid size-16 shrink-0 place-content-center rounded-2xl text-white shadow-sm"
        style={{ backgroundColor: vibrantColor(color) }}
      >
        <Dumbbell className="size-7" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold leading-tight" dir="auto">{name}</p>
        {trainerName && <p className="mt-1 truncate text-sm text-muted-foreground" dir="auto">{trainerName}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium" dir="ltr">
          <Clock className="size-3.5 text-muted-foreground" /> {from}–{to}
        </span>
        {showParticipants && capacity != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            <Users className="size-3" /> {enrolled ?? 0}/{capacity}
          </span>
        )}
      </div>
    </button>
  );
}
