<!-- PROFESSIONAL INTEGRATED TERMINAL LAYOUT DOCUMENTATION -->

# Single Bottom Terminal - Professional IDE Layout

## 📋 Architecture Overview

This refactored layout provides a **clean, modern single-panel terminal** at the bottom of your IDE, eliminating duplicate terminal instances and providing a VS Code-like professional appearance.

```
┌─────────────────────────────────────────┐
│                                         │
│          EDITOR COMPONENT (70%)         │
│          (Code Files & Tabs)            │
│                                         │
├─────────────────────────────────────────│ ◄── Draggable Resizer
│                                         │
│       TERMINAL COMPONENT (30%)          │
│       (Bash/Zsh Output)                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. **Unified Layout Components**
- ✅ Single integrated terminal (no side-panel duplicate)
- ✅ Editor occupies top 70% by default
- ✅ Terminal occupies bottom 30% by default
- ✅ Fully responsive and collapsible

### 2. **Resizable Panel System**
- Drag the divider between editor and terminal
- Smooth resize animation with visual feedback
- Minimum heights enforced (Editor: 300px, Terminal: 100px)
- Persistent state saved to localStorage

### 3. **Professional Terminal Header**
```
🟢 Terminal — bash                    [▢] [▼] [✕]
```
- Live status indicator (green pulse = connected)
- Shell name indicator
- Three action buttons:
  - **Clear** (🗑️) - Clears terminal output
  - **Minimize** (▼) - Collapses terminal to bar
  - **Close** (✕) - Hides terminal completely

### 4. **Terminal Toggle States**

#### **Expanded State**
```css
.terminal {
  display: flex;
  flex-direction: column;
  height: 30%;  /* Configurable */
  background: #1e1e1e;
  border-top: 1px solid #3D404A;
}
```

#### **Minimized State**
```css
.terminal-bar {
  height: 40px;
  background: #212429;
  display: flex;
  justify-content: space-between;
  padding: 0 1rem;
}
```

---

## 🔧 Component Structure

### **Files Modified/Created:**

#### 1. `TerminalIntegratedLayout.tsx` (Main Container)
```typescript
// Props: None (uses localStorage for state)
// State:
//   - showTerminal: boolean
//   - terminalHeight: number (0-100%)

// Features:
//   - Split pane management via react-split
//   - Persistent state management
//   - Clear terminal functionality
//   - Smooth gutter with hover effects
```

#### 2. `Terminal.tsx` (Xterm Renderer)
```typescript
// Props: None
// State:
//   - xtermRef: Reference to XTerm instance
//   - fitAddonRef: Reference to FitAddon

// Features:
//   - Auto-fit to container
//   - ResizeObserver for responsive sizing
//   - WebSocket communication with backend
//   - Event-based clear functionality
```

#### 3. `workspace/index.tsx` (Layout Wrapper)
```typescript
// Renders TerminalIntegratedLayout in place of EditorComponent
// Maintains drawing mode compatibility
```

#### 4. `types/view.ts` (Removed TERMINAL view)
```typescript
// Deleted: TERMINAL = "TERMINAL"
// Reason: Unified to single bottom panel
```

#### 5. `context/ViewContext.tsx` (Removed Terminal sidebar item)
```typescript
// Deleted: TerminalView component import
// Deleted: TERMINAL icon registration
// Deleted: TERMINAL in viewComponents
```

#### 6. `components/sidebar/Sidebar.tsx` (Removed Terminal button)
```typescript
// Deleted: SidebarButton for VIEWS.TERMINAL
// Result: Cleaner sidebar with 7 icons instead of 8
```

---

## 🎨 CSS/Tailwind Structure

### **Container Layout**
```tsx
<div className="h-full w-full flex flex-col bg-dark">
  {/* Split passes through flex items */}
  <Split direction="vertical" gutterSize={6}>
    {/* Editor: Top 70% */}
    <div className="overflow-hidden">
      <EditorComponent />
    </div>

    {/* Terminal: Bottom 30% */}
    <div className="flex flex-col h-full bg-dark border-t border-darkHover">
      {/* Header Bar */}
      <div className="h-11 flex items-center justify-between px-4 bg-darkHover border-b border-gray-700 group">
        {/* Status + Label */}
        {/* Action Buttons */}
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-hidden">
        <Terminal />
      </div>
    </div>
  </Split>
