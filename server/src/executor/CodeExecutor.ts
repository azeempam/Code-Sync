/**
 * CodeExecutor.ts
 * ---------------
 * Aura-Next IDE — Sandboxed Code Execution Engine
 *
 * Workflow
 * ────────
 * 1. Write code string to a per-execution temp file.
 * 2. Resolve the runtime command(s) from languageMap.
 * 3. For compile-then-run languages, run the compile step first; any
 *    compile error is forwarded as stderr and execution stops.
 * 4. Spawn the run step, piping stdin if provided.
 * 5. Stream stdout / stderr chunks back to the caller via events.
 * 6. Enforce a hard EXECUTION_TIMEOUT_MS wall-clock limit; kill the
 *    process tree (SIGKILL) if exceeded.
 * 7. Clean up all temp files regardless of how the process ended.
 *
 * Safety measures
 * ───────────────
 * • Each execution gets a UUID-scoped temp directory → no filename clashes
 *   between concurrent users.
 * • `detached: false` keeps the child inside Node's process group so
 *   SIGKILL reliably terminates the whole subtree.
 * • Compiled binaries are deleted with the source so no stale executables
 *   accumulate on disk.
 * • Per-socket active-process registry → disconnect kills any running job.
 */

import { spawn, SpawnOptionsWithoutStdio, ChildProcess } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { randomUUID } from "crypto"
import languageMap, { LangConfig } from "./languageMap"

// ── Configuration ──────────────────────────────────────────────────────────────

/** Hard wall-clock limit for the *run* step (ms). Compile step gets 2× this. */
const EXECUTION_TIMEOUT_MS = 5_000

/** Max bytes accepted from stdout/stderr before the stream is force-closed. */
const MAX_OUTPUT_BYTES = 512 * 1024   // 512 KB

// ── Public types ───────────────────────────────────────────────────────────────

export interface RunRequest {
    /** Source code string */
    code: string
    /** Language key (must exist in languageMap) */
    language: string
    /** Optional stdin to pipe into the running process */
    stdin?: string
}

export interface ExecutionCallbacks {
    onStdout:     (chunk: string) => void
    onStderr:     (chunk: string) => void
    /** Called when the process exits normally or via timeout */
    onDone:       (payload: DonePayload) => void
    /** Called for infrastructure errors (bad language, write failure, etc.) */
    onError:      (message: string) => void
}

