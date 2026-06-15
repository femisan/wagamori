import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray package-lock.json in the home dir otherwise
  // confuses Turbopack's root inference.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
