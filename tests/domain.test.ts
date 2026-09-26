import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PLAN,
  dateDay,
  money,
  nights,
  pathOpen,
  planQuery,
  readPlan,
  repairSchedule,
  tidalAccess,
  totals,
  validatePlan,
  waterHeight,
} from "../src/domain";

describe("fictional island rules", () => {
  test("calendar validation rejects nonexistent dates and counts nights across month boundaries", () => {
    expect(dateDay("2026-02-30")).toBeNull();
    expect(dateDay("bad")).toBeNull();
    expect(nights({ ...DEFAULT_PLAN, arrival: "2026-10-30", departure: "2026-11-01" })).toBe(2);
  });
  test("a three-night two-person stay and paid bath have the known sample total", () => {
    expect(totals(DEFAULT_PLAN)).toEqual({
      accommodation: 540000,
      activities: 36000,
      total: 576000,
    });
    expect(validatePlan(DEFAULT_PLAN)).toEqual([]);
    expect(money(totals(DEFAULT_PLAN).total)).toBe("R\u00a05\u00a0760");
  });
  test("availability is half-open and capacity is real", () => {
    expect(
      validatePlan({ ...DEFAULT_PLAN, arrival: "2026-10-13", departure: "2026-10-14" }),
    ).toEqual([]);
    expect(
      validatePlan({ ...DEFAULT_PLAN, arrival: "2026-10-13", departure: "2026-10-15" }).some(
        (issue) => issue.field === "availability",
      ),
    ).toBe(true);
    expect(
      validatePlan({ ...DEFAULT_PLAN, guests: 4 }).some((issue) => issue.field === "guests"),
    ).toBe(true);
  });
  test("a path that starts open can flood during the booked hour", () => {
    expect(waterHeight(9)).toBeCloseTo(0.16);
    expect(waterHeight(15)).toBeCloseTo(1.02);
    expect(pathOpen(11)).toBe(true);
    expect(tidalAccess(11, 1)).toBe(false);
    expect(tidalAccess(9, 1)).toBe(true);
    expect(tidalAccess(9, 12)).toBe(false);
  });
  test("conflicts are explained and a repaired schedule keeps every activity", () => {
    const activities = [
      { id: "bath" as const, hour: 15 },
      { id: "pools" as const, hour: 15 },
      { id: "stars" as const, hour: 15 },
    ];
    expect(validatePlan({ ...DEFAULT_PLAN, activities }).length).toBeGreaterThan(0);
    const repaired = repairSchedule(activities);
    expect(repaired).toHaveLength(3);
    expect(validatePlan({ ...DEFAULT_PLAN, activities: repaired })).toEqual([]);
  });
  test("shared plans round-trip, including an intentionally empty day", () => {
    expect(readPlan(planQuery(DEFAULT_PLAN))).toEqual(DEFAULT_PLAN);
    expect(readPlan(planQuery({ ...DEFAULT_PLAN, activities: [] })).activities).toEqual([]);
    const malformed = readPlan(
      "stay=unknown&guests=Infinity&time=NaN&in=2026-02-30&day=bad@9,bath@NaN",
    );
    expect(malformed.stay).toBe("weather-house");
    expect(malformed.guests).toBe(2);
    expect(malformed.hour).toBe(9);
    expect(malformed.activities).toEqual([]);
  });
});
