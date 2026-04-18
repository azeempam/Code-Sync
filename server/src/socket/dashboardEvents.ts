import { Server, Socket } from 'socket.io'
import Task from '../models/Task'
import ActivityLog from '../models/ActivityLog'
import VelocityMetrics from '../models/VelocityMetrics'
import redis from '../config/redis'
import mongoose from 'mongoose'

export const setupDashboardEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Dashboard client connected: ${socket.id}`)
    const { userId, teamId } = socket.handshake.auth

    // ========== SUBSCRIBE TO UPDATES ==========
    socket.on('dashboard:subscribe', (data: { teamId: string; projectId: string }) => {
      socket.join(`team:${data.teamId}`)
      socket.join(`project:${data.projectId}`)
      console.log(`✅ Socket ${socket.id} subscribed to project:${data.projectId}`)
    })

    // ========== TASK EVENTS ==========

    // Create Task
    socket.on('task:create', async (taskData: any) => {
      try {
        const newTask = await Task.create({
          ...taskData,
          createdBy: userId,
          history: [{
            changedBy: userId,
            timestamp: new Date(),
            changes: { created: true }
          }]
        })

        io.to(`project:${taskData.projectId}`).emit('task:created', {
          task: newTask,
          timestamp: new Date(),
          createdBy: socket.handshake.auth.userName
        })

        await invalidateDashboardCache(taskData.projectId)
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to create task', error: error.message })
      }
    })

    // Update Task Status
    socket.on('task:update', async (taskId: string, updates: any) => {
      try {
        const oldTask = await Task.findById(taskId)
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          {
            ...updates,
            $push: {
              history: {
                changedBy: userId,
                timestamp: new Date(),
                changes: updates
              }
            }
          },
          { new: true }
        )

        if (oldTask && oldTask.status !== updates.status) {
          const statusChangeMessage = `${socket.handshake.auth.userName} moved "${updatedTask?.title}" from ${oldTask.status} to ${updates.status}`

          io.to(`project:${updatedTask?.projectId}`).emit('task:status-changed', {
            taskId,
            oldStatus: oldTask.status,
            newStatus: updates.status,
            task: updatedTask,
            message: statusChangeMessage,
            timestamp: new Date(),
            changedBy: userId
          })

          // Recalculate velocity if task completed
          if (updates.status === 'done') {
            const projectId = updatedTask?.projectId?.toString()
            await recalculateVelocity(projectId)
            io.to(`project:${projectId}`).emit('velocity:updated', {
              projectId: projectId,
              message: '📊 Team velocity updated!'
            })
          }
        }

        await invalidateDashboardCache(updatedTask?.projectId?.toString())
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to update task', error: error.message })
      }
    })

    // Move Task (Kanban Drag & Drop)
    socket.on('task:move', async (taskId: string, columnId: string, position: number, projectId: string) => {
      try {
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          {
            'kanbanColumn.columnId': columnId,
            'kanbanColumn.position': position,
            $push: {
              history: {
                changedBy: userId,
                timestamp: new Date(),
                changes: { columnId, position }
              }
            }
          },
          { new: true }
        )

        io.to(`project:${projectId}`).emit('task:moved', {
          taskId,
          columnId,
          position,
          task: updatedTask,
          timestamp: new Date()
        })

        await invalidateDashboardCache(projectId)
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to move task', error: error.message })
      }
    })

    // Delete Task
    socket.on('task:delete', async (taskId: string, projectId: string) => {
      try {
        await Task.findByIdAndDelete(taskId)

        io.to(`project:${projectId}`).emit('task:deleted', {
          taskId,
          timestamp: new Date()
        })

        await invalidateDashboardCache(projectId)
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to delete task', error: error.message })
      }
    })

    // ========== COLLABORATION EVENTS ==========

    // User starts editing
    socket.on('task:edit:start', (taskId: string) => {
      io.to(`task:${taskId}`).emit('user:editing', {
        userId,
        userName: socket.handshake.auth.userName,
        taskId
      })
      socket.join(`task:${taskId}`)
    })

    // User stops editing
    socket.on('task:edit:end', (taskId: string) => {
      io.to(`task:${taskId}`).emit('user:stopped:editing', { userId, taskId })
    })

    // Add comment
    socket.on('task:comment', async (taskId: string, comment: any) => {
      try {
        const updatedTask = await Task.findByIdAndUpdate(
          taskId,
          {
            $push: {
              comments: {
                _id: new mongoose.Types.ObjectId(),
                author: userId,
                content: comment.content,
                mentions: comment.mentions || [],
                createdAt: new Date()
              }
            }
          },
          { new: true }
        ).populate('comments.author', 'name avatar')

        const lastComment = updatedTask?.comments[updatedTask.comments.length - 1]

        io.to(`task:${taskId}`).emit('comment:added', {
          taskId,
          comment: lastComment,
          timestamp: new Date()
        })
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to add comment', error: error.message })
      }
    })

    // ========== METRICS & DASHBOARD ==========

    socket.on('dashboard:metrics-subscribe', async (projectId: string) => {
      try {
        const metrics = await getVelocityMetrics(projectId)
        socket.emit('dashboard:metrics:initial', metrics)
        socket.join(`dashboard:${projectId}`)
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to fetch metrics', error: error.message })
      }
    })

    // ========== ACTIVITY TRACKING ==========

    socket.on('activity:log', async (activityData: any) => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const log = await ActivityLog.findOneAndUpdate(
          { userId, date: today },
          {
            teamId,
            $push: {
              activities: {
                type: activityData.type,
                startTime: new Date(Date.now() - activityData.duration * 60000),
                endTime: new Date(),
                duration: activityData.duration,
                taskId: activityData.taskId
              }
            }
          },
          { upsert: true, new: true }
        )

        io.to(`team:${teamId}`).emit('activity:tracked', {
          userId,
          type: activityData.type,
          duration: activityData.duration,
          timestamp: new Date()
        })

        await invalidateDashboardCache(activityData.projectId)
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to log activity', error: error.message })
      }
    })

    // ========== PAGINATION ==========

    socket.on('tasks:fetch', async (projectId: string, skip: number, limit: number, filter: any) => {
      try {
        const query = { projectId, ...filter }
        const tasks = await Task.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ 'kanbanColumn.position': 1 })

        const total = await Task.countDocuments(query)

        socket.emit('tasks:batch', {
          tasks,
          total,
          skip,
          limit,
          hasMore: skip + limit < total
        })
      } catch (error: any) {
        socket.emit('error', { message: 'Failed to fetch tasks', error: error.message })
      }
    })

    // ========== CLEANUP ==========

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`)
      io.to(`team:${teamId}`).emit('user:offline', { userId })
    })
  })
}

