/**
 * Minimal typed wrapper for Postgres functions. The generated Supabase types
 * do not include our RPCs, so this keeps call sites typed without `any`.
 */
type RpcClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function callRpc<T>(
  supabase: unknown,
  name: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T | null; error: string | null }> {
  const client = supabase as RpcClient;
  const { data, error } = await client.rpc(name, params);
  return { data: (data as T | null) ?? null, error: error?.message ?? null };
}
