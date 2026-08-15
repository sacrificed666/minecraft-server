"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Point = { t: number; v: number | null };

type Props = {
  data: Point[];
  color: string;
  /** Fixed domain when the metric has a natural ceiling (TPS 0-20, CPU 0-100). */
  domain?: [number, number];
  format: (v: number) => string;
  unit?: string;
  height?: number;
};

const PAD = { top: 14, right: 8, bottom: 20, left: 38 };
const GRID_ROWS = 4;

export function LineChart({
  data,
  color,
  domain,
  format,
  unit = "",
  height = 168,
}: Props) {
  // Shorter on phones: at 390px a 168px chart pushes everything below the fold
  const [chartHeight, setChartHeight] = useState(height);
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Render at true pixel coordinates so strokes and text never distort.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      setChartHeight(entry.contentRect.width < 480 ? Math.round(height * 0.78) : height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [height]);

  const points = useMemo(() => data.filter((d) => d.v !== null), [data]);

  const [min, max] = useMemo(() => {
    if (domain) return domain;
    if (!points.length) return [0, 1];
    const values = points.map((p) => p.v as number);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    if (lo === hi) return [Math.max(0, lo - 1), hi + 1];
    const margin = (hi - lo) * 0.15;
    return [Math.max(0, lo - margin), hi + margin];
  }, [points, domain]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = chartHeight - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (data.length <= 1 ? plotW : (i / (data.length - 1)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;

  const { linePath, areaPath } = useMemo(() => {
    if (!width || !data.length) return { linePath: "", areaPath: "" };
    let line = "";
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const v = data[i].v;
      if (v === null) {
        started = false;
        continue;
      }
      line += `${started ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
      started = true;
    }
    const firstIdx = data.findIndex((d) => d.v !== null);
    let lastIdx = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].v !== null) {
        lastIdx = i;
        break;
      }
    }
    const area =
      line && firstIdx >= 0
        ? `${line}L${x(lastIdx).toFixed(2)},${(PAD.top + plotH).toFixed(2)}` +
          `L${x(firstIdx).toFixed(2)},${(PAD.top + plotH).toFixed(2)}Z`
        : "";
    return { linePath: line, areaPath: area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, chartHeight, min, max]);

  const latest = points.at(-1)?.v ?? null;
  // useId keeps the gradient reference stable and unique across instances
  // without reaching for a random value during render.
  const gradientId = `grad-${useId().replace(/[:«»]/g, "")}`;

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!data.length || !plotW) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rel = event.clientX - rect.left - PAD.left;
    const ratio = Math.min(1, Math.max(0, rel / plotW));
    setHoverIndex(Math.round(ratio * (data.length - 1)));
  }

  if (!points.length) {
    return (
      <div
        ref={hostRef}
        style={{ height: chartHeight }}
        className="flex items-center justify-center px-5 pb-4 text-xs text-ink-muted"
      >
        Waiting for the first samples…
      </div>
    );
  }

  return (
    <div ref={hostRef} className="relative px-2 pb-2">
      <svg
        width={width || "100%"}
        height={chartHeight}
        role="img"
        aria-label={`Time series, latest value ${latest !== null ? format(latest) : "unknown"}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        className="touch-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive grid: hairlines, muted tick labels */}
        {Array.from({ length: GRID_ROWS + 1 }, (_, i) => {
          const value = min + ((max - min) * i) / GRID_ROWS;
          const gy = y(value);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={gy}
                y2={gy}
                stroke="var(--grid)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={gy + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {format(value)}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {linePath && (
          <path
            className="chart-line"
            style={{ ["--dash" as string]: "2000" }}
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={2000}
          />
        )}

        {/* Crosshair */}
        {hovered && hovered.v !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hoverIndex!)}
              x2={x(hoverIndex!)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--axis)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hoverIndex!)}
              cy={y(hovered.v)}
              r="5"
              fill={color}
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Direct label on the last point — this is the relief for the
            light-mode contrast warning on the aqua and orange series. */}
        {latest !== null && (
          <circle
            cx={x(data.length - 1)}
            cy={y(latest)}
            r="4"
            fill={color}
            stroke="var(--surface)"
            strokeWidth="2"
          />
        )}
      </svg>

      {hovered && hovered.v !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-(--glass-border) bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(x(hoverIndex!), 54), width - 54),
            top: 0,
          }}
        >
          <div className="font-semibold text-ink tabular-nums">
            {format(hovered.v)}
            {unit}
          </div>
          <div className="text-[10px] text-ink-muted tabular-nums">
            {new Date(hovered.t).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
