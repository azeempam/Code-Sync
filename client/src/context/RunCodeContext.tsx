/**
 * RunCodeContext.tsx
 * ------------------
 * Drives the "Run Code" panel using the Socket.IO execution pipeline
 * instead of the external Piston HTTP API.
 *
 * Socket event flow
 * ─────────────────
 *  Client emits  run:code   → { code, language, stdin }
 *  Server emits  run:started → acknowledged
 *  Server emits  run:stdout  → { data: string }   (streamed)
 *  Server emits  run:stderr  → { data: string }   (streamed)
 *  Server emits  run:done    → { exitCode, signal, timedOut, durationMs }
 *  Server emits  run:error   → { message }         (infra error)
 */

import { Language, RunContext as RunContextType } from "@/types/run"
import { SocketEvent } from "@/types/socket"
import langMap from "lang-map"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useFileSystem } from "./FileContext"
import { useSocket } from "./SocketContext"

const RunCodeContext = createContext<RunContextType | null>(null)

export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const RunCodeContextProvider = ({ children }: { children: ReactNode }) => {
    const { activeFile } = useFileSystem()
    const { socket } = useSocket()

    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<Language>({
        language: "",
        version: "",
        aliases: [],
    })

    // Accumulate streamed output between renders to avoid O(n²) string concat
    const outputBuf = useRef<string>("")

    // ── Fetch supported languages from our own server ──────────────────────
    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/languages`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data: Language[] = await res.json()
                setSupportedLanguages(data)
            } catch (error) {
                toast.error("Failed to fetch supported languages")
                console.error(error)
            }
        }

        fetchSupportedLanguages()
    }, [])

    // ── Auto-select language based on the active file extension ────────────
    useEffect(() => {
        if (supportedLanguages.length === 0 || !activeFile?.name) return

        const extension = activeFile.name.split(".").pop()
        if (extension) {
            const languageNames = langMap.languages(extension)
            const language = supportedLanguages.find(
                (lang) =>
                    lang.aliases.includes(extension) ||
                    languageNames
                        .map((n: string) => n.toLowerCase())
                        .includes(lang.language.toLowerCase()),
            )
            if (language) setSelectedLanguage(language)
        } else {
            setSelectedLanguage({ language: "", version: "", aliases: [] })
        }
    }, [activeFile?.name, supportedLanguages])

    // ── Socket listeners for streaming run output ──────────────────────────
    useEffect(() => {
        const handleStarted = () => {
            outputBuf.current = ""
            setOutput("")
        }

        const handleStdout = ({ data }: { data: string }) => {
            outputBuf.current += data
            setOutput(outputBuf.current)
        }

        const handleStderr = ({ data }: { data: string }) => {
            outputBuf.current += data
            setOutput(outputBuf.current)
        }

        const handleDone = ({
            exitCode,
            timedOut,
        }: {
            exitCode: number | null
            signal: string | null
            timedOut: boolean
            durationMs: number
        }) => {
            setIsRunning(false)
            toast.dismiss()
            if (timedOut) {
                toast.error("Execution timed out")
            } else if (exitCode !== 0 && exitCode !== null) {
                toast.error(`Process exited with code ${exitCode}`)
            } else {
                toast.success("Run complete")
            }
        }

        const handleError = ({ message }: { message: string }) => {
            outputBuf.current += `\nError: ${message}`
            setOutput(outputBuf.current)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Execution error: " + message)
        }

        socket.on(SocketEvent.RUN_STARTED, handleStarted)
        socket.on(SocketEvent.RUN_STDOUT,  handleStdout)
        socket.on(SocketEvent.RUN_STDERR,  handleStderr)
        socket.on(SocketEvent.RUN_DONE,    handleDone)
        socket.on(SocketEvent.RUN_ERROR,   handleError)

        return () => {
            socket.off(SocketEvent.RUN_STARTED, handleStarted)
            socket.off(SocketEvent.RUN_STDOUT,  handleStdout)
            socket.off(SocketEvent.RUN_STDERR,  handleStderr)
            socket.off(SocketEvent.RUN_DONE,    handleDone)
            socket.off(SocketEvent.RUN_ERROR,   handleError)
        }
    }, [socket])

    // ── runCode: emit the socket event ─────────────────────────────────────
    const runCode = () => {
        if (!selectedLanguage.language) {
            toast.error("Please select a language to run the code")
            return
        }
        if (!activeFile) {
            toast.error("Please open a file to run the code")
            return
        }
        if (isRunning) return

        setIsRunning(true)
        toast.loading("Running code…")

        socket.emit(SocketEvent.RUN_CODE, {
            code:     activeFile.content,
            language: selectedLanguage.language,
            stdin:    input,
        })
    }

    return (
        <RunCodeContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                supportedLanguages,
                selectedLanguage,
                setSelectedLanguage,
                runCode,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }
export default RunCodeContext
