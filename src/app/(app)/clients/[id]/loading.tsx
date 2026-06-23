/** Shown instantly during navigation while the profile's server data resolves. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-5 p-4 md:p-6">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-7 w-48 rounded bg-muted" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <div className="h-[28rem] rounded-xl bg-muted" />
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
          <div className="flex gap-4 border-b pb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 w-24 rounded bg-muted" />
            ))}
          </div>
          <div className="h-10 w-40 rounded bg-muted" />
          <div className="h-64 rounded-xl bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
