import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import type { Plugin } from "vite";

/**
 * Plugin to add Accept-Ranges header for Range Request support
 */
function rangeRequestPlugin(): Plugin {
  return {
    name: "range-request-support",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Add Accept-Ranges header to all responses
        res.setHeader("Accept-Ranges", "bytes");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
    rangeRequestPlugin(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "CloupeJS",
      fileName: "cloupe",
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    sourcemap: true,
  },
  server: {
    fs: {
      // Allow serving files from tests/fixtures for demo
      allow: [".", "tests/fixtures"],
    },
  },
});
