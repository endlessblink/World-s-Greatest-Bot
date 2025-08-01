# Use the official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S discordbot -u 1001

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY . .

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chown -R discordbot:nodejs /app

# Switch to non-root user
USER discordbot

# Expose port for web dashboard (using PORT env var)
EXPOSE 8742

# Health check - use PORT env var or default to 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const port = process.env.PORT || 3000; require('http').get('http://127.0.0.1:' + port + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]