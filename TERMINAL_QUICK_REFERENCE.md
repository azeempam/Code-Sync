# Terminal System - Quick Reference & Troubleshooting

## 🚀 Quick Test

**In Browser Console:**
```javascript
// Check socket connection
console.log('Socket ID:', window.__SOCKET_ID__)

// Send test input
socket.emit('terminal:input', { data: 'ls\r' })

// Watch for output
socket.on('terminal:output', (data) => console.log('Got:', data))
```

---

## ❌ Problem → ✅ Solution Matrix

### **Terminal Blank / Not Rendering**

| Problem | Check This | Fix |
|---------|-----------|-----|
| Blank black box | CSS loaded? | Verify `@xterm/xterm/css/xterm.css` imported |
| No cursor | Xterm created? | Check browser console for errors |
| Wrong position | Layout correct? | Verify `TerminalIntegratedLayout` renders Terminal |
| No terminal at all | Component mounted? | Check workspace/index.tsx imports Terminal |

**Debug Commands:**
```javascript
// Browser console
document.querySelector('[xterm-screen]')  // Should exist if tterm rendered
// or
document.querySelector('[data-gr-c]')      // Another way to check
```

---

### **Can Type But No Output**

| Problem | Command | Check |
|---------|---------|-------|
| Input sent but PTY no response | Type "ls" | Server logs: `[PTY_OUTPUT]` appearing? |
| Backend not receiving input | Watch server | Server logs: `[TERMINAL_INPUT]` appearing? |
| Output not sent to frontend | Check network | DevTools → Network → WS → Look for `terminal:output` |
| Output received but not displayed | Check console | Browser console for errors in `handleOutput` |

**Step-by-Step Debug:**
```bash
# 1. Server logs
npm run dev
# Watch for: [TERMINAL_INIT], [TERMINAL_INPUT], [PTY_OUTPUT]

# 2. Browser console
console.log('Socket:', socket?.id)
console.log('Socket connected:', socket?.connected)

# 3. Type a character and verify flow:
# Browser: [handleData] User input: "a"
# Server: [TERMINAL_INPUT] Socket abc: "a"
# Server: [PTY_OUTPUT] Socket abc: "a"
# Browser: [handleOutput] Received: "a"
```

---

### **Terminal Freezes / Slow**

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Hangs after 2-3 commands | PTY crashed | Restart server, check PTY memory |
| Very slow keystroke response | Network lag | Check DevTools Network tab timing |
| Output chunks at once | Socket buffer | Reduce `maxHttpBufferSize` or increase frequency |
| "lag" after npm install | Terminal reset | This is normal - terminal session ends |

**Performance Check:**
```bash
# Check if PTY processes leaking
ps aux | grep bash
# Should see 1 bash per connected user, gone on disconnect

# Check server memory
top -p $(pgrep -f "ts-node")
# Memory should stay <50MB per terminal
```

---

### **Special Keys Not Working**

| Key | Problem | Fix |
|-----|---------|-----|
| Ctrl+C | Doesn't interrupt | Check xterm config has full keyboard support |
| Arrow Keys | History not appearing | Bash should handle automatically |
| Tab | Completion not working | `completion` shouldn't be disabled in bash |
| Backspace | Not erasing | Terminal should echo backspace correctly |

**Test Keys:**
```bash
# In terminal
sleep 10  # Wait 10 seconds
# Press Ctrl+C - should interrupt immediately

# Test bksp
echo hello
[backspace 5 times]
# Should erase "hello"

# Test up arrow
ls
[Up arrow]
# Previous command should reappear
```

---

## 🔍 Verification Checklist

### **Pre-Start Verification**

- [ ] Backend: `npm install` completed
- [ ] Frontend: `npm install` completed
- [ ] Backend: No TypeScript errors (`npm run dev` starts)
- [ ] Frontend: No console errors on load
- [ ] Socket.io: Connected (check Application → Cookies)

### **Runtime Verification**

```javascript
// In browser console, all should be true:
console.log('Has socket:', !!io)
console.log('Socket connected:', !!io.socket?.connected)
console.log('Has xterm:', !!window.Terminal)
console.log('DOM has terminal:', !!document.querySelector('[data-gr-c]'))
```

### **Data Flow Verification**