// ========== HELPER FUNCTIONS ==========

async function invalidateDashboardCache(projectId: string | undefined) {
  if (!projectId) return
  const cacheKey = `dashboard:metrics:${projectId}`
  await redis.del(cacheKey)
}

async function recalculateVelocity(projectId: string | undefined) {
  if (!projectId) return

  try {
    const completedTasks = await Task.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      status: 'done',
      completedAt: { $exists: true }
    })

    const velocity = completedTasks.reduce((sum: number, task: any) => sum + (task.storyPoints || 0), 0)

    await VelocityMetrics.updateOne(
      { projectId: new mongoose.Types.ObjectId(projectId) },
      {
        completed: completedTasks.length,
        velocity,
        updatedAt: new Date()
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('❌ Error recalculating velocity:', error)
  }
}

async function getVelocityMetrics(projectId: string) {
  const cacheKey = `velocity:${projectId}`
  const cached = await redis.get(cacheKey)

  if (cached) return JSON.parse(cached)

  const metrics = await VelocityMetrics.findOne({
    projectId: new mongoose.Types.ObjectId(projectId)
  }).sort({ date: -1 })

  if (metrics) {
    await redis.setex(cacheKey, 300, JSON.stringify(metrics)) // 5 min TTL
  }

  return metrics
}
