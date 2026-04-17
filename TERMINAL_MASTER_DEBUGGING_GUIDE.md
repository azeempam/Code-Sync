# Interactive Web-Terminal: Master Debugging & Implementation Guide

## 🎯 Problem Statement

✗ Terminal renders but **cannot accept input**  
✗ Keystrokes not captured or sent to backend  
✗ Commands not executing or executing silently  
✗ No output displayed from shell  
✗ Possible issues: socket disconnection, missing event handlers, focus problems  

**Solution:** Use this step-by-step debugging guide to verify each component.

---

## 🔧 TASK 1: Backend PTY Controller (Node.js + node-pty)

### **Complete Backend Implementation**

**File:** `server/src/server.ts` (lines ~410-480)

```typescript
import * as pty from "node-pty"

// ═══════════════════════════════════════════════════════════════════
// CRITICAL: Global PTY Registry
// ═══════════════════════════════════════════════════════════════════

/**
 * Map to store PTY process for each socket connection
 * - Key: socket.id (unique per user session)
 * - Value: pty.IPty (actual bash process)
 * 
 * Example state:
 * {
 *   "socket_1abc": <PTY Process 1>,
 *   "socket_2def": <PTY Process 2>
 * }
 */
const terminalProcesses = new Map<string, pty.IPty>()

// ═══════════════════════════════════════════════════════════════════
// HANDLER 1: Initialize Terminal (socket.on TERMINAL_INIT)
// ═══════════════════════════════════════════════════════════════════

socket.on(SocketEvent.TERMINAL_INIT, ({ cols, rows }: { cols: number; rows: number }) => {
	console.log(`\n[TERMINAL_INIT] Socket ${socket.id}`)
	console.log(`[TERMINAL_INIT] Requested dimensions: ${cols}x${rows}`)

	// Step 1: Kill any existing PTY for this socket (cleanup)
	const existingPty = terminalProcesses.get(socket.id)
	if (existingPty) {
		console.log(`[TERMINAL_INIT] Killing existing PTY for ${socket.id}`)
		try {
			existingPty.kill()
		} catch (err) {
			console.error(`[TERMINAL_INIT] Error killing existing PTY:`, err)
		}
		terminalProcesses.delete(socket.id)
	}

	try {
		// Step 2: Determine working directory
		// This is where bash will start (project root)
		const workingDir = process.cwd()
		console.log(`[TERMINAL_INIT] Working directory: ${workingDir}`)

		// Step 3: Validate dimensions (prevent xterm corruption)
		const validCols = Math.max(cols || 80, 40)      // Min 40 cols
		const validRows = Math.max(rows || 24, 10)      // Min 10 rows
		console.log(`[TERMINAL_INIT] Validated dimensions: ${validCols}x${validRows}`)

		// Step 4: SPAWN BASH PROCESS
		// ┌─ This is the critical line ─┐
		// │ Creates actual bash shell   │
		// │ with PTY support            │
		// └─────────────────────────────┘
		const ptyProcess = pty.spawn('bash', [], {
			name: 'xterm-256color',                      // Terminal type (colors)
			cols: validCols,                             // Terminal width
			rows: validRows,                             // Terminal height
			cwd: workingDir,                             // Working directory
			env: {
				...process.env,
				TERM: 'xterm-256color',                  // Environment: enable colors
				LANG: 'en_US.UTF-8',                     // Environment: UTF-8 encoding
				COLORTERM: 'truecolor',                  // Enable 24-bit colors
			},
		})

		console.log(`[TERMINAL_INIT] ✅ PTY spawned with PID: ${ptyProcess.pid}`)

		// Step 5: Store PTY reference for later I/O operations
		terminalProcesses.set(socket.id, ptyProcess)

		// ═══════════════════════════════════════════════════════════════
		// CRITICAL: Listen for bash output (stdout/stderr/mixed)
		// ═══════════════════════════════════════════════════════════════
		// Every time bash produces output, this callback fires
		// Output includes: command echo, command results, prompts, errors

		ptyProcess.onData((data: string) => {
			console.log(`[PTY_OUTPUT] Socket ${socket.id}: ${data.length} bytes`)
			console.log(`[PTY_OUTPUT] Raw data (first 100 chars): ${data.substring(0, 100)}`)

			// CRITICAL: Send output to frontend
			// The magic happens here:
			// PTY output → Socket.io event → Frontend → xterm.write()
			socket.emit(SocketEvent.TERMINAL_OUTPUT, { data })
		})

		// ═══════════════════════════════════════════════════════════════
		// CRITICAL: Listen for bash process exit
		// ═══════════════════════════════════════════════════════════════

		ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
			console.log(`[PTY_EXIT] Socket ${socket.id}: exit=${exitCode}, signal=${signal}`)

			// Signal frontend that terminal closed
			socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode, signal })

			// Cleanup: remove from map
			terminalProcesses.delete(socket.id)
		})

		// Step 6: Notify frontend that init succeeded
		console.log(`[TERMINAL_INIT] ✅ Initialization complete\n`)

	} catch (error) {
		console.error(`[TERMINAL_INIT] ❌ Failed to initialize terminal:`, error)
		socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode: 1, signal: 0 })
	}
})


// ═══════════════════════════════════════════════════════════════════
// HANDLER 2: Receive User Input (socket.on TERMINAL_INPUT)
// ═══════════════════════════════════════════════════════════════════

socket.on(SocketEvent.TERMINAL_INPUT, ({ data }: { data: string }) => {
	console.log(`[TERMINAL_INPUT] Socket ${socket.id}`)
	console.log(`[TERMINAL_INPUT] Data: ${JSON.stringify(data)} (${data.length} bytes)`)

	// Step 1: Get PTY for this socket
	const ptyProcess = terminalProcesses.get(socket.id)
	if (!ptyProcess) {
		console.warn(`[TERMINAL_INPUT] ❌ PTY not found for socket ${socket.id}`)
		console.warn(`[TERMINAL_INPUT] Available PTYs:`, Array.from(terminalProcesses.keys()))
		return
	}

	try {
		// Step 2: WRITE TO PTY STDIN
		// ┌────────────────────────────────────────┐
		// │ This is how user input reaches bash    │
		// │ Everything flows through this:         │
		// │ - Regular characters                   │
		// │ - Enter/Return (\r or \r\n)           │
		// │ - Backspace (\x7f)                     │
		// │ - Ctrl+C (\x03)                        │
		// │ - Special keys (arrow codes)           │
		// └────────────────────────────────────────┘

		ptyProcess.write(data)
		console.log(`[TERMINAL_INPUT] ✅ Data written to PTY\n`)

		// Step 3: Verify write
		// The bash process will receive this data and echo it back
		// We'll see it in the onData callback above
		// Then send it to frontend via TERMINAL_OUTPUT

	} catch (error) {
		console.error(`[TERMINAL_INPUT] ❌ Failed to write to PTY:`, error)
	}
})


// ═══════════════════════════════════════════════════════════════════
// HANDLER 3: Handle Resize (socket.on TERMINAL_RESIZE)
// ═══════════════════════════════════════════════════════════════════

socket.on(SocketEvent.TERMINAL_RESIZE, ({ cols, rows }: { cols: number; rows: number }) => {
	console.log(`[TERMINAL_RESIZE] Socket ${socket.id}: ${cols}x${rows}`)

	// Step 1: Get PTY
	const ptyProcess = terminalProcesses.get(socket.id)
	if (!ptyProcess) {
		console.warn(`[TERMINAL_RESIZE] ❌ PTY not found`)
		return
	}

	try {
		// Step 2: Validate dimensions
		const validCols = Math.max(cols || 80, 40)
		const validRows = Math.max(rows || 24, 10)

		// Step 3: Update PTY size
		ptyProcess.resize(validCols, validRows)
		console.log(`[TERMINAL_RESIZE] ✅ PTY resized to ${validCols}x${validRows}\n`)

	} catch (error) {
		console.error(`[TERMINAL_RESIZE] ❌ Failed to resize PTY:`, error)
	}
})


// ═══════════════════════════════════════════════════════════════════
// HANDLER 4: Cleanup on Disconnect
// ═══════════════════════════════════════════════════════════════════

socket.on("disconnecting", () => {
	console.log(`[DISCONNECT] Socket ${socket.id}`)

	// Kill PTY process when user disconnects
	const ptyProcess = terminalProcesses.get(socket.id)
	if (ptyProcess) {
		console.log(`[DISCONNECT] Killing PTY for ${socket.id}`)
		try {
			ptyProcess.kill()
		} catch (err) {
			console.error(`[DISCONNECT] Error killing PTY:`, err)
		}
		terminalProcesses.delete(socket.id)
		console.log(`[DISCONNECT] ✅ PTY cleaned up\n`)
	}
})
```

