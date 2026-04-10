"""
Aura-Next IDE — Real-time Resource Monitoring Backend
======================================================
Architecture : Python (asyncio) + python-socketio + aiohttp
Monitoring   : psutil — CPU %, Memory RSS (MB), Thread Count
Leak detect  : sliding window of 10 readings; monotonic rise → warning
Hardware     : i7-11th Gen (8C / 16T) — CPU affinity & per-core sampling
Interval     : 500 ms  (≤ 1 % total CPU budget)
WebSocket    : Socket.io server on  ws://localhost:5001
"""

import asyncio
import os
import sys
import time
from collections import deque

import psutil
import socketio
from aiohttp import web

# ── Configuration ─────────────────────────────────────────────────────────────
MONITOR_PORT       = 5001
POLL_INTERVAL      = 0.5        # seconds  (500 ms)
LEAK_WINDOW        = 10         # consecutive rising samples → leak warning
SCROLL_HISTORY     = 120        # data points kept server-side
CPU_SAMPLE_INTERVAL = 0.1       # psutil cpu_percent interval per call (seconds)
# i7-11th Gen: 8 physical cores / 16 logical threads
LOGICAL_CORES      = psutil.cpu_count(logical=True)   # 16
PHYSICAL_CORES     = psutil.cpu_count(logical=False)  # 8

# ── Socket.io async server ─────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="aiohttp",
    cors_allowed_origins="*",   # Allow React dev-server
    logger=False,
    engineio_logger=False,
)
app = web.Application()
sio.attach(app)

# ── Runtime state ──────────────────────────────────────────────────────────────
monitored_pid: int | None = None
monitor_task: asyncio.Task | None = None
mem_window: deque[float] = deque(maxlen=LEAK_WINDOW)
history: deque[dict] = deque(maxlen=SCROLL_HISTORY)


# ── Helpers ────────────────────────────────────────────────────────────────────

def is_leak(window: deque[float]) -> bool:
    """
    Returns True when the last LEAK_WINDOW memory readings are strictly
    monotonically increasing (no drop at all → classic leak signature).
    """
    if len(window) < LEAK_WINDOW:
        return False
    return all(window[i] < window[i + 1] for i in range(len(window) - 1))


def sample_process(proc: psutil.Process) -> dict:
    """
    Collect one metric snapshot for a process.
    cpu_percent(interval=CPU_SAMPLE_INTERVAL) blocks for CPU_SAMPLE_INTERVAL
    but is cheap (≪ 1 % CPU on a 16-thread i7).
    """
    with proc.oneshot():
        cpu   = proc.cpu_percent(interval=CPU_SAMPLE_INTERVAL)
        mem   = proc.memory_info().rss / (1024 * 1024)   # bytes → MB
        threads = proc.num_threads()

    return {
        "cpu":       round(cpu, 2),
        "memory_mb": round(mem, 2),
        "threads":   threads,
        "pid":       proc.pid,
        "timestamp": int(time.time() * 1000),   # epoch ms for Recharts
    }


# ── Monitor coroutine ──────────────────────────────────────────────────────────

