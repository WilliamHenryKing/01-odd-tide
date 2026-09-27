import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { ROUTES } from "./src/routes.ts";

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: "odd-tide-prerendered-routes",
      configurePreviewServer(server) {
        const outDir = resolve(server.config.root, server.config.build.outDir);
        const builtFile = (path: string) => {
          try {
            return existsSync(resolve(outDir, `.${decodeURIComponent(path)}`));
          } catch {
            return false; // malformed escapes name no file
          }
        };
        server.middlewares.use((request, response, next) => {
          const [rawPath = "/", query] = (request.url ?? "/").split("?");
          const path = rawPath.replace(/\/$/, "") || "/";
          if (path !== "/" && ROUTES.includes(path))
            request.url = `${path}/index.html${query ? `?${query}` : ""}`;
          else if (path !== "/" && !path.includes(".")) {
            // Static serving would answer 200; a wrong turn must say 404, as hosts do with 404.html.
            response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
            response.end(readFileSync(resolve(outDir, "404.html")));
            return;
          } else if (path.includes(".") && !builtFile(path)) {
            // A missing file is a 404, not the application shell (the preview's SPA fallback).
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Not found");
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    host: "127.0.0.1",
    port: 4511,
    strictPort: true,
    watch: {
      ignored: [
        "**/output/**",
        "**/.playwright-cli/**",
        "**/public/plates/**",
        "**/docs/visual/captures/**",
      ],
    },
  },
  preview: { host: "127.0.0.1", port: 4611, strictPort: true },
  build: { cssMinify: "lightningcss", manifest: true },
});
