import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/pipeline/runPipelineCli.ts",
    outDir: ".vite/pipeline",
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: "runPipelineCli.mjs" }
    }
  }
});
