# Integrated Terminal - Developer Reference

## 🎯 Quick Reference for the Three Core Components

This document provides focused implementations for the three main requirements of the Integrated Terminal system.

---

## 1️⃣ Node.js Server-Side PTY Controller

### **File Location:** `server/src/server.ts` (lines 410-475)

### **Complete Implementation:**

```typescript
import * as pty from "node-pty"

// ========================================
// PTY Process Registry
// ========================================

/**
 * Global map: socket.id → pty.IPty process
 * Enables per-user terminal isolation
 */
const terminalProcesses = new Map<string, pty.IPty>()


// ========================================
// Terminal Initialization
// ========================================

socket.on(SocketEvent.TERMINAL_INIT, ({ cols, rows }: { cols: number; rows: number }) => {
	// 1. Kill existing PTY if present (reset)
	const existing = terminalProcesses.get(socket.id)
	if (existing) {
		try { existing.kill() } catch { /* ignore */ }
		terminalProcesses.delete(socket.id)
	}

	try {
		// 2. Get project working directory
		const workingDir = process.cwd()

		// 3. Spawn bash PTY with configuration
		const ptyProcess = pty.spawn('bash', [], {
			// Terminal emulator type (enables 256 colors)
			name: 'xterm-256color',
			
			// Terminal dimensions (validated minimums)
			cols: Math.max(cols || 80, 40),
			rows: Math.max(rows || 24, 10),
			
			// Working directory for commands
			cwd: workingDir,
			
			// Environment setup
			env: {
				...process.env,
				TERM: 'xterm-256color',  // Color support
				LANG: 'en_US.UTF-8',     // UTF-8 encoding
			},
		})

		// 4. Store PTY reference
		terminalProcesses.set(socket.id, ptyProcess)

		// 5. Listen for bash output (stdout/stderr)
		ptyProcess.onData((data: string) => {
			socket.emit(SocketEvent.TERMINAL_OUTPUT, { data })
		})

		// 6. Listen for bash exit/close
		ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
			socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode, signal })
			terminalProcesses.delete(socket.id)
			console.log(`Terminal [${socket.id}] closed: exit=${exitCode}, signal=${signal}`)
		})

		console.log(`Terminal [${socket.id}] initialized: ${cols}x${rows} at ${workingDir}`)
	} catch (error) {
		console.error(`Failed to initialize terminal [${socket.id}]:`, error)
		socket.emit(SocketEvent.TERMINAL_EXIT, { exitCode: 1, signal: 0 })
	}
})


// ========================================
// Terminal Input (User Keystrokes)
// ========================================

socket.on(SocketEvent.TERMINAL_INPUT, ({ data }: { data: string }) => {
	// 1. Get PTY for this socket
	const ptyProcess = terminalProcesses.get(socket.id)
	if (!ptyProcess) {
		console.warn(`Terminal [${socket.id}] not found for input`)
		return
	}

	try {
		// 2. Write raw text to PTY stdin
		// Bash receives: commands, pipes, redirects, special keys
		ptyProcess.write(data)
	} catch (error) {
		console.error(`Failed to write to terminal [${socket.id}]:`, error)
	}
})


// ========================================
// Terminal Resize
// ========================================

socket.on(SocketEvent.TERMINAL_RESIZE, ({ cols, rows }: { cols: number; rows: number }) => {
	// 1. Get PTY for this socket
	const ptyProcess = terminalProcesses.get(socket.id)
	if (!ptyProcess) {
		console.warn(`Terminal [${socket.id}] not found for resize`)
		return
	}

	try {
		// 2. Update PTY dimensions
		ptyProcess.resize(
			Math.max(cols || 80, 40),    // Minimum 40 cols
			Math.max(rows || 24, 10)     // Minimum 10 rows
		)
		// This updates LINES and COLUMNS env vars in bash
	} catch (error) {
		console.error(`Failed to resize terminal [${socket.id}]:`, error)
	}
})


// ========================================
// Cleanup on Disconnect
// ========================================

socket.on("disconnecting", () => {
	// Kill terminal PTY process when user disconnects
	const ptyProcess = terminalProcesses.get(socket.id)
	if (ptyProcess) {
		try { ptyProcess.kill() } catch { /* ignore */ }
		terminalProcesses.delete(socket.id)
		console.log(`Terminal [${socket.id}] killed on disconnect`)
	}
})
```

