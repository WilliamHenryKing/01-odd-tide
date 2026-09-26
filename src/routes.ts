import { STAYS } from "./domain.ts";

export const ROUTES: string[] = [
  "/",
  "/stays",
  ...STAYS.map((stay) => `/stays/${stay.id}`),
  "/plan",
  "/summary",
  "/about",
  "/404",
];
export function pageTitle(path: string): string {
  const stay = STAYS.find((item) => `/stays/${item.id}` === path);
  const names: Record<string, string> = {
    "/": "Somewhere between here and the sea",
    "/stays": "Our little stays",
    "/plan": "Your island day",
    "/summary": "A postcard from a possible day",
    "/about": "Good to know",
  };
  return `${stay?.name ?? names[path] ?? "A small wrong turn"} — ODD TIDE`;
}
