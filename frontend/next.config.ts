import type { NextConfig } from "next";

const backendBase =
  process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3111";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