</div>
```

### **Tailwind Color Scheme**
```javascript
// tailwind.config.ts
{
  colors: {
    dark: "#212429",        // Main background
    darkHover: "#3D404A",   // Hover/header background
    light: "#f5f5f5",       // Text
    primary: "#39E079",     // Status indicator
    danger: "#ef4444",      // Error states
  }
}
```

### **Gutter Styling**
```typescript
const getGutter = () => {
  const gutter = document.createElement('div')
  gutter.style.backgroundColor = '#3D404A'
  gutter.style.backgroundImage = 'url(...line-pattern...)'
  gutter.style.transition = 'background-color 0.2s ease'
  gutter.onmouseenter = () => {
    gutter.style.backgroundColor = '#4a5058'  // Highlight on hover
  }
  return gutter
}
```

---

## 📱 Responsive Behavior

### **Desktop (≥768px)**
- Full split layout with draggable divider
- Terminal shows at configured height (default 30%)
- Smooth resize animations

### **Tablet & Mobile**
- Responsive font sizes adjust
- Touch-friendly button sizing
- ResizeObserver maintains fit on orientation change

---

## 🔗 WebSocket Communication

### **Terminal → Server**
```typescript
// On button press
socket.emit(SocketEvent.TERMINAL_INPUT, { data: 'ls -la' })

// On resize
socket.emit(SocketEvent.TERMINAL_RESIZE, { cols: 120, rows: 30 })

// On init
socket.emit(SocketEvent.TERMINAL_INIT, { cols: 80, rows: 24 })
```

### **Server → Terminal**
```typescript
// Real-time output
socket.on(SocketEvent.TERMINAL_OUTPUT, ({ data }) => {
  xterm.write(data)  // Render to screen
})

// Terminal closed
socket.on(SocketEvent.TERMINAL_EXIT, () => {
  xterm.writeln('[Terminal Disconnected]')
})
```

---

## 💾 State Persistence

### **LocalStorage Structure**
```javascript
localStorage.setItem('terminalState', JSON.stringify({
  visible: true,      // Show/hidden state
  height: 30          // Height percentage (0-100)
}))
```

### **Recovery on Page Reload**
```typescript
useEffect(() => {
  const savedState = getItem('terminalState')
  if (savedState) {
    const { visible, height } = JSON.parse(savedState)
    setShowTerminal(visible)
    setTerminalHeight(height)
  }
}, [getItem])
```

---

## 🎯 Usage Examples

### **Toggle Terminal Visibility**
```typescript
<button onClick={() => setShowTerminal(!showTerminal)}>
  {showTerminal ? 'Hide' : 'Show'} Terminal
</button>
```

### **Clear Terminal Output**
```typescript
const clearTerminal = () => {
  window.dispatchEvent(new CustomEvent('clearTerminal'))
}
```

### **Programmatically Resize**
```typescript
socket.emit(SocketEvent.TERMINAL_RESIZE, {
  cols: 200,
  rows: 50
})
```

---

## 🚀 Performance Optimizations

1. **Debounced Resizing** (150ms)
   - Prevents excessive re-renders during drag

2. **ResizeObserver**
   - Monitors container size changes
   - Triggers terminal fit without manual events

3. **RequestAnimationFrame**
   - Smooth terminal initialization
   - Better visual performance

4. **Event Cleanup**
   - Proper listener removal on unmount
   - Memory leak prevention

---

## 🔐 Security & Isolation

✅ **Per-Session PTY** - Each user gets isolated bash process
✅ **Input Validation** - User keystrokes sent as-is without interpretation
✅ **Resource Limits** - PTY auto-killed on disconnect
✅ **Authentication Tied** - Terminal access requires valid socket connection

---

## 📞 Support & Troubleshooting

### Terminal not appearing?
- Check browser console for errors (F12)
- Verify WebSocket connection in Network tab
- Ensure backend PTY service is running

### Resize not working?
- Verify `react-split` version compatibility
- Check Chrome DevTools → Elements → check for overflow: hidden issues

### Clear button not working?
- Ensure Terminal component is listening for `clearTerminal` event
- Check that xterm instance has `.clear()` method available

---

## ✨ Future Enhancements

- [ ] Tab support for multiple terminal panes
- [ ] Terminal search functionality
- [ ] Custom color scheme picker
- [ ] Terminal recording/playback
- [ ] Keyboard shortcut customization
- [ ] Split terminal panels (VS Code style)

---

**Last Updated:** April 17, 2026
**Layout Version:** 2.0 (Unified Single Panel)
