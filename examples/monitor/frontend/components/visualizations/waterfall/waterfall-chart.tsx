"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { WaterfallSpan, WaterfallTrack } from "@/lib/types/waterfall";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import { formatDuration, cn } from "@/lib/utils/format";
import styles from "./waterfall.module.scss";

const TRACK_HEIGHT = 32;
const TRACK_GAP = 4;
const LABEL_WIDTH = 180;
const HEADER_HEIGHT = 30;
const PADDING = 8;

const HINT_COLORS: Record<string, string> = {
  step: "#3b82f6",
  compensation: "#f59e0b",
  final: "#22c55e",
  fork: "#8b5cf6",
};

interface WaterfallChartProps {
  tracks: WaterfallTrack[];
  spans: WaterfallSpan[];
}

export function WaterfallChart({ tracks, spans }: WaterfallChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoveredSpan, setHoveredSpan] = useState<WaterfallSpan | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewRange, setViewRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    range: { start: number; end: number };
  } | null>(null);

  const totalDuration = useMemo(() => {
    if (spans.length === 0) return 1000;
    return Math.max(...spans.map((s) => s.startMs + s.durationMs), 1000);
  }, [spans]);

  const range = viewRange ?? { start: 0, end: totalDuration };
  const canvasWidth = containerRef.current?.clientWidth ?? 800;
  const canvasHeight =
    HEADER_HEIGHT + tracks.length * (TRACK_HEIGHT + TRACK_GAP) + PADDING * 2;

  const trackIndexMap = useMemo(
    () => new Map(tracks.map((t, i) => [t.trackId, i])),
    [tracks],
  );

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerRef.current?.clientWidth ?? 800;
    canvas.width = w * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#1a1d27";
    ctx.fillRect(0, 0, w, canvasHeight);

    const chartWidth = w - LABEL_WIDTH;
    const msPerPx = (range.end - range.start) / chartWidth;

    // Draw time axis
    ctx.fillStyle = "#5c6078";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const tickCount = Math.max(Math.floor(chartWidth / 100), 2);
    for (let i = 0; i <= tickCount; i++) {
      const ms = range.start + (i / tickCount) * (range.end - range.start);
      const x = LABEL_WIDTH + (i / tickCount) * chartWidth;
      ctx.fillText(formatDuration(ms), x, 12);
      ctx.strokeStyle = "#2a2e3e";
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Draw track labels
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b8fa3";
    ctx.font = "12px -apple-system, sans-serif";
    for (const track of tracks) {
      const idx = trackIndexMap.get(track.trackId) ?? 0;
      const y =
        HEADER_HEIGHT +
        PADDING +
        idx * (TRACK_HEIGHT + TRACK_GAP) +
        TRACK_HEIGHT / 2 +
        4;
      const indent = track.depth * 12;
      ctx.fillText(track.label, LABEL_WIDTH - 8 - indent, y);
    }

    // Clip spans to chart area (right of labels)
    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_WIDTH, 0, chartWidth, canvasHeight);
    ctx.clip();

    // Draw spans
    for (const span of spans) {
      const idx = trackIndexMap.get(span.trackId);
      if (idx === undefined) continue;

      const x = LABEL_WIDTH + (span.startMs - range.start) / msPerPx;
      const naturalW = span.durationMs / msPerPx;
      const MIN_SPAN_W = 40;
      const spanW = Math.max(naturalW, MIN_SPAN_W);
      const y = HEADER_HEIGHT + PADDING + idx * (TRACK_HEIGHT + TRACK_GAP);

      // Check if in viewport
      if (x + spanW < LABEL_WIDTH || x > w) continue;

      const color = HINT_COLORS[span.hint ?? "step"] ?? "#3b82f6";
      ctx.fillStyle = span.estimated ? color + "80" : color;
      ctx.beginPath();
      ctx.roundRect(x, y + 2, spanW, TRACK_HEIGHT - 4, 3);
      ctx.fill();

      // Dashed border for estimated
      if (span.estimated) {
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Highlight hovered
      if (hoveredSpan?.id === span.id) {
        ctx.strokeStyle = "#e4e6ef";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Label inside span (clipped to bar width)
      if (spanW > 20) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, spanW, TRACK_HEIGHT);
        ctx.clip();
        ctx.fillStyle = "#e4e6ef";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(span.label, x + 4, y + TRACK_HEIGHT / 2 + 3);
        ctx.restore();
      }
    }

    ctx.restore(); // Restore chart area clip

    // "Now" marker for active sagas
    const hasRunning = spans.some((s) => s.status === "RUNNING");
    if (hasRunning) {
      const nowMs = Date.now() - spans[0]?.startMs; // approximate
      // We already have totalDuration as the full range
    }
  }, [spans, tracks, range, canvasHeight, trackIndexMap, hoveredSpan]);

  // Mouse interactions
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      dragStartRef.current = { x: e.clientX, range: { ...range } };
      setIsDragging(false);
    },
    [range],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      // Handle drag panning
      if (dragStartRef.current && e.buttons === 1) {
        const dx = e.clientX - dragStartRef.current.x;
        if (Math.abs(dx) > 3) setIsDragging(true);

        const chartWidth = rect.width - LABEL_WIDTH;
        const msPerPx =
          (dragStartRef.current.range.end - dragStartRef.current.range.start) /
          chartWidth;
        const deltaMs = -dx * msPerPx;

        const newStart = Math.max(
          0,
          dragStartRef.current.range.start + deltaMs,
        );
        const rangeSize =
          dragStartRef.current.range.end - dragStartRef.current.range.start;
        const newEnd = Math.min(newStart + rangeSize, totalDuration * 1.1);

        setViewRange({
          start: newEnd - rangeSize < 0 ? 0 : newStart,
          end: newEnd,
        });
        setHoveredSpan(null);
        return;
      }

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const chartWidth = rect.width - LABEL_WIDTH;
      const msPerPx = (range.end - range.start) / chartWidth;
      const mouseMs = range.start + (x - LABEL_WIDTH) * msPerPx;

      // Find span under cursor
      let found: WaterfallSpan | null = null;
      for (const span of spans) {
        const idx = trackIndexMap.get(span.trackId);
        if (idx === undefined) continue;
        const spanY =
          HEADER_HEIGHT + PADDING + idx * (TRACK_HEIGHT + TRACK_GAP);
        if (y >= spanY && y <= spanY + TRACK_HEIGHT) {
          if (
            mouseMs >= span.startMs &&
            mouseMs <= span.startMs + span.durationMs
          ) {
            found = span;
            break;
          }
        }
      }

      setHoveredSpan(found);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [spans, range, trackIndexMap, totalDuration],
  );

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Attach wheel handler natively so we can preventDefault (React uses passive listeners)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartW = rect.width - LABEL_WIDTH;
      const ratio = (x - LABEL_WIDTH) / chartW;

      setViewRange((prev) => {
        const r = prev ?? { start: 0, end: totalDuration };
        const currentRange = r.end - r.start;
        const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
        const newRange = Math.max(currentRange * zoomFactor, 100);
        const newStart = Math.max(
          0,
          r.start + ratio * (currentRange - newRange),
        );
        const newEnd = newStart + newRange;
        return { start: newStart, end: Math.min(newEnd, totalDuration * 1.1) };
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [totalDuration]);

  const handleReset = useCallback(() => setViewRange(null), []);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Span Waterfall</span>
        <button className={styles.toolbarBtn} onClick={handleReset}>
          Reset Zoom
        </button>
      </div>
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{
            cursor: isDragging ? "grabbing" : viewRange ? "grab" : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredSpan(null);
            dragStartRef.current = null;
            setIsDragging(false);
          }}
        />
      </div>

      {hoveredSpan && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{
            left: Math.min(
              tooltipPos.x + 12,
              (containerRef.current?.clientWidth ?? 800) - 300,
            ),
            top: (() => {
              const tooltipH = tooltipRef.current?.offsetHeight ?? 200;
              const wouldOverflow =
                tooltipPos.y + tooltipH + 12 > window.innerHeight;
              return wouldOverflow
                ? tooltipPos.y - tooltipH - 12
                : tooltipPos.y + 12;
            })(),
          }}
        >
          <div className={styles.tooltipTitle}>{hoveredSpan.label}</div>
          {hoveredSpan.stepDescription && (
            <div className={styles.tooltipDesc}>
              {hoveredSpan.stepDescription}
            </div>
          )}
          <div className={styles.tooltipRow}>
            <span>Saga</span>
            <span>
              {hoveredSpan.sagaName ?? hoveredSpan.sagaId.slice(0, 8)}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Duration</span>
            <span>
              {formatDuration(hoveredSpan.durationMs)} (
              {hoveredSpan.percentage.toFixed(1)}%)
            </span>
          </div>
          {hoveredSpan.hint && (
            <div className={styles.tooltipRow}>
              <span>Type</span>
              <span>{hoveredSpan.hint}</span>
            </div>
          )}
          <div className={styles.tooltipRow}>
            <span>Status</span>
            <span>
              {hoveredSpan.statusBefore &&
              hoveredSpan.statusBefore !== hoveredSpan.status
                ? `${hoveredSpan.statusBefore} → ${hoveredSpan.status}`
                : hoveredSpan.status}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Topic</span>
            <span>{hoveredSpan.topic}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Causation</span>
            <span>{hoveredSpan.causationId.slice(0, 12)}…</span>
          </div>
          {hoveredSpan.estimated && (
            <div className={styles.tooltipEstimated}>⚠ Estimated duration</div>
          )}
        </div>
      )}
    </div>
  );
}

export function WaterfallLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Skeleton variant="line" width="120px" height="16px" />
      </div>
      <div
        style={{
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <Skeleton variant="line" width="100px" height="14px" />
            <Skeleton
              variant="block"
              width={`${60 + Math.random() * 40}%`}
              height="24px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
