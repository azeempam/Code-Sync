import mongoose, { Schema, Document } from 'mongoose'

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId
  teamId: mongoose.Types.ObjectId
  date: Date
  activities: any[]
  dailyStats: any
  wellness: any
  createdAt: Date
  updatedAt: Date
}

const activitySchema = {
  type: String,
  enum: ['coding', 'meeting', 'review', 'break', 'documentation'],
  startTime: Date,
  endTime: Date,
  duration: Number,
  description: String,
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', sparse: true }
}

// @ts-ignore - Mongoose schema type instantiation issue
const ActivityLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  date: { type: Date, required: true },
  activities: [activitySchema],
  dailyStats: {
    totalDeepWork: { type: Number, default: 0 },
    totalMeetings: { type: Number, default: 0 },
    totalBreaks: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    codeCommits: { type: Number, default: 0 },
    pullRequests: { type: Number, default: 0 }
  },
  wellness: {
    energyLevel: { type: Number, min: 1, max: 10 },
    stressLevel: { type: Number, min: 1, max: 10 },
    focusQuality: { type: Number, min: 1, max: 10 },
    burnoutRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    notes: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Indexes
ActivityLogSchema.index({ userId: 1, date: -1 })
ActivityLogSchema.index({ teamId: 1, date: -1 })

export default mongoose.model('ActivityLog', ActivityLogSchema)