### **Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| **Map<socket.id, PTY>** | Each user gets isolated terminal; no cross-session interference |
| **pty.spawn('bash', [])** | Simple shell with no special args; bash handles complexity |
| **xterm-256color TERM** | Standard terminal type; supports colors in npm/npm output |
| **Math.max() validation** | Prevents xterm crashes from malformed dimensions |
| **onData / onExit listeners** | Captures all output without polling; event-driven architecture |
| **try-catch blocks** | Graceful degradation; server doesn't crash on PTY errors |

---

## 2️⃣ React Component Structure (Xterm.js)

### **File Location:** `client/src/components/terminal/Terminal.tsx`

### **Complete Implementation:**

```typescript
import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { SocketEvent } from '../../types/socket'
import { useSocket } from '../../context/SocketContext'

/**
 * Terminal Component
 * 
 * Responsibilities:
 * 1. Initialize Xterm.js instance
 * 2. Manage Socket.io connectivity
 * 3. Handle user input → backend PTY
 * 4. Display PTY output → user
 * 5. Handle resize events
 * 6. Cleanup on unmount
 */
const Terminal: React.FC = () => {
	// ========================================
	// References
	// ========================================
	
	const containerRef = useRef<HTMLDivElement>(null)        // Container for terminal
	const terminalRef = useRef<HTMLDivElement>(null)         // DOM node for xterm
	const xtermRef = useRef<XTerm | null>(null)              // Xterm instance
	const fitAddonRef = useRef<FitAddon | null>(null)        // Responsive sizing
	const socket = useSocket()                               // Socket.io context


	// ========================================
	// Main Effect Hook (Initialization)
	// ========================================

	useEffect(() => {
		// Guards: ensure DOM and socket ready
		if (!terminalRef.current || !socket) return

		try {
			// ════════════════════════════════════════
			// Step 1: Create Xterm Instance
			// ════════════════════════════════════════
			
			const xterm = new XTerm({
				cursorBlink: true,                    // Animated blinking cursor
				fontSize: 13,                          // 13 pixel font size
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				
				// Color theme (dark mode)
				theme: {
					background: '#1e1e1e',            // Dark gray background
					foreground: '#d4d4d4',            // Light gray text
					cursor: '#aeafad',                // Gray cursor
					cursorAccent: '#1e1e1e',          // Cursor accent
					selection: 'rgba(255, 255, 255, 0.15)',  // Selection highlight
				},
				
				// History and performance
				scrollback: 2000,                     // Keep 2000 lines of history
				fastScrollSensitivity: 2,             // Scroll speed
				smoothScrollDuration: 0,              // Instant scrolling (no animation)
			})

			// ════════════════════════════════════════
			// Step 2: Add Responsive Sizing Addon
			// ════════════════════════════════════════
			
			const fitAddon = new FitAddon()
			xterm.loadAddon(fitAddon)
			// fitAddon.fit() will auto-size terminal to its container

			// ════════════════════════════════════════
			// Step 3: Render to DOM
			// ════════════════════════════════════════
			
			terminalRef.current.innerHTML = ''  // Clear any previous content
			xterm.open(terminalRef.current)     // Inject xterm into DOM

			// ════════════════════════════════════════
			// Step 4: Initial Fit to Container
			// ════════════════════════════════════════
			
			requestAnimationFrame(() => {
				try {
					fitAddon.fit()
					console.log('🖥️  Terminal initialized:', xterm.cols, 'x', xterm.rows)
				} catch (e) {
					console.error('❌ Fit error:', e)
				}
			})

			// Save references for later access
			xtermRef.current = xterm
			fitAddonRef.current = fitAddon

			// ════════════════════════════════════════
			// Step 5: Initialize Backend PTY
			// ════════════════════════════════════════
			
			socket.emit(SocketEvent.TERMINAL_INIT, {
				cols: xterm.cols || 80,
				rows: xterm.rows || 24,
			})

			// ════════════════════════════════════════
			// Step 6: Capture User Input
			// ════════════════════════════════════════
			
			const handleData = (data: string) => {
				// Every keystroke is captured here
				// Includes: regular chars, Enter, Backspace, Ctrl+C, arrow keys
				socket.emit(SocketEvent.TERMINAL_INPUT, { data })
			}

			xterm.onData(handleData)

			// ════════════════════════════════════════
			// Step 7: Display Backend Output
			// ════════════════════════════════════════
			
			const handleOutput = ({ data }: { data: string }) => {
				// Backend sends bash stdout/stderr
				if (xtermRef.current) {
					xtermRef.current.write(data)  // Write to xterm buffer
				}
			}

			const handleExit = () => {
				// Backend sends when bash process exits
				if (xtermRef.current) {
					xtermRef.current.writeln('\r\n\x1b[33m[Terminal Disconnected]\x1b[0m')
				}
			}

			socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)
			socket.on(SocketEvent.TERMINAL_EXIT, handleExit)

			// ════════════════════════════════════════
			// Step 8: Handle Clear Terminal Event
			// ════════════════════════════════════════
			
			const handleClearTerminal = () => {
				if (xtermRef.current) {
					xtermRef.current.clear()
				}
			}

			window.addEventListener('clearTerminal', handleClearTerminal)

			// ════════════════════════════════════════
			// Step 9: Handle Window/Container Resize
			// ════════════════════════════════════════
			
			let resizeTimeout: NodeJS.Timeout

			const handleResize = () => {
				clearTimeout(resizeTimeout)
				resizeTimeout = setTimeout(() => {
					if (fitAddonRef.current && xtermRef.current && containerRef.current) {
						try {
							fitAddonRef.current.fit()
							const { cols, rows } = xtermRef.current
							
							// Notify backend of new dimensions
							socket.emit(SocketEvent.TERMINAL_RESIZE, { cols, rows })
						} catch (e) {
							// Silently fail if terminal not ready
						}
					}
				}, 150)  // Debounce: wait 150ms after resize stops
			}

			// ResizeObserver: Triggers when container size changes
			const resizeObserver = new ResizeObserver(() => {
				handleResize()
			})

			if (containerRef.current) {
				resizeObserver.observe(containerRef.current)
			}

			// Window resize listener: Fallback for global resize
			window.addEventListener('resize', handleResize)

			// ════════════════════════════════════════
			// Step 10: Cleanup on Unmount
			// ════════════════════════════════════════
			
			return () => {
				clearTimeout(resizeTimeout)
				window.removeEventListener('resize', handleResize)
				window.removeEventListener('clearTerminal', handleClearTerminal)
				resizeObserver.disconnect()
				socket.off(SocketEvent.TERMINAL_OUTPUT, handleOutput)
				socket.off(SocketEvent.TERMINAL_EXIT, handleExit)
				try {
					xterm.dispose()  // Cleanup xterm resources
				} catch (e) {
					// Silently ignore disposal errors
				}
			}
		} catch (error) {
			console.error('❌ Terminal initialization error:', error)
		}
	}, [socket])  // Re-run only if socket changes


	// ========================================
	// Render
	// ========================================

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

### **Component Flow Diagram:**

```
┌─ Initialization ─────────────────────────────────────┐
│                                                      │
│ 1. Create XTerm       │ New instance with settings  │
│                       ↓                              │
│ 2. Add FitAddon       │ Responsive sizing support   │
│                       ↓                              │
│ 3. Render to DOM      │ Inject into terminalRef     │
│                       ↓                              │
│ 4. Initial Fit        │ requestAnimationFrame()     │
│                       ↓                              │
│ 5. Init Backend       │ socket.emit(TERMINAL_INIT)  │
│                       ↓                              │
└──────────────────────────────────────────────────────┘
                        │
