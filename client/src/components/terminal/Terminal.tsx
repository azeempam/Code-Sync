import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { SocketEvent } from '../../types/socket'
import { useSocket } from '../../context/SocketContext'

const Terminal: React.FC = () => {
	const containerRef = useRef<HTMLDivElement>(null)
	const terminalRef = useRef<HTMLDivElement>(null)
	const xtermRef = useRef<XTerm | null>(null)
	const fitAddonRef = useRef<FitAddon | null>(null)
	const { socket } = useSocket()

	useEffect(() => {
		if (!terminalRef.current || !socket) {
			console.warn('⚠️  Terminal: Missing refs or socket')
			return
		}

		// 🔴 CRITICAL: Wait for socket to actually connect
		if (!socket.connected) {
			console.warn('⚠️  Socket not connected yet. Connected:', socket.connected)
			const connectListener = () => {
				console.log('✅ Socket connected! Socket ID:', socket.id)
				// Trigger re-render by calling effect again
			}
			socket.on('connect', connectListener)
			return () => {
				socket.off('connect', connectListener)
			}
		}

		console.log('🟢 Terminal: Socket connected, initializing...')

		try {
			// Initialize XTerm with optimized settings
			const xterm = new XTerm({
				cursorBlink: true,
				fontSize: 13,
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				theme: {
					background: '#1e1e1e',
					foreground: '#d4d4d4',
					cursor: '#aeafad',
					cursorAccent: '#1e1e1e',
					selection: 'rgba(255, 255, 255, 0.15)',
				},
				scrollback: 2000,
				fastScrollSensitivity: 2,
				smoothScrollDuration: 0,
			})

			const fitAddon = new FitAddon()
			xterm.loadAddon(fitAddon)

			// Clear and setup
			terminalRef.current.innerHTML = ''
			xterm.open(terminalRef.current)

			// Fit to container on next frame
			requestAnimationFrame(() => {
				try {
					fitAddon.fit()
					console.log('🖥️  Terminal initialized:', xterm.cols, 'x', xterm.rows)
				} catch (e) {
					console.error('❌ Fit error:', e)
				}
			})

			xtermRef.current = xterm
			fitAddonRef.current = fitAddon

			// 🟢 Initialize terminal session on backend
			console.log('📤 Emitting TERMINAL_INIT:', { cols: xterm.cols, rows: xterm.rows, socketId: socket.id })
			socket.emit(SocketEvent.TERMINAL_INIT, {
				cols: xterm.cols || 80,
				rows: xterm.rows || 24,
			})

			// Handle user input
			const handleData = (data: string) => {
				console.log('⌨️  User input:', JSON.stringify(data), 'Socket connected:', socket.connected)
				socket.emit(SocketEvent.TERMINAL_INPUT, { data })
			}

			xterm.onData(handleData)

			// Handle terminal output
			const handleOutput = ({ data }: { data: string }) => {
				console.log('📥 Terminal output received:', JSON.stringify(data.substring(0, 50)) + (data.length > 50 ? '...' : ''))
				if (xtermRef.current) {
					xtermRef.current.write(data)
				} else {
					console.warn('⚠️  xtermRef is null in handleOutput')
				}
			}

			const handleExit = () => {
				console.log('🔴 Terminal exit event received')
				if (xtermRef.current) {
					xtermRef.current.writeln('\r\n\x1b[33m[Terminal Disconnected]\x1b[0m')
				}
			}

			// Handle clear terminal event
			const handleClearTerminal = () => {
				console.log('🟡 Clear terminal event received')
				if (xtermRef.current) {
					xtermRef.current.clear()
				}
			}

			console.log('📡 Registering socket event listeners...')
			socket.on(SocketEvent.TERMINAL_OUTPUT, handleOutput)
			socket.on(SocketEvent.TERMINAL_EXIT, handleExit)
			window.addEventListener('clearTerminal', handleClearTerminal)

			// Handle resize with debounce and ResizeObserver
			let resizeTimeout: NodeJS.Timeout
			const handleResize = () => {
				clearTimeout(resizeTimeout)
				resizeTimeout = setTimeout(() => {
					if (fitAddonRef.current && xtermRef.current && containerRef.current) {
						try {
							fitAddonRef.current.fit()
							const { cols, rows } = xtermRef.current
							console.log('📐 Resize event:', { cols, rows, socketConnected: socket.connected })
							socket.emit(SocketEvent.TERMINAL_RESIZE, { cols, rows })
						} catch (e) {
							console.warn('⚠️  Resize error:', e)
						}
					}
				}, 150)
			}

			// Use ResizeObserver for container size changes
			const resizeObserver = new ResizeObserver(() => {
				handleResize()
			})

			if (containerRef.current) {
				resizeObserver.observe(containerRef.current)
			}

			// Also listen for window resize
			window.addEventListener('resize', handleResize)

			console.log('✅ Terminal setup complete')

			return () => {
				console.log('🧹 Cleaning up terminal...')
				clearTimeout(resizeTimeout)
				window.removeEventListener('resize', handleResize)
				window.removeEventListener('clearTerminal', handleClearTerminal)
				resizeObserver.disconnect()
				socket.off(SocketEvent.TERMINAL_OUTPUT, handleOutput)
				socket.off(SocketEvent.TERMINAL_EXIT, handleExit)
				try {
					xterm.dispose()
				} catch (e) {
					console.warn('⚠️  Terminal disposal error:', e)
				}
			}
		} catch (error) {
			console.error('❌ Terminal initialization error:', error)
		}
	}, [socket])

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