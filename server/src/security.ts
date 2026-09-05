import type { Request, Response, NextFunction } from "express";

const GOOGLE_APIS = "https://*.googleapis.com";

// apis.google.com is a known CSP bypass gadget: its JSONP endpoints can execute
// attacker-chosen code once the origin is trusted. It is allowed anyway because
// Firebase Auth's gapi helper loads a second script from a build-hashed path under
// /_/scs/, so pinning to /js/api.js breaks sign-in outright. Narrowing gains little
// in any case, since the gadget lives under /js/ too. The exposure needs script
// injection first, which is what the rest of this policy and React's escaping deny.
const GAPI_SCRIPT = "https://apis.google.com";
const AUTH_FRAMES =
  "https://*.firebaseapp.com https://accounts.google.com https://apis.google.com";

// same-origin-allow-popups, not same-origin: the Google sign-in popup must still be
// able to talk back to the opener.
const POLICY: ReadonlyArray<readonly [string, string]> = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Cross-Origin-Opener-Policy", "same-origin-allow-popups"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()"],
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  [
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https://*.googleusercontent.com",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' ${GAPI_SCRIPT}`,
      `connect-src 'self' ${GOOGLE_APIS} https://*.firebaseio.com wss://*.firebaseio.com`,
      `frame-src ${AUTH_FRAMES}`,
    ].join("; "),
  ],
];

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of POLICY) res.setHeader(name, value);
  res.removeHeader("X-Powered-By");
  next();
}
