const { Collection } = require('discord.js');

class AnalyticsService {
  constructor() {
    this.messageHistory = new Collection();
    this.reactionData = new Collection();
    this.activeUsers = new Set();
    this.hourlyActivity = Array(24).fill(0);
    this.channelEngagement = new Collection();
  }

  async analyzeServer(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    const analysis = {
      serverInfo: {
        name: guild.name,
        memberCount: guild.memberCount,
        channels: guild.channels.cache.filter(ch => ch.type === 0).size
      },
      activityPatterns: await this.getActivityPatterns(guild),
      engagementMetrics: await this.getEngagementMetrics(guild),
      recommendations: []
    };

    // Analyze best posting times
    const peakHours = this.findPeakHours(analysis.activityPatterns.hourlyActivity);
    analysis.recommendations.push({
      type: 'posting_time',
      suggestion: `Best posting times: ${peakHours.map(h => `${h}:00`).join(', ')}`,
      reason: 'These hours show the highest member activity'
    });

    // Analyze engagement patterns
    const avgEngagement = analysis.engagementMetrics.averageReactionsPerMessage;
    if (avgEngagement < 2) {
      analysis.recommendations.push({
        type: 'engagement_strategy',
        suggestion: 'Consider using role mentions instead of @everyone',
        reason: 'Low reaction rates suggest notification fatigue'
      });
    }

    return analysis;
  }

  async getActivityPatterns(guild) {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    
    // Get all text channels
    const textChannels = guild.channels.cache.filter(ch => ch.type === 0);
    
    const patterns = {
      hourlyActivity: Array(24).fill(0),
      dailyActivity: Array(7).fill(0), // Last 7 days
      dailyMessages: 0,
      weeklyMessages: 0,
      twoWeekMessages: 0,
      mostActiveChannels: [],
      activeUsers: new Set(),
      userActivity: new Collection(),
      messageTypes: {
        bot: 0,
        human: 0,
        withAttachments: 0,
        withLinks: 0,
        questions: 0,
        longMessages: 0
      },
      peakDays: [],
      dormantChannels: []
    };

    // Analyze messages from last 2 weeks with more detail
    for (const channel of textChannels.values()) {
      try {
        let allMessages = [];
        let lastId = null;
        let fetchCount = 0;
        
        // Fetch more messages (up to 500 per channel)
        while (fetchCount < 5) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;
          
          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;
          
          allMessages = allMessages.concat(Array.from(messages.values()));
          lastId = messages.last()?.id;
          fetchCount++;
        }
        
        let channelData = {
          name: channel.name,
          id: channel.id,
          messageCount: 0,
          uniqueUsers: new Set(),
          avgMessageLength: 0,
          totalLength: 0,
          hasBot: false,
          lastMessage: null,
          engagementScore: 0
        };
        
        allMessages.forEach(msg => {
          const msgTime = msg.createdTimestamp;
          
          if (msgTime > twoWeeksAgo) {
            patterns.twoWeekMessages++;
            
            // Track user activity
            if (!patterns.userActivity.has(msg.author.id)) {
              patterns.userActivity.set(msg.author.id, {
                messageCount: 0,
                channels: new Set(),
                avgLength: 0,
                totalLength: 0,
                reactions: 0,
                isBot: msg.author.bot
              });
            }
            
            const userData = patterns.userActivity.get(msg.author.id);
            userData.messageCount++;
            userData.channels.add(channel.id);
            userData.totalLength += msg.content.length;
            userData.avgLength = userData.totalLength / userData.messageCount;
            
            if (msgTime > oneWeekAgo) {
              patterns.weeklyMessages++;
              patterns.activeUsers.add(msg.author.id);
              channelData.messageCount++;
              channelData.uniqueUsers.add(msg.author.id);
              channelData.totalLength += msg.content.length;
              
              // Track message types
              if (msg.author.bot) {
                patterns.messageTypes.bot++;
                channelData.hasBot = true;
              } else {
                patterns.messageTypes.human++;
              }
              
              if (msg.attachments.size > 0) patterns.messageTypes.withAttachments++;
              if (msg.content.includes('http')) patterns.messageTypes.withLinks++;
              if (msg.content.includes('?')) patterns.messageTypes.questions++;
              if (msg.content.length > 200) patterns.messageTypes.longMessages++;
              
              const hour = msg.createdAt.getHours();
              patterns.hourlyActivity[hour]++;
              
              const dayOfWeek = msg.createdAt.getDay();
              patterns.dailyActivity[dayOfWeek]++;
              
              if (msgTime > oneDayAgo) {
                patterns.dailyMessages++;
              }
              
              // Calculate engagement score
              const reactions = msg.reactions.cache.reduce((acc, r) => acc + r.count, 0);
              channelData.engagementScore += reactions;
              userData.reactions += reactions;
              
              if (!channelData.lastMessage || msgTime > channelData.lastMessage) {
                channelData.lastMessage = msgTime;
              }
            }
          }
        });
        
        if (channelData.messageCount > 0) {
          channelData.avgMessageLength = Math.round(channelData.totalLength / channelData.messageCount);
          patterns.mostActiveChannels.push(channelData);
        } else if (allMessages.length > 0) {
          // Channel has old messages but no recent activity
          patterns.dormantChannels.push({
            name: channel.name,
            id: channel.id,
            daysSinceLastMessage: Math.floor((now - allMessages[0].createdTimestamp) / (24 * 60 * 60 * 1000))
          });
        }
        
      } catch (error) {
        console.error(`Error analyzing channel ${channel.name}:`, error.message);
      }
    }

