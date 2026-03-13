export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
}
