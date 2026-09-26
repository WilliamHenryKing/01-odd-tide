import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

if (import.meta.env.MODE === "performance" && new URLSearchParams(location.search).has("perf"))
  document.documentElement.dataset.perf = "true";

const element = document.getElementById("root");
if (!element) throw new Error("Missing application root");

// Development/visual-test only: the look-dev harness replaces the app on ?lookdev.
// Both conditions are compile-time false in production, so the harness is never bundled there.
const lookdev =
  (import.meta.env.DEV || import.meta.env.MODE === "visual-test") &&
  new URLSearchParams(location.search).has("lookdev");

if (lookdev) {
  element.removeAttribute("data-rendered");
  element.replaceChildren();
  element.style.cssText = "position:fixed;inset:0;background:#0d1414";
  void import("./world/lookdev-entry").then(({ start }) => start(element));
} else {
  const app = (
    <App initialPath={element.dataset.path ?? (location.pathname.replace(/\/$/, "") || "/")} />
  );
  if (element.dataset.rendered) hydrateRoot(element, app);
  else createRoot(element).render(app);
}
