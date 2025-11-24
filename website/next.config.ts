import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mixcut/parser", "@mixcut/shared"],
};

export default nextConfig;
