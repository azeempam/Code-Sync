# Stage 1: Build the project
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files and install all dependencies (including dev)
COPY package*.json ./

RUN npm ci

# Copy the rest of the source code and build the project
COPY . .

RUN npm run build

# Stage 2: Production image — only runtime deps
FROM node:18-alpine AS runner

WORKDIR /app

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and static files from builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/public ./public

# Expose the port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]