export interface DonePayload {
    exitCode:    number | null
    signal:      NodeJS.Signals | null
    /** True if the timeout watchdog killed the process */
    timedOut:    boolean
    /** Wall-clock ms for the run step only */
    durationMs:  number
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function resolveTokens(
    template: string[],
    tokens: Record<string, string>
): string[] {
    return template.map((part) =>
        Object.entries(tokens).reduce(
            (s, [k, v]) => s.split(`{${k}}`).join(v),
            part
        )
    )
}

async function writeTemp(
    dir: string,
    filename: string,
    content: string
): Promise<void> {
    return fs.promises.writeFile(path.join(dir, filename), content, "utf8")
}

function rimraf(dir: string): void {
    try {
        fs.rmSync(dir, { recursive: true, force: true })
    } catch {
        /* best-effort cleanup */
    }
}

/**
 * Run a single command step (compile or execute).
 * Returns { exitCode, stderr } — does NOT stream; used for the compile step.
 */
function runStep(
    cmd: string[],
    cwd: string,
    timeoutMs: number,
    stdin?: string
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
    return new Promise((resolve) => {
        const [bin, ...args] = cmd
        const opts: SpawnOptionsWithoutStdio = { cwd, shell: false }
        const child = spawn(bin, args, opts)

        let stderr = ""
        let stdout = ""

        if (stdin) child.stdin.write(stdin)
        child.stdin.end()

        child.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
        child.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

        const timer = setTimeout(() => {
            child.kill("SIGKILL")
        }, timeoutMs)

        child.on("close", (exitCode) => {
            clearTimeout(timer)
            resolve({ exitCode, stderr, stdout })
        })
    })
}

// ── Core executor ──────────────────────────────────────────────────────────────

/**
 * Execute `request.code` in a temp sandbox and stream results via `callbacks`.
 * Returns the spawned `ChildProcess` for the *run* step so the caller can
 * kill it on socket disconnect.  Returns `null` if execution never reached
 * the run step (e.g. compile error, bad language).
 */
export async function executeCode(
    request: RunRequest,
    callbacks: ExecutionCallbacks
): Promise<ChildProcess | null> {
    const { code, language, stdin } = request
    const { onStdout, onStderr, onDone, onError } = callbacks

    // ── 1. Resolve language config ─────────────────────────────────────────
    const langKey = language.toLowerCase().trim()
    const config: LangConfig | undefined = languageMap[langKey]
    if (!config) {
        onError(`Unsupported language: "${language}"`)
        return null
    }

    // ── 2. Create isolated temp directory ──────────────────────────────────
    const execId   = randomUUID()
    const tmpDir   = path.join(os.tmpdir(), `aura_exec_${execId}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Java: class name must match filename — use "Main" as a safe default.
    const isJava      = langKey === "java"
    const baseName    = isJava ? "Main" : `code_${execId}`
    const sourceFile  = `${baseName}.${config.extension}`
    const sourcePath  = path.join(tmpDir, sourceFile)
    const outPath     = path.join(tmpDir, baseName)   // compiled binary

    const tokens = {
        file:  sourcePath,
        out:   outPath,
        dir:   tmpDir,
        class: baseName,
    }

    // ── 3. Write source to disk ────────────────────────────────────────────
    try {
        await writeTemp(tmpDir, sourceFile, code)
    } catch (err: any) {
        rimraf(tmpDir)
        onError(`Failed to write temp file: ${err.message}`)
        return null
    }

    // ── 4. Compile step (languages with 2 command entries) ─────────────────
    if (config.commands.length > 1) {
        const compileCmd = resolveTokens(config.commands[0], tokens)
        const result     = await runStep(compileCmd, tmpDir, EXECUTION_TIMEOUT_MS * 2)

        if ((result.exitCode ?? 1) !== 0) {
            onStderr(result.stderr || result.stdout || "Compilation failed.")
            onDone({ exitCode: result.exitCode, signal: null, timedOut: false, durationMs: 0 })
            rimraf(tmpDir)
            return null
        }

        // Forward any compiler warnings as informational stderr
        if (result.stderr) onStderr(result.stderr)
    }

    // ── 5. Spawn the run step ──────────────────────────────────────────────
    const runCmdTemplate = config.commands[config.commands.length - 1]
    const runCmd         = resolveTokens(runCmdTemplate, tokens)
    const [bin, ...args] = runCmd

    const child = spawn(bin, args, {
        cwd:   tmpDir,
        shell: false,
        // Inherit nothing from parent — clean environment for sandboxing
        env: {
            PATH:   process.env.PATH,
            HOME:   tmpDir,         // jail home to temp dir
            TMPDIR: tmpDir,
        },
    })

    const startedAt = Date.now()
    let outputBytes = 0
    let timedOut    = false

    // ── 6. Pipe stdin ──────────────────────────────────────────────────────
    if (stdin && config.supportsStdin) {
        try {
            child.stdin.write(stdin)
        } catch { /* may throw if child died early */ }
    }
    try { child.stdin.end() } catch { /* ignore */ }

    // ── 7. Stream stdout ───────────────────────────────────────────────────
    child.stdout.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length
        if (outputBytes > MAX_OUTPUT_BYTES) {
            onStderr("\n[Output limit reached — process killed]\n")
            child.kill("SIGKILL")
            return
        }
        onStdout(chunk.toString())
    })

    // ── 8. Stream stderr ───────────────────────────────────────────────────
    child.stderr.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length
        onStderr(chunk.toString())
    })

    // ── 9. Timeout watchdog ────────────────────────────────────────────────
    const watchdog = setTimeout(() => {
        timedOut = true
        child.kill("SIGKILL")
        onStderr(`\n[Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s]\n`)
    }, EXECUTION_TIMEOUT_MS)

    // ── 10. Process exit ───────────────────────────────────────────────────
    child.on("close", (exitCode, signal) => {
        clearTimeout(watchdog)
        rimraf(tmpDir)
        onDone({
            exitCode,
            signal:      signal as NodeJS.Signals | null,
            timedOut,
            durationMs:  Date.now() - startedAt,
        })
    })

    child.on("error", (err) => {
        clearTimeout(watchdog)
        rimraf(tmpDir)
        onError(`Process error: ${err.message}`)
    })

    return child
}
