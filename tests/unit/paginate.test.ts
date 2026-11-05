import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { assertRead } from "@/lib/supabase/read";

describe("export pagination (F-08)", () => {
  it("reads every page until a short page", async () => {
    const page = (size: number, offset: number) =>
      Array.from({ length: size }, (_, index) => ({ id: offset + index }));
    const calls: [number, number][] = [];
    const query = vi.fn(async (from: number, to: number) => {
      calls.push([from, to]);
      const size = calls.length === 1 ? 1000 : calls.length === 2 ? 1000 : 250;
      const offset = (calls.length - 1) * 1000;
      return { data: page(size, offset), error: null };
    });

    const result = await fetchAllPages(query);
    expect(result.failed).toBe(false);
    expect(result.rows).toHaveLength(2250);
    expect(result.rows[2249].id).toBe(2249);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops on an empty page", async () => {
    const result = await fetchAllPages(async () => ({ data: [], error: null }));
    expect(result).toEqual({ rows: [], failed: false });
  });

  it("fails loudly instead of returning a partial export", async () => {
    let call = 0;
    const result = await fetchAllPages(async () => {
      call += 1;
      return call === 1
        ? {
            data: Array.from({ length: 1000 }, (_, index) => ({ id: index })),
            error: null,
          }
        : { data: null, error: { message: "boom" } };
    });
    expect(result.failed).toBe(true);
    expect(result.rows).toEqual([]);
  });
});

describe("read failure detection (F-11)", () => {
  it("throws when any query failed", () => {
    expect(() =>
      assertRead([{ error: null }, { error: { message: "denied" } }], "today")
    ).toThrow(/today/);
  });

  it("does not throw for successful queries", () => {
    expect(() => assertRead([{ error: null }, { error: null }], "today")).not.toThrow();
  });
});
