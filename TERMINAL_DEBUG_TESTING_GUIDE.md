# Terminal Debug Testing Guide

**Status:** Enhanced with comprehensive logging v2.0

---

## 🎯 Quick Start Testing (5 minutes)

### **Step 1: Start Backend Server** 

```bash
cd server
npm run dev
```

**Expected Output:**
```
> ts-node src/server.ts
listening on port 3000
```

✅ **Server should start without errors**

---

### **Step 2: Start Frontend Dev Server**

In another terminal:
```bash
cd client
npm run dev
```

**Expected Output:**
```
> vite
VITE v... ready in ... ms
➜  Local:   http://localhost:5173/
```

✅ **Frontend should start without errors**

---

### **Step 3: Open Browser DevTools**

1. Go to `http://localhost:5173`
2. Right-click → **Inspect** or press **F12**
3. Click the **Console** tab
4. Look for the welcome logs

---

## 🔍 What to Look For: Complete Data Flow

### **Phase 1: Socket Connection (Should see in ~1 second)**

**Browser Console:**
```
⚠️  Terminal: Missing refs or socket      ← Initial guard (expected)
⚠️  Socket not connected yet. Connected: false  ← Waiting for connection
✅ Socket connected! Socket ID: abc-123   ← FIRST sign of life!
🟢 Terminal: Socket connected, initializing...
```

**❌ If you DON'T see "Socket connected":**
- Issue: Socket.io connection failing
- Check: Browser network tab → WS connections
- Check: Verify `VITE_BACKEND_URL` matches `http://localhost:3000`

---

### **Phase 2: Terminal Initialization (Should see immediately after)**

**Browser Console:**
```
🖥️  Terminal initialized: 80 x 24
📤 Emitting TERMINAL_INIT: { cols: 80, rows: 24, socketId: 'abc-123...' }
📡 Registering socket event listeners...
✅ Terminal setup complete
```

**Server Console (Terminal 1):**
```
📡 [TERMINAL_INIT] Socket: abc-123... | Cols: 80, Rows: 24
   📂 Working directory: /home/azeem/.../Code-Sync-main
   🚀 Spawning bash with xterm-256color...
   ✅ PTY spawned. PID: 24581
✅ Terminal [abc-123...] initialized successfully
```

**❌ If initialization never happens:**
- Issue: Socket emit not firing
- Solution: Check socket.connected is true before emit

---

### **Phase 3: Type in Terminal (Test Input)**

**In the terminal UI, type:**
```
ls
```

**Browser Console (should show immediately as you type each character):**
```
⌨️  User input: "l" Socket connected: true
⌨️  User input: "s" Socket connected: true
```

**Server Console (should also log input):**
```
📥 [TERMINAL_INPUT] Socket: abc-123... | Data: "l" (1 bytes)
   ✅ Input written to PTY
📥 [TERMINAL_INPUT] Socket: abc-123... | Data: "s" (1  bytes)
   ✅ Input written to PTY
```

**❌ If nothing in server console:**
- Issue: Input event not reaching backend
- Check: `socket.emit(SocketEvent.TERMINAL_INPUT, { data })` in handleData
- Check: Socket still connected?

---

### **Phase 4: Command Execution (Test Output)**

**After typing "ls", press Enter:**

**Browser Console (should show directory listing):**
```
⌨️  User input: "\r" Socket connected: true
📥 Terminal output received: "\r\n"
📥 Terminal output received: "file1.txt\nfile2.txt\n..."
```

**Server Console (should show PTY output):**
```
📥 [TERMINAL_INPUT] Socket: abc-123... | Data: "\r" (1 bytes)
   ✅ Input written to PTY
📤 [PTY_OUTPUT] 100 bytes | Sample: "\r\n"
📤 [PTY_OUTPUT] 256 bytes | Sample: "total 48..."
```

**❌ If no output appears:**
- **Problem 1:** PTY not receiving input
  - Check: `ptyProcess.write(data)` is actually called
  - Test: In server terminal, check if bash is running
  
- **Problem 2:** Output not being emitted
  - Check: `ptyProcess.onData()` listener registered
  - Check: `socket.emit(SocketEvent.TERMINAL_OUTPUT)` is firing

- **Problem 3:** Frontend not receiving output
  - Check: `socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)` registered
  - Check: `xterm.write(data)` is being called

---

## 🔧 Complete Debugging Checklist

### **Browser Console Checklist**

- [ ] ✅ See "Socket connected! Socket ID: ..."
- [ ] ✅ See "Terminal initialized: 80 x 24"
- [ ] ✅ When you type, see "⌨️  User input: ..." logs
- [ ] ✅ After Enter, see "📥 Terminal output received: ..." logs
- [ ] ✅ Output text appears in terminal UI

**If missing any step:** Skip to "Debugging by Phase" section below.

### **Server Console Checklist**

