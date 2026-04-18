import { useState, useEffect } from 'react'
import Split from 'react-split'
import EditorComponent from '../editor/EditorComponent'
import Terminal from '../terminal/Terminal'
import useLocalStorage from '@/hooks/useLocalStorage'
import { MdClose, MdExpandLess, MdExpandMore, MdClear } from 'react-icons/md'
import { BiTerminal } from 'react-icons/bi'

function TerminalIntegratedLayout() {
	const [showTerminal, setShowTerminal] = useState(true)
	const [terminalHeight, setTerminalHeight] = useState(30)
	const { getItem, setItem } = useLocalStorage()

	useEffect(() => {
		// Load saved terminal state
		const savedState = getItem('terminalState')
		if (savedState) {
			const { visible, height } = JSON.parse(savedState)
			setShowTerminal(visible)
			if (height) setTerminalHeight(height)
		}
	}, [getItem])

	const handleSizeChange = (sizes: number[]) => {
		const editorSize = sizes[0]
		const newTerminalHeight = 100 - editorSize
		setTerminalHeight(newTerminalHeight)
		setItem('terminalState', JSON.stringify({ visible: true, height: newTerminalHeight }))
	}

	const toggleTerminal = () => {
		const newState = !showTerminal
		setShowTerminal(newState)
		setItem('terminalState', JSON.stringify({ visible: newState, height: terminalHeight }))
	}

	const clearTerminal = () => {
		// Signal to clear terminal (you can implement this in Terminal component)
		const event = new CustomEvent('clearTerminal')
		window.dispatchEvent(event)
	}

	const getGutter = () => {
		const gutter = document.createElement('div')
		gutter.className = 'h-1 cursor-row-resize'
		gutter.style.backgroundColor = '#3D404A'
		gutter.style.backgroundImage =
			'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cline x1=%270%27 y1=%2712%27 x2=%2724%27 y2=%2712%27 stroke=%2764748b%27 stroke-width=%271%27/%3E%3C/svg%3E")'
		gutter.style.backgroundRepeat = 'repeat-x'
		gutter.style.backgroundPosition = 'center'
		gutter.style.transition = 'background-color 0.2s ease'
		gutter.onmouseenter = () => {
			gutter.style.backgroundColor = '#4a5058'
		}
		gutter.onmouseleave = () => {
			gutter.style.backgroundColor = '#3D404A'
		}
		return gutter
	}

	if (!showTerminal) {
		return (
			<div className="h-full w-full flex flex-col">
				<div className="flex-1 overflow-hidden bg-dark">
					<EditorComponent />
				</div>

				{/* Minimized Terminal Bar */}
				<div className="h-10 bg-dark border-t border-darkHover flex items-center px-4 justify-between hover:bg-darkHover transition-colors">
					<div className="flex items-center gap-2">
						<BiTerminal size={16} className="text-green-500" />
						<span className="text-xs text-gray-400 font-medium">Terminal</span>
					</div>
					<button
						onClick={toggleTerminal}
						className="flex items-center gap-2 px-3 py-1 text-xs bg-darkHover hover:bg-gray-700 rounded transition-colors font-medium"
						title="Show terminal"
					>
						<MdExpandLess size={14} />
						Show
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="h-full w-full flex flex-col bg-dark">
			<Split
				sizes={[100 - terminalHeight, terminalHeight]}
				minSize={[300, 100]}
				maxSize={[Infinity, Infinity]}
				onDrag={handleSizeChange}
				direction="vertical"
				gutterSize={6}
				gutter={getGutter}
				style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
			>
				{/* Editor Section */}
				<div className="overflow-hidden">
					<EditorComponent />
				</div>

				{/* Terminal Section */}
				<div className="flex flex-col h-full bg-dark border-t border-darkHover">
					{/* Terminal Header/Toolbar */}
					<div className="h-11 flex items-center justify-between px-4 bg-darkHover border-b border-gray-700 group">
						<div className="flex items-center gap-3">
							<div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
							<BiTerminal size={16} className="text-gray-400" />
							<span className="text-sm font-medium text-gray-300">Terminal</span>
							<span className="text-xs text-gray-500">— bash</span>
						</div>

						{/* Toolbar Actions */}
						<div className="flex items-center gap-1">
							<button
								onClick={clearTerminal}
								className="p-1.5 hover:bg-dark rounded transition-colors opacity-0 group-hover:opacity-100"
								title="Clear terminal"
							>
								<MdClear size={16} className="text-gray-400 hover:text-gray-200" />
							</button>

							<button
								onClick={toggleTerminal}
								className="p-1.5 hover:bg-dark rounded transition-colors opacity-0 group-hover:opacity-100"
								title="Minimize terminal"
							>
								<MdExpandMore size={16} className="text-gray-400 hover:text-gray-200" />
							</button>

							<button
								onClick={toggleTerminal}
								className="p-1.5 hover:bg-dark rounded transition-colors"
								title="Close terminal"
							>
								<MdClose size={16} className="text-gray-400 hover:text-gray-200" />
							</button>
						</div>
					</div>

					{/* Terminal Output */}
					<div className="flex-1 overflow-hidden">
						<Terminal />
					</div>
				</div>
			</Split>
		</div>
	)
}

export default TerminalIntegratedLayout
