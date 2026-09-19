import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // A package-lock.json also exists in the parent home directory. Pinning the
  // root prevents Turbopack from treating that directory as this workspace and
  // resolving packages such as Tailwind CSS from the wrong node_modules folder.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
