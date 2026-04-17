#!/bin/bash

# Terminal System Diagnostic Tool
# Verify all components are working correctly

echo "════════════════════════════════════════════════════════════════"
echo "  TERMINAL SYSTEM DIAGNOSTIC TOOL"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_mark="${GREEN}✓${NC}"
x_mark="${RED}✗${NC}"
warning="${YELLOW}⚠${NC}"

# ════════════════════════════════════════════════════════════════════
# CHECK 1: Backend Dependencies
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[1/8] Checking Backend Dependencies${NC}"

if grep -q "node-pty" /home/azeem/Documents/Year3\ -Sem\ 2/Code-Sync-main/server/package.json; then
	echo -e "${check_mark} node-pty in server/package.json"
	package_version=$(grep '"node-pty"' /home/azeem/Documents/Year3\ -Sem\ 2/Code-Sync-main/server/package.json)
	echo "  └─ $package_version"
else
	echo -e "${x_mark} node-pty NOT in server/package.json"
	echo "  └─ Run: cd server && npm install node-pty"
fi

if [ -d "/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/server/node_modules/node-pty" ]; then
	echo -e "${check_mark} node-pty installed"
else
	echo -e "${x_mark} node-pty NOT installed"
	echo "  └─ Run: cd server && npm install"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 2: Frontend Dependencies
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[2/8] Checking Frontend Dependencies${NC}"

if grep -q "@xterm/xterm" /home/azeem/Documents/Year3\ -Sem\ 2/Code-Sync-main/client/package.json; then
	echo -e "${check_mark} @xterm/xterm in client/package.json"
	xterm_version=$(grep '"@xterm/xterm"' /home/azeem/Documents/Year3\ -Sem\ 2/Code-Sync-main/client/package.json)
	echo "  └─ $xterm_version"
else
	echo -e "${x_mark} @xterm/xterm NOT in client/package.json"
	echo "  └─ Run: cd client && npm install @xterm/xterm@^5.5.0 @xterm/addon-fit@^0.10.0"
fi

if grep -q "@xterm/addon-fit" /home/azeem/Documents/Year3\ -Sem\ 2/Code-Sync-main/client/package.json; then
	echo -e "${check_mark} @xterm/addon-fit in client/package.json"
else
	echo -e "${x_mark} @xterm/addon-fit NOT in client/package.json"
fi

if [ -d "/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/client/node_modules/@xterm" ]; then
	echo -e "${check_mark} @xterm packages installed"
else
	echo -e "${x_mark} @xterm packages NOT installed"
	echo "  └─ Run: cd client && npm install"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 3: Backend Terminal Code
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[3/8] Checking Backend Terminal Code${NC}"

server_file="/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/server/src/server.ts"

if grep -q "import \* as pty from \"node-pty\"" "$server_file"; then
	echo -e "${check_mark} node-pty imported"
else
	echo -e "${x_mark} node-pty NOT imported"
	echo "  └─ Add: import * as pty from \"node-pty\""
fi

if grep -q "const terminalProcesses = new Map" "$server_file"; then
	echo -e "${check_mark} terminalProcesses Map declared"
else
	echo -e "${x_mark} terminalProcesses Map NOT found"
	echo "  └─ Add: const terminalProcesses = new Map<string, pty.IPty>()"
fi

if grep -q "SocketEvent.TERMINAL_INIT" "$server_file"; then
	echo -e "${check_mark} TERMINAL_INIT handler exists"
else
	echo -e "${x_mark} TERMINAL_INIT handler NOT found"
fi

if grep -q "ptyProcess.onData" "$server_file"; then
	echo -e "${check_mark} ptyProcess.onData() registered"
else
	echo -e "${x_mark} ptyProcess.onData() NOT found"
fi

if grep -q "SocketEvent.TERMINAL_INPUT" "$server_file"; then
	echo -e "${check_mark} TERMINAL_INPUT handler exists"
else
	echo -e "${x_mark} TERMINAL_INPUT handler NOT found"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 4: Frontend Terminal Component
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[4/8] Checking Frontend Terminal Component${NC}"

terminal_file="/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/client/src/components/terminal/Terminal.tsx"

if [ -f "$terminal_file" ]; then
	echo -e "${check_mark} Terminal.tsx exists"
	
	if grep -q "import { Terminal as XTerm }" "$terminal_file"; then
		echo -e "${check_mark} XTerm imported"
	else
		echo -e "${x_mark} XTerm NOT imported"
	fi
	
	if grep -q "import { FitAddon }" "$terminal_file"; then
		echo -e "${check_mark} FitAddon imported"
	else
		echo -e "${x_mark} FitAddon NOT imported"
	fi
	
	if grep -q "xterm.onData" "$terminal_file"; then
		echo -e "${check_mark} xterm.onData() registered"
	else
		echo -e "${x_mark} xterm.onData() NOT found"
	fi
	
	if grep -q "socket.on(SocketEvent.TERMINAL_OUTPUT" "$terminal_file"; then
		echo -e "${check_mark} TERMINAL_OUTPUT handler registered"
	else
		echo -e "${x_mark} TERMINAL_OUTPUT handler NOT found"
	fi
