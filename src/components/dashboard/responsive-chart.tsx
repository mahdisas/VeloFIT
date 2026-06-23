"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";

/**
 * A responsive chart shell that never lets Recharts measure a zero-size box.
 *
 * Recharts' own ResponsiveContainer renders once with width/height = -1 before
 * its ResizeObserver fires, logging:
 *   "The width(-1) and height(-1) of chart should be greater than 0…".
 * Here we measure the wrapper ourselves and only mount ResponsiveContainer with
 * explicit pixel dimensions once they are known to be > 0 — so that warning can
 * never be emitted. The observer keeps `size` in sync, so it stays responsive.
 *
 * Parents must give this a fixed height (e.g. h-80) so layout doesn't shift
 * during the one frame before measurement.
 */
export function ResponsiveChart({
  children,
}: {
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev?.width === width && prev?.height === height ? prev : { width, height }
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {size && (
        <ResponsiveContainer width={size.width} height={size.height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