    // Sort and limit results
    patterns.mostActiveChannels.sort((a, b) => b.messageCount - a.messageCount);
    patterns.mostActiveChannels = patterns.mostActiveChannels.slice(0, 10);
    
    patterns.dormantChannels.sort((a, b) => b.daysSinceLastMessage - a.daysSinceLastMessage);
    patterns.dormantChannels = patterns.dormantChannels.slice(0, 5);
    
    patterns.uniqueActiveUsers = patterns.activeUsers.size;
    
    // Find peak days
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    patterns.peakDays = patterns.dailyActivity
      .map((count, day) => ({ day: dayNames[day], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return patterns;
  }

  async getEngagementMetrics(guild) {
    const metrics = {
      totalReactions: 0,
      messagesWithReactions: 0,
      totalMessages: 0,
      averageReactionsPerMessage: 0,
      topReactionTypes: new Collection(),
      postsWithReplies: 0
    };

    const textChannels = guild.channels.cache.filter(ch => ch.type === 0);
    
    for (const channel of textChannels.values()) {
      try {
        const messages = await channel.messages.fetch({ limit: 50 });
        
        messages.forEach(msg => {
          metrics.totalMessages++;
          
          // Count reactions
          if (msg.reactions.cache.size > 0) {
            metrics.messagesWithReactions++;
            msg.reactions.cache.forEach(reaction => {
              metrics.totalReactions += reaction.count;
              const current = metrics.topReactionTypes.get(reaction.emoji.name) || 0;
              metrics.topReactionTypes.set(reaction.emoji.name, current + reaction.count);
            });
          }
          
          // Check for thread replies
          if (msg.hasThread && msg.thread.messageCount > 0) {
            metrics.postsWithReplies++;
          }
        });
      } catch (error) {
        // Skip channels bot can't access
      }
    }

    metrics.averageReactionsPerMessage = metrics.totalMessages > 0 
      ? (metrics.totalReactions / metrics.totalMessages).toFixed(2) 
      : 0;

    // Get top 5 reactions
    metrics.topReactionTypes = Array.from(metrics.topReactionTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count }));

    return metrics;
  }

  findPeakHours(hourlyActivity) {
    // Find top 3 hours with most activity
    const hoursWithActivity = hourlyActivity
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour)
      .sort((a, b) => a - b);

