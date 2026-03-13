'use client';

import { useMemo } from 'react';
import { SagaStateDto } from '@/lib/types/saga';
import { useSagaTree } from '@/lib/hooks/use-saga-tree';
import { StatusBadge } from '@/components/shared/status-badge/status-badge';
import { formatDuration, cn } from '@/lib/utils/format';
import { Skeleton } from '@/components/shared/skeleton/skeleton';
import { EmptyState } from '@/components/shared/empty-state/empty-state';
import Link from 'next/link';
import styles from './tree-view.module.scss';

type NodeType = 'root' | 'child' | 'fork';

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  root: 'root',
  child: 'child',
  fork: 'fork',
};

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  root: 'var(--color-text-secondary)',
  child: 'var(--color-status-running)',
  fork: 'var(--color-hint-fork)',
};

interface TreeNode {
  saga: SagaStateDto;
  children: TreeNode[];
  nodeType: NodeType;
}

function buildTree(sagas: SagaStateDto[]): TreeNode | null {
  if (sagas.length === 0) return null;
  const root = sagas.find((s) => s.sagaId === s.sagaRootId) ?? sagas[0];
  const byParent = new Map<string, SagaStateDto[]>();
  const sagaMap = new Map<string, SagaStateDto>();

  for (const saga of sagas) {
    sagaMap.set(saga.sagaId, saga);
    if (saga.sagaParentId && saga.sagaId !== root.sagaId) {
      const children = byParent.get(saga.sagaParentId) ?? [];
      children.push(saga);
      byParent.set(saga.sagaParentId, children);
    }
  }

  function deriveNodeType(saga: SagaStateDto): NodeType {
    if (saga.sagaId === root.sagaId) return 'root';
    const parent = saga.sagaParentId ? sagaMap.get(saga.sagaParentId) : null;
    if (parent?.lastEventHint === 'fork') return 'fork';
    return 'child';
  }

  function build(saga: SagaStateDto): TreeNode {
    const children = (byParent.get(saga.sagaId) ?? []).map(build);
    return { saga, children, nodeType: deriveNodeType(saga) };
  }

  return build(root);
}

interface TreeViewProps {
  rootId: string;
  currentSagaId?: string;
}

export function TreeView({ rootId, currentSagaId }: TreeViewProps) {
  const { data: sagas, isLoading } = useSagaTree(rootId);

  const tree = useMemo(() => {
    if (!sagas) return null;
    return buildTree(sagas);
  }, [sagas]);

  if (isLoading) return <TreeViewLoading />;
  if (!tree) return <TreeViewEmpty />;

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Saga Tree</h3>
      <div className={styles.tree}>
        <TreeNodeComponent node={tree} currentSagaId={currentSagaId} depth={0} />
      </div>
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  currentSagaId?: string;
  depth: number;
}

function TreeNodeComponent({ node, currentSagaId, depth }: TreeNodeComponentProps) {
  const { saga } = node;
  const isCurrent = saga.sagaId === currentSagaId;
  const elapsed = saga.endedAt
    ? new Date(saga.endedAt).getTime() - new Date(saga.startedAt).getTime()
    : Date.now() - new Date(saga.startedAt).getTime();

  return (
    <div className={styles.nodeGroup}>
      <Link
        href={`/sagas/${saga.sagaId}`}
        className={cn(styles.node, isCurrent && styles.current)}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <StatusBadge status={saga.status} size="sm" />
        <span
          className={styles.nodeType}
          style={{ color: NODE_TYPE_COLORS[node.nodeType] }}
        >
          {NODE_TYPE_LABELS[node.nodeType]}
        </span>
        <span className={styles.nodeName}>{saga.sagaName ?? saga.sagaId.slice(0, 8)}</span>
        <span className={styles.nodeStep}>{saga.currentStepName}</span>
        <span className={styles.nodeDuration}>{formatDuration(elapsed)}</span>
      </Link>
      {node.children.map((child) => (
        <TreeNodeComponent
          key={child.saga.sagaId}
          node={child}
          currentSagaId={currentSagaId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function TreeViewLoading() {
  return (
    <div className={styles.panel}>
      <Skeleton variant="line" width="80px" height="16px" />
      <div className={styles.tree}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ paddingLeft: i * 20, padding: 'var(--space-2)' }}>
            <Skeleton variant="line" width={`${180 - i * 30}px`} height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TreeViewEmpty() {
  return (
    <div className={styles.panel}>
      <EmptyState title="No tree data" description="This saga has no related sagas in the tree." />
    </div>
  );
}
