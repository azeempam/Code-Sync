import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import './Charts.css'

interface BurndownPoint {
  date: string
  remainingPoints: number
  completedPoints: number
  idealLine: number
}

interface VelocityChartProps {
  data: BurndownPoint[]
}

export const VelocityChart: React.FC<VelocityChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No velocity data available</div>
  }

  return (
    <div className="chart-container">
      <h3>Sprint Burndown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '4px'
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="remainingPoints"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Remaining"
            dot={{ fill: '#3b82f6', r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="idealLine"
            stroke="#10b981"
            strokeDasharray="5 5"
            strokeWidth={2}
            name="Ideal"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TaskProgressPoint {
  status: string
  count: number
}

interface TaskProgressChartProps {
  data: TaskProgressPoint[]
}

export const TaskProgressChart: React.FC<TaskProgressChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No progress data available</div>
  }

  return (
    <div className="chart-container">
      <h3>Task Status Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis dataKey="status" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '4px'
            }}
          />
          <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface VelocityTrendPoint {
  week: string
  velocity: number
  average: number
}

interface VelocityTrendChartProps {
  data: VelocityTrendPoint[]
}

export const VelocityTrendChart: React.FC<VelocityTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No velocity trend data available</div>
  }

  return (
    <div className="chart-container">
      <h3>Team Velocity Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis dataKey="week" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '4px'
            }}
          />
          <Legend />
          <Bar dataKey="velocity" fill="#3b82f6" name="Sprint Velocity" />
          <Line
            type="monotone"
            dataKey="average"
            stroke="#10b981"
            strokeDasharray="5 5"
            name="Average"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
