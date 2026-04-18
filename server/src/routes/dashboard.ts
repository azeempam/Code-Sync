import express, { Request, Response, NextFunction } from 'express'
import Task from '../models/Task'
import VelocityMetrics from '../models/VelocityMetrics'
import ActivityLog from '../models/ActivityLog'
import mongoose from 'mongoose'

const router = express.Router()

// Middleware to verify team access
const verifyTeamAccess = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params
    // Verify user has access to this project
    // Implementation depends on your User/Project model structure
    next()
  } catch (error) {
    res.status(403).json({ error: 'Access denied' })
  }
}

// ========== GET ENDPOINTS ==========

// Get all tasks for a project
router.get('/projects/:projectId/tasks', verifyTeamAccess, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { projectId } = req.params
    const { status, assignedTo, skip = 0, limit = 50 } = req.query

    const filter: any = { projectId: new mongoose.Types.ObjectId(projectId as string) }
    if (status) filter.status = status
    if (assignedTo) filter.assignedTo = new mongoose.Types.ObjectId(assignedTo as string)

    const tasks = await Task.find(filter)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ 'kanbanColumn.position': 1 })
      .populate('assignedTo', 'name avatar')
      .populate('comments.author', 'name avatar')

    const total = await Task.countDocuments(filter)

    res.json({
      tasks,
      total,
      skip: Number(skip),
      limit: Number(limit),
      hasMore: Number(skip) + Number(limit) < total
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single task
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const task = await Task.findById(taskId)
      .populate('assignedTo', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('comments.author', 'name avatar')
      .populate('collaborators', 'name avatar')

    if (!task) return res.status(404).json({ error: 'Task not found' })

    res.json(task)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get velocity metrics
router.get('/projects/:projectId/metrics', verifyTeamAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const metrics = await VelocityMetrics.findOne({
      projectId: new mongoose.Types.ObjectId(projectId as string)
    }).sort({ date: -1 })

    if (!metrics) return res.status(404).json({ error: 'No metrics found' })

    res.json(metrics)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get activity logs for a user
router.get('/activity-logs/:userId', async (req: Request & { user?: any }, res: Response) => {
  try {
    const { userId } = req.params
    const { days = 7 } = req.query

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Number(days))

    const logs = await ActivityLog.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: startDate }
    }).sort({ date: -1 })

    res.json(logs)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ========== POST ENDPOINTS ==========

// Create task
router.post('/projects/:projectId/tasks', verifyTeamAccess, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { projectId } = req.params
    const { title, description, assignedTo, priority, storyPoints, dueDate } = req.body

    if (!title) return res.status(400).json({ error: 'Title is required' })

    const newTask = await Task.create({
      projectId: new mongoose.Types.ObjectId(projectId as string),
      title,
      description,
      assignedTo,
      priority,
      storyPoints,
      dueDate,
      createdBy: req.user?.id,
      status: 'todo',
      kanbanColumn: { columnId: 'todo', position: 0 },
      history: [{
        changedBy: req.user?.id,
        timestamp: new Date(),
        changes: { created: true }
      }]
    })

    await newTask.populate('assignedTo', 'name avatar')

    res.status(201).json(newTask)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ========== PUT ENDPOINTS ==========

// Update task
router.put('/tasks/:taskId', async (req: Request & { user?: any }, res: Response) => {
  try {
    const { taskId } = req.params
    const updates = req.body

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        ...updates,
        $push: {
          history: {
            changedBy: req.user?.id,
            timestamp: new Date(),
            changes: updates
          }
        }
      },
      { new: true }
    ).populate('assignedTo', 'name avatar')

    res.json(updatedTask)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ========== DELETE ENDPOINTS ==========

// Delete task
router.delete('/tasks/:taskId', async (req: Request & { user?: any }, res: Response) => {
  try {
    const { taskId } = req.params

    await Task.findByIdAndDelete(taskId)

    res.json({ message: 'Task deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
