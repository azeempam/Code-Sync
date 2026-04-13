/**
 * languageMap.ts
 * --------------
 * Maps a language identifier (as sent by the client) to the shell
 * command template that executes a temporary source file.
 *
 * Template tokens:
 *   {file}   – absolute path to the temp source file
 *   {out}    – absolute path for compiled binary  (compile-then-run langs)
 *   {dir}    – directory containing {file}
 *   {class}  – filename without extension          (Java)
 */

export interface LangConfig {
    /** File extension written for the temp file, e.g. "py", "js" */
    extension: string
    /**
     * Array of command + args arrays.
     * Single entry  → interpreted language  (e.g. ["python3", "{file}"])
     * Two entries   → compile then run       (e.g. ["gcc …", "{out}"] then ["{out}"])
     */
    commands: string[][]
    /** Whether stdin should be piped to the child process */
    supportsStdin?: boolean
}

const languageMap: Record<string, LangConfig> = {
    // ── Interpreted ────────────────────────────────────────────────────────
    python: {
        extension: "py",
        commands: [["python3", "-u", "{file}"]],
        supportsStdin: true,
    },
    python3: {
        extension: "py",
        commands: [["python3", "-u", "{file}"]],
        supportsStdin: true,
    },
    javascript: {
        extension: "js",
        commands: [["node", "{file}"]],
        supportsStdin: true,
    },
    js: {
        extension: "js",
        commands: [["node", "{file}"]],
        supportsStdin: true,
    },
    typescript: {
        extension: "ts",
        commands: [["npx", "--yes", "ts-node", "--transpile-only", "{file}"]],
        supportsStdin: true,
    },
    ts: {
        extension: "ts",
        commands: [["npx", "--yes", "ts-node", "--transpile-only", "{file}"]],
        supportsStdin: true,
    },
    ruby: {
        extension: "rb",
        commands: [["ruby", "{file}"]],
        supportsStdin: true,
    },
    php: {
        extension: "php",
        commands: [["php", "{file}"]],
        supportsStdin: true,
    },
    bash: {
        extension: "sh",
        commands: [["bash", "{file}"]],
        supportsStdin: true,
    },
    sh: {
        extension: "sh",
        commands: [["bash", "{file}"]],
        supportsStdin: true,
    },
    go: {
        extension: "go",
        commands: [["go", "run", "{file}"]],
        supportsStdin: true,
    },

    // ── Compiled ───────────────────────────────────────────────────────────
    c: {
        extension: "c",
        commands: [
            ["gcc", "{file}", "-o", "{out}", "-lm"],
            ["{out}"],
        ],
        supportsStdin: true,
    },
    cpp: {
        extension: "cpp",
        commands: [
            ["g++", "-std=c++17", "{file}", "-o", "{out}"],
            ["{out}"],
        ],
        supportsStdin: true,
    },
    "c++": {
        extension: "cpp",
        commands: [
            ["g++", "-std=c++17", "{file}", "-o", "{out}"],
            ["{out}"],
        ],
        supportsStdin: true,
    },
    java: {
        extension: "java",
        // javac writes .class next to source; exec from {dir}
        commands: [
            ["javac", "{file}"],
            ["java", "-cp", "{dir}", "{class}"],
        ],
        supportsStdin: true,
    },
    rust: {
        extension: "rs",
        commands: [
            ["rustc", "{file}", "-o", "{out}"],
            ["{out}"],
        ],
        supportsStdin: false,
    },
}

export default languageMap
