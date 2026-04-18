# Team Productivity Dashboard Integration Guide

## Installation Steps

### 1. Install Required Dependencies

```bash
cd client
npm install react-beautiful-dnd recharts
npm install --save-dev @types/react-beautiful-dnd

cd ../server
npm install mongoose redis
```

### 2. Update Server Configuration

#### In `server/src/server.ts`:

```typescript
import { setupDashboardEvents } from './socket/dashboardEvents'

// After initializing Socket.IO
setupDashboardEvents(io)

// Register dashboard routes
app.use('/api/dashboard', dashboardRoutes)
```

#### In `server/src/routes/index.ts`:

```typescript
import dashboardRoutes from './dashboard'

app.use('/api', dashboardRoutes)
```

### 3. Update Client Configuration

#### In `client/src/App.tsx`:

```typescript
import DashboardModule from './components/dashboard/DashboardModule'

function App() {
  const [activeProjectId, setActiveProjectId] = useState('your-project-id')

  return (
    <div className="app-layout">
      {/* Your existing components */}
      
      {/* Add Dashboard Module */}
      <div className="dashboard-container">
        <DashboardModule projectId={activeProjectId} />
      </div>
    </div>
  )
}
```

### 4. Update Socket Context

Ensure your Socket context properly authenticates with dashboard events:

```typescript
// In client/src/context/SocketContext.tsx
socket.emit('dashboard:subscribe', {
  teamId: user.teamId,
  projectId: activeProjectId
})
```

## Features Overview

### ✅ Kanban Board
- Drag & drop tasks between columns
- Real-time updates across team members
- Priority color indicators
- Story points display
- Assignee avatars
- Due date warnings

### ✅ Velocity Metrics
- Sprint burndown chart
- Task status distribution
- Team velocity trends
- Completed vs. ideal line comparison

### ✅ Activity Stream
- Real-time task updates
- Comment notifications
- Activity logging
- User engagement tracking

### ✅ Real-time Sync
- Instant task creation notifications
- Live status changes
- Collaborative editing indicators
- Activity stream updates

## API Endpoints

### Tasks
- `GET /api/dashboard/projects/:projectId/tasks` - Fetch tasks with pagination
- `POST /api/dashboard/projects/:projectId/tasks` - Create new task
- `PUT /api/dashboard/tasks/:taskId` - Update task
- `DELETE /api/dashboard/tasks/:taskId` - Delete task

### Metrics
- `GET /api/dashboard/projects/:projectId/metrics` - Get velocity metrics

### Activity Logs
- `GET /api/dashboard/activity-logs/:userId` - Get user activity

## Socket.IO Events

### Emit Events
- `dashboard:subscribe` - Subscribe to project updates
- `task:create` - Create task
- `task:update` - Update task status
- `task:move` - Move task to different column
- `task:delete` - Delete task
- `task:edit:start` - Indicate user editing
- `task:edit:end` - Indicate user stopped editing
- `task:comment` - Add comment to task
- `activity:log` - Log user activity
- `tasks:fetch` - Fetch tasks with filters

### Listen Events
- `task:created` - Task was created
- `task:status-changed` - Task status updated
- `task:moved` - Task moved to new column
- `task:deleted` - Task was deleted
- `comment:added` - Comment added to task
- `dashboard:metrics:initial` - Initial metrics loaded
- `velocity:updated` - Velocity recalculated
- `activity:tracked` - Activity was logged

## Data Flow

```
User Action
    ↓
React Component
    ↓
Socket.IO Event Emit
    ↓
Backend Socket Handler
    ↓
Database Update + Cache Invalidation
    ↓
Broadcast to Team via Socket.IO
    ↓
Real-time UI Update
```

## Performance Optimization

### Caching Strategy
- Dashboard metrics cached for 5 minutes
- Velocity metrics cached for 5 minutes
- Real-time cache invalidation on updates

### Pagination
- Tasks loaded in batches of 50
- Lazy loading for infinite scroll
- Efficient querying with indexes

### Database Indexes
```javascript
// Created automatically by models
tasks: { projectId, status }
tasks: { assignedTo, status }
tasks: { projectId, kanbanColumn }
activityLogs: { userId, date }
velocityMetrics: { projectId, sprintNumber }
```

## Customization

### Adding New Columns
Edit `client/src/components/dashboard/Kanban/KanbanBoard.tsx`:

```typescript
const COLUMNS = [
  { id: 'custom-column', title: 'Custom Status' },
  // ... other columns
]
```

### Styling
All components use CSS modules. Modify theme colors in respective `.css` files:

- `DashboardModule.css` - Main layout
- `KanbanBoard.css` - Board styling
- `TaskCard.css` - Card styling
- `Charts.css` - Chart styling
- `ActivityStream.css` - Activity feed styling

### Chart Configuration
Modify chart data in `DashboardModule.tsx`:

```typescript
const taskProgressData = [
  { status: 'Custom', count: tasks.filter(t => ...).length }
]
```

## Security Considerations

### Authentication
- All endpoints require JWT token
- Team isolation via `teamId` verification
- Project-level access control

### Data Validation
- Input validation on server
- WebSocket message authentication
- SQL injection prevention via Mongoose

### Rate Limiting
Consider adding rate limiting for:
- Task creation (max 100/hour per user)
- Activity logging (max 1000/hour per user)
- Metrics queries (max 300/hour per team)

## Troubleshooting

### Tasks not updating in real-time
- Check Socket.IO connection status
- Verify `dashboard:subscribe` event sent
- Check browser console for errors

### Charts not displaying
- Verify Recharts installed: `npm list recharts`
- Check metrics data format
- Ensure data array is not empty

### Performance issues
- Check MongoDB indexes created
- Verify Redis cache configured
- Monitor WebSocket message frequency

## Next Steps

1. Add user authentication if not present
2. Implement team management
3. Add sprint configuration
4. Create user roles and permissions
5. Add email notifications
6. Implement API rate limiting
7. Add analytics tracking
8. Create mobile responsive design

## Support

For issues or questions:
1. Check the Socket.IO event handlers in `/server/src/socket/dashboardEvents.ts`
2. Review API endpoints in `/server/src/routes/dashboard.ts`
3. Check React components in `/client/src/components/dashboard/`