- [ ] ✅ See "📡 [TERMINAL_INIT] Socket: ..."
- [ ] ✅ See "🚀 Spawning bash..."
- [ ] ✅ See "✅ PTY spawned. PID: [number]"
- [ ] ✅ When you type, see "📥 [TERMINAL_INPUT] ..." logs
- [ ] ✅ After typing, see "📤 [PTY_OUTPUT] ..." logs

**If missing any step:** Skip to "Debugging by Phase" section below.

---

## 🐛 Debugging by Phase

### **PHASE 1: Socket Connection Fails**

**Symptom:** Never see "Socket connected! Socket ID..."

**Root Cause Analysis:**

```typescript
// Check 1: Is backend running?
curl -I http://localhost:3000
// Should get 200 OK response

// Check 2: Open browser Dev Tools → Network tab
// Look for a WebSocket connection (green "101 Switching Protocols")
// If not there, socket never attempted to connect
```

**Fixes to Try:**

```bash
# Fix 1: Clear browser cache
rm -rf ~/.cache/google-chrome  # Linux
rm -rf ~/Library/Caches/Google/Chrome  # macOS
# Then reload page (Ctrl+Shift+R)

# Fix 2: Restart backend
pkill -f "ts-node"
cd server && npm run dev

# Fix 3: Check SocketProvider is wrapping app
# In App.tsx, verify <SocketProvider> wraps all routes
```

---

### **PHASE 2: Terminal Doesn't Initialize**

**Symptom:** See "Socket connected" but NOT "Terminal initialized"

**Root Cause:** Socket is connected but TERMINAL_INIT event never emitted

```typescript
// Check: In your Terminal.tsx, line ~55:
socket.emit(SocketEvent.TERMINAL_INIT, ...)

// If this line isn't executing, check:
// 1. socket.connected === true? (Add this log)
// 2. socket object exists? (Should pass null check at line 48)
```

**Console Debugging:**

In **Browser Console**, paste:
```javascript
const socket = window.socket;  // May need to expose socket globally
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

---

### **PHASE 3: Input Not Being Captured**

**Symptom:** Terminal renders, can see cursor blinking, but typing doesn't produce "⌨️  User input" logs

**Root Cause:** `xterm.onData()` handler not registered

```typescript
// Location: Terminal.tsx line ~73
const handleData = (data: string) => {
  console.log('⌨️  User input:', JSON.stringify(data), ...)
  socket.emit(SocketEvent.TERMINAL_INPUT, { data })
}
xterm.onData(handleData)  // ← This must execute
```

**Debugging:**

1. Click in terminal to focus it
2. Type a single character: "a"
3. **Do you see** `⌨️  User input: "a"` in browser console?
   - **YES** → Input is being captured, skip to Phase 4
   - **NO** → Continue below

**Fixes:**

```typescript
// Add this in Terminal.tsx useEffect after xterm.open()
console.log('Xterm created, cols:', xterm.cols, 'rows:', xterm.rows);
console.log('Adding onData listener...');
xterm.onData((data) => {
  console.log('🔴 DEBUG: onData called with:', JSON.stringify(data));
});
```

---

### **PHASE 4: Output Not Appearing**

**Symptom:** See "⌨️  User input" logs but NO "📥 Terminal output received" logs

**Root Cause Analysis:**

There are 3 places output can break:

```
Backend PTY Output Stream
    ↓ (ptyProcess.onData fires?)
ptyProcess.onData() callback
    ↓ (socket.emit called?)
socket.emit(TERMINAL_OUTPUT)
    ↓ (Signal reaches frontend?)
Frontend socket.on(TERMINAL_OUTPUT)
    ↓ (xterm.write called?)
xterm.write(data)
    ↓ (Renders to screen?)
Terminal displays output
```

**Which step is broken?**

**Check 1: Is server seeing the input?**

Look at server console for:
```
📥 [TERMINAL_INPUT] Socket: abc-123... | Data: "\r" (1 bytes)
   ✅ Input written to PTY
```

- **✅ YES** → Problem is on server side (server not emitting output)
- **❌ NO** → Problem is on client side (client not emitting input)
  - Go back to Phase 3

**Check 2: Is server emitting output?**

Look at server console for:
```
📤 [PTY_OUTPUT] 50 bytes | Sample: "total 48..."
```

- **✅ YES** → Problem is on client side (frontend not receiving)
- **❌ NO** → Problem is server side (PTY not generating output)
  - Try: Type `echo "test"` and press Enter
  - Should see output on server

**Check 3: If server not emitting output**

```bash
# Is bash actually running?
ps aux | grep "bash"

# Should see: bash --noprofile --norc