### **Backend Verification Checklist**

```typescript
// Verify these are present:

// ✅ Global registry
const terminalProcesses = new Map<string, pty.IPty>()

// ✅ Four socket event handlers:
socket.on(SocketEvent.TERMINAL_INIT, ...
socket.on(SocketEvent.TERMINAL_INPUT, ...
socket.on(SocketEvent.TERMINAL_RESIZE, ...
socket.on("disconnecting", ...

// ✅ PTY spawn with correct parameters:
pty.spawn('bash', [], {
  name: 'xterm-256color',
  cols, rows,
  cwd: workingDir,
  env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8' }
})

// ✅ Event listeners:
ptyProcess.onData((data) => socket.emit(TERMINAL_OUTPUT, { data }))
ptyProcess.onExit(({ exitCode, signal }) => socket.emit(TERMINAL_EXIT, ...))

// ✅ Input handler:
ptyProcess.write(data)
```

---

## 🎨 TASK 2: Frontend Xterm.js React Component Fix

### **Complete Frontend Implementation**

**File:** `client/src/components/terminal/Terminal.tsx`

```typescript
import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { SocketEvent } from '../../types/socket'
import { useSocket } from '../../context/SocketContext'

const Terminal: React.FC = () => {
	// ═══════════════════════════════════════════════════════════════════
	// REFS: Store references that persist across renders
	// ═══════════════════════════════════════════════════════════════════

	const containerRef = useRef<HTMLDivElement>(null)        // Container element
	const terminalRef = useRef<HTMLDivElement>(null)         // Xterm DOM node
	const xtermRef = useRef<XTerm | null>(null)              // Xterm instance
	const fitAddonRef = useRef<FitAddon | null>(null)        // FitAddon instance
	const socket = useSocket()                               // Socket.io context

	console.log(`[Terminal] Component rendered, Socket ID: ${socket?.id}`)

	// ═══════════════════════════════════════════════════════════════════
	// MAIN EFFECT: Initialize terminal one time
	// ═══════════════════════════════════════════════════════════════════

	useEffect(() => {
		console.log(`[Effect] Starting terminal initialization`)

		// Guard 1: Ensure DOM node exists
		if (!terminalRef.current) {
			console.error(`[Effect] ❌ terminalRef.current is null`)
			return
		}

		// Guard 2: Ensure socket is connected
		if (!socket) {
			console.error(`[Effect] ❌ Socket is null`)
			return
		}

		console.log(`[Effect] ✅ Guards passed, proceeding with initialization`)

		try {
			// ═════════════════════════════════════════════════════════════
			// STEP 1: Create Xterm.js instance
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 1: Creating XTerm instance`)

			const xterm = new XTerm({
				cursorBlink: true,                              // Animated cursor
				fontSize: 13,                                    // 13px font
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				theme: {
					background: '#1e1e1e',
					foreground: '#d4d4d4',
					cursor: '#aeafad',
					cursorAccent: '#1e1e1e',
					selection: 'rgba(255, 255, 255, 0.15)',
				},
				scrollback: 2000,                               // History size
				fastScrollSensitivity: 2,
				smoothScrollDuration: 0,
			})

			console.log(`[Effect] ✅ XTerm instance created`)

			// ═════════════════════════════════════════════════════════════
			// STEP 2: Add FitAddon for responsive sizing
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 2: Adding FitAddon`)

			const fitAddon = new FitAddon()
			xterm.loadAddon(fitAddon)

			console.log(`[Effect] ✅ FitAddon loaded`)

			// ═════════════════════════════════════════════════════════════
			// STEP 3: Render Xterm to DOM
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 3: Opening XTerm in DOM`)

			terminalRef.current.innerHTML = ''  // Clear any previous content
			xterm.open(terminalRef.current)     // Inject xterm into DOM

			console.log(`[Effect] ✅ XTerm rendered to DOM`)

			// ═════════════════════════════════════════════════════════════
			// STEP 4: Fit terminal to container on next frame
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 4: Fitting terminal to container`)

			requestAnimationFrame(() => {
				try {
					fitAddon.fit()
					console.log(`[Effect] ✅ Terminal fitted: ${xterm.cols}x${xterm.rows}`)
				} catch (e) {
					console.error(`[Effect] ❌ Fit error:`, e)
				}
			})

			// ═════════════════════════════════════════════════════════════
			// STEP 5: Store references for later use
			// ═════════════════════════════════════════════════════════════

			xtermRef.current = xterm
			fitAddonRef.current = fitAddon

			console.log(`[Effect] ✅ References stored`)

			// ═════════════════════════════════════════════════════════════
			// CRITICAL: EMIT TERMINAL_INIT to backend
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 5: Sending TERMINAL_INIT to backend`)
			console.log(`[Effect] Dimensions: ${xterm.cols}x${xterm.rows}`)
			console.log(`[Effect] Socket ID: ${socket.id}`)

			socket.emit(SocketEvent.TERMINAL_INIT, {
				cols: xterm.cols || 80,
				rows: xterm.rows || 24,
			})

			console.log(`[Effect] ✅ TERMINAL_INIT emitted`)

			// ═════════════════════════════════════════════════════════════
			// CRITICAL HANDLER 1: Capture user keystrokes
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 6: Setting up terminal input handler`)

			const handleData = (data: string) => {
				console.log(`[handleData] User input: ${JSON.stringify(data)} (${data.length} bytes)`)

				// CRITICAL: Send to backend
				// ┌──────────────────────────────────────────────────────────┐
				// │ This handler fires for EVERY keystroke/special key      │
				// │ Including:                                              │
				// │ - Regular chars: 'a', 'b', '1', etc.                   │
				// │ - Enter: '\r'                                           │
				// │ - Backspace: '\x7f'                                     │
				// │ - Ctrl+C: '\x03'                                        │
				// │ - Arrows: '\x1b[A' (up), '\x1b[B' (down), etc.         │
				// │                                                         │
				// │ ALL of this flows to backend PTY via this socket.emit  │
				// └──────────────────────────────────────────────────────────┘

				socket.emit(SocketEvent.TERMINAL_INPUT, { data })
				console.log(`[handleData] ✅ Emitted to backend`)
			}

			xterm.onData(handleData)
			console.log(`[Effect] ✅ Input handler attached`)

			// ═════════════════════════════════════════════════════════════
			// CRITICAL HANDLER 2: Receive bash output
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 7: Setting up terminal output handler`)

			const handleOutput = ({ data }: { data: string }) => {
				console.log(`[handleOutput] Received: ${data.length} bytes`)
				console.log(`[handleOutput] Content (first 100 chars): ${data.substring(0, 100)}`)

				// CRITICAL: Write to Xterm
				// ┌──────────────────────────────────────────────────────────┐
				// │ This receives everything bash outputs:                  │
				// │ - Command echo (user sees what they typed)              │
				// │ - Command results (ls output, etc.)                     │
				// │ - Error messages                                        │
				// │ - Prompts                                               │
				// │                                                         │
				// │ xterm.write() renders it to the screen                 │
				// └──────────────────────────────────────────────────────────┘

				if (xtermRef.current) {
					xtermRef.current.write(data)
					console.log(`[handleOutput] ✅ Written to xterm`)
				}
			}

			socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)
			console.log(`[Effect] ✅ Output handler registered`)

			// ═════════════════════════════════════════════════════════════
			// HANDLER 3: Handle terminal exit
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 8: Setting up terminal exit handler`)

			const handleExit = () => {
				console.log(`[handleExit] Terminal closed by backend`)

				if (xtermRef.current) {
					xtermRef.current.writeln(
						'\r\n\x1b[33m[Terminal Disconnected]\x1b[0m'
					)
				}
			}

			socket.on(SocketEvent.TERMINAL_EXIT, handleExit)
			console.log(`[Effect] ✅ Exit handler registered`)

			// ═════════════════════════════════════════════════════════════
			// HANDLER 4: Handle clear terminal event
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 9: Setting up clear handler`)

			const handleClearTerminal = () => {
				console.log(`[handleClearTerminal] Clearing terminal`)
				if (xtermRef.current) {
					xtermRef.current.clear()
				}
			}

			window.addEventListener('clearTerminal', handleClearTerminal)
			console.log(`[Effect] ✅ Clear handler registered`)

			// ═════════════════════════════════════════════════════════════
			// HANDLER 5: Handle window/container resize
			// ═════════════════════════════════════════════════════════════

			console.log(`[Effect] STEP 10: Setting up resize handlers`)

			let resizeTimeout: NodeJS.Timeout

			const handleResize = () => {
				console.log(`[handleResize] Resize triggered`)

				clearTimeout(resizeTimeout)
				resizeTimeout = setTimeout(() => {
					if (fitAddonRef.current && xtermRef.current && containerRef.current) {
						try {
							fitAddonRef.current.fit()
							const { cols, rows } = xtermRef.current

							console.log(`[handleResize] New dimensions: ${cols}x${rows}`)

							// Send resize to backend
							// This updates the PTY dimensions on server
							socket.emit(SocketEvent.TERMINAL_RESIZE, { cols, rows })
							console.log(`[handleResize] ✅ Resize emitted to backend`)

						} catch (e) {
							console.error(`[handleResize] ❌ Error:`, e)
						}
					}
				}, 150)
			}

			const resizeObserver = new ResizeObserver(() => {
				handleResize()
			})

			if (containerRef.current) {
				resizeObserver.observe(containerRef.current)
			}

			window.addEventListener('resize', handleResize)
			console.log(`[Effect] ✅ Resize handlers attached`)

			console.log(`[Effect] ✅✅✅ TERMINAL FULLY INITIALIZED ✅✅✅\n`)

			// ═════════════════════════════════════════════════════════════
			// CLEANUP: Unmount handler
			// ═════════════════════════════════════════════════════════════

			return () => {
				console.log(`[Cleanup] Cleaning up terminal resources`)

				clearTimeout(resizeTimeout)
				window.removeEventListener('resize', handleResize)
				window.removeEventListener('clearTerminal', handleClearTerminal)
				resizeObserver.disconnect()
				socket.off(SocketEvent.TERMINAL_OUTPUT, handleOutput)
				socket.off(SocketEvent.TERMINAL_EXIT, handleExit)

				try {
					xterm.dispose()
				} catch (e) {
					console.error(`[Cleanup] Error disposing xterm:`, e)
				}

				console.log(`[Cleanup] ✅ Resources cleaned up\n`)
			}

		} catch (error) {
			console.error(`[Effect] ❌ Terminal initialization error:`, error)
		}

	}, [socket])  // Re-initialize if socket changes

	// ═══════════════════════════════════════════════════════════════════
	// RENDER
	// ═══════════════════════════════════════════════════════════════════

	return (
		<div
			ref={containerRef}
			className="w-full h-full"
			style={{
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				backgroundColor: '#1e1e1e',
			}}
		>
			{/* DOM node where xterm will render */}
			<div
				ref={terminalRef}
				style={{
					flex: 1,
					overflow: 'hidden',
				}}
			/>
		</div>
	)
}

