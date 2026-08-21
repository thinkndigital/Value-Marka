import { NextResponse } from "next/server";
import { recordAffiliateClick, AffiliateError } from "@/server/services/affiliates";
import { AFFILIATE_COOKIE_ID, AFFILIATE_COOKIE_CLICK } from "@/server/affiliates/cookies";

/** The affiliate share-link redirect: /api/r/{slug} — records a real click, then forwards the visitor on. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let click;
  try {
    click = await recordAffiliateClick(slug, {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (err) {
    if (err instanceof AffiliateError) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    throw err;
  }

  const response = NextResponse.redirect(click.targetUrl);
  const maxAge = click.cookieDays * 24 * 60 * 60;
  response.cookies.set(AFFILIATE_COOKIE_ID, click.affiliateId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
  response.cookies.set(AFFILIATE_COOKIE_CLICK, click.clickId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
  return response;
}
