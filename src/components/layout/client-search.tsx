"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { searchClients, type ClientSearchResult } from "@/app/(app)/search-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

const fmtDate = (iso: string | null) => formatDate(iso, "");

export function ClientSearch() {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ClientSearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Debounced search. A request id guards against out-of-order responses.
  const reqId = React.useRef(0);
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const rows = await searchClients(q);
      if (id === reqId.current) {
        setResults(rows);
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click / Escape, and whenever the route changes.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative max-w-xl flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("Search for a client")}
        aria-label={t("Search for a client")}
        className="h-10 rounded-lg border-input bg-background pl-9 shadow-none"
      />

      {showPanel && (
        // Mobile: break out to a viewport-width panel below the header so client
        // names aren't squished by the cramped top bar. Desktop: keep it aligned
        // to the (roomy) search input.
        <div className="fixed inset-x-3 top-16 z-50 max-h-[26rem] overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-lg md:absolute md:inset-x-0 md:top-full md:mt-1.5">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No clients found
            </div>
          ) : (
            results.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={c.avatarUrl ?? undefined} alt={c.fullName} />
                  <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                    <span dir="auto">{initials(c.fullName)}</span>
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-sm font-medium text-foreground">{c.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
                </div>

                {c.status === "active" ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right text-[11px] leading-tight text-muted-foreground tabular-nums sm:block">
                      <div>
                        <span className="text-muted-foreground/60">From</span> {fmtDate(c.fromDate)}
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">To</span> {fmtDate(c.toDate)}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-400/20">
                      Active
                    </span>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-400/20">
                    Inactive
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
