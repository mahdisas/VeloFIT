"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addFamilyMember,
  removeFamilyMember,
  searchFamilyCandidates,
  type ClientHit,
} from "@/app/(app)/clients/family-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type FamilyMember } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";

const COLUMNS = ["Full Name", "Client No.", "Phone Number", "Birth Date", ""];

function fmtBirth(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Family members linker — search existing clients and attach them (both ways). */
export function FamilyMembersDialog({
  clientId,
  members,
  children,
}: {
  clientId: string;
  members: FamilyMember[];
  children: React.ReactNode;
}) {
  const tr = useT();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ClientHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Debounced live search; skip clients already linked.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const hits = await searchFamilyCandidates(clientId, q);
      const linked = new Set(members.map((m) => m.id));
      setResults(hits.filter((h) => !linked.has(h.id)));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, clientId, members]);

  const onAdd = (memberId: string) =>
    startTransition(async () => {
      const res = await addFamilyMember(clientId, memberId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tr("Family member added"));
      setQuery("");
      setResults([]);
      router.refresh();
    });

  const onRemove = (memberId: string) =>
    startTransition(async () => {
      const res = await removeFamilyMember(clientId, memberId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tr("Family member removed"));
      router.refresh();
    });

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{tr("Family members")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {/* Live client search */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Search for a client to link…")}
              className="ps-9"
            />
            {(results.length > 0 || searching) && (
              <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                {searching ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> {tr("Searching…")}
                  </div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={pending}
                      onClick={() => onAdd(r.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <span dir="auto" className="font-medium">{r.name}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">#{r.clientNumber}</span>
                        <Plus className="size-4 text-primary" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>
                      <span className="font-medium text-muted-foreground">{tr(c)}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
                      {tr("No family members yet — search above to link a client.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell><span dir="auto" className="font-medium">{m.fullName}</span></TableCell>
                      <TableCell className="text-muted-foreground">#{m.clientNumber}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{m.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtBirth(m.birthDate)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={tr("Remove {name}", { name: m.fullName })}
                            disabled={pending}
                            onClick={() => onRemove(m.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <SheetClose asChild>
            <Button type="button" variant="ghost">{tr("Close")}</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
