import { Server } from 'socket.io'
import { healthMonitor } from '../services/HealthMonitor'

let metricsInterval: NodeJS.Timeout | null = null

export const setupHealthMonitorEvents = (io: Server) => {
  io.on('connection', (socket) => {
    console.log(`🏥 Health monitor client connected: ${socket.id}`)

    socket.on('health:subscribe', () => {
      socket.join('health-monitoring')
      console.log(`✅ Socket subscribed to health metrics`)
      const metrics = healthMonitor.getMetrics()
      socket.emit('health:metrics', metrics)
    })

    socket.on('health:unsubscribe', () => {
      socket.leave('health-monitoring')
      console.log(`❌ Socket unsubscribed`)
    })

    socket.on('health:request', () => {
      const metrics = healthMonitor.getMetrics()
      socket.emit('health:metrics', metrics)
    })
  })

  startHealthMetricsInterval(io)
}

function startHealthMetricsInterval(io: Server, interval: number = 2000) {
  if (metricsInterval) clearInterval(metricsInterval)

  metricsInterval = setInterval(() => {
    const metrics = healthMonitor.getMetrics()
    io.to('health-monitoring').emit('health:metrics', metrics)
    
    if (metrics.alerts.some(a => a.level === 'critical')) {
      io.to('health-monitoring').emit('health:alert', {
        severity: 'critical',
        alerts: metrics.alerts.filter(a => a.level === 'critical')
      })
    }
    
    healthMonitor.clearOldAlerts()
  }, interval)
}

export function stopHealthMetricsInterval() {
  if (metricsInterval) {
    clearInterval(metricsInterval)
    metricsInterval = null
  }
}