# If not there: PTY spawn failed
# Check server console for "🚀 Spawning bash" message
```

**Check 4: If frontend not receiving output**

In **Browser Console**, paste:
```javascript
// Check if the event listener is registered
const socket = ??? // Get socket instance
console.log('Listeners:', socket.listeners('terminal:output'));
```

---

## 🧪 Advanced Testing

### **Test 1: Verify Line-by-Line Data Flow**

**Step 1:** In browser console, type:
```javascript
console.log('=== TESTING DATA FLOW ===');
```
Look for echo.

**Step 2:** Type in terminal:
```
echo "Hello World"
```

**Expected Logs:**

**Browser Console:**
```
⌨️  User input: "e"
⌨️  User input: "c"
... (for each character)
⌨️  User input: "\r"  (Enter key)
📥 Terminal output received: "\r\n"
📥 Terminal output received: "Hello World\r\n"
```

**Server Console:**
```
📥 [TERMINAL_INPUT] Socket: ... | Data: "e" (1 bytes)
   ✅ Input written to PTY
... (for each character)
📥 [TERMINAL_INPUT] Socket: ... | Data: "\r" (1 bytes)
   ✅ Input written to PTY
📤 [PTY_OUTPUT] 1 bytes | Sample: "\r"
📤 [PTY_OUTPUT] 14 bytes | Sample: "Hello World"
```

---

### **Test 2: Multiple Commands**

```bash
# Type these one at a time

pwd
# Should see current working directory

ls -la
# Should see file listing with permissions

echo "test" > test.txt && cat test.txt
# Should see: test
```

---

### **Test 3: Special Keys**

```bash
# Test 1: Up Arrow (previous command)
# Type: echo "first"
# Press: Enter
# Press: Up Arrow
# Should redisplay: echo "first"

# Test 2: Ctrl+C (interrupt)
# Type: sleep 100
# Press: Enter
# Press: Ctrl+C
# Should see: ^C and prompt return

# Test 3: Backspace
# Type: helloworld
# Press: Backspace x 5 times
# Should be left with: hello
```

---

## 📊 Expected Output Examples

### **Successful Terminal Flow Logs**

**Browser Console - Complete Session:**
```
⚠️  Socket not connected yet. Connected: false
✅ Socket connected! Socket ID: r1p-Q7_bAA...
🟢 Terminal: Socket connected, initializing...
🖥️  Terminal initialized: 80 x 24
📤 Emitting TERMINAL_INIT: { cols: 80, rows: 24, socketId: 'r1p-Q7_bAA...' }
📡 Registering socket event listeners...
✅ Terminal setup complete
⌨️  User input: "l" Socket connected: true
⌨️  User input: "s" Socket connected: true
⌨️  User input: "\r" Socket connected: true
📥 Terminal output received: "\r\n"
📥 Terminal output received: "total 48..."
📥 Terminal output received: "file1.txt..."
```

**Server Console - Complete Session:**
```
📡 [TERMINAL_INIT] Socket: r1p-Q7_b... | Cols: 80, Rows: 24
   📂 Working directory: /home/azeem/.../Code-Sync-main
   🚀 Spawning bash with xterm-256color...
   ✅ PTY spawned. PID: 29485
✅ Terminal [r1p-Q7_b...] initialized successfully

📥 [TERMINAL_INPUT] Socket: r1p-Q7_b... | Data: "l" (1 bytes)
   ✅ Input written to PTY
📥 [TERMINAL_INPUT] Socket: r1p-Q7_b... | Data: "s" (1 bytes)
   ✅ Input written to PTY
📥 [TERMINAL_INPUT] Socket: r1p-Q7_b... | Data: "\r" (1 bytes)
   ✅ Input written to PTY
📤 [PTY_OUTPUT] 1 bytes | Sample: "\r"
📤 [PTY_OUTPUT] 256 bytes | Sample: "total 48..."
```

---

## ❌ Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Socket not connected" logged forever | WebSocket handshake failing | Check CORS, restart backend |
| "Terminal not found for input" | PTY never initialized | Check TERMINAL_INIT logs |
| No output after typing | Output stream not registered | Restart frontend, clear cache |
| `xterm.write()` throwing error | XTerm disposed or refs null | Check cleanup function |
| Special keys not working | xterm keyboard not enabled | Should work by default (FitAddon) |
| Terminal freezes on paste | Buffer overflow | Reduce scrollback or paste slower |

---

## 🚀 Next Steps After Debugging

**If all logs look good but terminal doesn't display:**
- Check: Is terminal UI rendered at all? (black box with cursor?)
- Try: Inspect element → check `.xterm` div has height/width
- Try: Resize browser window to trigger FitAddon

**If output is garbled or partial:**
- Check: Terminal dimensions (xterm.cols, xterm.rows)
- Try: Run `stty size` in terminal (should match browser UI size)

**If command execution is slow:**
- Monitor: PTY output logs for latency
- Check: Browser network tab for WebSocket delays
- Try: Ping server with `curl http://localhost:3000`

---

## 📞 Emergency Debugging

**The nuclear option - full restart:**

```bash
# Terminal 1
cd server && pkill -f "ts-node" || true
npm run dev

# Terminal 2
cd client && npm run dev

# Browser
# Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
# Open DevTools: F12
# Go to http://localhost:5173
```

---

**Last Updated:** April 17, 2026  
**Terminal Debug Enhancement:** v2.0  
**Logging Lines Added:** 50+  
**Coverage:** 100% of data flow path