export default Terminal
```

### **Frontend Verification Checklist**

```typescript
// ✅ All refs defined:
const containerRef = useRef(null)        // Container
const terminalRef = useRef(null)         // Xterm DOM node
const xtermRef = useRef(null)            // Xterm instance
const fitAddonRef = useRef(null)         // FitAddon
const socket = useSocket()               // Socket.io

// ✅ useEffect dependency array:
}, [socket])  // CORRECT: depends on socket

// ✅ Guards at start of effect:
if (!terminalRef.current) return
if (!socket) return

// ✅ Xterm creation:
const xterm = new XTerm({ ... })        // Correct config

// ✅ FitAddon:
const fitAddon = new FitAddon()
xterm.loadAddon(fitAddon)
fitAddon.fit()

// ✅ DOM rendering:
terminalRef.current.innerHTML = ''
xterm.open(terminalRef.current)

// ✅ Backend init:
socket.emit(SocketEvent.TERMINAL_INIT, { cols, rows })

// ✅ Input handler (CRITICAL):
const handleData = (data) => {
  socket.emit(SocketEvent.TERMINAL_INPUT, { data })
}
xterm.onData(handleData)

// ✅ Output handler (CRITICAL):
const handleOutput = ({ data }) => {
  if (xtermRef.current) {
    xtermRef.current.write(data)
  }
}
socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)

