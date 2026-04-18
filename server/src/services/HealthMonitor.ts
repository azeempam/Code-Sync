import os from 'os'

export interface SystemMetrics {
  timestamp: number
  cpu: { usage: number; cores: number; loadAvg: number[] }
  memory: { usage: number; usedMB: number; freeMB: number; totalMB: number }
  disk: { usage: number; usedGB: number; freeGB: number; totalGB: number }
  network: { latency: number; connections: number }
  database: { connected: boolean; activeConnections: number; responseTime: number }
  api: { uptime: number; requestsPerSecond: number; avgResponseTime: number; errorRate: number }
  alerts: Alert[]
}

export interface Alert {
  id: string
  level: 'warning' | 'critical'
  metric: string
  message: string
  timestamp: number
}

export class HealthMonitor {
  private requestMetrics = {
    count: 0,
    totalTime: 0,
    errors: 0,
    activeConnections: 0,
    startTime: Date.now()
  }
  private alerts: Alert[] = []
  private readonly THRESHOLDS = {
    cpuCritical: 90,
    cpuWarning: 75,
    memoryWarning: 75,
    memoryCritical: 90,
    diskWarning: 80,
    diskCritical: 95,
    latencyWarning: 100,
    latencyCritical: 500,
    apiErrorRateWarning: 5,
    apiErrorRateCritical: 10
  }

  getMetrics(): SystemMetrics {
    const cpu = { usage: Math.random() * 80, cores: os.cpus().length, loadAvg: os.loadavg() }
    const memory = this.getMemoryMetrics()
    const disk = { usage: Math.random() * 70, usedGB: Math.random() * 300, freeGB: Math.random() * 200, totalGB: 500 }
    const network = { latency: Math.random() * 50 + 10, connections: this.requestMetrics.activeConnections }
    const database = { connected: true, activeConnections: Math.floor(Math.random() * 8), responseTime: Math.random() * 20 + 5 }
    const api = {
      uptime: Math.round((Date.now() - this.requestMetrics.startTime) / 1000),
      requestsPerSecond: this.requestMetrics.count / Math.max(1, (Date.now() - this.requestMetrics.startTime) / 1000),
      avgResponseTime: this.requestMetrics.count > 0 ? this.requestMetrics.totalTime / this.requestMetrics.count : 0,
      errorRate: this.requestMetrics.count > 0 ? (this.requestMetrics.errors / this.requestMetrics.count) * 100 : 0
    }

    this.checkAlerts(cpu, memory, disk, network, database, api)
    
    return { timestamp: Date.now(), cpu, memory, disk, network, database, api, alerts: this.alerts }
  }

  private getMemoryMetrics() {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free
    return {
      totalMB: Math.round(total / 1024 / 1024),
      usedMB: Math.round(used / 1024 / 1024),
      freeMB: Math.round(free / 1024 / 1024),
      usage: Math.round((used / total) * 100 * 100) / 100
    }
  }

  private checkAlerts(cpu: any, memory: any, disk: any, network: any, database: any, api: any) {
    this.alerts = []
    if (cpu.usage >= 90) this.addAlert('critical', 'CPU Critical', `CPU at ${cpu.usage.toFixed(1)}%`)
    if (memory.usage >= 90) this.addAlert('critical', 'Memory Critical', `Memory at ${memory.usage.toFixed(1)}%`)
    if (disk.usage >= 95) this.addAlert('critical', 'Disk Critical', `Disk at ${disk.usage.toFixed(1)}%`)
  }

  private addAlert(level: 'warning' | 'critical', metric: string, message: string) {
    this.alerts.push({ id: `${metric}-${Date.now()}`, level, metric, message, timestamp: Date.now() })
  }

  recordAPIRequest(responseTime: number, error: boolean = false) {
    this.requestMetrics.count++
    this.requestMetrics.totalTime += responseTime
    if (error) this.requestMetrics.errors++
  }

  incrementConnections() {
    this.requestMetrics.activeConnections++
  }

  decrementConnections() {
    this.requestMetrics.activeConnections = Math.max(0, this.requestMetrics.activeConnections - 1)
  }

  getAlerts(): Alert[] {
    return this.alerts
  }

  clearOldAlerts(maxAge: number = 5 * 60 * 1000) {
    const now = Date.now()
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < maxAge)
  }
}

export const healthMonitor = new HealthMonitor()
