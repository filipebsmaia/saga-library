'use client';

import Link from 'next/link';
import { ConnectionStatus } from '@/components/layout/connection-status/connection-status';
import styles from './app-header.module.scss';

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          Saga Monitor
        </Link>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>Dashboard</Link>
        </nav>
        <div className={styles.right}>
          <ConnectionStatus />
        </div>
      </div>
    </header>
  );
}
