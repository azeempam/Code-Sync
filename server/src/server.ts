import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"
import { ChildProcess } from "child_process"
import { executeCode } from "./executor/CodeExecutor"
import languageMap from "./executor/languageMap"
import * as pty from "node-pty"
import { setupDashboardEvents } from "./socket/dashboardEvents"
import dashboardRoutes from "./routes/dashboard"

import { setupHealthMonitorEvents } from "./socket/healthMonitorEvents"
import healthRoutes from "./routes/health"
dotenv.config()

const app = express()

app.use(express.json())

app.use(cors())

app.use(express.static(path.join(__dirname, "public"))) // Serve static files

// Register dashboard routes
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/health', healthRoutes)

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: "*",
	},
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
})

let userSocketMap: User[] = []

/**
 * Map of socket ID to PTY process for terminal sessions.
 */
const terminalProcesses = new Map<string, pty.IPty>()

/**
 * Per-socket registry of the currently running child process.
 * Used to kill jobs on socket disconnect or explicit run:kill.
 */
const runningJobs = new Map<string, ChildProcess>()

/**
 * Notify the Python resource-monitor server (localhost:5001) to start
 * watching `pid` automatically — no manual PID entry needed in the UI.
 * Uses Node's built-in `http` module so no extra dependency is required.
 * Silently swallowed if the Python monitor is not running.
 */
function notifyMonitor(pid: number | undefined): void {
	if (!pid) return
	const body = JSON.stringify({ pid })
	const req  = http.request(
		{
			hostname: "127.0.0.1",
			port:     5001,
			path:     "/start",
			method:   "POST",
			headers: {
				"Content-Type":   "application/json",
				"Content-Length": Buffer.byteLength(body),
			},
		},
		() => { /* ignore response body */ }
	)
	req.on("error", () => { /* Python monitor not running — harmless */ })
	req.write(body)
	req.end()
}

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

