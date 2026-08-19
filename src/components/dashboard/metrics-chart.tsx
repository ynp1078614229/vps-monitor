'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface MetricsChartProps {
  data: Array<{
    timestamp: number;
    cpuUsage: number;
    memoryUsage: number;
    networkRxBytes: number;
    networkTxBytes: number;
  }>;
  title: string;
  dataKey: string;
  color: string;
  unit?: string;
  type?: 'area' | 'line';
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatValue(value: number, unit: string): string {
  if (unit === 'bytes/s') {
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(value) / Math.log(k));
    return `${(value / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
  return `${value.toFixed(1)}${unit}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: number;
  unit: string;
}

function CustomTooltip({ active, payload, label, unit }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  return (
    <div className="bg-[var(--popover)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
      <p className="text-xs text-[var(--muted-foreground)] mb-1 font-mono">
        {formatTime(label)}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-mono" style={{ color: entry.color }}>
          {formatValue(entry.value, unit)}
        </p>
      ))}
    </div>
  );
}

export function MetricsChart({
  data,
  title,
  dataKey,
  color,
  unit = '%',
  type = 'area',
}: MetricsChartProps) {
  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    [dataKey]: unit === 'bytes/s'
      ? (d as Record<string, number>)[dataKey]
      : (d as Record<string, number>)[dataKey],
  }));

  const maxDomain = unit === '%' ? 100 : undefined;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        {type === 'area' ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, maxDomain || 'auto']}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => `${v}${unit === '%' ? '%' : ''}`}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${dataKey})`}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, maxDomain || 'auto']}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => `${v}${unit === '%' ? '%' : ''}`}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

interface NetworkChartProps {
  data: Array<{
    timestamp: number;
    networkRxBytes: number;
    networkTxBytes: number;
  }>;
}

export function NetworkChart({ data }: NetworkChartProps) {
  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    rx: d.networkRxBytes,
    tx: d.networkTxBytes,
  }));

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
        Network I/O
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="gradient-rx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradient-tx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => {
              const k = 1024;
              const sizes = ['B/s', 'KB/s', 'MB/s'];
              const i = Math.floor(Math.log(v) / Math.log(k));
              return `${(v / Math.pow(k, i)).toFixed(0)} ${sizes[i]}`;
            }}
          />
          <Tooltip content={<CustomTooltip unit="bytes/s" />} />
          <Area
            type="monotone"
            dataKey="rx"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#gradient-rx)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="tx"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#gradient-tx)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-[#06b6d4] rounded" />
          <span className="text-xs text-[var(--muted-foreground)]">RX (Download)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-[#8b5cf6] rounded" />
          <span className="text-xs text-[var(--muted-foreground)]">TX (Upload)</span>
        </div>
      </div>
    </div>
  );
}