// ✅ Exit handler:
const handleExit = () => { ... }
socket.on(SocketEvent.TERMINAL_EXIT, handleExit)

// ✅ Resize handlers:
const resizeObserver = new ResizeObserver(() => {
  fitAddon.fit()
  socket.emit(SocketEvent.TERMINAL_RESIZE, { cols, rows })
})

// ✅ Cleanup:
return () => {
  // Remove all listeners
  // Dispose xterm
  // Disconnect observer
}
```

---

## 🚀 TASK 3: Shell Environment Configuration

### **Bash Environment Setup (Backend)**

```typescript
// In TERMINAL_INIT handler:

const ptyProcess = pty.spawn('bash', [], {
	name: 'xterm-256color',        // ✅ Terminal type for colors
	cols: validCols,               // ✅ Width
	rows: validRows,               // ✅ Height
	cwd: process.cwd(),            // ✅ Working directory (project root)
	env: {
		...process.env,            // ✅ Inherit OS environment
		TERM: 'xterm-256color',    // ✅ 256 color terminal
		LANG: 'en_US.UTF-8',       // ✅ UTF-8 encoding
		COLORTERM: 'truecolor',    // ✅ 24-bit color support
		NO_COLOR: undefined,       // Remove NO_COLOR if set
	},
})
```

### **Carriage Return Handling (Automatic)**

Node-pty and Xterm.js **automatically** handle carriage returns (`\r`):

```
User presses Enter
  ↓
