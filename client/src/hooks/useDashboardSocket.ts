import { useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'

interface UseDashboardSocketProps {
  projectId: string
  onTaskCreated?: (task: any) => void
  onTaskUpdated?: (taskId: string, updates: any) => void
  onTaskMoved?: (taskId: string, columnId: string, position: number) => void
  onMetricsUpdated?: (metrics: any) => void
}

export const useDashboardSocket = ({
  projectId,
  onTaskCreated,
  onTaskUpdated,
  onTaskMoved,
  onMetricsUpdated
}: UseDashboardSocketProps) => {
  const { socket } = useSocket()
  const subscriptionRef = useRef<boolean>(false)

  // Subscribe to dashboard
  useEffect(() => {
    if (!socket || !projectId || subscriptionRef.current) return

    console.log('📡 Subscribing to dashboard for project:', projectId)
    socket.emit('dashboard:subscribe', { projectId })
    socket.emit('dashboard:metrics-subscribe', projectId)
    subscriptionRef.current = true

    return () => {
      subscriptionRef.current = false
    }
  }, [socket, projectId])

  // Listen for task events
  useEffect(() => {
    if (!socket) return

    socket.on('task:created', (data: any) => {
      console.log('✨ Task created:', data.task.title)
      onTaskCreated?.(data.task)
    })

    socket.on('task:status-changed', (data: any) => {
      console.log('📋 Task updated:', data.message)
      onTaskUpdated?.(data.taskId, { status: data.newStatus })
    })

    socket.on('task:moved', (data: any) => {
      console.log('🎯 Task moved to column:', data.columnId)
      onTaskMoved?.(data.taskId, data.columnId, data.position)
    })

    socket.on('dashboard:metrics:initial', (metrics: any) => {
      console.log('📊 Metrics loaded')
      onMetricsUpdated?.(metrics)
    })

    socket.on('velocity:updated', (_data: any) => {
      console.log('📈 Velocity updated')
      socket.emit('dashboard:metrics-subscribe', projectId)
    })

    return () => {
      socket.off('task:created')
      socket.off('task:status-changed')
      socket.off('task:moved')
      socket.off('dashboard:metrics:initial')
      socket.off('velocity:updated')
    }
  }, [socket, onTaskCreated, onTaskUpdated, onTaskMoved, onMetricsUpdated, projectId])

  // Emit task update
  const updateTask = useCallback((taskId: string, updates: any) => {
    socket?.emit('task:update', taskId, updates)
  }, [socket])

  // Emit task move
  const moveTask = useCallback((taskId: string, columnId: string, position: number) => {
    socket?.emit('task:move', taskId, columnId, position, projectId)
  }, [socket, projectId])

  // Emit activity log
  const logActivity = useCallback((type: string, duration: number, taskId?: string) => {
    socket?.emit('activity:log', { type, duration, taskId, projectId })
  }, [socket, projectId])

  // Fetch tasks
  const fetchTasks = useCallback((skip = 0, limit = 50, filter = {}) => {
    return new Promise((resolve) => {
      socket?.once('tasks:batch', (data: any) => {
        resolve(data)
      })
      socket?.emit('tasks:fetch', projectId, skip, limit, filter)
    })
  }, [socket, projectId])

  return {
    updateTask,
    moveTask,
    logActivity,
    fetchTasks
  }
}
