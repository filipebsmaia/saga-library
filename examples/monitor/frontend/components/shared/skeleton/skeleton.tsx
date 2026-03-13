import styles from './skeleton.module.scss';
import { cn } from '@/lib/utils/format';

interface SkeletonProps {
  variant?: 'line' | 'block' | 'circle' | 'badge';
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = 'line', width, height, className }: SkeletonProps) {
  return (
    <div
      className={cn(styles.skeleton, styles[variant], className)}
      style={{ width, height }}
    />
  );
}
