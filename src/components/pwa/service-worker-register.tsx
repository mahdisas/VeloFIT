"use client";

import { useEffect } from "react";

/**
 * Registers the veloFIT service worker (/sw.js) once the window has loaded.
 * Renders nothing. Service workers only run in a secure context — that means
 * HTTPS in production and localhost in development (both treated as secure).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("Service worker registration failed:", err));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