// Setup dashboard events
setupDashboardEvents(io)
setupHealthMonitorEvents(io)

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		console.log(`\n🔌 [DISCONNECTING] Socket: ${socket.id.substring(0, 8)}...`)
		
		// Kill any running code execution job for this socket
		const job = runningJobs.get(socket.id)
		if (job) {
			try {
				console.log(`   💀 Killing running job...`)
				job.kill("SIGKILL")
			} catch (e) {
				console.warn(`   ⚠️  Failed to kill job:`, e)
			}
			runningJobs.delete(socket.id)
		}

		// Kill terminal PTY process
		const ptyProcess = terminalProcesses.get(socket.id)
		if (ptyProcess) {
			try {
				console.log(`   💀 Killing PTY process (PID: ${ptyProcess.pid})...`)
				ptyProcess.kill()
			} catch (e) {
				console.warn(`   ⚠️  Failed to kill PTY:`, e)
			}
			terminalProcesses.delete(socket.id)
			console.log(`   ✅ PTY cleanup complete`)
		}

		// Notify room peers
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position and selection
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					typing: true,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	// Handle cursor movement without typing
	socket.on(SocketEvent.CURSOR_MOVE, ({ cursorPosition, selectionStart, selectionEnd }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return {
					...user,
					cursorPosition,
					selectionStart,
					selectionEnd
				}
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.CURSOR_MOVE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})

	// ── Code Execution ───────────────────────────────────────────────────────

	/**
	 * Payload: { code: string; language: string; stdin?: string }
	 * The handler is scoped to the requesting socket only — other users in the
	 * same room do NOT receive stdout/stderr (execution is private to the runner).
	 */
	socket.on(
		SocketEvent.RUN_CODE,
		async ({ code, language, stdin }: { code: string; language: string; stdin?: string }) => {
			// Kill any previously running job for this socket
			const existing = runningJobs.get(socket.id)
			if (existing) {
				try { existing.kill("SIGKILL") } catch { /* ignore */ }
				runningJobs.delete(socket.id)
			}

			io.to(socket.id).emit(SocketEvent.RUN_STARTED, { language })

			const child = await executeCode(
				{ code, language, stdin },
				{
					onStdout: (chunk) =>
						io.to(socket.id).emit(SocketEvent.RUN_STDOUT, { data: chunk }),

					onStderr: (chunk) =>
						io.to(socket.id).emit(SocketEvent.RUN_STDERR, { data: chunk }),

					onDone: (payload) => {
						runningJobs.delete(socket.id)
						io.to(socket.id).emit(SocketEvent.RUN_DONE, payload)
					},

					onError: (message) => {
						runningJobs.delete(socket.id)
						io.to(socket.id).emit(SocketEvent.RUN_ERROR, { message })
					},
				}
			)

			if (child) runningJobs.set(socket.id, child)
		}
	)

	/** Client requests explicit kill of the current job (e.g. user presses ⏹) */
	socket.on(SocketEvent.RUN_KILL, () => {
		const job = runningJobs.get(socket.id)
		if (job) {
			try { job.kill("SIGKILL") } catch { /* ignore */ }
			runningJobs.delete(socket.id)
			io.to(socket.id).emit(SocketEvent.RUN_DONE, {
				exitCode: null, signal: "SIGKILL", timedOut: false, durationMs: 0,
			})
		}
	})

	// ── Terminal Handlers ──────────────────────────────────────────────────

	/** Initialize a new terminal session */
	socket.on(SocketEvent.TERMINAL_INIT, ({ cols, rows }: { cols: number; rows: number }) => {
		console.log(`\n📡 [TERMINAL_INIT] Socket: ${socket.id.substring(0, 8)}... | Cols: ${cols}, Rows: ${rows}`)
		
		// Kill existing PTY if any
		const existing = terminalProcesses.get(socket.id)
		if (existing) {
			try {
				console.log(`   🔴 Killing existing PTY...`)
				existing.kill()
			} catch (e) {
				console.warn(`   ⚠️  Failed to kill existing PTY:`, e)
			}
			terminalProcesses.delete(socket.id)
		}

		try {
			// Determine working directory - prefer project root or user home
			const workingDir = process.cwd()
			console.log(`   📂 Working directory: ${workingDir}`)

			// Spawn new PTY with proper configuration
			console.log(`   🚀 Spawning bash with xterm-256color...`)
			const ptyProcess = pty.spawn('bash', [], {
				name: 'xterm-256color',
				cols: Math.max(cols || 80, 40),
				rows: Math.max(rows || 24, 10),
				cwd: workingDir,
				env: {
					...process.env,
					TERM: 'xterm-256color',
					LANG: 'en_US.UTF-8',
				},
			})

			terminalProcesses.set(socket.id, ptyProcess)
			console.log(`   ✅ PTY spawned. PID: ${ptyProcess.pid}`)

			// Forward PTY output to client
			ptyProcess.onData((data: string) => {
				console.log(`   📤 [PTY_OUTPUT] ${data.length} bytes | Sample: ${JSON.stringify(data.substring(0, 30))}${data.length > 30 ? '...' : ''}`)
				socket.emit(SocketEvent.TERMINAL_OUTPUT, { data })
			})

			// Handle PTY exit/close
			ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
				console.log(`   🔴 [PTY_EXIT] Exit code: ${exitCode}, Signal: ${signal}`)
				socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode, signal })
				})

			console.log(`✅ Terminal [${socket.id.substring(0, 8)}...] initialized successfully\n`)
		} catch (error) {
			console.error(`❌ Failed to initialize terminal [${socket.id}]:`, error)
			socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode: 1, signal: 0 })
		}
	})

	/** Send input to terminal (user keystrokes or commands) */
	socket.on(SocketEvent.TERMINAL_INPUT, ({ data }: { data: string }) => {
		console.log(`📥 [TERMINAL_INPUT] Socket: ${socket.id.substring(0, 8)}... | Data: ${JSON.stringify(data)} (${data.length} bytes)`)
		
		const ptyProcess = terminalProcesses.get(socket.id)
		if (!ptyProcess) {
			console.warn(`   ⚠️  Terminal [${socket.id.substring(0, 8)}...] not found for input`)
			return
		}

		try {
			// Write user input directly to PTY stdin
			// This allows all shell features: pipes, redirects, etc.
			ptyProcess.write(data)
			console.log(`   ✅ Input written to PTY`)
		} catch (error) {
			console.error(`   ❌ Failed to write to terminal [${socket.id}]:`, error)
		}
	})

	/** Resize terminal when user resizes window */
	socket.on(SocketEvent.TERMINAL_RESIZE, ({ cols, rows }: { cols: number; rows: number }) => {
		console.log(`📐 [TERMINAL_RESIZE] Socket: ${socket.id.substring(0, 8)}... | ${cols}x${rows}`)
		
		const ptyProcess = terminalProcesses.get(socket.id)
		if (!ptyProcess) {
			console.warn(`   ⚠️  Terminal [${socket.id.substring(0, 8)}...] not found for resize`)
			return
		}

		try {
			ptyProcess.resize(Math.max(cols || 80, 40), Math.max(rows || 24, 10))
			console.log(`   ✅ PTY resized`)
		} catch (error) {
			console.error(`   ❌ Failed to resize terminal [${socket.id}]:`, error)
		}
	})

})

const PORT = process.env.PORT || 3000

/**
 * GET /api/languages
 * Returns the list of languages supported by the local CodeExecutor so the
 * client can populate its language selector without depending on Piston.
 */
app.get("/api/languages", (_req: Request, res: Response) => {
	const languages = Object.keys(languageMap).map((key) => ({
		language: key,
		version: "",
		aliases: [key],
	}))
	res.json(languages)
})

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
