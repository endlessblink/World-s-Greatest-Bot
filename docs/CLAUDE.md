# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# World's Greatest Bot - Discord WFH Bot

## Project Overview
A sophisticated Discord bot that monitors voice channels, sends notifications, and generates AI-powered work-from-home content. Built with Node.js, Discord.js, and multiple AI providers.

## Development Commands

### Running the Bot
```bash
# Development/Local
npm start

# Docker (Recommended)
docker-compose up -d

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down
```

### Testing
```bash
# Test Perplexity AI integration
node services/langchainTest.js

# No formal test suite currently implemented
```

### Debugging
```bash
# Check container status
docker stats worldsgreatestbot

# View dashboard
# http://localhost:3000/dashboard

# Health check
curl http://localhost:3000/health
```

## Core Architecture

### Service-Oriented Design
The bot follows a modular service architecture:

**Main Application (index.js)**
- Express web server with dashboard and health endpoints
- Discord client initialization with voice/guild intents
- Event orchestration and error handling
- Winston logging system

**VoiceHandler (handlers/voiceHandler.js)**
- Multi-tier rate limiting (user cooldowns, burst protection, daily limits)
- Dual notification system (Discord @everyone + WhatsApp)
- Configurable message templates with Hebrew support
- Advanced activity tracking and statistics

**LLMService (services/llmService.js)**
- Multi-provider AI integration (OpenAI, Anthropic, Perplexity)
- LangChain integration for advanced prompt engineering
- Perplexity web search for real-time content with citations
- WFH-focused content generation across 12 topic areas

**WhatsAppService (services/whatsappService.js)**
- Green API integration for WhatsApp group messaging
- Built-in rate limiting and account validation
- Error handling with fallback mechanisms

**ScheduledPosts (services/scheduledPosts.js)**
- Cron-based scheduling with timezone support
- Server activity context for dynamic content
- Configurable posting schedules

### Data Flow
1. Voice channel events → VoiceHandler → Dual notifications
2. Scheduled posts → LLMService → AI content generation → Discord
3. Web dashboard → Real-time statistics and health monitoring

## Key Configuration

### Environment Variables
Critical settings in `.env`:
- `LLM_PROVIDER` - AI provider selection (openai/anthropic/perplexity)
- `MASTER_PROMPT` - Core prompt template for AI content
- `POST_SCHEDULE` - Cron expression for scheduled posts
- `VOICE_COOLDOWN_MINUTES` - Rate limiting configuration
- Message templates support Hebrew/English localization

### Rate Limiting Architecture
Multi-layered protection system:
- Per-user cooldowns (configurable minutes)
- Burst protection (max notifications per timeframe)
- Daily limits per user
- Service-level rate limiting for APIs

### Docker Volumes
- `./logs/` - Persistent logging with rotation
- `./data/` - Bot state and statistics storage

## Important Development Notes

### AI Content Generation
- Uses web search for real-time data and source citations
- Content style is analytical/professional, not promotional
- 12 rotating WFH topic areas (mental health, ergonomics, productivity, etc.)
- Built-in fallback system if primary AI provider fails

### Notification System
- Discord notifications use @everyone mentions
- WhatsApp integration requires Green API setup
- Both systems have independent rate limiting
- Messages are templated and support localization

### Error Handling
- Comprehensive Winston logging with multiple levels
- Service-specific error boundaries
- Health check endpoints for monitoring
- Automatic container restart on crashes

### Security Considerations
- Non-root Docker user (discordbot:nodejs)
- Environment variable isolation
- API key rotation support
- Rate limiting prevents abuse

## Monitoring and Maintenance

### Health Monitoring
- Web dashboard at `/dashboard` with real-time stats
- Health check endpoint at `/health`
- Docker health checks with retry logic
- Comprehensive logging for debugging

### Common Issues
- API rate limits → Check service-specific rate limiting configs
- AI content generation fails → Verify API keys and fallback providers
- WhatsApp notifications not working → Validate Green API instance status
- Memory usage → Monitor Docker stats and log rotation

### Performance Optimization
- LangChain caching for repeated AI queries
- Discord.js partial structures for memory efficiency
- Log rotation to prevent disk space issues
- Configurable cooldowns to balance activity and resource usage

## Git Workflow Notes
Current uncommitted changes include Perplexity AI integration and Docker configuration updates. The project is production-ready with comprehensive error handling and monitoring capabilities.