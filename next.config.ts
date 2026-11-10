import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Proxy handles the session cookie for uploads, so its request buffer must
    // cover the 100 MB PDF limit plus multipart boundaries and headers.
    proxyClientMaxBodySize: "101mb",
  },
  serverExternalPackages: ["pdfjs-dist", "@adobe/pdfservices-node-sdk"],
  output: "standalone",
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
