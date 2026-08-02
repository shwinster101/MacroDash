// MacroDash v2.0 — Pages middleware. Applies security headers to all routes
// and keeps /api same-origin (the SPA and the function share the Pages origin,
// so no cross-origin access is granted).

export async function onRequest(context) {
  const response = await context.next();
  const h = new Headers(response.headers);

  // Hardening headers.
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("x-frame-options", "DENY");
  h.set("permissions-policy", "geolocation=(), microphone=(), camera=()");

  /* B3 (v3.59, re-audit MED-security): report-only CSP on the PUBLIC React routes.
     Report-only first — observe before enforcing (a violation report costs nothing; a broken
     page costs trust). /admin.html and /api are exempt: the terminal is a buildless single
     file whose inline script would need 'unsafe-inline' script-src, which defeats the point —
     its CSP is the deferred admin-extraction scope; /api returns JSON, nothing to police.
     'unsafe-inline' style-src is required by the dashboard's inline-styles-only convention.
     Google Fonts hosts cover the CSS @import + font files the page actually loads. */
  const cspPath = new URL(context.request.url).pathname;
  if (!cspPath.startsWith("/api/") && cspPath !== "/admin.html") {
    h.set("content-security-policy-report-only",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }

  // Same-origin only for /api. We deliberately do NOT emit
  // Access-Control-Allow-Origin: * — the dashboard fetches /api/fred from its
  // own origin, so no CORS allowance is needed and none is granted.
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/api/")) {
    h.delete("access-control-allow-origin");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}
