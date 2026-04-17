# 🎯 Terminal Debug Quick Card

Print this or keep it in another window while testing!

---

## **The 4 Phases (in order)**

```
[1] Socket Connected?           → Look for: ✅ Socket connected!
                                   ❌ Shows: ⚠️ Socket not connected yet

        ↓

[2] Terminal Initialized?       → Look for: 🖥️ Terminal initialized: 80 x 24
                                   ❌ Shows: Nothing (stuck at phase 1)

        ↓

[3] Input Captured?             → Look for: ⌨️ User input: "l"
                                   ❌ Shows: Typing does nothing, no logs

        ↓

[4] Output Displayed?           → Look for: 📥 Terminal output received:
                                              Output shows in terminal UI
                                   ❌ Shows: Typed "ls" but no output
```

---

## **Quick Diagnosis Flowchart**

```
Terminal doesn't work?
│
├─ Check: Do you see "✅ Socket connected"?
│  ├─ NO  → Go to: PHASE 1 FIX (Network issue)
│  └─ YES → Continue
│
├─ Check: Can you click in terminal and see cursor?
│  ├─ NO  → Go to: PHASE 2 FIX (XTerm not mounting)
│  └─ YES → Continue
│
├─ Check: When you type, does server show "📥 [TERMINAL_INPUT]"?
│  ├─ NO  → Go to: PHASE 3 FIX (Input capture broken)
│  └─ YES → Continue
│
└─ Check: When you press Enter, does server show "📤 [PTY_OUTPUT]"?
   ├─ NO  → Go to: PHASE 4A FIX (Backend emission broken)
   └─ YES → Likely working, but not rendering
            Go to: PHASE 4B FIX (Frontend display broken)
```

---

## **The Console Log Language** 🗣️

### Frontend (Browser Console)

```
🟢 GREEN symbols (✅, 🟢) = Everything working
🟡 YELLOW symbols (⚠️) = Waiting or normal state
🔵 BLUE symbols (📤, 📥, ⌨️) = Data flowing
🔴 RED symbols (❌, 💀) = Errors
```

**Critical Lines to Watch:**

| Log | Means |
|-----|-------|
| `✅ Socket connected! Socket ID:` | Socket.io handshake succeeded |
| `🖥️  Terminal initialized: 80 x 24` | XTerm.js mounted and sized |
| `📤 Emitting TERMINAL_INIT:` | Frontend sending init event |
| `⌨️  User input: "l"` | Keystroke captured locally |
| `📥 Terminal output received:` | Data from backend arrived |

### Backend (Server Console)

| Log | Means |
|-----|-------|
| `listening on port 3000` | Server started |
| `📡 [TERMINAL_INIT]` | Frontend sent init |
| `✅ PTY spawned. PID: [num]` | Bash shell created |
| `📥 [TERMINAL_INPUT] ... Data: "l"` | Keystroke received |
| `📤 [PTY_OUTPUT] ... Sample:` | Bash output available |

---

## **Copy-Paste Debugging Snippets**

### Browser Console (paste these)

```javascript
// 1. Check socket connection
console.log('Socket exists?', window.io !== undefined);
console.log('Check Network tab for "WS" connection');

// 2. Check XTerm mounted
console.log('XTerm DOM:', document.querySelector('.xterm'));
console.log('Terminal container:', document.querySelector('[data-terminal]'));
```

### Terminal (bash)

```bash
# 1. Test backend is running
curl -I http://localhost:3000
# Should return: HTTP/1.1 200 OK

# 2. Check if bash is spawned (watch for running pty)
watch -n1 "ps aux | grep bash | grep -v grep"

# 3. Kill all node processes if stuck
pkill -f "ts-node"; pkill -f "node"; sleep 1

# 4. Restart from scratch
cd server && npm run dev
# In another terminal:
cd client && npm run dev
```

---

## **3-Step Emergency Reset**

```bash
# Step 1: Kill ALL Node processes
pkill -f "node" || pkill -f "ts-node" || true
sleep 2

# Step 2: Verify they're dead
ps aux | grep -E "(node|ts-node)" | grep -v grep

# Step 3: Restart fresh
cd server && npm run dev
# New terminal:
cd client && npm run dev
```

Then:
- Hard refresh browser: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
- Open DevTools: **F12**
- Go to **http://localhost:5173**
- Look for Phase 1 logs

---

## **What Each Phase Break Looks Like**

### Phase 1 Break: Socket Won't Connect

**Browser Console:**
```
⚠️  Socket not connected yet. Connected: false
⚠️  Socket not connected yet. Connected: false    ← REPEATS forever
⚠️  Socket not connected yet. Connected: false
```

**Fix:** Restart backend, check `VITE_BACKEND_URL` in .env

---

### Phase 2 Break: Terminal Won't Mount

**Browser Console:**
```
✅ Socket connected!
⚠️ Fit error: ...     ← XTerm mounted but sizing failed
         OR
🟢 Terminal: Socket connected, initializing...
📤 Emitting TERMINAL_INIT:
   (then nothing else)  ← Never says "Terminal initialized"
```

**Fix:** Check browser dev tools → Application tab → Console for JS errors

---

### Phase 3 Break: Input Not Captured

**Browser Console:**
```
✅ Socket connected!
🖥️  Terminal initialized: 80 x 24
✅ Terminal setup complete
(click in terminal, type "hello")
(nothing happens - no ⌨️ logs)
```

**Server Console:**
```
✅ Terminal [abc-123...] initialized successfully
(you type in terminal)
(no "📥 [TERMINAL_INPUT]" logs)
```

**Fix:** Check if terminal is focused (cursor visible?), click in terminal first

---

### Phase 4 Break: Output Not Flowing

**Browser Console:**
```
✅ Socket connected!
🖥️  Terminal initialized: 80 x 24
⌨️  User input: "l"
⌨️  User input: "s"
⌨️  User input: "\r"
(nothing after - no 📥 logs)
```

**Server Console:**
```
📥 [TERMINAL_INPUT] Socket: ... | Data: "l"
   ✅ Input written to PTY
📥 [TERMINAL_INPUT] Socket: ... | Data: "s"
   ✅ Input written to PTY
📥 [TERMINAL_INPUT] Socket: ... | Data: "\r"
   ✅ Input written to PTY
(then stops - no 📤 [PTY_OUTPUT] logs)
```

**Fixes:**
1. Make sure bash is spawned: `ps aux | grep bash`
2. Restart backend: `pkill -f ts-node; cd server && npm run dev`

---

## **Success Checklist** ✅

- [ ] Phase 1: ✅ See "Socket connected! Socket ID:"
- [ ] Phase 2: ✅ See "Terminal initialized: 80 x 24"
- [ ] Phase 3: ✅ Type and see ⌨️  logs on every keystroke
- [ ] Phase 4: ✅ After Enter, see 📥 output logs
- [ ] Display: ✅ Terminal shows command output
- [ ] Special Keys: ✅ Ctrl+C interrupts, arrows work, backspace deletes

---

## **How to Share Error with Support**

Paste this command, then share the output:

```bash
echo "=== ENVIRONMENT ===" && \
uname -a && \
echo -e "\n=== NODE VERSION ===" && \
node --version && npm --version && \
echo -e "\n=== PORT CHECK ===" && \
netstat -tlnp 2>/dev/null | grep -E "(3000|5173)" || echo "Ports check skipped" && \
echo -e "\n=== PROCESS CHECK ===" && \
ps aux | grep -E "(ts-node|vite|node)" | grep -v grep
```

---

**Pro Tip:** Keep this file open in a second monitor or tab while debugging!

---

*Last Updated: April 17, 2026*
