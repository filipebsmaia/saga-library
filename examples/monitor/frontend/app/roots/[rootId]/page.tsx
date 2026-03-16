"use client";

import { useSagaTree } from "@/lib/hooks/use-saga-tree";
import {
  TreeView,
  TreeViewLoading,
} from "@/components/detail/tree-view/tree-view";
import {
  SagaTable,
  SagaTableLoading,
} from "@/components/dashboard/saga-table/saga-table";
import styles from "./page.module.scss";

interface Props {
  params: { rootId: string };
}

export default function RootTreePage({ params }: Props) {
  const { data: sagas, isLoading } = useSagaTree(params.rootId);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Root Tree</h1>
      <p className={styles.subtitle}>Root ID: {params.rootId}</p>

      <div className={styles.content}>
        <div className={styles.treeSection}>
          <TreeView rootId={params.rootId} />
        </div>
        <div className={styles.tableSection}>
          <h2 className={styles.sectionTitle}>All Sagas in Tree</h2>
          {isLoading ? (
            <SagaTableLoading />
          ) : sagas ? (
            <SagaTable sagas={sagas} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
