import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { PERSIST_COOKIE, persistFromCookieValue, scopeCookie } from "@/lib/supabase/persistence";

/**
 * Next.js 16 Proxy (formerly "middleware"). Runs on the Node runtime before each
 * matched route to:
 *   1. refresh the Supabase auth session cookie on every request, and
 *   2. gate routes — unauthenticated users are sent to /login; authenticated
 *      users are kept out of /login and the bare root.
 *
 * This is a UX/redirect layer, not the security boundary: RLS (and per-action
 * auth checks) are what actually protect data. Server Functions are POSTed to
 * the route they live on, so excluding a path here also skips its actions — keep
 * the matcher permissive and verify auth inside sensitive actions too.
 */

// Pages reachable without a session. Everything else requires auth.
const PUBLIC_PATHS = ["/login", "/privacy", "/terms", "/terms-business"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // The response we mutate as Supabase refreshes cookies.
  let response = NextResponse.next({ request });

  // "Keep me signed in": scope rotated auth cookies to a session cookie unless
  // the user opted into persistence (see lib/supabase/persistence.ts).
  const persist = persistFromCookieValue(request.cookies.get(PERSIST_COOKIE)?.value);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, scopeCookie(options, persist))
          );
        },
      },
    }
  );

  // Do not run any logic between createServerClient and getUser() — this call
  // is what refreshes an expired session and writes the rotated cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Signed-in users never see the login screen or the bare root.
  if (user && (pathname === "/login" || pathname === "/")) {
    return redirectWithSession("/dashboard", request, response);
  }

  // Signed-out users may only reach public pages.
  if (!user && !isPublic(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    if (pathname !== "/") target.searchParams.set("redirect", pathname);
    return redirectWithSession(target, request, response);
  }

  // Always return the (possibly cookie-refreshed) response.
  return response;
}

/**
 * Redirect while preserving any auth cookies Supabase just refreshed — otherwise
 * the rotated session is dropped and the user bounces between pages.
 */
function redirectWithSession(
  to: string | URL,
  request: NextRequest,
  source: NextResponse
): NextResponse {
  const url = typeof to === "string" ? new URL(to, request.url) : to;
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Run on every path except static assets, image optimisation, and PWA files.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
