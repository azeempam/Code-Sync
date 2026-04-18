import express from 'express'
import { healthMonitor } from '../services/HealthMonitor'

const router = express.Router()

router.get('/metrics', (_req, res) => {
  try {
    const metrics = healthMonitor.getMetrics()
    res.json(metrics)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/status', (_req, res) => {
  try {
    const metrics = healthMonitor.getMetrics()
    const hasCritical = metrics.alerts.some(a => a.level === 'critical')
    const hasWarning = metrics.alerts.some(a => a.level === 'warning')
    const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy'

    res.json({
      status,
      timestamp: metrics.timestamp,
      cpu: { usage: metrics.cpu.usage, cores: metrics.cpu.cores },
      memory: { usage: metrics.memory.usage, usedMB: metrics.memory.usedMB, totalMB: metrics.memory.totalMB },
      disk: { usage: metrics.disk.usage, freeGB: metrics.disk.freeGB, totalGB: metrics.disk.totalGB },
      api: { uptime: metrics.api.uptime, requestsPerSecond: metrics.api.requestsPerSecond, avgResponseTime: metrics.api.avgResponseTime, errorRate: metrics.api.errorRate },
      alertsCount: { critical: metrics.alerts.filter(a => a.level === 'critical').length, warning: metrics.alerts.filter(a => a.level === 'warning').length }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/alerts', (_req, res) => {
  try {
    const alerts = healthMonitor.getAlerts()
    res.json({
      total: alerts.length,
      critical: alerts.filter(a => a.level === 'critical').length,
      warning: alerts.filter(a => a.level === 'warning').length,
      alerts
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/check', (_req, res) => {
  res.json({ status: 'up', timestamp: Date.now() })
})

export default router