async def monitor_loop(pid: int) -> None:
    """
    Continuously polls 'pid' at POLL_INTERVAL and broadcasts metrics.
    Stops when the process exits or monitoring is cancelled.
    """
    global mem_window, history
    mem_window.clear()
    history.clear()

    try:
        proc = psutil.Process(pid)

        # Pin the monitor thread to a single logical core (last one) so it
        # interferes as little as possible with the user's 15 remaining threads.
        try:
            if sys.platform == "linux":
                os.sched_setaffinity(0, {LOGICAL_CORES - 1})
        except (AttributeError, PermissionError):
            pass  # non-critical — best-effort optimisation

        print(f"[Aura-Next Monitor] Watching PID {pid} "
              f"on {LOGICAL_CORES}-thread i7 @ {POLL_INTERVAL*1000:.0f} ms")

        while True:
            if not proc.is_running() or proc.status() == psutil.STATUS_ZOMBIE:
                await sio.emit("process_ended", {"pid": pid})
                break

            metrics = sample_process(proc)

            # ── Memory-leak detection ──────────────────────────────────────
            mem_window.append(metrics["memory_mb"])
            metrics["leak_warning"] = is_leak(mem_window)

            # ── Persist to server-side history ─────────────────────────────
            history.append(metrics)

            # ── Broadcast ─────────────────────────────────────────────────
            await sio.emit("metrics", metrics)

            await asyncio.sleep(max(0, POLL_INTERVAL - CPU_SAMPLE_INTERVAL))

    except psutil.NoSuchProcess:
        await sio.emit("process_ended", {"pid": pid})
        print(f"[Aura-Next Monitor] PID {pid} no longer exists.")
    except asyncio.CancelledError:
        print(f"[Aura-Next Monitor] Monitoring of PID {pid} cancelled.")
    except Exception as exc:
        await sio.emit("monitor_error", {"message": str(exc)})
        print(f"[Aura-Next Monitor] Error: {exc}")


# ── Socket.io event handlers ───────────────────────────────────────────────────

@sio.event
async def connect(sid: str, environ: dict) -> None:
    print(f"[Aura-Next Monitor] Client connected: {sid}")
    # Send recent history so the chart isn't blank on connect
    if history:
        await sio.emit("history", list(history), to=sid)


@sio.event
async def disconnect(sid: str) -> None:
    print(f"[Aura-Next Monitor] Client disconnected: {sid}")


@sio.event
async def start_monitoring(sid: str, data: dict) -> None:
    """
    Payload: { "pid": <int> }
    Starts (or restarts) the monitoring loop for the given PID.
    """
    global monitored_pid, monitor_task

    pid = int(data.get("pid", 0))
    if pid <= 0:
        await sio.emit("monitor_error", {"message": "Invalid PID"}, to=sid)
        return

    # Cancel any existing monitor
    if monitor_task and not monitor_task.done():
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    monitored_pid = pid
    loop = asyncio.get_event_loop()
    monitor_task = loop.create_task(monitor_loop(pid))
    await sio.emit("monitoring_started", {"pid": pid}, to=sid)


@sio.event
async def stop_monitoring(sid: str, _data: dict) -> None:
    global monitor_task

    if monitor_task and not monitor_task.done():
        monitor_task.cancel()
    await sio.emit("monitoring_stopped", {}, to=sid)


@sio.event
async def get_history(sid: str, _data: dict) -> None:
    await sio.emit("history", list(history), to=sid)


# ── HTTP health-check ──────────────────────────────────────────────────────────

async def health(_request: web.Request) -> web.Response:
    return web.json_response({
        "status": "ok",
        "pid":    monitored_pid,
        "cores":  {"logical": LOGICAL_CORES, "physical": PHYSICAL_CORES},
    })


app.router.add_get("/health", health)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Optional: accept a PID as CLI arg to start monitoring immediately
    auto_pid: int | None = None
    if len(sys.argv) > 1:
        try:
            auto_pid = int(sys.argv[1])
        except ValueError:
            print("Usage: python process_monitor.py [PID]")
            sys.exit(1)

    async def _startup(application: web.Application) -> None:
        if auto_pid:
            loop = asyncio.get_event_loop()
            global monitor_task, monitored_pid
            monitored_pid = auto_pid
            monitor_task = loop.create_task(monitor_loop(auto_pid))

    app.on_startup.append(_startup)

    print(f"[Aura-Next Monitor] Starting Socket.io server on port {MONITOR_PORT}")
    print(f"[Aura-Next Monitor] Hardware: {PHYSICAL_CORES}C/{LOGICAL_CORES}T i7-11th Gen")
    web.run_app(app, host="0.0.0.0", port=MONITOR_PORT)
