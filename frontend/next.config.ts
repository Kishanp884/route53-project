import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cloudscape ships ESM + global CSS imports; let Next transpile them.
  transpilePackages: [
    "@cloudscape-design/components",
    "@cloudscape-design/component-toolkit",
    "@cloudscape-design/global-styles",
    "@cloudscape-design/collection-hooks",
    "@cloudscape-design/theming-runtime",
  ],
};

export default nextConfig;
