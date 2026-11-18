"use client";

import type { TimeSeriesPoint } from "@/types/agrotwin";

interface TrendChartProps {
  data: TimeSeriesPoint[];
  farmName: string;
}

export default function TrendChart({ data, farmName }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        No time-series data available yet.
      </div>
    );
  }

  const width = 560;
  const height = 160;
  const padX = 28;
  const padY = 18;

  const pointsNdvi = data.map((d, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(1, data.length - 1);
    const y = height - padY - ((Math.min(1, Math.max(0, d.ndvi)) - 0) * (height - padY * 2));
    return { x, y, val: d.ndvi, label: d.label };
  });

  const polylineNdvi = pointsNdvi.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            30-Day Sentinel-2 NDVI & AWD Water Trend — {farmName}
          </h3>
          <p className="text-xs text-slate-500">
            5-day satellite revisit cycle + IoT water level tracking
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          NDVI 0.0 – 1.0
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
          {[0.25, 0.5, 0.75].map((grid) => {
            const gy = height - padY - grid * (height - padY * 2);
            return (
              <g key={grid}>
                <line x1={padX} y1={gy} x2={width - padX} y2={gy} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x={4} y={gy + 3} fontSize="9" fill="#64748b">
                  {grid.toFixed(2)}
                </text>
              </g>
            );
          })}

          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineNdvi}
          />

          {pointsNdvi.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="600" fill="#065f46">
                {p.val}
              </text>
              <text x={p.x} y={height - 3} textAnchor="middle" fontSize="9" fill="#64748b">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
        {data.map((pt, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
            <div className="text-[11px] text-slate-500">{pt.label}</div>
            <div className="text-xs font-semibold text-sky-700">{pt.water_cm} cm</div>
          </div>
        ))}
      </div>
    </div>
  );
}
