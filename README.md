# WorldsGreatestBot - Discord Work-From-Home Assistant

A Discord bot that enhances remote work collaboration by sending notifications when users join voice channels and posting scheduled AI-generated content about work-from-home topics.

## Features

- **Voice Channel Notifications**: Sends Discord and WhatsApp notifications when users join voice channels
- **AI-Generated Posts**: Daily scheduled posts about WFH topics using Perplexity AI
- **Rate Limiting**: Prevents spam with configurable limits
- **Docker Support**: Runs reliably in containerized environment
- **Multi-LLM Support**: Compatible with OpenAI, Anthropic, and Perplexity APIs

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Install dependencies: `npm install`
4. Run the bot: `npm start`

### Docker Setup

```bash
docker-compose up -d
```

The bot runs on port 8742 by default (configurable in .env).

## Configuration

See `.env.example` for all configuration options including:
- Discord bot token and channel IDs
- WhatsApp Green API credentials
- LLM provider settings
- Scheduled post timing
- Rate limiting controls

## Commands

- `!post` - Manually trigger a scheduled post (requires appropriate permissions)

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `NOTIFICATION_CHANNEL_ID` - Channel for voice notifications
- `SCHEDULED_POST_CHANNEL_ID` - Channel for AI-generated posts
- `PORT` - Web server port (default: 8742)

## License

MIT