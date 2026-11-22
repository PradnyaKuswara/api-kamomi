import { asc, desc, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export interface PageRequest {
  page: number;
  size: number;
  sort: { field: string; dir: 'asc' | 'desc' }[];
}

/** Parameter Spring Data: ?page=0&size=20&sort=name,desc (sort boleh berulang). */
export function parsePageable(
  query: unknown,
  defaults: { size?: number; sort?: PageRequest['sort'] } = {},
): PageRequest {
  const q = (query ?? {}) as Record<string, string | string[] | undefined>;
  const int = (v: unknown, d: number) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : d);
  const rawSort = q.sort === undefined ? [] : Array.isArray(q.sort) ? q.sort : [q.sort];
  const sort = rawSort.map((s) => {
    const [field, dir] = s.split(',');
    return { field: (field ?? '').trim(), dir: dir?.trim().toLowerCase() === 'desc' ? ('desc' as const) : ('asc' as const) };
  }).filter((s) => s.field);
  return {
    page: int(q.page, 0),
    size: Math.min(Math.max(int(q.size, defaults.size ?? 20), 1), 200),
    sort: sort.length ? sort : (defaults.sort ?? []),
  };
}

/** Terjemahkan sort ke ORDER BY; field yang tidak dikenal diabaikan (whitelist). */
export function orderBy(req: PageRequest, columns: Record<string, PgColumn>, fallback: PgColumn): SQL[] {
  const out = req.sort.flatMap((s) => {
    const col = columns[s.field];
    return col ? [s.dir === 'desc' ? desc(col) : asc(col)] : [];
  });
  return out.length ? out : [asc(fallback)];
}

const sortInfo = (req: PageRequest) => {
  const sorted = req.sort.length > 0;
  return { empty: !sorted, sorted, unsorted: !sorted };
};

/** Bentuk JSON yang sama dengan org.springframework.data.domain.PageImpl. */
export function toPage<T>(content: T[], total: number, req: PageRequest) {
  const totalPages = Math.ceil(total / req.size);
  return {
    content,
    pageable: {
      pageNumber: req.page, pageSize: req.size, sort: sortInfo(req),
      offset: req.page * req.size, paged: true, unpaged: false,
    },
    last: req.page + 1 >= totalPages,
    totalPages,
    totalElements: total,
    size: req.size,
    number: req.page,
    sort: sortInfo(req),
    first: req.page === 0,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}
