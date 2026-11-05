import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/messages/ar";
import { en } from "@/lib/i18n/messages/en";
import { direction, translate } from "@/lib/i18n";

const enKeys = Object.keys(en).sort();
const arKeys = Object.keys(ar).sort();

describe("bilingual catalog (I18N-01/02)", () => {
  it("has identical key sets in English and Arabic", () => {
    expect(arKeys).toEqual(enKeys);
  });

  it("has no empty translations", () => {
    for (const key of enKeys) {
      expect(en[key as keyof typeof en].trim().length).toBeGreaterThan(0);
      expect(ar[key as keyof typeof ar].trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the same interpolation placeholders in both locales", () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of enKeys) {
      expect(placeholders(ar[key as keyof typeof ar])).toEqual(
        placeholders(en[key as keyof typeof en])
      );
    }
  });

  it("actually translates core navigation instead of falling back", () => {
    expect(translate("ar", "nav.today")).toBe("اليوم");
    expect(translate("en", "nav.today")).toBe("Today");
    expect(translate("ar", "nav.today")).not.toBe(translate("en", "nav.today"));
  });

  it("interpolates values and leaves unknown placeholders intact", () => {
    expect(translate("en", "cycle.weeks", { count: 4 })).toBe("4 weeks");
    expect(translate("ar", "journal.energy.3")).toContain("3");
    expect(translate("en", "auth.check-email.body", { email: "a@b.co" })).toContain("a@b.co");
  });

  it("derives document direction from the locale", () => {
    expect(direction("ar")).toBe("rtl");
    expect(direction("en")).toBe("ltr");
  });
});
