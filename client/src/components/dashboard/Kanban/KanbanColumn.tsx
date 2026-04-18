import React from 'react'
import { Droppable, Draggable } from 'react-beautiful-dnd'
import TaskCard from './TaskCard.tsx'
import './KanbanBoard.css'

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

interface KanbanColumnProps {
  columnId: string
  title: string
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  columnId,
  title,
  tasks,
  onTaskClick
}) => {

  const getColumnColor = (columnId: string) => {
    const colors: Record<string, string> = {
      'backlog': '#64748b',
      'todo': '#f59e0b',
      'in-progress': '#3b82f6',
      'review': '#8b5cf6',
      'testing': '#ec4899',
      'done': '#10b981'
    }
    return colors[columnId] || '#6b7280'
  }

  return (
    <div className="kanban-column" style={{ borderTopColor: getColumnColor(columnId) }}>
      <div className="column-header">
        <h3>{title}</h3>
        <span className="task-count">{tasks.length}</span>
      </div>

      <Droppable droppableId={columnId} type="TASK">
        {(provided: any, snapshot: any) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-content ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
          >
            {tasks.map((task, index) => (
              <Draggable key={task._id} draggableId={task._id} index={index}>
                {(provided: any, snapshot: any) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={snapshot.isDragging ? 'dragging' : ''}
                  >
                    <TaskCard 
                      task={task} 
                      onClick={() => onTaskClick?.(task)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default KanbanColumn
