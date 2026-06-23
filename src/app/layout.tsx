import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { dirFor } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";

// Configure Rubik for Latin, Hebrew and Arabic characters
const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "veloFIT — Gym Management",
    template: "%s | veloFIT",
  },
  description:
    "Enterprise-grade gym management platform: clients, subscriptions, classes, finance and more.",
  applicationName: "veloFIT",
  // <link rel="manifest"> is auto-injected from app/manifest.ts.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "veloFIT",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.jpeg", sizes: "192x192", type: "image/jpeg" },
      { url: "/icon-512.jpeg", sizes: "512x512", type: "image/jpeg" },
    ],
    apple: [{ url: "/icon-512.jpeg", sizes: "512x512", type: "image/jpeg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dict = getDict(locale);

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}