import { EventHint } from '@/lib/types/saga';
import styles from './hint-badge.module.scss';
import { cn } from '@/lib/utils/format';

interface HintBadgeProps {
  hint: EventHint | null;
  variant?: 'default' | 'expected';
}

export function HintBadge({ hint, variant = 'default' }: HintBadgeProps) {
  if (variant === 'expected') {
    return (
      <span className={cn(styles.badge, styles.expected)}>
        expected
      </span>
    );
  }

  if (!hint) return <span className={cn(styles.badge, styles.unknown)}>—</span>;

  return (
    <span className={cn(styles.badge, styles[hint])}>
      {hint}
    </span>
  );
}
