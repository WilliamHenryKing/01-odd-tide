import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const element = document.getElementById("root");
if (!element) throw new Error("Missing application root");
const app = (
  <App initialPath={element.dataset.path ?? (location.pathname.replace(/\/$/, "") || "/")} />
);
if (element.dataset.rendered) hydrateRoot(element, app);
else createRoot(element).render(app);
