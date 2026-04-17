# Terminal System - Testing & Verification Guide

## 🎯 Quick Start Verification

This guide helps you verify the terminal system works correctly end-to-end.

---

## ✅ Pre-Flight Checks

### **1. Backend Dependencies Installed**
```bash
cd /path/to/server
ls node_modules | grep -i xterm    # Should exist
ls node_modules | grep -i pty      # Should exist: node-pty
```

### **2. Frontend Dependencies Installed**
```bash
cd /path/to/client
ls node_modules/@xterm             # Should have: xterm, addon-fit
```

### **3. Services Running**
```bash
# Terminal 1: Backend server
cd server
npm run dev
# Should see: "Express server running on port 3000"

# Terminal 2: Frontend dev server
cd client
npm run dev
# Should see: "➜  Local: http://localhost:5173/"

# Terminal 3: Open browser
open http://localhost:5173
```

---

## 🧪 Test Cases

### **Test 1: Terminal Renders Successfully** ✅

**Expected:** See terminal emulator at bottom of IDE (30% of viewport)

**Verification:**
```
1. Open IDE in browser
2. Scroll to bottom
3. See black terminal panel with "bash" label
4. See cursor blinking
5. See "Clear", "−", "✕" buttons in header
```

**If Failed:**
- Check browser console for errors (F12)
- Check that @xterm/xterm CSS is loaded (should see xterm background)
- Verify Terminal.tsx is imported in TerminalIntegratedLayout.tsx

---

### **Test 2: Keyboard Input Works** ✅

**Expected:** Typed text appears in terminal

**Steps:**
```
1. Click in terminal
2. Type: echo "hello world"
3. Press Enter
```

**Expected Output:**
```
$ echo "hello world"
hello world
```

**If Failed:**
- Check browser console for "xterm.onData()" logs
- Verify socket is connected (check Network tab for Socket.io messages)
- Check server console for "TERMINAL_INPUT" logs

---

### **Test 3: Basic Commands Work** ✅

**Expected:** System commands execute and return output

**Run These Commands:**

#### **3a. List files**
```bash
ls
```
Should show project files (client, server, etc.)

#### **3b. Print working directory**
```bash
pwd
```
Should show: `/home/azeem/Documents/Year3\ -\ Sem\ 2/Code-Sync-main`

#### **3c. Create and read file**
```bash
echo "test" > test.txt
cat test.txt
```
Should output: `test`

#### **3d. View file system**
```bash
ls -la
```
Should show file listing with timestamps

**If Failed:**
- Working directory might not be set correctly
- Check server logs: should see "Terminal initialized"
- Verify PTY is spawning bash (check `ps` command)

---

### **Test 4: Pipes and Redirects** ✅

**Expected:** Complex shell syntax works

**Test piping:**
```bash
ls | grep client
```
Should show only `client` directory

**Test redirection:**
```bash
ls > file_list.txt
cat file_list.txt
```
Should show directory listing

**If Failed:**
- Bash isn't receiving full command properly
- Check server console: actual input being sent
- Verify `ptyProcess.write()` is being called

---

### **Test 5: Special Keys Work** ✅

**Expected:** Arrow keys, Backspace, Ctrl+C handled correctly

**Test arrow keys:**
```bash
ls                          # List files
# Press UP arrow
# Previous command re-displayed
```

**Test Backspace:**
```bash
hello [Backspace][Backspace]e
```
Should show: `hele` (backspace removed `ll`)

**Test Ctrl+C:**
```bash
sleep 10
# Press Ctrl+C immediately
# Should show: ^C
# Command interrupted, prompt returns
```

**If Failed:**
- Xterm.js might not be sending special key codes
- Check browser Network tab for special keystroke data
- Verify xterm theme has cursor color set

---

### **Test 6: Real-time Output Streaming** ✅

**Expected:** Output appears character-by-character in real-time

**Long-running command:**
```bash
for i in {1..10}; do echo "Line $i"; sleep 1; done
```

**Expected:** Each line appears ≈1 second apart (not all at once)

**If Failed:**
- Socket.io might be buffering output
- Check `ptyProcess.onData()` is firing
- Verify `socket.emit(TERMINAL_OUTPUT)` is sending each chunk

---

### **Test 7: Multi-User Isolation** ✅ (If Multiplayer Enabled)

**Expected:** Each user has separate terminal session

**Setup:**
```bash
# User A's terminal
value=123
echo $value
# Output: 123

# In parallel: Open IDE in different browser/incognito window
# User B's terminal
echo $value
# Output: (empty line - User B doesn't see User A's variable)
```

**If Failed:**
- Terminal sessions might not be isolated
- Check `terminalProcesses.get(socket.id)` mapping
- Verify each socket gets unique PTY instance

---

### **Test 8: Terminal Clear Button** ✅

**Steps:**
```bash
ls
# Terminal now shows file list

# Click "Clear" button (trash icon)
```

**Expected:** Terminal clears, shows only prompt

**If Failed:**
- Clear button might not be emitting event
- Check `xterm.clear()` in Terminal.tsx
- Verify CustomEvent listener is attached

---

### **Test 9: Terminal Resize** ✅

