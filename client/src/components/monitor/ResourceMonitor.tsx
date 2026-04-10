/**
 * ResourceMonitor.tsx
 * -------------------
 * Aura-Next IDE — Real-time Resource Monitor
 *
 * Displays a live dual-axis scrolling line graph of:
 *   • CPU usage  (%, left Y-axis, blue)
 *   • RAM RSS    (MB, right Y-axis, orange)
 * Plus per-metric gauges, thread count, and a memory-leak warning banner.
 *
 * Connects to the Python Socket.io monitor server at ws://localhost:5001.
 * Uses Recharts for the graph (zero canvas overhead, pure SVG).
 */

import { useState } from "react"
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts"
import {
    useResourceMonitor,
    MetricPoint,
    MonitorStatus,
} from "@/hooks/useResourceMonitor"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(epochMs: number): string {
    const d = new Date(epochMs)
    return `${d.getMinutes().toString().padStart(2, "0")}:${d
        .getSeconds()
        .toString()
        .padStart(2, "0")}`
}

function statusColor(s: MonitorStatus): string {
    switch (s) {
        case "monitoring":    return "bg-green-500"
        case "connecting":    return "bg-yellow-400 animate-pulse"
        case "process_ended": return "bg-gray-400"
        case "error":         return "bg-red-500"
        default:              return "bg-gray-600"
    }
}

function statusLabel(s: MonitorStatus): string {
    switch (s) {
        case "monitoring":    return "Live"
        case "connecting":    return "Connecting…"
        case "process_ended": return "Process ended"
        case "error":         return "Error"
        default:              return "Idle"
    }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface GaugeProps {
    label: string
    value: number
    max: number
    unit: string
    color: string
}

function Gauge({ label, value, max, unit, color }: GaugeProps) {
    const pct = Math.min((value / max) * 100, 100)
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-gray-400">
                <span>{label}</span>
                <span style={{ color }}>
                    {value.toFixed(1)} {unit}
                </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-700">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    )
}

// Custom tooltip for the line chart
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-xs shadow-lg">
            <p className="mb-1 text-gray-400">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }}>
                    {p.name}: {p.value}
                    {p.dataKey === "cpu" ? " %" : " MB"}
                </p>
            ))}
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ResourceMonitor() {
    const {
        metrics,
        latest,
        status,
        leakWarning,
        startMonitoring,
        stopMonitoring,
        clearMetrics,
    } = useResourceMonitor()

    const [pidInput, setPidInput] = useState<string>("")

    const handleStart = () => {
        const pid = parseInt(pidInput.trim(), 10)
        if (!isNaN(pid) && pid > 0) startMonitoring(pid)
    }

    const handleStop = () => {
        stopMonitoring()
        clearMetrics()
    }

    // Reduce chart data to avoid re-rendering overhead
    const chartData = metrics.map((m: MetricPoint) => ({
        time:      formatTime(m.timestamp),
        cpu:       m.cpu,
        memory_mb: m.memory_mb,
    }))

    const maxMem = metrics.length
        ? Math.max(...metrics.map(m => m.memory_mb)) * 1.2
        : 512

    return (
        <div className="flex h-full w-full flex-col gap-3 overflow-y-auto p-3 text-sm text-white">

            {/* ── Title & status ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-wide">
                    Resource Monitor
                </h2>
                <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${statusColor(status)}`} />
                    <span className="text-xs text-gray-400">
                        {statusLabel(status)}
                    </span>
                </span>
            </div>

            {/* ── Memory-leak warning ──────────────────────────────────────── */}
            {leakWarning && (
                <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs text-red-300">
                    <span className="text-base">⚠</span>
                    <span>
                        <strong>Potential Memory Leak detected</strong> — RSS has
                        risen continuously for {"\u00a0"}10+ samples without dropping.
                    </span>
                </div>
            )}

            {/* ── PID input & controls ─────────────────────────────────────── */}
            <div className="flex gap-2">
                <input
                    type="number"
                    min={1}
                    placeholder="Enter PID…"
                    value={pidInput}
                    onChange={e => setPidInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleStart()}
                    className="min-w-0 flex-1 rounded-md bg-neutral-800 px-3 py-1.5 text-xs outline-none ring-1 ring-neutral-600 focus:ring-blue-500"
                />
                <button
                    onClick={handleStart}
                    disabled={status === "monitoring" || status === "connecting"}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Start
                </button>
                <button
                    onClick={handleStop}
                    disabled={status === "idle" || status === "error"}
                    className="rounded-md bg-neutral-700 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Stop
                </button>
            </div>

            {/* ── Live gauges ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 rounded-md bg-neutral-800/60 p-3">
                <Gauge
                    label="CPU Usage"
                    value={latest?.cpu ?? 0}
                    max={100}
                    unit="%"
                    color="#3b82f6"
                />
                <Gauge
                    label="Memory RSS"
                    value={latest?.memory_mb ?? 0}
                    max={maxMem}
                    unit="MB"
                    color="#f97316"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                    <span>
                        Threads:{" "}
                        <span className="text-purple-400 font-semibold">
                            {latest?.threads ?? "—"}
                        </span>
                    </span>
                    <span>
                        PID:{" "}
                        <span className="text-gray-300">{latest?.pid ?? "—"}</span>
                    </span>
                </div>
            </div>

            {/* ── Scrolling line chart ─────────────────────────────────────── */}
            <div className="rounded-md bg-neutral-800/60 p-2">
                <p className="mb-1 px-1 text-xs text-gray-500">
                    Last {metrics.length} samples · 500 ms interval
                </p>
                <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 4, right: 10, left: -16, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#2d2d2d"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: "#6b7280" }}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        {/* Left Y-axis: CPU % */}
                        <YAxis
                            yAxisId="cpu"
                            domain={[0, 100]}
                            tick={{ fontSize: 9, fill: "#3b82f6" }}
                            tickLine={false}
                            axisLine={false}
                            unit="%"
                            width={32}
                        />
                        {/* Right Y-axis: Memory MB */}
                        <YAxis
                            yAxisId="mem"
                            orientation="right"
                            domain={[0, "auto"]}
                            tick={{ fontSize: 9, fill: "#f97316" }}
                            tickLine={false}
                            axisLine={false}
                            unit="M"
                            width={36}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                            iconType="circle"
                            iconSize={6}
                            wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
                        />
                        {/* CPU threshold line */}
                        <ReferenceLine
                            yAxisId="cpu"
                            y={80}
                            stroke="#ef444466"
                            strokeDasharray="4 4"
                        />
                        <Line
                            yAxisId="cpu"
                            type="monotone"
                            dataKey="cpu"
                            name="CPU %"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                        />
                        <Line
                            yAxisId="mem"
                            type="monotone"
                            dataKey="memory_mb"
                            name="RAM MB"
                            stroke="#f97316"
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* ── Hardware info badge ──────────────────────────────────────── */}
            <p className="text-center text-[10px] text-neutral-600">
                Intel i7-11th Gen · 8C / 16T · Monitor ≤ 1% CPU budget
            </p>
        </div>
    )
}
