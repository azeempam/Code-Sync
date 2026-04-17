# Terminal Socket Events - Protocol Reference

## 📡 Event Overview

The terminal system communicates via Socket.io with the following protocol:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `terminal:init` | Client → Server | Initialize new terminal session |
| `terminal:input` | Client → Server | Send user keyboard input |
| `terminal:resize` | Client → Server | Resize terminal dimensions |
| `terminal:output` | Server → Client | Stream terminal output |
| `terminal:exit` | Server → Client | Signal terminal closed |

---

## 🔄 Request/Response Payloads

### **1. TERMINAL_INIT** (Client → Server)

**When:** Called when terminal component mounts

**Payload:**
```typescript
{
  "event": "terminal:init",
  "data": {
    "cols": 80,      // Terminal width in characters
    "rows": 24       // Terminal height in characters
  }
}
```

**Example (Real):**
```json
{
  "event": "terminal:init",
  "data": {
    "cols": 120,
    "rows": 32
  }
}
```

**Backend Handler:**
```typescript
socket.on(SocketEvent.TERMINAL_INIT, ({ cols, rows }) => {
  // 1. Kill existing PTY (if any)
  // 2. Spawn new bash process with cols/rows
  // 3. Set up listeners for output
  // 4. Store in terminalProcesses map
})
```

**Response:** None (implicit success), starts listening for TERMINAL_OUTPUT

**Error Response:**
```typescript
socket.emit(SocketEvent.TERMINAL_EXIT, {
  exitCode: 1,
  signal: 0
})
```

---

### **2. TERMINAL_INPUT** (Client → Server)

**When:** User types in terminal (every keystroke)

**Payload:**
```typescript
{
  "event": "terminal:input",
  "data": {
    "data": "ls\r"   // Keyboard input (string)
  }
}
```

**Examples:**

**Regular character:**
```json
{ "data": "a" }
```

**Special keys:**
```json
{ "data": "\r" }           // Enter
{ "data": "\x7f" }         // Backspace
{ "data": "\x1b[A" }       // Arrow Up
{ "data": "\x1b[B" }       // Arrow Down
{ "data": "\x03" }         // Ctrl+C
{ "data": "\x04" }         // Ctrl+D (EOF)
{ "data": "\x1a" }         // Ctrl+Z
```

**Multi-character input (paste):**
```json
{ "data": "npm install react\n" }
```

**Backend Handler:**
```typescript
socket.on(SocketEvent.TERMINAL_INPUT, ({ data }) => {
  const ptyProcess = terminalProcesses.get(socket.id)
  if (!ptyProcess) return
  
  ptyProcess.write(data)  // Write to PTY stdin
})
```

**Response:** None (data is written, output comes via TERMINAL_OUTPUT)

---

### **3. TERMINAL_RESIZE** (Client → Server)

**When:** Browser window resized or sidebar collapsed

**Payload:**
```typescript
{
  "event": "terminal:resize",
  "data": {
    "cols": 100,     // New width
    "rows": 30       // New height
  }
}
```

**Example (Window made wider):**
```json
{ "cols": 150, "rows": 24 }
```

**Backend Handler:**
```typescript
socket.on(SocketEvent.TERMINAL_RESIZE, ({ cols, rows }) => {
  const ptyProcess = terminalProcesses.get(socket.id)
  if (!ptyProcess) return
  
  // Validate dimensions (security)
  ptyProcess.resize(Math.max(cols || 80, 40), Math.max(rows || 24, 10))
  
  // This updates: $LINES, $COLUMNS env vars
})
```

**Response:** None (immediate)

---

### **4. TERMINAL_OUTPUT** (Server → Client)

**When:** Terminal process outputs data

**Direction:** Server → Client (unsolicited)

**Payload:**
```typescript
{
  "event": "terminal:output",
  "data": {
    "data": "hello world\n"   // Output from bash/child process
  }
}
```

**Examples:**

**Command echo output:**
```json
{
  "event": "terminal:output",
  "data": {
    "data": "hello world\r\n"
  }
}
```

**Node.js console.log:**
```json
{
  "event": "terminal:output",
  "data": {
    "data": "Server running on port 3000\r\n"
  }
}
```

**Partial data (streaming):**
```json
{ "data": "%" }        // Prompt
{ "data": "npm" }      // User types
{ "data": " install" } // Continues typing
{ "data": "\r\n" }     // Enter
```

**ANSI Color Codes:**
```json
{
  "data": "\u001b[32mGreen text\u001b[0m"
}
```

**Frontend Handler:**
```typescript
socket.on(SocketEvent.TERMINAL_OUTPUT, ({ data }) => {
  xterm.write(data)  // Write to xterm buffer and render
})
```

---

### **5. TERMINAL_EXIT** (Server → Client)

**When:** Terminal process terminates

**Direction:** Server → Client (unsolicited)

**Payload:**
```typescript
{
  "event": "terminal:exit",
  "data": {
    "exitCode": 0,    // Process exit code (0 = success)
    "signal": null    // Signal if killed (e.g., "SIGTERM")
  }
}
```

**Examples:**

**Normal exit:**
```json
{
  "exitCode": 0,
  "signal": null
}
```

**Command error:**
```json
{
  "exitCode": 127,
  "signal": null
}
```

**Process killed:**
```json
{
  "exitCode": null,
  "signal": "SIGTERM"
}
```

**Frontend Handler:**
```typescript
socket.on(SocketEvent.TERMINAL_EXIT, ({ exitCode, signal }) => {
  xterm.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
  // Optionally auto-spawn new terminal
})
```

---

## 🔐 Security Considerations

### **Input Validation**