**Steps:**
```bash
1. Run command: stty size
   Output: 24 80 (rows × cols)

2. Resize browser window to make IDE narrower

3. Run: stty size again
```

**Expected:** Columns decreased from 80 to smaller number

**If Failed:**
- ResizeObserver might not be triggering
- Check `TERMINAL_RESIZE` handler on backend
- Verify `ptyProcess.resize()` is being called

---

### **Test 10: Terminal Persistence** ✅

**Steps:**
```bash
1. Make terminal visible and at certain height
2. Refresh browser (Ctrl+R)
3. Check terminal is still visible at same height
```

**Expected:** Terminal state persisted via localStorage

**If Failed:**
- localStorage key might be wrong
- Check browser DevTools: Application → Local Storage
- Look for `terminalState` key with `{ visible: true, height: 30 }`

---

## 🚀 Advanced Testing

### **Test: Running Node Server**

```bash
cd client
npm run build
```

Then in terminal:

```bash
cd server
npm start
```

**Expected:** Server runs without crashing

**Verification:**
```bash
# In browser console
const socket = io('http://localhost:3000')
console.log(socket.connected)  # Should be: true
```

---

### **Test: Installing Packages**

```bash
npm install lodash
```

**Expected:**
- Progress bar shows
- "added X packages" message
- lodash appears in node_modules

---

### **Test: Compiling Code**

```bash
javac HelloWorld.java 2>&1
java HelloWorld
```

**Expected:**
- Compilation runs
- Bytecode created
- Program executes

---

### **Test: Performance (Long Session)**

```bash
# Run for 2 minutes
watch -n 1 'echo "$(date): $(ls | wc -l) files"'
# After 2 min: Ctrl+C

# Check for memory leaks
ps aux | grep node
```

**Expected:**
- No significant memory increase
- Process remains responsive

---

## 🔧 Debugging Commands

### **Check PTY Process Running**
```bash
ps aux | grep bash
# Should show: /bin/bash (spawned by node-pty)
```

### **Check Socket Connection**
```javascript
// In browser console
const socket = io('http://localhost:3000')
socket.on('connect', () => console.log('Connected:', socket.id))
socket.on('disconnect', () => console.log('Disconnected'))
```

### **Check Terminal Output Flow**
```javascript
// In browser console (Terminal.tsx)
// Should see logs like:
// "🖥️ Terminal initialized"
// "📥 Terminal Output: ..."
```

### **Check Backend Logs**
```bash
# server/src/server.ts console output
# Look for:
# "Terminal [socket-id] initialized"
# "TERMINAL_INPUT received"
# "Terminal [socket-id] closed"
```

---

## 📊 Checklist

Use this to track your testing:

- [ ] Terminal renders at bottom of IDE
- [ ] Can type text in terminal
- [ ] Basic commands work (ls, pwd, echo)
- [ ] Pipes work (ls | grep)
- [ ] Arrow keys work
- [ ] Backspace works
- [ ] Ctrl+C interrupts commands
- [ ] Clear button removes text
- [ ] Terminal resizes with window
- [ ] Terminal state persists on reload
- [ ] Real-time output streaming works
- [ ] Multi-user isolation works (if applicable)
- [ ] No memory leaks after 5 min usage
- [ ] Error messages display correctly

**Pass Rate:** ___/14 tests

---

## ❌ Common Issues & Solutions

### **"Terminal not rendering"**
```
→ Check @xterm/xterm CSS imported correctly
→ Look for console errors (F12 → Console)
→ Verify Terminal.tsx component is mounted
→ Check terminalRef.current is valid
```

### **"No output from commands"**
```
→ Check Socket.io connection (Network tab)
→ Verify TERMINAL_OUTPUT listener in Terminal.tsx
→ Check backend PTY is spawned correctly
→ Try running: echo "test" | nc localhost 3000
```

### **"Terminal freezes after command"**
```
→ Check if PTY crashed: ps aux | grep bash
→ Look for error in server console
→ Try clicking Clear button
→ Refresh terminal: F5
```

### **"Text looks garbled/corrupted"**
```
→ Check xterm theme colors set correctly
→ Verify TERM=xterm-256color is set
→ Check LANG=en_US.UTF-8 is set
→ Try: echo -e "\\033[32mGreen\\033[0m"
```

### **"Multiple terminals appearing"**
```
→ Check that TerminalView.tsx is NOT imported
→ Verify TERMINAL view enum is removed
→ Search codebase for duplicate TerminalView
→ Only TerminalIntegratedLayout should exist
```

---

## 📞 Getting Help

If tests fail:

1. **Take a screenshot** of terminal and browser console
2. **Check these logs:**
   - Browser: DevTools → Console tab
   - Server: Terminal where `npm run dev` runs
3. **Verify these files exist:**
   - `/client/src/components/terminal/Terminal.tsx`
   - `/client/src/components/workspace/TerminalIntegratedLayout.tsx`
   - `/server/src/server.ts` (should have PTY handlers)
4. **Check network:**
   - DevTools → Network tab
   - Filter for "Socket.io" messages
   - Look for TERMINAL_INIT, TERMINAL_INPUT, TERMINAL_OUTPUT

---

**Test Environment:** Linux
**Node Version:** ≥14.0.0
**npm Version:** ≥6.0.0

Last updated: April 17, 2026
