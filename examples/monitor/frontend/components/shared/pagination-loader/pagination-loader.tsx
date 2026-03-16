"use client";

import { useEffect, useRef } from "react";
import styles from "./pagination-loader.module.scss";

interface PaginationLoaderProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function PaginationLoader({
  onLoadMore,
  hasMore,
  isLoading,
}: PaginationLoaderProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );

    const el = ref.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className={styles.loader}>
      {isLoading && <span className={styles.spinner} />}
    </div>
  );
}
