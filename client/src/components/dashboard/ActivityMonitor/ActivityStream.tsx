import React, { useEffect, useState } from 'react'
import { MdCheckCircle, MdEdit, MdComment, MdAccessTime } from 'react-icons/md'
import './ActivityStream.css'

interface Activity {
  id: string
  type: 'task-created' | 'task-updated' | 'comment' | 'activity-logged'
  user: string
  message: string
  timestamp: Date
  icon: React.ReactNode
  avatar?: string
}

interface ActivityStreamProps {
  projectId: string
  socket?: any
}

const ActivityStream: React.FC<ActivityStreamProps> = ({ socket }) => {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (!socket) return

    const addActivity = (activity: Omit<Activity, 'id'>) => {
      const newActivity: Activity = {
        ...activity,
        id: Math.random().toString(36)
      }
      setActivities(prev => [newActivity, ...prev].slice(0, 30))
    }

    socket.on('task:created', (data: any) => {
      addActivity({
        type: 'task-created',
        user: data.createdBy,
        message: `created task: ${data.task.title}`,
        icon: <MdCheckCircle className="icon icon-create" />,
        timestamp: new Date()
      })
    })

    socket.on('task:status-changed', (data: any) => {
      addActivity({
        type: 'task-updated',
        user: data.changedBy,
        message: `moved task to ${data.newStatus}`,
        icon: <MdEdit className="icon icon-update" />,
        timestamp: new Date()
      })
    })

    socket.on('comment:added', (data: any) => {
      addActivity({
        type: 'comment',
        user: data.comment?.author?.name || 'Unknown',
        message: `commented on task`,
        icon: <MdComment className="icon icon-comment" />,
        timestamp: new Date()
      })
    })

    socket.on('activity:tracked', (data: any) => {
      addActivity({
        type: 'activity-logged',
        user: data.userId,
        message: `logged ${data.duration}min of ${data.type}`,
        icon: <MdAccessTime className="icon icon-activity" />,
        timestamp: new Date()
      })
    })

    return () => {
      socket.off('task:created')
      socket.off('task:status-changed')
      socket.off('comment:added')
      socket.off('activity:tracked')
    }
  }, [socket])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="activity-stream">
      <div className="activity-header">
        <h3>Recent Activity</h3>
        <span className="activity-count">{activities.length}</span>
      </div>

      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="empty-state">
            <p>No activity yet</p>
            <p className="subtext">Start working on tasks or logging activities</p>
          </div>
        ) : (
          activities.map(activity => (
            <div key={activity.id} className={`activity-item activity-${activity.type}`}>
              <div className="activity-icon">
                {activity.icon}
              </div>
              <div className="activity-content">
                <p className="activity-message">
                  <span className="user">{activity.user}</span>
                  <span className="message">{activity.message}</span>
                </p>
                <span className="activity-time">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ActivityStream
