import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // SINGLE=1: tutto in un solo file .html da aprire con un doppio clic (senza Node ne' terminale).
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: process.env.SINGLE ? { outDir: "dist-single" } : undefined,
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom" },
});
