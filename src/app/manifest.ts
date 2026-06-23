import type { MetadataRoute } from "next";

/**
 * Web App Manifest (served at /manifest.webmanifest). Next.js auto-injects the
 * <link rel="manifest"> from this route. start_url points at /dashboard since
 * the root "/" only redirects there — launching straight to the app avoids a
 * redirect hop on cold start.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "veloFIT — Gym Management",
    short_name: "veloFIT",
    description:
      "Enterprise-grade gym management: clients, subscriptions, classes, finance and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#3b82f6",
    categories: ["business", "productivity", "health", "fitness"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
