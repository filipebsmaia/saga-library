import { HeaderPanelLoading } from "@/components/detail/header-panel/header-panel";
import { TimelineLoading } from "@/components/detail/timeline/timeline";
import { MetricsPanelLoading } from "@/components/detail/metrics-panel/metrics-panel";

export default function SagaDetailLoading() {
  return (
    <div>
      <HeaderPanelLoading />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        <TimelineLoading />
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <MetricsPanelLoading />
        </div>
      </div>
    </div>
  );
}
