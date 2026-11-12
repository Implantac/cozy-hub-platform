import { throwIfError, type SupabaseLikeResult } from "./_supabase";

/** Read every requested row; never turn PostgREST's page cap into a false total. */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<SupabaseLikeResult<T[] | null>>,
  { pageSize = 500, maxRows = 50_000 } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await page(from, from + pageSize - 1);
    throwIfError(result.error);
    if (!result.data) throw new Error("A consulta não retornou os dados esperados.");
    rows.push(...result.data);
    if (rows.length > maxRows)
      throw new Error("Há dados demais para esta consulta. Reduza o período e tente novamente.");
    if (result.data.length < pageSize) return rows;
  }
}
