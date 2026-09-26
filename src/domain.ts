export const STAYS = [
  {
    id: "weather-house",
    name: "The Weather House",
    short: "A little room for a big exhale.",
    mood: "For the quietly curious",
    capacity: 2,
    price: 180000,
    detail:
      "A cedar A-frame with a roof that opens to the sky, a deep reading nook and a rather earnest collection of wind instruments.",
    features: ["Sky-opening roof", "Reading nook", "Private tidal deck"],
    blocked: ["2026-10-14", "2026-10-15", "2026-10-16"],
  },
  {
    id: "nap-observatory",
    name: "The Nap Observatory",
    short: "Serious equipment. Very soft pillows.",
    mood: "For aspiring stargazers",
    capacity: 2,
    price: 220000,
    detail:
      "A round little observatory above the bay. Turn the roof towards a constellation, or conduct a thorough investigation of the daybed.",
    features: ["Rotating roof aperture", "Panoramic daybed", "Evening star kit"],
    blocked: ["2026-10-22", "2026-10-23"],
  },
  {
    id: "lantern-lodge",
    name: "The Lantern Lodge",
    short: "A place to bring your favourite people.",
    mood: "For small gatherings",
    capacity: 4,
    price: 280000,
    detail:
      "A generous boardwalk cabin where the table is made for long breakfasts. Follow a trail of little lights all the way home.",
    features: ["Two sleeping nooks", "Long breakfast table", "Boardwalk terrace"],
    blocked: ["2026-10-10", "2026-10-11"],
  },
] as const;
export type StayId = (typeof STAYS)[number]["id"];
export const ACTIVITIES = [
  {
    id: "bath",
    name: "The Borrowed Bath",
    duration: 1,
    price: 18000,
    start: 7,
    end: 18,
    tidal: true,
    description: "A warm soak. A short walk. A tide to keep an eye on.",
  },
  {
    id: "pools",
    name: "Rock-pool ramble",
    duration: 1,
    price: 0,
    start: 7,
    end: 18,
    tidal: true,
    description: "Tiny worlds left behind by the sea.",
  },
  {
    id: "reading",
    name: "A very slow hour",
    duration: 1,
    price: 0,
    start: 8,
    end: 18,
    tidal: false,
    description: "Tea, a book, and absolutely no agenda.",
  },
  {
    id: "lanterns",
    name: "The Lantern Walk",
    duration: 1,
    price: 0,
    start: 18,
    end: 21,
    tidal: false,
    description: "Follow the little lights around the sheltered bay.",
  },
  {
    id: "stars",
    name: "Quite possibly stars",
    duration: 1,
    price: 12000,
    start: 19,
    end: 22,
    tidal: false,
    description: "Meet the night at the Nap Observatory.",
  },
] as const;
export type ActivityId = (typeof ACTIVITIES)[number]["id"];
export type Slot = { id: ActivityId; hour: number };
export type Plan = {
  stay: StayId;
  arrival: string;
  departure: string;
  guests: number;
  hour: number;
  activities: Slot[];
};
export type Issue = {
  field: "dates" | "guests" | "availability" | "activities";
  message: string;
  id?: ActivityId;
};
export const DEFAULT_PLAN: Plan = {
  stay: "weather-house",
  arrival: "2026-10-19",
  departure: "2026-10-22",
  guests: 2,
  hour: 9,
  activities: [
    { id: "bath", hour: 9 },
    { id: "lanterns", hour: 18 },
  ],
};
export const stayFor = (id: StayId) => STAYS.find((stay) => stay.id === id) ?? STAYS[0];
export const activityFor = (id: ActivityId) =>
  ACTIVITIES.find((activity) => activity.id === id) ?? ACTIVITIES[0];
// The fictional price display is deliberately identical in Bun's prerender and browser ICU.
export const money = (cents: number) =>
  `R\u00a0${Math.round(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}`;
export const hourLabel = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

