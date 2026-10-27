import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localSourcesPlugin } from "./server/local-sources.mjs";
import { glmProxyPlugin } from "./server/glm-proxy.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'PDF_');
  return {
  plugins: [react(), localSourcesPlugin(env), glmProxyPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
  };
});