┌─ User Interaction ────┼─────────────────────────────┐
│                       ↓                              │
│ Keystroke            │ xterm.onData()               │
│    ↓                 │ socket.emit(TERMINAL_INPUT) │
│ PTY Output           │ socket.on(TERMINAL_OUTPUT)  │
│    ↓                 │ xterm.write()               │
│ Display Updated      │ Desktop renders             │
│                                                      │
└──────────────────────────────────────────────────────┘
                        │
┌─ Resize Handling ─────┼─────────────────────────────┐
│                       ↓                              │
│ Window resized       │ ResizeObserver or resize    │
│    ↓                 │ fitAddon.fit()              │
│ Terminal refitted    │ socket.emit(TERMINAL_RESIZE)│
│    ↓                 │ Backend updates PTY dims    │
│ PTY updated          │ Command output relayouted   │
│                                                      │
└──────────────────────────────────────────────────────┘
                        │
┌─ Cleanup ────────────┼─────────────────────────────┐
│                      ↓                              │
│ Component unmounts   │ socket.off() all listeners  │
│    ↓                 │ xterm.dispose()             │
│ Resources freed      │ ResizeObserver.disconnect() │
│                                                      │
└────────────────────────────────────────────────────┘
```

### **Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| **useRef for DOM nodes** | Direct DOM access needed for xterm; useRef persists across renders |
| **useRef for xterm instance** | Need to access xterm methods after initial render |
| **xterm.onData()** | Captures all keyboard input including special keys; automatic encoding |
| **ResizeObserver** | More reliable than window resize for split-pane scenarios |
| **Debounced resize** | Prevents excessive socket.emit calls during continuous resize drag |
| **requestAnimationFrame** | Ensures fits happen after DOM is painted |
| **Cleanup in return** | Proper resource management; prevents memory leaks |
| **socket dependency** | Only re-initialize if socket reference changes |

---

## 3️⃣ Data Flow & Communication Protocol

### **Mechanism: Socket.io Events**

The frontend and backend communicate via 5 core Socket.io events:

```
┌──────────────────────────────────────────────────────────────┐
│                 Socket Event Protocol                        │
└──────────────────────────────────────────────────────────────┘

