import mongoose, { Schema, Document } from 'mongoose'

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId
  title: string
  description: string
  assignedTo: mongoose.Types.ObjectId
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'testing' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  storyPoints: number
  actualHours?: number
  estimatedHours?: number
  kanbanColumn: {
    columnId: string
    position: number
  }
  dueDate?: Date
  completedAt?: Date
  dependencies: mongoose.Types.ObjectId[]
  blockedBy: mongoose.Types.ObjectId[]
  collaborators: mongoose.Types.ObjectId[]
  attachments: Array<{
    url: string
    type: string
    uploadedBy: mongoose.Types.ObjectId
    uploadedAt: Date
  }>
  comments: Array<{
    _id: mongoose.Types.ObjectId
    author: mongoose.Types.ObjectId
    content: string
    mentions: mongoose.Types.ObjectId[]
    createdAt: Date
    updatedAt: Date
  }>
  history: Array<{
    changedBy: mongoose.Types.ObjectId
    timestamp: Date
    changes: Record<string, any>
  }>
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

// @ts-ignore - Mongoose schema type instantiation issue
const TaskSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['backlog', 'todo', 'in-progress', 'review', 'testing', 'done', 'blocked'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  storyPoints: { type: Number, min: 1 },
  actualHours: { type: Number },
  estimatedHours: { type: Number },
  kanbanColumn: {
    columnId: String,
    position: Number
  },
  dueDate: { type: Date, sparse: true },
  completedAt: { type: Date, sparse: true },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  blockedBy: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  attachments: [{
    url: String,
    type: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  comments: [{
    _id: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: String,
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
  }],
  history: [{
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    changes: Schema.Types.Mixed
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Indexes for performance
TaskSchema.index({ projectId: 1, status: 1 })
TaskSchema.index({ assignedTo: 1, status: 1 })
TaskSchema.index({ projectId: 1, 'kanbanColumn.columnId': 1, 'kanbanColumn.position': 1 })
TaskSchema.index({ completedAt: 1 }, { sparse: true })
TaskSchema.index({ dueDate: 1 }, { sparse: true })

export default mongoose.model('Task', TaskSchema)
