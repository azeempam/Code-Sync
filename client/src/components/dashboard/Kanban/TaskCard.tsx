import React from 'react'
import { MdError, MdAccessTime } from 'react-icons/md'
import './TaskCard.css'

interface TaskCardProps {
  task: {
    _id: string
    title: string
    description?: string
    priority: string
    storyPoints?: number
    assignedTo?: { _id: string; name: string; avatar?: string }
    dueDate?: Date
    status: string
  }
  onClick?: () => void
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'critical': '#dc2626',
      'high': '#f97316',
      'medium': '#f59e0b',
      'low': '#10b981'
    }
    return colors[priority] || '#6b7280'
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()

  return (
    <div className="task-card" onClick={onClick}>
      <div className="task-header">
        <h4 className="task-title">{task.title}</h4>
        <div 
          className="priority-badge"
          style={{ backgroundColor: getPriorityColor(task.priority) }}
          title={task.priority}
        />
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-footer">
        <div className="task-meta">
          {task.storyPoints && (
            <span className="story-points">{task.storyPoints} pts</span>
          )}

          {task.assignedTo && (
            <div className="assignee">
              {task.assignedTo.avatar && (
                <img src={task.assignedTo.avatar} alt={task.assignedTo.name} />
              )}
              <span>{task.assignedTo.name}</span>
            </div>
          )}
        </div>

        {task.dueDate && (
          <div className="due-date">
            {isOverdue ? (
              <MdError className="icon overdue" />
            ) : (
              <MdAccessTime className="icon" />
            )}
            <span className={isOverdue ? 'overdue' : ''}>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskCard
