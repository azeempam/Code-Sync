# Stage 1: Build the project
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files and install dependencies
COPY package*.json ./

RUN npm ci

# Copy the rest of the source code and build
COPY . .

RUN npm run build

# Stage 2: Serve the dist folder using nginx
FROM nginx:alpine AS runner

# Copy built frontend from builder stage
COPY --from=builder /build/dist /usr/share/nginx/html

# nginx config to handle SPA routing
RUN printf 'server {\n\
    listen 5173;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Expose the port
EXPOSE 5173

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
