import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { pageTitle, ROUTES } from "../src/routes";

const template = await readFile("dist/index.html", "utf8");
const server = await createServer({
  cacheDir: "node_modules/.vite-prerender",
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "warn",
});
try {
  const { render } = await server.ssrLoadModule("/src/entry-server.tsx");
  for (const route of ROUTES) {
    const folder = join("dist", route.slice(1));
    await mkdir(folder, { recursive: true });
    const html = template
      .replace(/<title>.*?<\/title>/, `<title>${pageTitle(route)}</title>`)
      .replace(
        '<div id="root"></div>',
        `<div id="root" data-path="${route}" data-rendered="true">${render(route)}</div>`,
      );
    if (!html.includes('data-rendered="true"')) throw new Error("Prerender root marker missing");
    await writeFile(join(folder, "index.html"), html);
  }
  console.log(`Rendered ${ROUTES.length} meaningful HTML entry points.`);
} finally {
  await server.close();
}
