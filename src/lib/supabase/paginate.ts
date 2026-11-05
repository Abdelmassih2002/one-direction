export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * F-08: PostgREST caps a single response at its configured max rows. Read
 * every page in a deterministic order so an export never truncates silently.
 */
export async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000
): Promise<{ rows: T[]; failed: boolean }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) return { rows: [], failed: true };
    if (!data || data.length === 0) return { rows, failed: false };
    rows.push(...data);
    if (data.length < pageSize) return { rows, failed: false };
  }
}