INITIALIZATION PHASE:
─────────────────────
Client → Server:   TERMINAL_INIT { cols: 80, rows: 24 }
                   └─ Triggers: pty.spawn('bash', [])
                   └ Stores in: terminalProcesses.set(socketId, pty)
                   └ Starts listening: ptyProcess.onData()
                   └ Starts listening: ptyProcess.onExit()

INTERACTIVE PHASE:
──────────────────
User Types: "ls" + Enter
   │
   └─→ xterm.onData('l')  ── socket.emit(TERMINAL_INPUT, {data: 'l'})
   └─→ xterm.onData('s')  ── socket.emit(TERMINAL_INPUT, {data: 's'})
   └─→ xterm.onData('\r') ── socket.emit(TERMINAL_INPUT, {data: '\r'})

Backend Processing:
   │
   ├─ ptyProcess.write('l')
   ├─ ptyProcess.write('s')
   └─ ptyProcess.write('\r') ──→ bash interprets and executes

PTY Output:
   │
   ├─ stdout: "file1.txt\n"     ─→ ptyProcess.onData() triggers
   ├─ stdout: "file2.txt\n"     ────→ socket.emit(TERMINAL_OUTPUT, {data})
   └─ bash prompt: "$ "           ──────→ Frontend socket.on()

Frontend Rendering:
   │
   ├─ socket.on(TERMINAL_OUTPUT)
   ├─ xterm.write("file1.txt\n")
   ├─ xterm.write("file2.txt\n")
   ├─ xterm.write("$ ")
   └─→ User sees output in terminal

RESIZE PHASE:
─────────────
Browser window resized
   │
   └─→ ResizeObserver triggers
   └─→ fitAddon.fit() updates xterm cols/rows
   └─→ socket.emit(TERMINAL_RESIZE, {cols: 120, rows: 30})

Backend Processing:
   │
   ├─ ptyProcess.resize(120, 30)
   ├─ PTY updates $LINES and $COLUMNS
   └─ Apps like vim/nano respond to resize

EXIT PHASE:
───────────
User closes browser / disconnects
   │
   └─→ socket.on("disconnecting")

Backend Cleanup:
   │
   ├─ ptyProcess.kill()
   ├─ terminalProcesses.delete(socketId)
   └─ Process resources freed
```

### **Message Payloads**

#### **TERMINAL_INIT** (Client → Server)
```json
{
  "event": "terminal:init",
  "data": {
    "cols": 80,
    "rows": 24
  }
}
```

#### **TERMINAL_INPUT** (Client → Server)
```json
{
  "event": "terminal:input",
  "data": {
    "data": "ls\r"
  }
}
```

#### **TERMINAL_RESIZE** (Client → Server)
```json
{
  "event": "terminal:resize",
  "data": {
    "cols": 120,
    "rows": 32
  }
}
```

#### **TERMINAL_OUTPUT** (Server → Client)
```json
{
  "event": "terminal:output",
  "data": {
    "data": "file1.txt\nfile2.txt\n"
  }
}
```

#### **TERMINAL_EXIT** (Server → Client)
```json
{
  "event": "terminal:exit",
  "data": {
    "exitCode": 0,
    "signal": null
  }
}
```

### **Complete Data Transaction Example**

**Scenario:** User types `node app.js` and presses Enter

```
T=0ms    User presses 'n'
         ├─ xterm.onData('n') fires
         ├─ socket.emit(TERMINAL_INPUT, {data: 'n'})
         └─ Network: small packet (~10 bytes) sent to server

T=10ms   'n' arrives at backend
         ├─ ptyProcess.write('n')
         ├─ bash receives character
         └─ bash echoes character back (PTY echo mode)

T=15ms   Bash outputs 'n' to PTY
         ├─ ptyProcess.onData('n') fires
         ├─ socket.emit(TERMINAL_OUTPUT, {data: 'n'})
         └─ Network: small packet sent to client

