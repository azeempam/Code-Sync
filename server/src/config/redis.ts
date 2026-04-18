// Stub Redis configuration - Replace with actual Redis connection when available
// For development, this provides a mock interface

const redis = {
  del: async (key: string) => {
    // Mock implementation
    return Promise.resolve()
  },
  get: async (key: string) => {
    // Mock implementation
    return Promise.resolve(null)
  },
  setex: async (key: string, ttl: number, value: string) => {
    // Mock implementation
    return Promise.resolve()
  }
}

export default redis
