import { SagaStateDto } from "@/lib/types/saga";

/**
 * Filters a flat list of sagas to only include the given sagaId
 * and all its descendants. The target saga becomes the "root" of the subtree.
 */
export function filterSubtree(
  sagas: SagaStateDto[],
  sagaId: string,
): SagaStateDto[] {
  const target = sagas.find((s) => s.sagaId === sagaId);
  if (!target) return sagas;

  // If it's already the root, return the full tree
  if (target.sagaId === target.sagaRootId) return sagas;

  // Collect the target + all descendants
  const included = new Set<string>([sagaId]);
  let added = true;
  while (added) {
    added = false;
    for (const s of sagas) {
      if (
        s.sagaParentId &&
        included.has(s.sagaParentId) &&
        !included.has(s.sagaId)
      ) {
        included.add(s.sagaId);
        added = true;
      }
    }
  }

  // Target saga first, then descendants
  const result = sagas.filter((s) => included.has(s.sagaId));
  result.sort((a, b) =>
    a.sagaId === sagaId ? -1 : b.sagaId === sagaId ? 1 : 0,
  );
  return result;
}
