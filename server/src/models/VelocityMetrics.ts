import mongoose, { Schema, Document } from 'mongoose'

export interface IVelocityMetrics extends Document {
  projectId: mongoose.Types.ObjectId
  sprintNumber: number
  weekNumber: number
  date: Date
  completed: number
  inProgress: number
  blocked: number
  totalPoints: number
  velocity: number
  burndownData: Array<{
    date: Date
    remainingPoints: number
    completedPoints: number
    idealLine: number
  }>
  updatedAt: Date
}

// @ts-ignore - Mongoose schema type instantiation issue
const VelocityMetricsSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  sprintNumber: { type: Number, required: true },
  weekNumber: { type: Number },
  date: { type: Date, default: Date.now },
  completed: { type: Number, default: 0 },
  inProgress: { type: Number, default: 0 },
  blocked: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  velocity: { type: Number, default: 0 },
  burndownData: [{
    date: Date,
    remainingPoints: Number,
    completedPoints: Number,
    idealLine: Number
  }],
  updatedAt: { type: Date, default: Date.now }
})

// Indexes
VelocityMetricsSchema.index({ projectId: 1, sprintNumber: 1 })
VelocityMetricsSchema.index({ projectId: 1, date: -1 })

export default mongoose.model('VelocityMetrics', VelocityMetricsSchema)
