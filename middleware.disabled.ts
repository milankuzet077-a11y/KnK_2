
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!api|assets|favicon.ico|sw.js|workbox-.*|manifest.webmanifest).*)"],
};

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD || "";
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get("site_auth")?.value;
  if (cookie === password) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/_auth";
  return NextResponse.rewrite(url);
}