    return hoursWithActivity;
  }

  async generateReport(analysis) {
    const patterns = analysis.activityPatterns;
    const engagement = analysis.engagementMetrics;
    
    // Find top users
    const topUsers = Array.from(patterns.userActivity.entries())
      .filter(([id, data]) => !data.isBot)
      .sort((a, b) => b[1].messageCount - a[1].messageCount)
      .slice(0, 5);
    
    const report = [
      `**📊 DEEP SERVER ANALYTICS**`,
      `Server: ${analysis.serverInfo.name}`,
      `Total Members: ${analysis.serverInfo.memberCount}`,
      `Active (7d): ${patterns.uniqueActiveUsers} | Active Rate: ${(patterns.uniqueActiveUsers/analysis.serverInfo.memberCount*100).toFixed(1)}%`,
      ``,
      `**📈 ACTIVITY BREAKDOWN**`,
      `Today: ${patterns.dailyMessages} | Week: ${patterns.weeklyMessages} | 2-Week: ${patterns.twoWeekMessages}`,
      `Trend: ${patterns.twoWeekMessages > patterns.weeklyMessages*2 ? '📈 Growing' : '📉 Declining'}`,
      `Peak Days: ${patterns.peakDays.map(d => `${d.day}(${d.count})`).join(', ')}`,
      ``,
      `**🔥 CHANNEL PERFORMANCE**`,
      ...patterns.mostActiveChannels.slice(0, 8).map((ch, i) => 
        `${i + 1}. #${ch.name}: ${ch.messageCount}msg, ${ch.uniqueUsers.size}users, ${ch.engagementScore}reactions`
      ),
      ``,
      patterns.dormantChannels.length > 0 ? `**💀 DEAD CHANNELS (${patterns.dormantChannels.length})**` : '',
      ...patterns.dormantChannels.map(ch => 
        `#${ch.name} - ${ch.daysSinceLastMessage} days silent`
      ),
      patterns.dormantChannels.length > 0 ? '' : '',
      `**👥 TOP CONTRIBUTORS**`,
      ...topUsers.map((u, i) => 
        `${i + 1}. User: ${u[1].messageCount}msg, ${u[1].channels.size}channels, ${u[1].avgLength.toFixed(0)}chars avg`
      ),
      ``,
      `**📝 MESSAGE ANALYSIS**`,
      `Human: ${patterns.messageTypes.human} | Bot: ${patterns.messageTypes.bot}`,
      `Questions: ${patterns.messageTypes.questions} | Links: ${patterns.messageTypes.withLinks}`,
      `Long Posts: ${patterns.messageTypes.longMessages} | Media: ${patterns.messageTypes.withAttachments}`,
      ``,
      `**💬 ENGAGEMENT DEEP DIVE**`,
      `React Rate: ${engagement.averageReactionsPerMessage} avg per message`,
      `Reaction Participation: ${((engagement.messagesWithReactions/engagement.totalMessages)*100).toFixed(1)}%`,
      `Top Reactions: ${engagement.topReactionTypes.map(r => `${r.emoji}(${r.count})`).join(', ')}`,
      `Thread Usage: ${engagement.postsWithReplies} threads created`,
      ``,
      `**⏰ OPTIMAL TIMING**`,
      `Peak Hours: ${this.findPeakHours(patterns.hourlyActivity).join(':00, ')}:00`,
      `Activity Spread: ${patterns.hourlyActivity.filter(h => h > 0).length}/24 hours active`,
      ``,
      `**🎯 ACTIONABLE INSIGHTS**`,
      ...analysis.recommendations.map(rec => 
        `• ${rec.suggestion}`
      ),
      patterns.uniqueActiveUsers < 20 ? `• Focus on the ${patterns.uniqueActiveUsers} active users - they're your real community` : '',
      patterns.dormantChannels.length > 3 ? `• Consider archiving ${patterns.dormantChannels.length} inactive channels to reduce noise` : '',
      engagement.averageReactionsPerMessage < 0.5 ? `• Engagement is critically low - content strategy needs complete overhaul` : '',
      patterns.messageTypes.questions < patterns.messageTypes.human * 0.1 ? `• Only ${((patterns.messageTypes.questions/patterns.messageTypes.human)*100).toFixed(1)}% of messages are questions - community lacks curiosity` : ''
    ].filter(line => line !== ''); // Remove empty strings

    return report.join('\n');
  }
}

module.exports = AnalyticsService;