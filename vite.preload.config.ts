import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist/preload",
    lib: {
      entry: {
        preload: path.resolve(__dirname, "src/preload/preload.ts"),
        webviewLogger: path.resolve(__dirname, "src/preload/webviewLogger.ts")
      },
      formats: ["cjs"]
    },
    rollupOptions: {
      external: ["electron", "node:path"],
      output: {
        entryFileNames: "[name].cjs"
      }
    }
  }
});
