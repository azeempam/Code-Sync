/**
 * useResourceMonitor.ts
 * ---------------------
 * Custom hook that manages the Socket.io connection to the Python
 * Aura-Next process monitor (ws://localhost:5001).
 *
 * Returns real-time CPU, Memory (MB), Thread count metrics along with
 * a memory-leak warning flag.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetricPoint {
    timestamp: number   // epoch ms
    cpu: number         // 0 – 100 %
    memory_mb: number   // resident set size in MB
    threads: number
    pid: number
    leak_warning: boolean
}

export type MonitorStatus =
    | "idle"
    | "connecting"
    | "monitoring"
    | "process_ended"
    | "error"

interface UseResourceMonitorResult {
    metrics: MetricPoint[]          // rolling window (last 60 points)
    latest: MetricPoint | null
    status: MonitorStatus
    leakWarning: boolean
    startMonitoring: (pid: number) => void
    stopMonitoring: () => void
    clearMetrics: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONITOR_URL  = "http://localhost:5001"
const MAX_POINTS   = 60   // 60 × 500 ms = 30-second visible window

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useResourceMonitor(): UseResourceMonitorResult {
    const socketRef = useRef<Socket | null>(null)
    const [metrics, setMetrics]           = useState<MetricPoint[]>([])
    const [status, setStatus]             = useState<MonitorStatus>("idle")
    const [leakWarning, setLeakWarning]   = useState(false)
    const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null

    // ── Establish Socket.io connection once ───────────────────────────────────
    useEffect(() => {
        const socket = io(MONITOR_URL, {
            transports: ["websocket"],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            autoConnect: true,
        })

        socketRef.current = socket
        setStatus("connecting")

        socket.on("connect", () => {
            console.log("[Aura-Next Monitor] Socket connected")
            setStatus("idle")
        })

        socket.on("disconnect", () => {
            console.log("[Aura-Next Monitor] Socket disconnected")
            setStatus("idle")
        })

        socket.on("connect_error", () => {
            setStatus("error")
        })

        // Bulk history delivered on (re)connect
        socket.on("history", (data: MetricPoint[]) => {
            setMetrics(data.slice(-MAX_POINTS))
            if (data.length > 0) {
                setLeakWarning(data[data.length - 1].leak_warning)
            }
        })

        // Live metric stream
        socket.on("metrics", (point: MetricPoint) => {
            setMetrics(prev => {
                const next = [...prev, point]
                return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
            })
            setLeakWarning(point.leak_warning)
            setStatus("monitoring")
        })

        socket.on("monitoring_started", () => setStatus("monitoring"))
        socket.on("monitoring_stopped", () => setStatus("idle"))
        socket.on("process_ended",      () => setStatus("process_ended"))
        socket.on("monitor_error",      () => setStatus("error"))

        return () => {
            socket.disconnect()
        }
    }, [])

    // ── Public API ────────────────────────────────────────────────────────────

    const startMonitoring = useCallback((pid: number) => {
        if (!socketRef.current?.connected) return
        setMetrics([])
        setLeakWarning(false)
        socketRef.current.emit("start_monitoring", { pid })
    }, [])

    const stopMonitoring = useCallback(() => {
        socketRef.current?.emit("stop_monitoring", {})
        setStatus("idle")
    }, [])

    const clearMetrics = useCallback(() => {
        setMetrics([])
        setLeakWarning(false)
    }, [])

    return {
        metrics,
        latest,
        status,
        leakWarning,
        startMonitoring,
        stopMonitoring,
        clearMetrics,
    }
}
