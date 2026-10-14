import { NextResponse, type NextRequest } from "next/server";

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333").origin;

// CSP com nonce por requisição: só scripts emitidos pelo próprio Next (que
// recebem o nonce) executam, o que limita o estrago de um eventual XSS —
// relevante porque o token de sessão fica no localStorage.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' e ws: só em dev (React Refresh / hot reload).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${API_ORIGIN}${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // O Next lê o CSP do request para aplicar o nonce nos scripts que gera.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Assets estáticos não precisam de CSP (e não devem pagar o custo do middleware).
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
