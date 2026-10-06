import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(directory, "../..");

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/event-intelligence-buoyancy-map/" : "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: {
      allow: [workspaceRoot]
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true
  }
});