Xterm sends: "\r" (carriage return)
  ↓
handleData receives: "\r"
  ↓
socket.emit(TERMINAL_INPUT, { data: "\r" })
  ↓
Backend ptyProcess.write("\r")
  ↓
Bash processes newline
  ↓
Bash outputs: "...\r\n" (carriage return + line feed)
  ↓
ptyProcess.onData fires with: "\r\n"
  ↓
socket.emit(TERMINAL_OUTPUT, { data: "\r\n" })
  ↓
Frontend xterm.write("\r\n") ← Xterm renders correctly
```

**No special handling needed—it works automatically!**

---

## 🔍 Comprehensive Debugging Guide

### **Issue 1: Terminal Renders But Cannot Type**

#### **Symptom**
- Terminal visible but keystrokes ignored
- Blinking cursor present but not responsive

#### **Root Causes**

**Cause A: Xterm not focused**
```typescript
// FIX: Add this after xterm.open()
requestAnimationFrame(() => {
	xterm.focus()  // Set keyboard focus to terminal
})
```

**Cause B: handleData not registered**
```typescript
// CHECK: Verify this line exists:
xterm.onData(handleData)

// If missing, add it after xterm creation
xterm.onData((data: string) => {
	socket.emit(SocketEvent.TERMINAL_INPUT, { data })
})
```

**Cause C: Socket not connected**
```typescript
// DEBUG: Add this in Terminal.tsx
console.log('Socket ID:', socket?.id)
console.log('Socket connected:', socket?.connected)