```bash
# Run this test sequence:

# 1. Type in terminal
ls

# 2. Watch server logs for:
# [TERMINAL_INPUT] Socket xxx...
# [PTY_OUTPUT] Socket xxx...
# [EMIT] terminal:output...

# 3. Watch browser console for:
# [handleData] User input: "l"
# [handleData] User input: "s" 
# [handleData] User input: "\r"
# [handleOutput] Received: [command echo]
# [handleOutput] Received: [file list]
```

---

## 📊 Expected Log Output

### **When Everything Works**

**Server console (on client connect):**
```
[TERMINAL_INIT] Socket abc123
[TERMINAL_INIT] Working directory: /path/to/project
[TERMINAL_INIT] ✅ PTY spawned with PID: 12345
```

**Browser console (on page load):**
```
🖥️  Terminal initialized: 80 x 24
```

**Typing "ls" + Enter:**
```
Server:
[TERMINAL_INPUT] Socket abc123: "l"
[TERMINAL_INPUT] Socket abc123: "s"
[TERMINAL_INPUT] Socket abc123: "\r"
[PTY_OUTPUT] Socket abc123: "l\r\ns\r\nfile1.txt\r\nfile2.txt\r\n$"

Browser:
[handleData] User input: "l"
[handleData] User input: "s"
[handleData] User input: "\r"
[handleOutput] Received: "file1.txt\r\nfile2.txt\r\n"
```

---

## 🛠️ Emergency Fixes

### **Terminal Won't Connect**

```bash
# 1. Kill old processes
pkill -f "ts-node"
pkill -f "vite"
sleep 2

# 2. Restart backend
cd server && npm run dev

# 3. In new terminal, start frontend
cd client && npm run dev

# 4. Clear browser cache
# DevTools → Application → Clear Site Data

# 5. Refresh page
```

### **Socket Connection Stuck**

```javascript
// In browser console
io.socket?.disconnect()
io.socket?.connect()
// Should see "Connect" in logs

// Or refresh page
location.reload()
```

### **PTY Consuming Too Much Memory**

```bash
# Find zombie PTY processes
ps aux | grep "[b]ash"

# Kill them manually if needed
kill -9 <PID>

# Check server isn't starting multiple PTYs
grep -n "pty.spawn" server/src/server.ts
# Should only be 1 spawn per TERMINAL_INIT
```

### **Terminal Showing Old Session**

```javascript
// In browser console
localStorage.getItem('terminalState')
// Delete if corrupted:
localStorage.removeItem('terminalState')
location.reload()
```

---

## 📝 Sample Commands to Test

```bash
# Test basic commands
$ ls
$ pwd
$ date
$ echo "hello"

# Test with output
$ npm list lodash

# Test with streaming output
$ for i in {1..5}; do echo "Line $i"; sleep 1; done

# Test with error
$ ls /nonexistent

# Test interactive
$ node
> 2 + 2
4
> .exit

# Test piping
$ ls | grep json

# Test redirection
$ echo "test" > file.txt
$ cat file.txt
```

---

## 🔗 Related Resources

- **Full Debugging Guide:** [TERMINAL_MASTER_DEBUGGING_GUIDE.md](TERMINAL_MASTER_DEBUGGING_GUIDE.md)
- **Architecture Overview:** [INTEGRATED_SHELL_ARCHITECTURE.md](INTEGRATED_SHELL_ARCHITECTURE.md)
- **Socket Protocol:** [TERMINAL_SOCKET_PROTOCOL.md](TERMINAL_SOCKET_PROTOCOL.md)
- **Execution Details:** [PTY_EXECUTION_GUIDE.md](PTY_EXECUTION_GUIDE.md)
- **Testing Guide:** [TERMINAL_TESTING_GUIDE.md](TERMINAL_TESTING_GUIDE.md)
- **Developer Reference:** [TERMINAL_DEVELOPER_REFERENCE.md](TERMINAL_DEVELOPER_REFERENCE.md)

---

## 🎯 If Still Stuck

1. **Run diagnostic:** `bash terminal-diagnostic.sh`
2. **Check logs:** Look at both server and browser console
3. **Enable verbose logging:** Add `console.log()` to handlers
4. **Test socket separately:** Use `socket.emit()` in browser console
5. **Check processes:** `ps aux | grep node`
6. **Review code:** Compare your code with guides above
7. **Check TypeScript:** `cd client && npm run build` (check for errors)

---

**Last Updated:** April 17, 2026  
**Terminal Version:** 1.0 Production
