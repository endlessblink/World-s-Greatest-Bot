#!/bin/bash

echo "🔧 Fixing WorldsGreatestBot container issues..."

# Check current channel ID
echo "Current SCHEDULED_POST_CHANNEL_ID: 1368701854648762400"
echo ""
echo "⚠️  This channel ID is causing 'Unknown Channel' errors."
echo "Please verify the correct channel ID from your Discord server."
echo ""
echo "To find the correct channel ID:"
echo "1. Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)"
echo "2. Right-click on the channel where you want scheduled posts"
echo "3. Click 'Copy Channel ID'"
echo ""
read -p "Enter the correct SCHEDULED_POST_CHANNEL_ID (or press Enter to skip): " NEW_CHANNEL_ID

if [ ! -z "$NEW_CHANNEL_ID" ]; then
    echo "Updating .env file with new channel ID..."
    sed -i "s/SCHEDULED_POST_CHANNEL_ID=.*/SCHEDULED_POST_CHANNEL_ID=$NEW_CHANNEL_ID/" .env
    echo "✅ Updated SCHEDULED_POST_CHANNEL_ID to: $NEW_CHANNEL_ID"
fi

echo ""
echo "🔄 Rebuilding and restarting the bot container..."

# Stop current container
docker stop discoord-bot

# Rebuild with updated configuration
docker build -t worldsgreatestbot-discoord-bot .

# Remove old container
docker rm discoord-bot

# Start new container with proper health check
docker run -d \
  --name discoord-bot \
  -p 3049:3000 \
  --env-file .env \
  --restart unless-stopped \
  worldsgreatestbot-discoord-bot

echo ""
echo "⏳ Waiting for bot to start..."
sleep 10

# Check container status
echo ""
echo "📊 Container Status:"
docker ps --filter "name=discoord-bot" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check logs
echo ""
echo "📝 Recent logs:"
docker logs discoord-bot --tail 20

echo ""
echo "✅ Bot fix complete!"
echo ""
echo "To monitor the bot:"
echo "  - Logs: docker logs -f discoord-bot"
echo "  - Health: docker inspect discoord-bot --format='{{.State.Health.Status}}'"