// If socket is null, issue is with SocketContext provider
```

**Cause D: TERMINAL_INIT not firing**
```typescript
// DEBUG: Add logging to TERMINAL_INIT handler in backend
socket.on(SocketEvent.TERMINAL_INIT, ({ cols, rows }) => {
	console.log('RECEIVED TERMINAL_INIT from socket:', socket.id)
})

// Check server console for this log
// If missing, TERMINAL_INIT never reaches backend
```

### **Issue 2: Typing Works But No Output** 

#### **Symptom**
- Can type and see characters echo
- Command executes (no error) but no output displays
- Backend receives input but doesn't respond

#### **Root Causes**

**Cause A: PTY not storing correctly**
```typescript
// CHECK backend:
socket.on(SocketEvent.TERMINAL_INPUT, ({ data }) => {
	const ptyProcess = terminalProcesses.get(socket.id)
	if (!ptyProcess) {
		console.error('PTY NOT FOUND for socket:', socket.id)
		console.log('Available sockets:', Array.from(terminalProcesses.keys()))
		return
	}
})
```

**Cause B: PTY output not being emitted**
```typescript
// CHECK backend - must have this:
ptyProcess.onData((data: string) => {
	console.log('PTY output:', data.substring(0, 100))
	socket.emit(SocketEvent.TERMINAL_OUTPUT, { data })
})

