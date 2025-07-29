# World's Greatest Bot - WFH Discord Bot

A sophisticated Discord bot that monitors voice channels, sends intelligent notifications, and generates research-driven work-from-home content using AI and web search capabilities.

## 🌟 Features

### Core Functionality
- 🎤 **Voice Channel Monitoring**: Automatically detects when users join voice channels
- 📱 **WhatsApp Notifications**: Sends notifications to WhatsApp groups via Green API
- 📢 **Discord Notifications**: Posts @everyone messages in designated channels
- 🤖 **AI-Generated WFH Content**: Creates analytical, research-backed work-from-home posts
- 🔍 **Web Search Integration**: Uses Perplexity AI for real-time data and current trends
- ⏰ **Intelligent Scheduling**: Configurable timing with timezone support
- 📊 **Activity Tracking**: Collects server statistics for contextual content
- 🛡️ **Rate Limiting**: Built-in protection against API abuse
- 📝 **Comprehensive Logging**: Winston-based logging system
- 🌐 **Web Dashboard**: Health monitoring and statistics interface

### Content Variety
The bot covers diverse work-from-home topics:
- Remote work statistics and productivity trends
- Mental health and wellbeing research
- Home office ergonomics and setup best practices
- Remote team collaboration strategies
- Digital nomad lifestyle trends
- Work-life balance challenges and solutions
- Hybrid workplace culture insights
- Remote work tools and technology adoption
- Virtual meeting fatigue and optimization
- Career advancement in remote environments
- Distributed team management
- Remote work cybersecurity

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Discord bot token
- Green API WhatsApp account
- At least one AI API key (OpenAI, Anthropic, or Perplexity)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/endlessblink/World-s-Greatest-Bot.git
cd World-s-Greatest-Bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment**
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. **Run with Docker (Recommended)**
```bash
docker-compose up -d
```

Or run directly:
```bash
npm start
```

## 🔧 Configuration

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Enable these intents:
   - Guilds
   - Guild Voice States  
   - Guild Messages
   - Message Content
4. Invite bot with permissions:
   - Read Messages
   - Send Messages
   - Connect (Voice)
   - View Channels

### API Keys Required

**Discord:**
- `DISCORD_TOKEN`: Your bot token
- `DISCORD_CLIENT_ID`: Your application ID
- `NOTIFICATION_CHANNEL_ID`: Channel for voice notifications
- `SCHEDULED_POST_CHANNEL_ID`: Channel for WFH content

**WhatsApp (Green API):**
- `GREEN_API_INSTANCE_ID`: Your instance ID
- `GREEN_API_TOKEN`: Your API token  
- `WHATSAPP_GROUP_ID`: Target group ID (format: `123456789@g.us`)

**AI Providers (Choose one or more):**
- `OPENAI_API_KEY`: For GPT models
- `ANTHROPIC_API_KEY`: For Claude models
- `PERPLEXITY_API_KEY`: For web-search enabled content (Recommended)

### Environment Configuration

```bash
# Set your preferred AI provider
LLM_PROVIDER=perplexity  # Options: openai, anthropic, perplexity

# Customize posting schedule (cron format)
POST_SCHEDULE=0 9 * * *  # Daily at 9 AM
POST_TIMEZONE=Asia/Jerusalem  # Your timezone

# Customize search queries for WFH content
WFH_SEARCH_QUERY=work from home trends, remote work productivity, WFH mental health, home office setup

# Rate limiting (optional customization)
USER_COOLDOWN_SECONDS=5
WHATSAPP_HOURLY_LIMIT=50
```

## 📊 Content Intelligence

### Perplexity Integration (Recommended)
When using Perplexity as the LLM provider, the bot:
- Searches the web for current WFH trends and research
- Provides real source citations with URLs
- Delivers data-driven insights from recent studies
- Covers diverse aspects beyond just statistics

### Content Style
- **Analytical tone**: Professional, not promotional
- **Data-driven**: Includes real statistics and sources
- **Research-backed**: Uses current studies and reports
- **Diverse topics**: Rotates through different WFH aspects daily
- **Source attribution**: Includes full URLs for fact-checking

## 🐳 Docker Deployment

**Benefits:**
- ✅ Always running with auto-restart
- ✅ Isolated environment
- ✅ Persistent logs and data
- ✅ Easy updates and management
- ✅ Resource control

**Commands:**
```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Restart after config changes  
docker-compose restart

# Stop
docker-compose down

# Update
docker-compose pull && docker-compose up -d
```

## 📁 Project Structure

```
World-s-Greatest-Bot/
├── index.js                    # Main application entry
├── handlers/
│   └── voiceHandler.js         # Voice channel event processing
├── services/
│   ├── whatsappService.js      # Green API integration
│   ├── llmService.js           # AI model integration & web search
│   └── scheduledPosts.js       # Intelligent posting system
├── logs/                       # Persistent log files (Docker volume)
├── data/                       # Persistent data (Docker volume)
├── Dockerfile                  # Container definition
├── docker-compose.yml         # Docker deployment config
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies
└── README.md                  # Documentation
```

## 🔍 Monitoring

### Web Dashboard
Visit `http://localhost:3000/dashboard` for:
- Real-time bot status
- Server statistics
- Recent activity logs
- Health checks

### Health Endpoint
Check `http://localhost:3000/health` for service status

### Logs
- `error.log`: Error messages only
- `combined.log`: All log messages  
- Console: Real-time logging

## 🛠️ Troubleshooting

### Common Issues

**Bot not responding:**
- Verify Discord token and permissions
- Check bot is online in Discord
- Review console logs for errors

**WhatsApp notifications failing:**
- Confirm Green API credentials
- Verify group ID format (`123456789@g.us`)
- Check API quota limits

**No scheduled posts:**
- Verify AI API keys
- Check cron schedule syntax
- Confirm channel permissions
- Review timezone settings

**Content quality issues:**
- Ensure Perplexity API key is set for best results
- Check WFH_SEARCH_QUERY customization
- Verify LLM_PROVIDER setting

## 📊 Rate Limits & Costs

### API Limits
- **Green API Free**: 1000 messages/month
- **Discord**: Standard bot limits
- **Perplexity**: Pay-per-use, ~$5-20/month typical
- **OpenAI**: Pay-per-use, minimal cost for scheduled posts
- **Anthropic**: Pay-per-use, similar to OpenAI

### Built-in Protection
- User cooldown periods
- Hourly message limits
- Burst protection
- Error handling and fallbacks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues:
1. Check the logs for error details
2. Verify all API keys and IDs
3. Test individual services
4. Check API service status pages
5. Review troubleshooting section

**Built with ❤️ for remote work communities**