else
	echo -e "${x_mark} Terminal.tsx NOT FOUND"
	echo "  └─ Create: client/src/components/terminal/Terminal.tsx"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 5: Socket Event Types
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[5/8] Checking Socket Event Types${NC}"

socket_types="/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/client/src/types/socket.ts"

if [ -f "$socket_types" ]; then
	if grep -q "TERMINAL_INIT" "$socket_types"; then
		echo -e "${check_mark} TERMINAL_INIT event defined"
	else
		echo -e "${x_mark} TERMINAL_INIT event NOT defined"
	fi
	
	if grep -q "TERMINAL_INPUT" "$socket_types"; then
		echo -e "${check_mark} TERMINAL_INPUT event defined"
	else
		echo -e "${x_mark} TERMINAL_INPUT event NOT defined"
	fi
	
	if grep -q "TERMINAL_OUTPUT" "$socket_types"; then
		echo -e "${check_mark} TERMINAL_OUTPUT event defined"
	else
		echo -e "${x_mark} TERMINAL_OUTPUT event NOT defined"
	fi
	
	if grep -q "TERMINAL_RESIZE" "$socket_types"; then
		echo -e "${check_mark} TERMINAL_RESIZE event defined"
	else
		echo -e "${x_mark} TERMINAL_RESIZE event NOT defined"
	fi
	
	if grep -q "TERMINAL_EXIT" "$socket_types"; then
		echo -e "${check_mark} TERMINAL_EXIT event defined"
	else
		echo -e "${x_mark} TERMINAL_EXIT event NOT defined"
	fi
else
	echo -e "${warning} Socket types file not checked"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 6: CSS Imports
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[6/8] Checking CSS Imports${NC}"

if grep -q "@xterm/xterm/css/xterm.css" "$terminal_file"; then
	echo -e "${check_mark} Xterm CSS imported"
else
	echo -e "${x_mark} Xterm CSS NOT imported"
	echo "  └─ Add: import '@xterm/xterm/css/xterm.css'"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 7: Layout Integration
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[7/8] Checking Layout Integration${NC}"

layout_file="/home/azeem/Documents/Year3 -Sem 2/Code-Sync-main/client/src/components/workspace/TerminalIntegratedLayout.tsx"

if [ -f "$layout_file" ]; then
	echo -e "${check_mark} TerminalIntegratedLayout.tsx exists"
	
	if grep -q "import.*Terminal" "$layout_file"; then
		echo -e "${check_mark} Terminal component imported in layout"
	else
		echo -e "${x_mark} Terminal NOT imported in layout"
	fi
	
	if grep -q "Terminal" "$layout_file"; then
		echo -e "${check_mark} Terminal component used in layout"
	else
		echo -e "${x_mark} Terminal component NOT used in layout"
	fi
else
	echo -e "${warning} TerminalIntegratedLayout.tsx not found - terminal may not be shown"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CHECK 8: Ports and Processes
# ════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[8/8] Checking Ports and Processes${NC}"

if command -v lsof &> /dev/null; then
	if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
		echo -e "${check_mark} Backend running on port 3000"
	else
		echo -e "${warning} Backend NOT running on port 3000"
		echo "  └─ Start: cd server && npm run dev"
	fi
	
	if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
		echo -e "${check_mark} Frontend dev server running on port 5173"
	else
		echo -e "${warning} Frontend dev server NOT running on port 5173"
		echo "  └─ Start: cd client && npm run dev"
	fi
else
	echo -e "${warning} lsof not available - skipping port check"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}DIAGNOSTIC SUMMARY${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "If all checks pass (${GREEN}✓${NC}), your terminal system is ready!"
echo ""
echo "Common Issues:"
echo "  • Terminal renders but can't type:"
echo "    └─ Check: xterm.onData() and socket connection"
echo ""
echo "  • No output from commands:"
echo "    └─ Check: ptyProcess.onData() and socket.on(TERMINAL_OUTPUT)"
echo ""
echo "  • Backend won't compile:"
echo "    └─ Check: node-pty import and TypeScript types"
echo ""
echo "Next Steps:"
echo "  1. Open browser to http://localhost:5173"
echo "  2. Check browser console for [Terminal] logs"
echo "  3. Check server console for [TERMINAL_*] logs"
echo "  4. Type in terminal and watch the logs flow"
echo ""
echo "For detailed debugging, see:"
echo "  • TERMINAL_MASTER_DEBUGGING_GUIDE.md"
echo "  • PTY_EXECUTION_GUIDE.md"
echo "════════════════════════════════════════════════════════════════"