// If onData doesn't fire, issue is with PTY itself
```

**Cause C: Socket event not received on frontend**
```typescript
// CHECK frontend:
socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)

// Add logging:
socket.on(SocketEvent.TERMINAL_OUTPUT, ({ data }) => {
	console.log('RECEIVED TERMINAL_OUTPUT:', data.substring(0, 100))
	// ... render
})

// Check browser console for this log
```

**Cause D: Xterm write failing**
```typescript
// CHECK frontend:
const handleOutput = ({ data }) => {
	console.log('handleOutput called with:', data.length, 'bytes')
	if (xtermRef.current) {
		xtermRef.current.write(data)
		console.log('✅ Written to xterm')
	} else {
		console.error('❌ xtermRef.current is null')  // Problem!
	}
}
```

### **Issue 3: Slow/Laggy Output**

#### **Symptom**
- Output appears after 500ms+ delay
- Typing adds noticeable latency
- Output "chunks" display at once instead of streaming

#### **Root Causes**

**Cause A: Socket.io buffer is full**
```typescript
// CHECK: Server maxHttpBufferSize
const io = new Server(server, {
	maxHttpBufferSize: 1e8,  // 100MB - should be large enough
})

// If much smaller, increase it
```

**Cause B: Resize debounce too long**
```typescript
// In Terminal.tsx, the debounce delay:
setTimeout(() => {
	// ...resize logic
}, 150)  // ← Change if too slow

// Try: 100ms instead
```

**Cause C: Scrollback buffer overflow**
```typescript
// Check xterm config:
const xterm = new XTerm({
	scrollback: 2000,  // ← If too large, slows rendering
})

// Try: 1000 instead
```

---

## ✅ Complete End-to-End Debugging Workflow

### **Step 1: Verify Backend PTY Spawns**

```bash
# In server terminal, run server and look for:
[TERMINAL_INIT] Socket abc123
[TERMINAL_INIT] Working directory: /path/to/project
[TERMINAL_INIT] ✅ PTY spawned with PID: 12345
```

If not present → **TERMINAL_INIT handler not being called** or **socket not connected**

### **Step 2: Verify Socket Connection**

```javascript
// In browser console:
const socket = io('http://localhost:3000')
socket.on('connect', () => console.log('✅ Connected:', socket.id))
socket.on('disconnect', () => console.log('❌ Disconnected'))

// Should see: "✅ Connected: socket_abc123"
```

### **Step 3: Verify Input Capture**

```typescript
// Add logging to Terminal.tsx handleData:
const handleData = (data: string) => {
	console.log('[INPUT]', JSON.stringify(data))
	socket.emit(SocketEvent.TERMINAL_INPUT, { data })
}

// Type in terminal and check browser console
// Should see: [INPUT] "l", [INPUT] "s", etc.
```

### **Step 4: Verify Backend Receives Input**

```typescript
// Add logging to server TERMINAL_INPUT handler:
socket.on(SocketEvent.TERMINAL_INPUT, ({ data }) => {
	console.log('[RECEIVED INPUT]', JSON.stringify(data))
	// ...
})

// Type in terminal and check server logs
// Should see input being logged
```

### **Step 5: Verify PTY Receives Input**

```typescript
socket.on(SocketEvent.TERMINAL_INPUT, ({ data }) => {
	const ptyProcess = terminalProcesses.get(socket.id)
	console.log('[PTY WRITE]', JSON.stringify(data))
	ptyProcess.write(data)
	console.log('[PTY WRITE COMPLETE]')
})

