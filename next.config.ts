import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self' https://storage.yandexcloud.net${isDevelopment ? " ws: http:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const platformSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
] as const;

const platformPageSecurityHeaders = [
  ...platformSecurityHeaders,
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
] as const;

const privatePageHeaders = [
  ...platformPageSecurityHeaders,
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
] as const;

const privateApiHeaders = [
  ...platformSecurityHeaders,
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [...platformPageSecurityHeaders],
      },
      {
        source: "/auth/:path*",
        headers: [...privatePageHeaders],
      },
      {
        source: "/portal/:path*",
        headers: [...privatePageHeaders],
      },
      {
        source: "/api/platform/:path*",
        headers: [...privateApiHeaders],
      },
      {
        source: "/api/auth/:path*",
        headers: [...privateApiHeaders],
      },
    ];
  },
};

export default nextConfig;
