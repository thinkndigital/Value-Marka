import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE_NAME, decryptSessionToken } from "@/server/auth/token";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (functionality is
// unchanged). This is the single proxy file for the project — it composes
// next-intl's locale routing with an *optimistic* auth redirect.
//
// Per the Next.js auth guide: proxy only ever reads the signed cookie, never
// the database, so it stays cheap on every request (including prefetches).
// It is a UX nicety (redirect before a page even renders), not the
// authorization boundary — the DAL (src/server/auth/dal.ts) re-verifies
// against the database on every actual data access.
const handleIntl = createMiddleware(routing);

const PROTECTED_PATHS = ["/account"];
const AUTH_ONLY_PATHS = ["/login", "/register"];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

function matches(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(request: NextRequest) {
  const intlResponse = handleIntl(request);

  const pathname = stripLocale(request.nextUrl.pathname);
  const isProtected = matches(pathname, PROTECTED_PATHS);
  const isAuthOnly = matches(pathname, AUTH_ONLY_PATHS);

  if (!isProtected && !isAuthOnly) {
    return intlResponse;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSessionToken(token);
  const currentLocale = request.nextUrl.pathname.split("/")[1] || routing.defaultLocale;

  if (isProtected && !session) {
    return NextResponse.redirect(new URL(`/${currentLocale}/login`, request.url));
  }

  if (isAuthOnly && session) {
    return NextResponse.redirect(new URL(`/${currentLocale}/account`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