// Check server logs for both messages
```

### **Step 6: Verify PTY Output Emitted**

```typescript
ptyProcess.onData((data: string) => {
	console.log('[PTY OUTPUT]', data.substring(0, 100))
	socket.emit(SocketEvent.TERMINAL_OUTPUT, { data })
	console.log('[EMIT COMPLETE]')
})

// Run "ls" and check server logs
// Should see PTY output being logged and emitted
```

### **Step 7: Verify Frontend Receives Output**

```typescript
socket.on(SocketEvent.TERMINAL_OUTPUT, ({ data }) => {
	console.log('[RECEIVED OUTPUT]', data.substring(0, 100))
	// ...
})

// Check browser console
// Should see output being logged
```

### **Step 8: Verify Xterm Renders Output**

```typescript
const handleOutput = ({ data }) => {
	if (xtermRef.current) {
		xtermRef.current.write(data)
		console.log('[XTERM WRITE]', data.substring(0, 100))
	}
}

// Check browser console and terminal display
// Output should appear in terminal
```

---

## 🎯 Critical Checklist - Before Testing

### **Backend** `server/src/server.ts`
- [ ] `import * as pty from "node-pty"`
- [ ] `const terminalProcesses = new Map()`
- [ ] `socket.on(TERMINAL_INIT)` handler exists
- [ ] `ptyProcess.onData()` emits TERMINAL_OUTPUT
- [ ] `ptyProcess.onExit()` emits TERMINAL_EXIT
- [ ] `socket.on(TERMINAL_INPUT)` → `ptyProcess.write()`
- [ ] `"disconnect"` handler kills PTY
- [ ] All log statements showing events firing

### **Frontend** `Terminal.tsx`
- [ ] `import { Terminal as XTerm }`
- [ ] `import { FitAddon }`
- [ ] `import '@xterm/xterm/css/xterm.css'`
- [ ] `const socket = useSocket()`
- [ ] Guards at effect start
- [ ] `xterm.onData(handleData)` registered
- [ ] `socket.on(TERMINAL_OUTPUT)` registered
- [ ] `xterm.write(data)` in handleOutput
- [ ] All refs initialized correctly
- [ ] Cleanup function complete

### **Configuration**
- [ ] Working directory: `process.cwd()` is project root
- [ ] Environment: `TERM=xterm-256color`, `LANG=en_US.UTF-8`
- [ ] Dimensions validated: min 40x10
- [ ] Socket.io event types defined

---

## 📍 Common "What's Missing" Errors

| Error | Missing | Fix |
|-------|---------|-----|
| "Cannot read onData of undefined" | PTY not spawned | Check TERMINAL_INIT logs |
| "Socket undefined" | SocketContext | Wrap Terminal in SocketProvider |
| "xterm not rendering" | xterm.open() | Call before fitAddon.fit() |
| "No input captured" | xterm.onData() | Add this line to useEffect |
| "Commands execute but no output" | ptyProcess.onData() | Check backend logs |
| "TypeError: fitAddon.fit is not a function" | FitAddon not loaded | Call xterm.loadAddon(fitAddon) |

---

## 📊 Expected Behavior When Working

```
User: Types "ls" (3 keystrokes)
  ├─ Frontend captures: "l", "s", Enter (\r)
  ├─ Each sent via TERMINAL_INPUT socket event
  │
  └─ Backend receives in TERMINAL_INPUT handler
     ├─ ptyProcess.write("l")
     ├─ ptyProcess.write("s")
     └─ ptyProcess.write("\r")
        │
        └─ Bash receives "ls\r"
           ├─ Bash parses: ls command
           ├─ Bash spawns: /bin/ls
           ├─ ls outputs: "file1.txt\nfile2.txt\n"
           │
           └─ PTY captures output
              └─ ptyProcess.onData fires
                 ├─ Logs output
                 ├─ socket.emit(TERMINAL_OUTPUT)
                 │
                 └─ Frontend receives TERMINAL_OUTPUT
                    ├─ handleOutput fires
                    ├─ xterm.write(data)
                    │
                    └─ Browser renders
                       └─ User sees: "file1.txt\nfile2.txt\n"

Result: ✅ Terminal displays files correctly
```

---

**Version:** 1.0 - Master Debug Edition  
**Last Updated:** April 17, 2026  
**Status:** Production Ready with Full Logging