// An authored fictional cycle, shared by the water, paths and planner. Not a forecast.
export function waterHeight(hour: number): number {
  return 0.16 + (0.86 * (1 - Math.cos(((hour - 9) / 12) * Math.PI * 2))) / 2;
}
export const pathOpen = (hour: number) => waterHeight(hour) <= 0.54;
export function tidalAccess(start: number, duration: number): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration < 0) return false;
  // The tide's maxima are known analytically; check endpoints and every peak inside.
  let highest = Math.max(waterHeight(start), waterHeight(start + duration));
  for (let peak = 3 + 12 * Math.floor((start - 3) / 12); peak <= start + duration; peak += 12) {
    if (peak >= start) highest = Math.max(highest, waterHeight(peak));
  }
  return highest <= 0.54;
}
export function dateDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(ms / 86400000);
}
export function nights(plan: Plan): number {
  const a = dateDay(plan.arrival),
    b = dateDay(plan.departure);
  return a === null || b === null ? 0 : Math.max(0, b - a);
}
export function validatePlan(plan: Plan): Issue[] {
  const issues: Issue[] = [];
  const stay = stayFor(plan.stay);
  const a = dateDay(plan.arrival),
    b = dateDay(plan.departure);
  if (
    a === null ||
    b === null ||
    b <= a ||
    b - a > 7 ||
    plan.arrival < "2026-10-01" ||
    plan.departure > "2026-11-01"
  )
    issues.push({
      field: "dates",
      message: "Choose 1–7 nights in our fictional October 2026 season.",
    });
  if (!Number.isInteger(plan.guests) || plan.guests < 1 || plan.guests > stay.capacity)
    issues.push({
      field: "guests",
      message: `${stay.name} sleeps ${stay.capacity}. Choose fewer guests or try the Lantern Lodge.`,
    });
  if (
    a !== null &&
    b !== null &&
    stay.blocked.some((date) => {
      const d = dateDay(date);
      return d !== null && d >= a && d < b;
    })
  )
    issues.push({
      field: "availability",
      message:
        "This stay is unavailable for part of those sample dates. Try 19–22 October or choose another cabin.",
    });
  const sorted = [...plan.activities].sort((x, y) => x.hour - y.hour);
  for (const [index, slot] of sorted.entries()) {
    const activity = activityFor(slot.id);
    if (
      !Number.isFinite(slot.hour) ||
      slot.hour < activity.start ||
      slot.hour + activity.duration > activity.end
    )
      issues.push({
        field: "activities",
        id: slot.id,
        message: `${activity.name} is available ${hourLabel(activity.start)}–${hourLabel(activity.end)}.`,
      });
    else if (activity.tidal && !tidalAccess(slot.hour, activity.duration))
      issues.push({
        field: "activities",
        id: slot.id,
        message: `The tide covers the path during ${activity.name}. Try 08:00, 09:00 or 10:00.`,
      });
    const previous = sorted[index - 1];
    if (previous && previous.hour + activityFor(previous.id).duration > slot.hour)
      issues.push({
        field: "activities",
        id: slot.id,
        message: `${activity.name} overlaps ${activityFor(previous.id).name}. Give each its own hour.`,
      });
  }
  return issues;
}
export function totals(plan: Plan) {
  const accommodation = nights(plan) * stayFor(plan.stay).price;
  const activities = plan.activities.reduce(
    (sum, slot) => sum + activityFor(slot.id).price * plan.guests,
    0,
  );
  return { accommodation, activities, total: accommodation + activities };
}
export function moodPlan(mood: string): Slot[] {
  if (mood === "wander")
    return [
      { id: "pools", hour: 8 },
      { id: "bath", hour: 9 },
      { id: "lanterns", hour: 18 },
    ];
  if (mood === "stars")
    return [
      { id: "reading", hour: 16 },
      { id: "lanterns", hour: 18 },
      { id: "stars", hour: 20 },
    ];
  return [
    { id: "bath", hour: 9 },
    { id: "reading", hour: 14 },
    { id: "lanterns", hour: 18 },
  ];
}
export function repairSchedule(slots: Slot[]): Slot[] {
  const repaired: Slot[] = [];
  for (const slot of [...slots].sort((x, y) => activityFor(x.id).end - activityFor(y.id).end)) {
    const activity = activityFor(slot.id);
    const candidates = Array.from(
      { length: Math.floor((activity.end - activity.start - activity.duration) * 2) + 1 },
      (_, i) => activity.start + i / 2,
    ).sort((x, y) => Math.abs(x - slot.hour) - Math.abs(y - slot.hour));
    const hour = candidates.find(
      (candidate) =>
        (!activity.tidal || tidalAccess(candidate, activity.duration)) &&
        !repaired.some(
          (other) =>
            candidate < other.hour + activityFor(other.id).duration &&
            other.hour < candidate + activity.duration,
        ),
    );
    if (hour !== undefined) repaired.push({ id: slot.id, hour });
  }
  return repaired.sort((x, y) => x.hour - y.hour);
}
export function readPlan(search: string): Plan {
  const q = new URLSearchParams(search);
  const rawStay = q.get("stay");
  const stay = STAYS.find((item) => item.id === rawStay)?.id ?? DEFAULT_PLAN.stay;
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = q.get(key);
    if (value === null || value.trim() === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const slots: Slot[] = [];
  for (const raw of (q.get("day") ?? "bath@9,lanterns@18").split(",").slice(0, 5)) {
    const [id, hour] = raw.split("@");
    const activity = ACTIVITIES.find((item) => item.id === id);
    if (
      activity &&
      hour !== undefined &&
      Number.isFinite(Number(hour)) &&
      !slots.some((slot) => slot.id === id)
    )
      slots.push({
        id: activity.id,
        hour: Math.round(Math.max(6, Math.min(22, Number(hour))) * 4) / 4,
      });
  }
  return {
    stay,
    arrival:
      dateDay(q.get("in") ?? "") === null
        ? DEFAULT_PLAN.arrival
        : (q.get("in") ?? DEFAULT_PLAN.arrival),
    departure:
      dateDay(q.get("out") ?? "") === null
        ? DEFAULT_PLAN.departure
        : (q.get("out") ?? DEFAULT_PLAN.departure),
    guests: Math.round(number("guests", 2, 1, 4)),
    hour: Math.round(number("time", 9, 6, 22) * 4) / 4,
    activities: slots,
  };
}
export type LensId = "bath" | "weather" | "stars";
export function lensReady(id: LensId, hour: number): boolean {
  return id === "bath" ? pathOpen(hour) : id === "weather" ? hour < 11 : hour >= 19;
}
export function planQuery(plan: Plan): string {
  return new URLSearchParams({
    stay: plan.stay,
    in: plan.arrival,
    out: plan.departure,
    guests: String(plan.guests),
    time: String(plan.hour),
    day: plan.activities.map((slot) => `${slot.id}@${slot.hour}`).join(","),
  }).toString();
}
