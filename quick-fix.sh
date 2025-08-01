#!/bin/bash

echo "🔧 Quick fix for WorldsGreatestBot..."

# Stop and remove current container
docker stop discoord-bot
docker rm discoord-bot

# Rebuild image with fixes
echo "🔨 Building updated image..."
docker build -t worldsgreatestbot-discoord-bot .

# Run with current .env - map to correct internal port
echo "🚀 Starting bot..."
docker run -d \
  --name discoord-bot \
  -p 3049:8742 \
  --env-file .env \
  --restart unless-stopped \
  worldsgreatestbot-discoord-bot

# Wait for startup
sleep 5

# Show status
echo ""
echo "✅ Bot restarted with fixes!"
echo ""
docker ps --filter "name=discoord-bot" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "📝 Recent logs:"
docker logs discoord-bot --tail 10