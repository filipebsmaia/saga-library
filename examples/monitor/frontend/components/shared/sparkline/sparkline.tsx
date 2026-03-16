"use client";

import { useMemo, useState } from "react";
import styles from "./sparkline.module.scss";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "var(--color-accent)",
  fillOpacity = 0.1,
  className,
}: SparklineProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, fillPoints, max } = useMemo(() => {
    if (data.length === 0) return { points: "", fillPoints: "", max: 0 };

    const max = Math.max(...data, 1);
    const padY = 2;
    const usableH = height - padY * 2;
    const stepX = width / Math.max(data.length - 1, 1);

    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = padY + usableH - (v / max) * usableH;
      return `${x},${y}`;
    });

    const line = pts.join(" ");
    const fill = `0,${height} ${line} ${width},${height}`;

    return { points: line, fillPoints: fill, max };
  }, [data, width, height]);

  if (data.length === 0) {
    return <div className={className} style={{ width, height }} />;
  }

  const stepX = width / Math.max(data.length - 1, 1);

  return (
    <div
      className={`${styles.wrapper} ${className ?? ""}`}
      style={{ width, height }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const idx = Math.round(x / stepX);
          setHoverIdx(Math.max(0, Math.min(idx, data.length - 1)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polygon points={fillPoints} fill={color} opacity={fillOpacity} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoverIdx !== null && (
          <circle
            cx={hoverIdx * stepX}
            cy={
              2 +
              (height - 4) -
              (data[hoverIdx] / Math.max(max, 1)) * (height - 4)
            }
            r={3}
            fill={color}
          />
        )}
      </svg>
      {hoverIdx !== null && (
        <span
          className={styles.tooltip}
          style={{
            left: Math.min(hoverIdx * stepX, width - 40),
            color,
          }}
        >
          {data[hoverIdx].toLocaleString()}
        </span>
      )}
    </div>
  );
}