**Frontend** (before sending):
```typescript
// Xterm.js already handles this
// Special characters are properly escaped
```

**Backend** (receiving):
```typescript
socket.on(SocketEvent.TERMINAL_INPUT, ({ data }) => {
  // Validate socket is authenticated
  if (!socket.authenticated) {
    socket.emit('error', { message: 'Unauthorized' })
    return
  }
  
  // data is already a string, write directly to PTY
  ptyProcess.write(data)
})
```

### **Dimension Limits**

```typescript
// Prevent malformed xterm by limiting dimensions
ptyProcess.resize(
  Math.max(cols || 80, 40),    // Min 40, default 80
  Math.max(rows || 24, 10)     // Min 10, default 24
)
```

### **Per-Session Isolation**

```typescript
// Users cannot access other users' PTY
terminalProcesses.set(socket.id, ptyProcess)  // Unique per socket
```

---

## 📊 Example Session Flow

### **User runs: `echo hello && npm install`**

```
Timeline:

[t=0ms]  Client: emit("terminal:init", { cols: 80, rows: 24 })
         Server: Spawn bash process (PID: 1234)
         Server: socket.on(output) setup

[t=50ms] Client: emit("terminal:input", { data: "e" })
         Server: ptyProcess.write("e")
         Bash: Receives 'e'
         
[t=60ms] Client: emit("terminal:input", { data: "c" })
[t=70ms] Client: emit("terminal:input", { data: "h" })
[t=80ms] Client: emit("terminal:input", { data: "o" })
[t=90ms] Client: emit("terminal:input", { data: " " })
[t=100ms] Client: emit("terminal:input", { data: "hello" })

[t=150ms] Client: emit("terminal:input", { data: "\r" })
          Server: ptyProcess.write("\r")
          Bash: $ echo hello
          Bash: Executes echo command
          Bash: Outputs "hello\n"
          PTY: onData() triggers with "hello\n"
          
[t=160ms] Server: emit("terminal:output", { data: "hello\n" })
          Client: xterm.write("hello\n")
          Browser: Renders "hello"
          
[t=170ms] Bash: $ npm install
          npm: Starting package installation
          npm: Downloading lodash...
          
[t=200ms] Server: emit("terminal:output", { data: "npm notices..." })
[t=250ms] Server: emit("terminal:output", { data: "added 5 packages" })
[t=300ms] npm: Exits with code 0
          
[t=310ms] Server: emit("terminal:exit", { exitCode: 0, signal: null })
          Client: Receives exit event
          Browser: [Process exited with code 0]
```

---

## 🧪 Testing Payloads

### **Browser Console Test**

```javascript
// Simulate sending commands
const socket = io('http://localhost:3000')

// Initialize terminal
socket.emit('terminal:init', { cols: 80, rows: 24 })

// Wait 100ms
setTimeout(() => {
  // Send: ls
  socket.emit('terminal:input', { data: 'ls\r' })
}, 100)

// Listen for output
socket.on('terminal:output', (data) => {
  console.log('Output:', data)
})
```

### **Server Console Test**

```bash
# Watch Socket.io messages
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('terminal:output', (data) => {
  console.log('Got output:', data);
});

socket.emit('terminal:init', { cols: 80, rows: 24 });
setTimeout(() => {
  socket.emit('terminal:input', { data: 'pwd\\r' });
}, 100);

setTimeout(() => process.exit(0), 5000);
"
```

---

## 📈 Message Rate & Performance

### **Typical Rates**

| Scenario | Messages/sec | Bytes/sec |
|----------|-------------|-----------|
| Typing slowly | 5 | 5 |
| Typing fast | 20 | 20 |
| Paste large text | 1 | 5000 |
| npm install output | 100 | 50000 |
| Long running process | 10 | 10000 |

### **Optimization Strategies**

**Batching:**
```typescript
// Socket.io automatically batches messages on next event loop
// Multiple writes to socket in same tick = 1 network message
```

**Throttling Output:**
```typescript
// Xterm can handle high-frequency updates
// No need to throttle PTY output
```

---

## 🔍 Monitoring & Debugging

### **Enable Debug Mode**

```bash
# Server
DEBUG=socket.io:* npm run dev

# Client  
localStorage.debug = 'socket.io-client:*'
```

### **Check Message Flow**

```javascript
// Browser DevTools → Network tab
// Filter: WS (WebSocket)
// Inspect: 4... messages with terminal events
```

### **Log All Events**

```typescript
// server/src/server.ts
socket.on('terminal:init', (data) => {
  console.log('[TERMINAL_INIT]', socket.id, data)
})

socket.on('terminal:input', (data) => {
  console.log('[TERMINAL_INPUT]', socket.id, data?.data?.substring(0, 50))
})
```

---

## 📝 Reference

**Socket Event Enum** (`src/types/socket.ts`):
```typescript
export enum SocketEvent {
  TERMINAL_INIT = "terminal:init",
  TERMINAL_INPUT = "terminal:input",
  TERMINAL_RESIZE = "terminal:resize",
  TERMINAL_OUTPUT = "terminal:output",
  TERMINAL_EXIT = "terminal:exit",
}
```

**Backend Type** (`server/src/types/socket.ts`):
```typescript
export interface TerminalInitPayload {
  cols: number
  rows: number
}

export interface TerminalInputPayload {
  data: string
}

export interface TerminalResizePayload {
  cols: number
  rows: number
}

export interface TerminalOutputPayload {
  data: string
}

export interface TerminalExitPayload {
  exitCode: number | null
  signal: string | null
}
```

---

**Protocol Version:** 1.0  
**Last Updated:** April 17, 2026  
**Status:** Production Ready
