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
  Legend,
  Line,
  ComposedChart,
} from 'recharts';

interface HistoryPoint {
  date: string;
  elo: number;
  tsiDisplay: number;
}

interface OptaHistoryPoint {
  date: string;
  optaRating: number;
  optaRank: number;
}

interface TSIChartProps {
  history: HistoryPoint[];
  optaHistory?: OptaHistoryPoint[];
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

interface MergedPoint {
  date: string;
  tsiDisplay?: number;
  elo?: number;
  optaRating?: number;
  optaRank?: number;
}

interface TooltipPayload {
  value: number;
  dataKey: string;
  payload: MergedPoint;
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
      {point.tsiDisplay != null && (
        <div className="text-sm font-bold text-[var(--accent-cyan)] mt-1 tabular-nums">
          TSI: {Math.round(point.tsiDisplay)}
        </div>
      )}
      {point.elo != null && (
        <div className="text-xs text-[var(--text-dim)] tabular-nums">
          Elo: {Math.round(point.elo)}
        </div>
      )}
      {point.optaRating != null && (
        <div className="text-sm font-bold text-[#f59e0b] mt-1 tabular-nums">
          Opta: {point.optaRating.toFixed(1)}
        </div>
      )}
      {point.optaRank != null && (
        <div className="text-xs text-[var(--text-dim)] tabular-nums">
          Opta Rank: #{point.optaRank}
        </div>
      )}
    </div>
  );
}

export default function TSIChart({ history, optaHistory }: TSIChartProps) {
  const [rangeIdx, setRangeIdx] = useState(3); // Default to 1Y

  const hasOpta = optaHistory && optaHistory.length > 0;

  // Merge TSI and Opta data by date
  const mergedData = useMemo(() => {
    const dateMap = new Map<string, MergedPoint>();

    for (const h of history) {
      dateMap.set(h.date, {
        date: h.date,
        tsiDisplay: h.tsiDisplay,
        elo: h.elo,
      });
    }

    if (optaHistory) {
      for (const o of optaHistory) {
        const existing = dateMap.get(o.date);
        if (existing) {
          existing.optaRating = o.optaRating;
          existing.optaRank = o.optaRank;
        } else {
          dateMap.set(o.date, {
            date: o.date,
            optaRating: o.optaRating,
            optaRank: o.optaRank,
          });
        }
      }
    }

    return [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [history, optaHistory]);

  const filteredData = useMemo(() => {
    const range = TIME_RANGES[rangeIdx];
    if (range.days === 0) return mergedData;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return mergedData.filter((h) => h.date >= cutoffStr);
  }, [mergedData, rangeIdx]);

  // Calculate Y-axis domains with padding
  const [yMin, yMax] = useMemo(() => {
    if (filteredData.length === 0) return [0, 1000];
    const values = filteredData.filter(h => h.tsiDisplay != null).map((h) => h.tsiDisplay!);
    if (values.length === 0) return [0, 1000];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 5);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData]);

  const [optaMin, optaMax] = useMemo(() => {
    if (!hasOpta) return [0, 100];
    const values = filteredData.filter(h => h.optaRating != null).map((h) => h.optaRating!);
    if (values.length === 0) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 2);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData, hasOpta]);

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
          <ComposedChart data={filteredData} margin={{ top: 5, right: hasOpta ? 50 : 5, left: 0, bottom: 5 }}>
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
              yAxisId="tsi"
              domain={[yMin, yMax]}
              stroke="var(--text-dim)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            {hasOpta && (
              <YAxis
                yAxisId="opta"
                orientation="right"
                domain={[optaMin, optaMax]}
                stroke="#f59e0b"
                tick={{ fontSize: 11, fill: '#f59e0b' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {hasOpta && (
              <Legend
                verticalAlign="top"
                height={28}
                formatter={(value: string) => (
                  <span className="text-xs text-[var(--text-muted)]">{value}</span>
                )}
              />
            )}
            <Area
              yAxisId="tsi"
              type="monotone"
              dataKey="tsiDisplay"
              name="TSI (ClubElo)"
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
              connectNulls
            />
            {hasOpta && (
              <Line
                yAxisId="opta"
                type="monotone"
                dataKey="optaRating"
                name="Opta Power Rating"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#f59e0b',
                  stroke: 'var(--background)',
                  strokeWidth: 2,
                }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
