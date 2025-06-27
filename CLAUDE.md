# World's Greatest Bot - WFH Discord Bot

## Project Status: COMPLETE & SANITIZED FOR GITHUB
The Discord bot is fully built with advanced WFH content generation capabilities.

## What We Built
A sophisticated Discord bot that:
- Monitors voice channel joins and sends WhatsApp notifications via Green API
- Posts @everyone Discord notifications when users join voice channels  
- Creates AI-generated analytical WFH content using Perplexity web search
- Supports OpenAI, Anthropic, and Perplexity AI providers
- Generates research-backed content with real source citations
- Covers diverse WFH topics (mental health, ergonomics, productivity, etc.)
- Includes web dashboard for monitoring at http://localhost:3000/dashboard
- Runs in Docker with persistent volumes for logs and data

## Key Features Added
- ✅ Perplexity AI integration for web-search enabled content
- ✅ Real-time data sourcing with URL citations
- ✅ Analytical content style (professional, not promotional)
- ✅ Diverse WFH topic rotation (12 different areas)
- ✅ Tel Aviv timezone support
- ✅ Improved error handling and fallback systems
- ✅ Sanitized for public GitHub repository

## Technical Architecture
- **Main**: index.js (Express server + Discord client)
- **Handlers**: voiceHandler.js (voice event processing)
- **Services**: whatsappService.js, llmService.js, scheduledPosts.js
- **Docker**: Dockerfile + docker-compose.yml with volumes
- **Persistence**: ./logs/ and ./data/ volumes
- **Monitoring**: Web dashboard with real-time stats

## Project Structure
```
worldsgreatestbot/  # (renamed from Discoord-bot)
├── index.js
├── handlers/voiceHandler.js
├── services/
│   ├── whatsappService.js
│   ├── llmService.js
│   └── scheduledPosts.js
├── logs/ (Docker volume)
├── data/ (Docker volume)
├── Dockerfile
├── docker-compose.yml
├── .env (configured)
├── .env.example
└── README.md
```

## Next Steps
1. Rename folder to "worldsgreatestbot"
2. Run: docker-compose up -d
3. Test voice channel joins
4. Monitor via dashboard

## Bot Features
- Voice channel monitoring with cooldown protection
- WhatsApp group notifications via Green API
- Discord @everyone notifications
- Scheduled AI posts with server activity context
- Rate limiting and error handling
- Winston logging system
- Health checks and monitoring
- Automatic restart on crashes

## Environment Variables Set
- DISCORD_TOKEN, DISCORD_CLIENT_ID
- NOTIFICATION_CHANNEL_ID, SCHEDULED_POST_CHANNEL_ID  
- GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, WHATSAPP_GROUP_ID
- OPENAI_API_KEY, ANTHROPIC_API_KEY, LLM_PROVIDER
- MASTER_PROMPT, POST_SCHEDULE, POST_TIMEZONE
- LOG_LEVEL, PORT

## Commands for Management
- Start: docker-compose up -d
- Logs: docker-compose logs -f  
- Restart: docker-compose restart
- Stop: docker-compose down
- Stats: docker stats worldsgreatestbot