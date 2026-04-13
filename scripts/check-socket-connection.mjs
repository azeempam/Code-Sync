/**
 * check-socket-connection.mjs
 * ---------------------------
 * Standalone Node.js script that verifies the Socket.IO connection between
 * a client and the Code-Sync server is alive and that code execution events
 * work end-to-end.
 *
 * Usage (with Node ≥ 18):
 *   node scripts/check-socket-connection.mjs [SERVER_URL]
 *
 * Examples:
 *   node scripts/check-socket-connection.mjs
 *   node scripts/check-socket-connection.mjs http://localhost:3000
 *
 * Install dependency once (not part of the main project package.json):
 *   npm install socket.io-client --no-save
 */

import { io } from "socket.io-client"

// ── Config ─────────────────────────────────────────────────────────────────
const SERVER_URL = process.argv[2] || "http://localhost:3000"
const TIMEOUT_MS = 8_000

// ── ANSI colours ───────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m"
const RED    = "\x1b[31m"
const YELLOW = "\x1b[33m"
const CYAN   = "\x1b[36m"
const RESET  = "\x1b[0m"

const ok   = (msg) => console.log(`${GREEN}  ✓ ${msg}${RESET}`)
const fail = (msg) => console.log(`${RED}  ✗ ${msg}${RESET}`)
const info = (msg) => console.log(`${CYAN}  ℹ ${msg}${RESET}`)
const warn = (msg) => console.log(`${YELLOW}  ⚠ ${msg}${RESET}`)

// ── Helpers ────────────────────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)
        ),
    ])
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${CYAN}━━ Code-Sync Socket.IO Connection Check ━━${RESET}`)
    info(`Target server: ${SERVER_URL}`)
    console.log()

    // ── 1. HTTP reachability ───────────────────────────────────────────────
    try {
        const res = await withTimeout(
            fetch(`${SERVER_URL}/api/languages`),
            TIMEOUT_MS,
            "HTTP /api/languages"
        )
        if (!res.ok) {
            fail(`HTTP GET /api/languages returned ${res.status}`)
        } else {
            const langs = await res.json()
            ok(`HTTP reachable — /api/languages returned ${langs.length} languages`)
        }
    } catch (err) {
        fail(`HTTP not reachable: ${err.message}`)
        warn("Make sure the server is running: cd server && npm run dev")
        process.exit(1)
    }

    // ── 2. Socket.IO handshake ─────────────────────────────────────────────
    const socket = io(SERVER_URL, { reconnection: false, timeout: TIMEOUT_MS })

    await withTimeout(
        new Promise((resolve, reject) => {
            socket.on("connect", resolve)
            socket.on("connect_error", (err) => reject(new Error(err.message)))
        }),
        TIMEOUT_MS,
        "socket connect"
    ).then(() => {
        ok(`Socket.IO connected  (id: ${socket.id})`)
    }).catch((err) => {
        fail(`Socket.IO handshake failed: ${err.message}`)
        process.exit(1)
    })

    // ── 3. run:code → run:done round-trip ─────────────────────────────────
    info("Emitting run:code with a trivial JS snippet…")

    const runResult = await withTimeout(
        new Promise((resolve, reject) => {
            let stdout = ""
            let stderr = ""

            socket.on("run:stdout", ({ data }) => { stdout += data })
            socket.on("run:stderr", ({ data }) => { stderr += data })
            socket.on("run:error",  ({ message }) => reject(new Error(message)))
            socket.on("run:done",   (payload) => resolve({ payload, stdout, stderr }))

            socket.emit("run:code", {
                language: "javascript",
                code:     'console.log("hello from check script")',
                stdin:    "",
            })
        }),
        TIMEOUT_MS,
        "run:done"
    ).catch((err) => {
        fail(`Execution round-trip failed: ${err.message}`)
        socket.disconnect()
        process.exit(1)
    })

    const { payload, stdout, stderr } = runResult

    if (stdout.trim() === "hello from check script") {
        ok(`stdout received correctly: "${stdout.trim()}"`)
    } else if (stdout) {
        warn(`Unexpected stdout: "${stdout.trim()}"`)
    }

    if (stderr) warn(`stderr output: "${stderr.trim()}"`)

    if (payload.exitCode === 0) {
        ok(`Process exited cleanly (exitCode: 0, ${payload.durationMs}ms)`)
    } else {
        fail(`Process exited with code ${payload.exitCode}`)
    }

    socket.disconnect()
    console.log()
    console.log(`${GREEN}━━ All checks passed — the run pipeline is healthy ━━${RESET}\n`)
    process.exit(0)
}

main().catch((err) => {
    fail(`Unexpected error: ${err.message}`)
    process.exit(1)
})
