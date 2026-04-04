# Frontend Dockerfile - Multi-stage build
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps flag for compatibility
RUN npm ci --legacy-peer-deps

# Copy app source
COPY . .

# Build the application
RUN npm run build

# Production stage - Serve with nginx
FROM nginx:alpine

# Copy built files from builder stage (includes HtmlWebpackPlugin-generated index.html)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
