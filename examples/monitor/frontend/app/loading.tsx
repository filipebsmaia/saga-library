import { MetricsCardsLoading } from "@/components/dashboard/metrics-cards/metrics-cards";
import { SagaTableLoading } from "@/components/dashboard/saga-table/saga-table";

export default function DashboardLoading() {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div
          style={{
            height: 28,
            width: 200,
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-sm)",
          }}
        />
      </div>
      <MetricsCardsLoading />
      <SagaTableLoading />
    </div>
  );
}
