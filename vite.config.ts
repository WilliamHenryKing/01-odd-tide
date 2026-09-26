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
        server.middlewares.use((request, response, next) => {
          const [rawPath = "/", query] = (request.url ?? "/").split("?");
          const path = rawPath.replace(/\/$/, "") || "/";
          if (path !== "/" && ROUTES.includes(path))
            request.url = `${path}/index.html${query ? `?${query}` : ""}`;
          else if (path !== "/" && !path.includes(".")) {
            request.url = "/404/index.html";
            response.statusCode = 404;
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
