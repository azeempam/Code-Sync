import React from 'react'
import { DragDropContext, DropResult } from 'react-beautiful-dnd'
import KanbanColumn from './KanbanColumn'
import './KanbanBoard.css'

const COLUMNS = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'In Review' },
  { id: 'testing', title: 'Testing' },
  { id: 'done', title: '✓ Done' }
]

interface Task {
  _id: string
  title: string
  description: string
  status: string
  priority: string
  storyPoints: number
  assignedTo?: any
  dueDate?: Date
  kanbanColumn?: { columnId: string; position: number }
}

interface KanbanBoardProps {
  tasks: Task[]
  onTaskMoved: (taskId: string, columnId: string, position: number) => void
  onTaskClick?: (task: Task) => void
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskMoved,
  onTaskClick
}) => {
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    onTaskMoved(draggableId, destination.droppableId, destination.index)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map(column => {
          const columnTasks = tasks
            .filter(t => t.kanbanColumn?.columnId === column.id)
            .sort((a, b) => (a.kanbanColumn?.position || 0) - (b.kanbanColumn?.position || 0))

          return (
            <KanbanColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              tasks={columnTasks}
              onTaskClick={onTaskClick}
            />
          )
        })}
      </div>
    </DragDropContext>
  )
}

export default KanbanBoard
