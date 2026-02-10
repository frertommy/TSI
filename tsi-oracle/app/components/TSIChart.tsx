'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface HistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

interface TSIChartProps {
  history: HistoryPoint[];
}

const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TooltipPayload {
  value: number;
  payload: HistoryPoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  return (
    <div className="bg-[#1a1a2e] border border-[var(--card-border)] rounded-lg px-3 py-2 shadow-lg">
      <div className="text-xs text-[var(--text-dim)]">{formatDateFull(point.date)}</div>
      <div className="text-sm font-bold text-[var(--foreground)] mt-1 tabular-nums">
        TSI: {Math.round(point.tsiDisplay)}
      </div>
      <div className="text-xs text-[var(--text-dim)] tabular-nums">
        Elo: {Math.round(point.elo)}
      </div>
    </div>
  );
}

export default function TSIChart({ history }: TSIChartProps) {
  const [rangeIdx, setRangeIdx] = useState(3); // Default to 1Y

  const filteredData = useMemo(() => {
    const range = TIME_RANGES[rangeIdx];
    if (range.days === 0) return history;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return history.filter((h) => h.date >= cutoffStr);
  }, [history, rangeIdx]);

  // Calculate Y-axis domain with padding
  const [yMin, yMax] = useMemo(() => {
    if (filteredData.length === 0) return [0, 1000];
    const values = filteredData.map((h) => h.tsiDisplay);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 5);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData]);

  if (history.length === 0) {
    return (
      <div className="w-full h-[400px] rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-center">
        <span className="text-[var(--text-dim)] text-sm">No history data available.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Time range selector */}
      <div className="flex gap-1 mb-4">
        {TIME_RANGES.map((range, idx) => (
          <button
            key={range.label}
            onClick={() => setRangeIdx(idx)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              rangeIdx === idx
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] border border-[var(--card-border)]'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[400px] rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="tsiGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--card-border)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="var(--text-dim)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="var(--text-dim)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="tsiDisplay"
              stroke="var(--accent-cyan)"
              strokeWidth={2}
              fill="url(#tsiGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--accent-cyan)',
                stroke: 'var(--background)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
