import React, { useState, useMemo } from 'react';
import { MonitoringRecord } from '../types.ts';
import {
  Activity,
  Clock,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  TrendingUp,
  Calendar,
  Zap,
  ShieldCheck,
  Info
} from 'lucide-react';

interface PortalTimeSeriesChartProps {
  history: MonitoringRecord[];
}

type TimeRangeOption = '30d' | '14d' | '7d' | '24h';

interface DaySummary {
  dateStr: string;
  dayLabel: string;
  fullDateStr: string;
  status: 'reachable' | 'degraded' | 'issue' | 'unprobed';
  avgLatency: number | null;
  checksCount: number;
  reachableCount: number;
  degradedCount: number;
  issueCount: number;
  notes: string[];
}

export const PortalTimeSeriesChart: React.FC<PortalTimeSeriesChartProps> = ({ history }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRangeOption>('30d');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Simulated current timestamp anchor (October 29, 2026)
  const currentAnchorMs = useMemo(() => {
    if (history.length > 0) {
      const timestamps = history.map((r) => new Date(r.check_timestamp).getTime());
      return Math.max(...timestamps, new Date('2026-10-29T08:30:00Z').getTime());
    }
    return new Date('2026-10-29T08:30:00Z').getTime();
  }, [history]);

  // Filter records based on selected time range
  const filteredRecords = useMemo(() => {
    const rangeMs = {
      '30d': 30 * 24 * 60 * 60 * 1000,
      '14d': 14 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }[selectedRange];

    const cutoff = currentAnchorMs - rangeMs;

    return [...history]
      .filter((r) => new Date(r.check_timestamp).getTime() >= cutoff)
      .sort((a, b) => new Date(a.check_timestamp).getTime() - new Date(b.check_timestamp).getTime());
  }, [history, selectedRange, currentAnchorMs]);

  // All valid latency records for curve mapping
  const validLatencyRecords = useMemo(() => {
    return filteredRecords.filter(
      (r) => r.latency_ms !== null && r.latency_ms !== undefined && !isNaN(r.latency_ms)
    );
  }, [filteredRecords]);

  // Generate 30-Day Day-by-Day Health Strip
  const thirtyDayStrip = useMemo<DaySummary[]>(() => {
    const days: DaySummary[] = [];
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    for (let i = 29; i >= 0; i--) {
      const dayStartMs = currentAnchorMs - i * MS_PER_DAY;
      const dayDate = new Date(dayStartMs);
      const year = dayDate.getUTCFullYear();
      const month = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dayDate.getUTCDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      // Find all checks occurring on this UTC day
      const dayChecks = history.filter((r) => {
        const checkDate = new Date(r.check_timestamp);
        const cYear = checkDate.getUTCFullYear();
        const cMonth = String(checkDate.getUTCMonth() + 1).padStart(2, '0');
        const cDay = String(checkDate.getUTCDate()).padStart(2, '0');
        return `${cYear}-${cMonth}-${cDay}` === dateKey;
      });

      if (dayChecks.length === 0) {
        days.push({
          dateStr: dateKey,
          dayLabel: dayDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          fullDateStr: dayDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'unprobed',
          avgLatency: null,
          checksCount: 0,
          reachableCount: 0,
          degradedCount: 0,
          issueCount: 0,
          notes: []
        });
      } else {
        const hasIssue = dayChecks.some((c) => c.status === 'issue' || (c.http_status && c.http_status >= 500));
        const hasDegraded = dayChecks.some((c) => c.status === 'degraded' || (c.latency_ms && c.latency_ms > 250));
        const overallStatus = hasIssue ? 'issue' : hasDegraded ? 'degraded' : 'reachable';

        const latencies = dayChecks
          .map((c) => c.latency_ms)
          .filter((l): l is number => l !== null && l !== undefined && !isNaN(l));

        const avgLat = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

        const reachableCount = dayChecks.filter((c) => c.status === 'reachable').length;
        const degradedCount = dayChecks.filter((c) => c.status === 'degraded').length;
        const issueCount = dayChecks.filter((c) => c.status === 'issue').length;
        const notes = dayChecks.map((c) => c.diagnostic_notes).filter(Boolean) as string[];

        days.push({
          dateStr: dateKey,
          dayLabel: dayDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          fullDateStr: dayDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          status: overallStatus,
          avgLatency: avgLat,
          checksCount: dayChecks.length,
          reachableCount,
          degradedCount,
          issueCount,
          notes
        });
      }
    }

    return days;
  }, [history, currentAnchorMs]);

  // Metrics for the currently selected time window
  const metrics = useMemo(() => {
    if (filteredRecords.length === 0) {
      return {
        total: 0,
        reachable: 0,
        degraded: 0,
        issue: 0,
        reachabilityRate: 0,
        avgLatency: 0,
        minLatency: 0,
        maxLatency: 0
      };
    }

    const reachable = filteredRecords.filter((r) => r.status === 'reachable').length;
    const degraded = filteredRecords.filter((r) => r.status === 'degraded').length;
    const issue = filteredRecords.filter((r) => r.status === 'issue').length;
    const reachabilityRate = Math.round((reachable / filteredRecords.length) * 100);

    const latencies = validLatencyRecords.map((r) => r.latency_ms!);
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    return {
      total: filteredRecords.length,
      reachable,
      degraded,
      issue,
      reachabilityRate,
      avgLatency,
      minLatency,
      maxLatency
    };
  }, [filteredRecords, validLatencyRecords]);

  // Overall 30-day availability
  const thirtyDayAvailability = useMemo(() => {
    const activeDays = thirtyDayStrip.filter((d) => d.status !== 'unprobed');
    if (activeDays.length === 0) return 0;
    const fullyReachable = activeDays.filter((d) => d.status === 'reachable').length;
    const degradedDays = activeDays.filter((d) => d.status === 'degraded').length;
    // Degraded counts as 0.75 availability
    const score = (fullyReachable * 1.0 + degradedDays * 0.75) / activeDays.length;
    return Math.round(score * 1000) / 10;
  }, [thirtyDayStrip]);

  if (history.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center space-y-2">
        <Server className="w-8 h-8 text-[#94A3B8] mx-auto" />
        <h4 className="text-xs font-bold text-[#1A2B4C] uppercase tracking-wider">
          No Time-Series Telemetry Recorded Yet
        </h4>
        <p className="text-xs text-[#64748B] max-w-sm mx-auto">
          This portal has no prior monitoring probes recorded. Click <strong>"Run Probe"</strong> above to capture the initial reachability and latency baseline.
        </p>
      </div>
    );
  }

  // SVG Chart Geometry Constants
  const width = 680;
  const height = 180;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 26;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Compute Y-axis scale bounds
  const yMin = 0;
  const maxRecorded = metrics.maxLatency > 0 ? metrics.maxLatency : 250;
  const yMax = Math.max(Math.ceil((maxRecorded * 1.25) / 50) * 50, 300);

  // Map points to SVG coordinates
  const getX = (index: number, total: number) => {
    if (total <= 1) return padLeft + chartWidth / 2;
    return padLeft + (index / (total - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return padTop + chartHeight - ((clamped - yMin) / (yMax - yMin)) * chartHeight;
  };

  const points = validLatencyRecords.map((r, i) => ({
    x: getX(i, validLatencyRecords.length),
    y: getY(r.latency_ms!),
    record: r
  }));

  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
    : '';

  // 250ms SLA Reference Line Y
  const slaY = getY(250);

  // Horizontal Grid Lines
  const gridSteps = [
    Math.round(yMax * 0.25),
    Math.round(yMax * 0.5),
    Math.round(yMax * 0.75),
    yMax
  ];

  const hoveredPoint = hoveredPointIndex !== null && points[hoveredPointIndex] ? points[hoveredPointIndex] : null;
  const hoveredDay = hoveredDayIndex !== null && thirtyDayStrip[hoveredDayIndex] ? thirtyDayStrip[hoveredDayIndex] : null;

  return (
    <div className="border border-[#CBD5E1] rounded-xl p-4 bg-white shadow-xs space-y-4">
      {/* Header, Range Selector & 30-Day Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#EEF2FF] text-[#243B6B] rounded-lg border border-[#C7D2FE]">
            <Activity className="w-4 h-4 text-[#243B6B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[#1A2B4C]">
                30-Day Response Latency & Operational Health
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-[#DCFCE7] text-[#15803D] rounded-full border border-[#BBF7D0]">
                {thirtyDayAvailability}% 30d Uptime
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Automated root TLS connectivity handshakes & health classification over the past 30 days
            </p>
          </div>
        </div>

        {/* Time Window Toggles */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#CBD5E1] text-xs self-start sm:self-auto">
          {(
            [
              { key: '30d', label: '30 Days' },
              { key: '14d', label: '14 Days' },
              { key: '7d', label: '7 Days' },
              { key: '24h', label: '24 Hours' }
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setSelectedRange(opt.key);
                setHoveredPointIndex(null);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedRange === opt.key
                  ? 'bg-white text-[#1A2B4C] shadow-xs'
                  : 'text-[#64748B] hover:text-[#1A2B4C]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[11px] text-[#64748B] block font-medium">Average Latency ({selectedRange})</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#1A2B4C] font-mono tabular-nums">
              {metrics.avgLatency}
            </span>
            <span className="text-[11px] text-[#64748B]">ms</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[11px] text-[#64748B] block font-medium">Min / Max Range</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#1A2B4C] font-mono tabular-nums">
              {metrics.minLatency}
            </span>
            <span className="text-[11px] text-[#64748B]">/</span>
            <span className="text-base font-bold text-[#1A2B4C] font-mono tabular-nums">
              {metrics.maxLatency}
            </span>
            <span className="text-[11px] text-[#64748B]">ms</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[11px] text-[#64748B] block font-medium">Reachable Probes</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-[#15803D] font-mono tabular-nums">
              {metrics.reachabilityRate}%
            </span>
            <span className="text-[11px] text-[#64748B]">({metrics.reachable}/{metrics.total})</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-[11px] text-[#64748B] block font-medium">Recorded Anomalies</span>
          <div className="flex items-center gap-2 mt-0.5 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 text-[#D97706]">
              <span className="w-2 h-2 rounded-full bg-[#D97706]"></span>
              <span>{metrics.degraded} Degraded</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-[#DC2626]">
              <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
              <span>{metrics.issue} Issue</span>
            </span>
          </div>
        </div>
      </div>

      {/* Primary Visualization: High-Performance Latency Trajectory SVG */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
          <span className="font-semibold text-[#1A2B4C]">
            Response Latency Curve (in ms)
          </span>
          <span className="text-[11px] flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0F9D8A]"></span> Nominal (&lt;250ms)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#D97706]"></span> Degraded (&gt;250ms)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span> Outage/Issue
            </span>
          </span>
        </div>

        <div className="relative w-full overflow-hidden select-none bg-[#FAFCFF] rounded-lg border border-[#E2E8F0] p-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible"
            aria-label="Portal latency time series chart"
          >
            <defs>
              <linearGradient id="latencyGradient30d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F9D8A" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#0F9D8A" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0F9D8A" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines and Y-axis labels */}
            {gridSteps.map((val) => {
              const y = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px] fill-[#94A3B8] font-mono tabular-nums"
                  >
                    {val}ms
                  </text>
                </g>
              );
            })}

            {/* 250ms Nominal SLA Threshold Line if within visible scale */}
            {slaY > padTop && slaY < padTop + chartHeight && (
              <g>
                <line
                  x1={padLeft}
                  y1={slaY}
                  x2={width - padRight}
                  y2={slaY}
                  stroke="#F59E0B"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.85"
                />
                <text
                  x={width - padRight}
                  y={slaY - 4}
                  textAnchor="end"
                  className="text-[9px] fill-[#B45309] font-medium"
                >
                  250ms Nominal SLA Threshold
                </text>
              </g>
            )}

            {/* Bottom Base Border */}
            <line
              x1={padLeft}
              y1={padTop + chartHeight}
              x2={width - padRight}
              y2={padTop + chartHeight}
              stroke="#CBD5E1"
              strokeWidth="1"
            />

            {/* Area Gradient Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#latencyGradient30d)" />
            )}

            {/* Trajectory Polyline */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#0F9D8A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical Guide when hovering */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={padTop + chartHeight}
                stroke="#243B6B"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            )}

            {/* Interactive Data Nodes colored by individual Status */}
            {points.map((pt, i) => {
              const isHovered = hoveredPointIndex === i;
              const status = pt.record.status;
              let nodeFill = '#0F9D8A';
              if (status === 'degraded') nodeFill = '#D97706';
              if (status === 'issue') nodeFill = '#DC2626';

              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPointIndex(i)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                >
                  {/* Hit target for touch/hover */}
                  <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />

                  {/* Outer highlight ring on hover */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="7.5"
                      fill={nodeFill}
                      opacity="0.35"
                    />
                  )}

                  {/* Core node circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 4.5 : 3}
                    fill={nodeFill}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}

            {/* X-axis date labels */}
            {points.length > 0 && (
              <>
                <text
                  x={points[0].x}
                  y={height - 6}
                  textAnchor="start"
                  className="text-[10px] fill-[#64748B] font-medium"
                >
                  {new Date(points[0].record.check_timestamp).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </text>

                {points.length >= 4 && (
                  <text
                    x={points[Math.floor(points.length / 2)].x}
                    y={height - 6}
                    textAnchor="middle"
                    className="text-[10px] fill-[#64748B] font-medium"
                  >
                    {new Date(points[Math.floor(points.length / 2)].record.check_timestamp).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </text>
                )}

                {points.length > 1 && (
                  <text
                    x={points[points.length - 1].x}
                    y={height - 6}
                    textAnchor="end"
                    className="text-[10px] fill-[#64748B] font-medium"
                  >
                    Today (
                    {new Date(points[points.length - 1].record.check_timestamp).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric'
                    })}
                    )
                  </text>
                )}
              </>
            )}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none transform -translate-x-1/2 bg-[#1A2B4C] text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs transition-all duration-150 max-w-xs"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${Math.max(5, (hoveredPoint.y / height) * 100 - 55)}%`
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-mono text-xs font-bold text-[#6EE7B7]">
                  {hoveredPoint.record.latency_ms !== null ? `${hoveredPoint.record.latency_ms} ms` : 'Unreachable'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    hoveredPoint.record.status === 'reachable'
                      ? 'bg-[#15803D] text-white'
                      : hoveredPoint.record.status === 'degraded'
                      ? 'bg-[#B45309] text-white'
                      : 'bg-[#B91C1C] text-white'
                  }`}
                >
                  {hoveredPoint.record.status}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 font-medium">
                {new Date(hoveredPoint.record.check_timestamp).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>

              <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-700/60 pt-1">
                <span>Method: {hoveredPoint.record.monitoring_method}</span>
                <span className="mx-1">·</span>
                <span>HTTP {hoveredPoint.record.http_status || '—'}</span>
              </div>

              {hoveredPoint.record.diagnostic_notes && (
                <div className="text-[10px] text-slate-300 mt-1 italic">
                  {hoveredPoint.record.diagnostic_notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Visualization: 30-Day Daily Status Strip */}
      <div className="pt-2 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#243B6B]" />
            <h5 className="text-xs font-bold text-[#1A2B4C] uppercase tracking-wider">
              30-Day Operational Status Timeline (Day by Day)
            </h5>
          </div>
          <span className="text-[11px] text-[#64748B]">
            Hover day for daily status audit
          </span>
        </div>

        {/* 30 Discrete Daily Health Blocks */}
        <div className="relative">
          <div className="flex items-center gap-1 h-7 bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]">
            {thirtyDayStrip.map((day, idx) => {
              let bg = 'bg-[#10B981] hover:bg-[#059669]'; // Reachable
              if (day.status === 'degraded') bg = 'bg-[#F59E0B] hover:bg-[#D97706]'; // Degraded
              if (day.status === 'issue') bg = 'bg-[#EF4444] hover:bg-[#DC2626]'; // Issue
              if (day.status === 'unprobed') bg = 'bg-[#CBD5E1] hover:bg-[#94A3B8]'; // Unprobed

              return (
                <div
                  key={day.dateStr}
                  onMouseEnter={() => setHoveredDayIndex(idx)}
                  onMouseLeave={() => setHoveredDayIndex(null)}
                  className={`flex-1 h-full rounded-xs transition-colors cursor-pointer ${bg}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${day.dayLabel}: ${day.status}`}
                />
              );
            })}
          </div>

          {/* Daily Hover Card */}
          {hoveredDay && (
            <div className="absolute z-20 left-1/2 transform -translate-x-1/2 -top-16 bg-[#1A2B4C] text-white px-3 py-1.5 rounded-lg shadow-xl border border-slate-700 text-xs pointer-events-none whitespace-nowrap">
              <div className="font-semibold text-slate-200">
                {hoveredDay.fullDateStr}
              </div>
              <div className="flex items-center gap-2 text-[11px] mt-0.5">
                <span
                  className={`font-bold ${
                    hoveredDay.status === 'reachable'
                      ? 'text-[#6EE7B7]'
                      : hoveredDay.status === 'degraded'
                      ? 'text-[#FCD34D]'
                      : 'text-[#FCA5A5]'
                  }`}
                >
                  Status: {hoveredDay.status.toUpperCase()}
                </span>
                {hoveredDay.avgLatency && (
                  <span className="text-slate-300">
                    · Avg Latency: {hoveredDay.avgLatency} ms
                  </span>
                )}
                <span className="text-slate-400">
                  ({hoveredDay.checksCount} {hoveredDay.checksCount === 1 ? 'check' : 'checks'})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 30-Day Legend & Range Labels */}
        <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 px-0.5">
          <span>30 Days Ago</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#10B981]"></span>
              <span>Reachable</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#F59E0B]"></span>
              <span>Degraded</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#EF4444]"></span>
              <span>Issue / Outage</span>
            </span>
          </div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};
