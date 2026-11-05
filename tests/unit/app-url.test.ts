import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/lib/app-url";
import { nextQuarterHourLocal } from "@/lib/time";

describe("canonical app URL (F-07)", () => {
  it("prefers the configured canonical origin regardless of request headers", () => {
    expect(
      resolveAppUrl({ APP_URL: "https://one-direction.app", NODE_ENV: "production" })
    ).toBe("https://one-direction.app");
    expect(
      resolveAppUrl({
        NEXT_PUBLIC_APP_URL: "https://staging.one-direction.app/",
        NODE_ENV: "production",
      })
    ).toBe("https://staging.one-direction.app");
  });

  it("refuses to invent an origin in production", () => {
    expect(resolveAppUrl({ NODE_ENV: "production" })).toBeNull();
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "not-a-url", NODE_ENV: "production" })).toBeNull();
  });

  it("falls back to loopback only outside production", () => {
    expect(resolveAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });
});

describe("schedule default slot (F-10)", () => {
  it("rounds up to the next quarter hour in the user's timezone", () => {
    // 09:07 UTC → 09:15; 21:46 Cairo (UTC+2) → 22:00.
    expect(nextQuarterHourLocal("UTC", new Date("2026-11-04T09:07:00Z"))).toBe("09:15");
    expect(nextQuarterHourLocal("Africa/Cairo", new Date("2026-11-04T19:46:00Z"))).toBe("22:00");
  });

  it("keeps an exact quarter hour and never crosses midnight", () => {
    expect(nextQuarterHourLocal("UTC", new Date("2026-11-04T09:15:00Z"))).toBe("09:15");
    expect(nextQuarterHourLocal("UTC", new Date("2026-11-04T23:59:00Z"))).toBe("23:45");
  });
});
