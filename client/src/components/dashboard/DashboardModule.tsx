import { useEffect, useState } from 'react'
import { MdDashboard, MdInsertChart, MdRefresh } from 'react-icons/md'
import KanbanBoard from './Kanban/KanbanBoard'
import { VelocityChart, TaskProgressChart } from './Charts/Charts'
import ActivityStream from './ActivityMonitor/ActivityStream'
import { useDashboardSocket } from '../../hooks/useDashboardSocket'
import useLocalStorage from '../../hooks/useLocalStorage'
import './DashboardModule.css'

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

interface DashboardModuleProps {
  projectId: string
}

interface Metrics {
  burndownData?: any[]
  completed?: number
  velocity?: number
}

const DashboardModule: React.FC<DashboardModuleProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'metrics'>('kanban')
  const [refreshing, setRefreshing] = useState(false)
  const { getItem, setItem } = useLocalStorage()

  const { moveTask, fetchTasks } = useDashboardSocket({
    projectId,
    onTaskCreated: (task) => {
      setTasks(prev => [...prev, task])
    },
    onTaskUpdated: (taskId, updates) => {
      setTasks(prev =>
        prev.map(t => t._id === taskId ? { ...t, ...updates } : t)
      )
    },
    onTaskMoved: (taskId, columnId, position) => {
      setTasks(prev =>
        prev.map(t =>
          t._id === taskId
            ? { ...t, kanbanColumn: { columnId, position } }
            : t
        )
      )
    },
    onMetricsUpdated: (metricsData) => {
      setMetrics(metricsData)
    }
  })

  // Load view preference
  useEffect(() => {
    const savedViewMode = getItem('dashboardViewMode')
    if (savedViewMode) {
      setViewMode(JSON.parse(savedViewMode))
    }
  }, [])

  // Load initial tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await fetchTasks(0, 100, {})
        setTasks((data as any).tasks || [])
        setLoading(false)
      } catch (error) {
        console.error('Failed to load tasks:', error)
        // Load demo data when API fails
        const demoTasks: Task[] = [
          {
            _id: '1',
            title: 'Set up dashboard',
            description: 'Initialize the team dashboard',
            status: 'in-progress',
            priority: 'high',
            storyPoints: 5,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            kanbanColumn: { columnId: 'in-progress', position: 0 }
          },
          {
            _id: '2',
            title: 'Create task management system',
            description: 'Implement CRUD operations',
            status: 'todo',
            priority: 'high',
            storyPoints: 8,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            kanbanColumn: { columnId: 'todo', position: 0 }
          },
          {
            _id: '3',
            title: 'Add real-time updates',
            description: 'Integrate Socket.IO',
            status: 'todo',
            priority: 'medium',
            storyPoints: 13,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            kanbanColumn: { columnId: 'todo', position: 1 }
          },
          {
            _id: '4',
            title: 'Documentation',
            description: 'Write API docs',
            status: 'backlog',
            priority: 'low',
            storyPoints: 3,
            kanbanColumn: { columnId: 'backlog', position: 0 }
          },
          {
            _id: '5',
            title: 'User testing',
            description: 'Conduct UAT sessions',
            status: 'done',
            priority: 'medium',
            storyPoints: 5,
            dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            kanbanColumn: { columnId: 'done', position: 0 }
          }
        ]
        setTasks(demoTasks)
        setLoading(false)
      }
    }

    loadTasks()
  }, [projectId, fetchTasks])

  const handleViewChange = (mode: 'kanban' | 'metrics') => {
    setViewMode(mode)
    setItem('dashboardViewMode', JSON.stringify(mode))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await fetchTasks(0, 100, {})
      setTasks((data as any).tasks || [])
    } finally {
      setRefreshing(false)
    }
  }

  const handleTaskMoved = (taskId: string, columnId: string, position: number) => {
    moveTask(taskId, columnId, position)
  }

  // Prepare chart data
  const taskProgressData = [
    { status: 'Backlog', count: tasks.filter(t => t.status === 'backlog').length },
    { status: 'To Do', count: tasks.filter(t => t.status === 'todo').length },
    { status: 'In Progress', count: tasks.filter(t => t.status === 'in-progress').length },
    { status: 'Review', count: tasks.filter(t => t.status === 'review').length },
    { status: 'Testing', count: tasks.filter(t => t.status === 'testing').length },
    { status: 'Done', count: tasks.filter(t => t.status === 'done').length }
  ]

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dashboard-module">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <div className="header-icon">
            <MdDashboard />
          </div>
          <div className="header-title">
            <h1>Team Dashboard</h1>
            <p className="subtitle">{tasks.length} tasks • {tasks.filter(t => t.status === 'done').length} completed</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => handleViewChange('kanban')}
            title="Kanban Board View"
          >
            📋 Board
          </button>
          <button
            className={`view-btn ${viewMode === 'metrics' ? 'active' : ''}`}
            onClick={() => handleViewChange('metrics')}
            title="Metrics View"
          >
            <MdInsertChart /> Metrics
          </button>
          <button
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh dashboard"
          >
            <MdRefresh />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {viewMode === 'kanban' ? (
          <div className="kanban-view">
            <div className="kanban-section">
              <KanbanBoard
                tasks={tasks}
                onTaskMoved={handleTaskMoved}
              />
            </div>
            <div className="activity-sidebar">
              <ActivityStream projectId={projectId} socket={undefined} />
            </div>
          </div>
        ) : (
          <div className="metrics-view">
            <div className="metrics-grid">
              <div className="metrics-stat">
                <div className="stat-value">{tasks.filter(t => t.status === 'done').length}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="metrics-stat">
                <div className="stat-value">{tasks.filter(t => t.status === 'in-progress').length}</div>
                <div className="stat-label">In Progress</div>
              </div>
              <div className="metrics-stat">
                <div className="stat-value">{metrics?.velocity || 0}</div>
                <div className="stat-label">Velocity</div>
              </div>
              <div className="metrics-stat">
                <div className="stat-value">{tasks.length}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
            </div>

            <div className="charts-section">
              <div className="chart-wrapper">
                <TaskProgressChart data={taskProgressData} />
              </div>
              {metrics?.burndownData && (
                <div className="chart-wrapper">
                  <VelocityChart data={metrics.burndownData} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardModule
