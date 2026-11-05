// Paginazione uniforme per tutti gli elenchi: ?page=1&page_size=20
// In SQL diventa LIMIT page_size OFFSET (page - 1) * page_size.
import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;

export function toSkipTake({ page, page_size }: Pagination) {
  return { skip: (page - 1) * page_size, take: page_size };
}

export function paginated<T>(data: T[], totale: number, { page, page_size }: Pagination) {
  return {
    data,
    pagination: { page, page_size, totale, pagine: Math.ceil(totale / page_size) },
  };
}
