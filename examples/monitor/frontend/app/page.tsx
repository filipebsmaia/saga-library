import { LiveSagaTable } from '@/components/dashboard/live-saga-table/live-saga-table';
import { MetricsCards } from '@/components/dashboard/metrics-cards/metrics-cards';
import { NeedsAttention } from '@/components/dashboard/needs-attention/needs-attention';
import { LiveEventStream } from '@/components/dashboard/live-event-stream/live-event-stream';
import { TopStepsPanel } from '@/components/dashboard/top-steps-panel/top-steps-panel';
import { TopTypesPanel } from '@/components/dashboard/top-types-panel/top-types-panel';
import styles from './page.module.scss';

export default function DashboardPage() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Dashboard</h1>
        <span className={styles.subtitle}>Saga orchestration monitor</span>
      </div>
      <NeedsAttention />
      <MetricsCards />
      <main className={styles.main}>
        <LiveSagaTable />
      </main>
      <section className={styles.panels}>
        <TopStepsPanel />
        <TopTypesPanel />
        <LiveEventStream />
      </section>
    </div>
  );
}
