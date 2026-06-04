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
