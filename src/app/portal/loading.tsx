import { BrandLogo } from "@/components/layout/brand";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant gateway skeleton. Giving /portal a loading boundary lets Next prefetch
 * the route shell (the page itself is dynamic — it awaits the gym identity), so
 * tapping "Main menu" shows this immediately instead of hanging on the old page.
 * Mirrors portal/page.tsx so there's no layout shift when the content swaps in.
 */
export default function PortalLoading() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
      />

      <header className="relative z-10 flex items-center justify-between gap-4 p-5 md:p-6">
        <BrandLogo />
        <Skeleton className="h-8 w-20" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl text-center">
          <Skeleton className="mx-auto h-8 w-64 md:h-9" />
          <Skeleton className="mx-auto mt-3 h-4 w-44" />

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton className="aspect-square rounded-3xl" />
            <Skeleton className="aspect-square rounded-3xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
