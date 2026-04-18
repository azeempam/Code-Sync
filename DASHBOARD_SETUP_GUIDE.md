# Dashboard Setup - Required Dependencies & Configuration

## 🚀 Step 1: Install Dependencies

### Server Side
```bash
cd server
npm install mongoose redis socket.io
npm install --save-dev @types/node @types/express-serve-static-core
```

### Client Side  
```bash
cd client
npm install react-beautiful-dnd recharts
npm install --save-dev @types/react-beautiful-dnd
```

## 📋 Step 2: Update Server Configuration

### In `server/src/server.ts`:

Add these imports and setup:
```typescript
import { setupDashboardEvents } from './socket/dashboardEvents'
import dashboardRoutes from './routes/dashboard'

// After initializing Socket.IO
setupDashboardEvents(io)

// Register dashboard routes BEFORE other routes
app.use('/api/dashboard', dashboardRoutes)
```

### In `server/tsconfig.json`:

Ensure these settings are present:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🎨 Step 3: Update Client Configuration

### In `client/src/App.tsx`:

```typescript
import DashboardModule from './components/dashboard/DashboardModule'

export default function App() {
  const [activeProjectId] = useState('your-project-id')

  return (
    <div className="app-layout">
      {/* Your existing components */}
      
      {/* Add Dashboard Module */}
      <aside className="dashboard-panel">
        <DashboardModule projectId={activeProjectId} />
      </aside>
    </div>
  )
}
```

### In `client/tsconfig.json`:

Ensure these settings:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": false,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noImplicitAny": false
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## 🔐 Step 4: Socket.IO Authentication Setup

### In your Socket Context (`client/src/context/SocketContext.tsx`):

Make sure authentication is properly set:
```typescript
const socket = io('http://localhost:3000', {
  auth: {
    userId: currentUser.id,
    teamId: currentUser.teamId,
    userName: currentUser.name,
    token: authToken
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
})
```

## 📁 Step 5: File Structure Verification

Ensure these files exist:

```
server/
├── src/
│   ├── models/
│   │   ├── Task.ts ✅
│   │   ├── ActivityLog.ts ✅
│   │   └── VelocityMetrics.ts ✅
│   ├── routes/
│   │   └── dashboard.ts ✅
│   ├── socket/
│   │   └── dashboardEvents.ts ✅
│   ├── config/
│   │   └── redis.ts ✅
│   └── server.ts (needs update)

client/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── DashboardModule.tsx ✅
│   │       ├── DashboardModule.css ✅
│   │       ├── Kanban/
│   │       │   ├── KanbanBoard.tsx ✅
│   │       │   ├── KanbanColumn.tsx ✅
│   │       │   ├── TaskCard.tsx ✅
│   │       │   ├── KanbanBoard.css ✅
│   │       │   ├── TaskCard.css ✅
│   │       │   └── index.css ✅
│   │       ├── Charts/
│   │       │   ├── Charts.tsx ✅
│   │       │   └── Charts.css ✅
│   │       └── ActivityMonitor/
│   │           ├── ActivityStream.tsx ✅
│   │           └── ActivityStream.css ✅
│   └── hooks/
│       └── useDashboardSocket.ts ✅
```

## ✅ Step 6: Verify Setup

After installation and configuration:

1. **Check server errors:**
   ```bash
   cd server
   npm run build
   ```

2. **Check client errors:**
   ```bash
   cd client
   npm run build
   ```

3. **Run development servers:**
   ```bash
   # Terminal 1 - Server
   cd server && npm run dev
   
   # Terminal 2 - Client
   cd client && npm run dev
   ```

## 🐛 Troubleshooting

### "Cannot find module 'mongoose'"
- Run: `npm install mongoose`
- Check `server/package.json` has mongoose listed

### "Cannot find module 'react-beautiful-dnd'"
- Run: `npm install react-beautiful-dnd @types/react-beautiful-dnd`
- Check `client/package.json`

### Socket.IO connection issues
- Verify `setupDashboardEvents` is called in `server.ts`
- Check Socket.IO is properly initialized
- Verify auth credentials are being passed

### Type errors after install
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear TypeScript cache: `rm -rf dist`
- Restart dev server

## 📦 Complete Dependencies List

### Server (`server/package.json`)
```json
{
  "dependencies": {
    "mongoose": "^7.0.0",
    "redis": "^4.6.0",
    "socket.io": "^4.5.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0"
  }
}
```

### Client (`client/package.json`)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-beautiful-dnd": "^13.1.1",
    "recharts": "^2.7.0",
    "react-icons": "^4.9.0",
    "socket.io-client": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-beautiful-dnd": "^13.1.2"
  }
}
```

After completing these steps, all compilation errors should be resolved! ✨
