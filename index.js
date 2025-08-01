require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const winston = require('winston');
const cron = require('node-cron');
const express = require('express');

const VoiceHandler = require('./handlers/voiceHandler');
const WhatsAppService = require('./services/whatsappService');
const LLMService = require('./services/llmService');
const ScheduledPosts = require('./services/scheduledPosts');
const AnalyticsService = require('./services/analyticsService');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const services = {
  whatsapp: new WhatsAppService(),
  llm: new LLMService(logger),
  scheduledPosts: new ScheduledPosts(),
  analytics: new AnalyticsService()
};

const voiceHandler = new VoiceHandler(client, services, logger);

client.once(Events.ClientReady, readyClient => {
  logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
  
  services.scheduledPosts.start(client, services.llm, logger);
  
  logger.info('All services initialized successfully');
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  voiceHandler.handleVoiceStateUpdate(oldState, newState);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return; // Ignore messages from bots

  if (message.content === '!post') {
    logger.info(`Manual post trigger received from ${message.author.tag}`);
    try {
      await services.scheduledPosts.createScheduledPost(true); // true = manual trigger
      message.reply('Scheduled post triggered successfully!');
    } catch (error) {
      logger.error('Error triggering manual post:', error);
      message.reply('Failed to trigger scheduled post. Check logs for details.');
    }
  }

  // Analytics command
  if (message.content === '!analyze') {
    logger.info(`Analytics request from ${message.author.tag}`);
    try {
      const loadingMsg = await message.reply('🔍 Deep-analyzing server activity... This will take 30-60 seconds.');
      
      const analysis = await services.analytics.analyzeServer(client, message.guild.id);
      const report = await services.analytics.generateReport(analysis);
      
      // Split report if too long
      if (report.length > 2000) {
        const chunks = report.match(/.{1,1900}/gs);
        for (let i = 0; i < chunks.length; i++) {
          await message.channel.send(`**Part ${i + 1}/${chunks.length}**\n${chunks[i]}`);
        }
      } else {
        await message.channel.send(report);
      }
      
      await loadingMsg.delete();
    } catch (error) {
      logger.error('Error running analytics:', error);
      message.reply('Failed to analyze server. Make sure the bot has permission to read message history.');
    }
  }

  // Quick analytics for just hourly patterns
  if (message.content === '!heatmap') {
    logger.info(`Heatmap request from ${message.author.tag}`);
    try {
      const loadingMsg = await message.reply('📊 Generating activity heatmap...');
      
      const analysis = await services.analytics.analyzeServer(client, message.guild.id);
      const hourlyData = analysis.activityPatterns.hourlyActivity;
      
      const heatmap = hourlyData.map((count, hour) => {
        const intensity = count === 0 ? '⬛' : count < 2 ? '🟫' : count < 5 ? '🟨' : count < 10 ? '🟧' : '🟥';
        return `${hour.toString().padStart(2, '0')}h ${intensity} ${count}`;
      }).join('\n');
      
      await message.channel.send(`**📊 24-Hour Activity Heatmap**\n\`\`\`\n${heatmap}\n\`\`\`\n${analysis.activityPatterns.weeklyMessages} total messages this week`);
      await loadingMsg.delete();
    } catch (error) {
      logger.error('Error generating heatmap:', error);
      message.reply('Failed to generate heatmap.');
    }
  }
});

client.on(Events.Error, error => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Discord bot is running', uptime: process.uptime() });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    discord: client.isReady() ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

app.get('/stats', (req, res) => {
  try {
    const stats = services.scheduledPosts.getStats();
    const voiceStats = voiceHandler.getStats();
    const whatsappStatus = services.whatsapp.getRateLimitStatus();
    
    res.json({
      serverStats: stats,
      voiceStats: voiceStats,
      whatsappRateLimit: whatsappStatus,
      discordStatus: client.isReady() ? 'connected' : 'disconnected',
      services: {
        whatsapp: services.whatsapp.isConfigured(),
        llm: services.llm.isConfigured()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Discord Bot Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .online { background: #d4edda; color: #155724; }
            .offline { background: #f8d7da; color: #721c24; }
            .card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px; }
            .refresh { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 Discord Bot Dashboard</h1>
            
            <div class="card">
                <h3>📊 System Status</h3>
                <div id="systemStatus">Loading...</div>
            </div>
            
            <div class="card">
                <h3>📈 Statistics</h3>
                <div id="stats">Loading...</div>
            </div>
            
            <div class="card">
                <h3>🔧 Service Status</h3>
                <div id="services">Loading...</div>
            </div>
            
            <button class="refresh" onclick="refreshData()">🔄 Refresh Data</button>
        </div>
        
        <script>
            async function refreshData() {
                try {
                    const response = await fetch('/stats');
                    const data = await response.json();
                    
                    document.getElementById('systemStatus').innerHTML = \`
                        <div class="status \${data.discordStatus === 'connected' ? 'online' : 'offline'}">
                            Discord: \${data.discordStatus}
                        </div>
                        <p>Uptime: \${Math.floor(data.serverStats.uptime || 0)} seconds</p>
                    \`;
                    
                    document.getElementById('stats').innerHTML = \`
                        <p>Messages Today: \${data.serverStats.messages || 0}</p>
                        <p>Voice Joins Today: \${data.serverStats.voiceActivity?.totalJoins || 0}</p>
                        <p>Active Schedules: \${data.serverStats.activeSchedules || 0}</p>
                        <h4>📊 Rate Limiting Status</h4>
                        <p>Burst: \${data.voiceStats.burstCount}/\${data.voiceStats.burstLimit} (\${(data.voiceStats.burstLimit - data.voiceStats.burstCount)} remaining)</p>
                        <p>Daily: \${data.voiceStats.dailyCount}/\${data.voiceStats.dailyLimit} notifications</p>
                        <p>User Cooldown: \${data.voiceStats.cooldownMs/1000}s</p>
                    \`;
                    
                    document.getElementById('services').innerHTML = \`
                        <div class="status \${data.services.whatsapp ? 'online' : 'offline'}">
                            WhatsApp: \${data.services.whatsapp ? 'Configured' : 'Not Configured'}
                        </div>
                        <div class="status \${data.services.llm ? 'online' : 'offline'}">
                            LLM: \${data.services.llm ? 'Configured' : 'Not Configured'}
                        </div>
                        <p>WhatsApp Rate Limit: \${data.whatsappRateLimit.count}/\${data.whatsappRateLimit.limit}</p>
                    \`;
                } catch (error) {
                    document.getElementById('systemStatus').innerHTML = 'Error loading data';
                }
            }
            
            refreshData();
            setInterval(refreshData, 30000);
        </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces for Docker health checks
app.listen(PORT, HOST, () => {
  logger.info(`Web server running on ${HOST}:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);