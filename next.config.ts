import type { NextConfig } from "next";

const platformSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
        headers: [...platformSecurityHeaders],
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