T=25ms   'n' arrives at frontend
         ├─ socket.on(TERMINAL_OUTPUT, {data: 'n'})
         ├─ xterm.write('n')
         └─ Xterm renders 'n' in terminal

T=30ms   User sees 'n' on screen
         (Total latency: ~30ms for character echo)

T=50ms   User presses 'o'
         (repeat cycle for 'o', 'd', 'e', ' ', 'a', 'p', 'p', '.', 'j', 's')

T=200ms  User presses Enter ('\r')
         ├─ xterm.onData('\r')
         ├─ socket.emit(TERMINAL_INPUT, {data: '\r'})
         ├─ ptyProcess.write('\r')
         └─ bash receives newline

T=210ms  Bash parses command
         ├─ Recognizes: node command
         ├─ Spawns: child process for node
         ├─ node runs app.js
         └─ node outputs: "Server running on port 3000"

T=220ms  App output sent to PTY
         ├─ node stdout: "Server running on port 3000\n"
         ├─ ptyProcess.onData("Server running...\n")
         ├─ socket.emit(TERMINAL_OUTPUT, {data: "Server running..."})
         └─ Network: larger packet sent to client

T=230ms  Output arrives at frontend
         ├─ socket.on(TERMINAL_OUTPUT)
         ├─ xterm.write("Server running on port 3000\n")
         └─ Xterm renders output in terminal

T=240ms  User sees: "Server running on port 3000"
         (command completed, node process still running)

T=300ms  User presses Ctrl+C
         ├─ xterm.onData('\x03') (Ctrl+C escape code)
         ├─ socket.emit(TERMINAL_INPUT, {data: '\x03'})
         ├─ ptyProcess.write('\x03')
         ├─ bash sends SIGINT to node process
         └─ node catches signal and exits

T=310ms  Node exits
         ├─ stdout: "^C\n" (Ctrl+C feedback)
         ├─ ptyProcess.onData("^C\n")
         ├─ socket.emit(TERMINAL_OUTPUT, {data: "^C\n"})
         └─ Bash returns to prompt

T=320ms  Frontend receives
         ├─ xterm.write("^C\n")
         ├─ Xterm renders Ctrl+C feedback
         └─ bash $ prompt appears

T=330ms  User sees command interrupted
         ├─ "^C"
         ├─ "$ " (bash prompt ready for next command)
         └─ Total command lifecycle: ~130ms
```

### **Latency Breakdown**

| Phase | Time | Components |
|-------|------|------------|
| **User Input → Socket Sent** | 1ms | xterm.onData + socket.emit |
| **Network latency** | 5-20ms | TCP/Socket.io overhead |
| **Backend PTY Write** | 1ms | ptyProcess.write() |
| **PTY Echo Back** | 2-5ms | Bash echo mode |
| **PTY Output → Socket** | 1ms | ptyProcess.onData + socket.emit |
| **Network latency** | 5-20ms | TCP/Socket.io overhead |
| **Frontend Render** | 5-10ms | xterm.write() + DOM update |
| **Visual Display** | 1ms | Browser renders |
| **Total Round-trip** | ~30-60ms | User sees character appear |

---

## 🧩 Integration Checklist

To integrate the terminal into an existing IDE:

- [ ] **Backend Setup**
  - [ ] Import `node-pty`
  - [ ] Create `terminalProcesses` Map
  - [ ] Add 4 Socket handlers (init, input, resize, cleanup)
  - [ ] Verify PTY spawns successfully

- [ ] **Frontend Setup**
  - [ ] Import `@xterm/xterm` and `@xterm/addon-fit`
  - [ ] Create Terminal.tsx component
  - [ ] Import Socket context
  - [ ] Define Socket.io event types

- [ ] **Integration**
  - [ ] Add Terminal component to layout
  - [ ] Use react-split for resizable panes (optional)
  - [ ] Add clear button functionality
  - [ ] Add minimize/maximize functionality

- [ ] **Testing**
  - [ ] Run `npm install` in terminal
  - [ ] Run `node app.js` and see output
  - [ ] Test Ctrl+C to interrupt
  - [ ] Test window resize
  - [ ] Test multi-user isolation

---

## 📖 Additional Resources

- **Socket Event Types:** `client/src/types/socket.ts` + `server/src/types/socket.ts`
- **Socket Context:** `client/src/context/SocketContext.tsx`
- **Layout Container:** `client/src/components/workspace/TerminalIntegratedLayout.tsx`
- **Execution Guides:** See linked documentation files

---

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** April 17, 2026
