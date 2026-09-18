import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,

  output: "export",

  basePath: "/intern-area",
  assetPrefix: "/intern-area/",

  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
