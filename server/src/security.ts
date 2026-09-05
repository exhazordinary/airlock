import type { Request, Response, NextFunction } from "express";

const GOOGLE_APIS = "https://*.googleapis.com";
// Firebase Auth loads the gapi helper from apis.google.com and hosts its sign-in
// handler on the project's firebaseapp.com domain. Omitting either breaks sign-in.
const FIREBASE_AUTH =
  "https://apis.google.com https://*.firebaseapp.com https://accounts.google.com";

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
      `script-src 'self' ${FIREBASE_AUTH}`,
      `connect-src 'self' ${GOOGLE_APIS} https://*.firebaseio.com wss://*.firebaseio.com`,
      `frame-src ${FIREBASE_AUTH}`,
    ].join("; "),
  ],
];

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of POLICY) res.setHeader(name, value);
  res.removeHeader("X-Powered-By");
  next();
}
