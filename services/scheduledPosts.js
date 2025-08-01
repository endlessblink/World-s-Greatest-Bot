const cron = require('node-cron');

class ScheduledPosts {
  constructor() {
    this.tasks = new Map();
    this.serverStats = {
      messages: 0,
      members: 0,
      newMembers: 0,
      voiceActivity: {
        totalJoins: 0,
        peakHour: null,
        hourlyStats: {}
      }
    };
  }

  start(client, llmService, logger) {
    this.client = client;
    this.llmService = llmService;
    this.logger = logger;

    // Check if scheduled posts are configured
    if (!process.env.SCHEDULED_POST_CHANNEL_ID) {
      this.logger.info('Scheduled posts disabled - no SCHEDULED_POST_CHANNEL_ID configured');
      this.startStatsCollection();
      return;
    }

    const schedule = process.env.POST_SCHEDULE || '0 9 * * *';
    const timezone = process.env.POST_TIMEZONE || 'America/New_York';

    if (!cron.validate(schedule)) {
      this.logger.error(`Invalid cron schedule: ${schedule}`);
      return;
    }

    this.logger.info(`Setting up scheduled posts with schedule: ${schedule} (${timezone})`);

    const task = cron.schedule(schedule, async () => {
      await this.createScheduledPost();
    }, {
      scheduled: true,
      timezone: timezone
    });

    this.tasks.set('dailyPost', task);

    this.startStatsCollection();

    this.logger.info('Scheduled posts service started successfully');
  }

  async createScheduledPost(isManualTrigger = false) {
    try {
      const channelId = process.env.SCHEDULED_POST_CHANNEL_ID;
      if (!channelId) {
        this.logger.warn('SCHEDULED_POST_CHANNEL_ID not configured');
        return;
      }

      if (!this.llmService.isConfigured()) {
        this.logger.warn('LLM service not configured, skipping scheduled post');
        return;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        this.logger.error('Could not find scheduled post channel');
        return;
      }

      this.logger.info('Generating scheduled post content...');
      
      const masterPrompt = process.env.MASTER_PROMPT;
      const searchQuery = process.env.WFH_SEARCH_QUERY;
      
      let postContent = await this.llmService.generateScheduledPost({
        stats: this.serverStats,
        masterPrompt: isManualTrigger ? null : masterPrompt, // Use null for manual to force research format
        searchQuery,
        isManualTrigger
      });

      // Generate contextual discussion question
      let discussionQuestion = '';
      try {
        discussionQuestion = await this.llmService.generateDiscussionQuestion(postContent);
      } catch (error) {
        this.logger.error('Error generating discussion question:', error);
      }

      // Calculate space for discussion question (if any)
      const discussionLength = discussionQuestion ? discussionQuestion.length + 4 : 0; // +4 for \n\n prefix
      const maxContentLength = 2000 - discussionLength;

      // Ensure content fits with discussion question
      if (postContent.length > maxContentLength) {
        this.logger.warn(`Post content too long with discussion question (${postContent.length} + ${discussionLength} chars), intelligently truncating`);
        
        // Try to preserve sources section if present
        const sourcesMatch = postContent.match(/(\[1\][\s\S]*$)/);
        let mainContent = postContent;
        let sourcesSection = '';
        
        if (sourcesMatch) {
          sourcesSection = sourcesMatch[0];
          mainContent = postContent.substring(0, sourcesMatch.index).trim();
        }
        
        // Calculate space for main content
        const sourcesLength = sourcesSection.length;
        const availableForMain = maxContentLength - sourcesLength - 10; // 10 chars buffer
        
        if (mainContent.length > availableForMain) {
          // Find a good truncation point
          let truncateAt = mainContent.lastIndexOf('. ', availableForMain);
          if (truncateAt === -1) truncateAt = mainContent.lastIndexOf('! ', availableForMain);
          if (truncateAt === -1) truncateAt = mainContent.lastIndexOf('? ', availableForMain);
          if (truncateAt === -1) truncateAt = mainContent.lastIndexOf(' ', availableForMain - 20);
          if (truncateAt === -1) truncateAt = availableForMain - 20;
          
          mainContent = mainContent.substring(0, truncateAt).trim();
          if (!mainContent.match(/[.!?]$/)) mainContent += '...';
        }
        
        // Reconstruct with sources
        postContent = sourcesSection ? mainContent + '\n\n' + sourcesSection : mainContent;
      }

      // Combine content with discussion question
      const finalContent = discussionQuestion 
        ? postContent + '\n\n' + discussionQuestion
        : postContent;

      const sentMessage = await channel.send(finalContent);
      
      this.logger.info('Successfully posted scheduled content with discussion');
      
      // Track engagement for analytics
      this.trackPostEngagement(sentMessage);
      
      this.resetDailyStats();

    } catch (error) {
      this.logger.error('Error creating scheduled post:', error);
    }
  }

  startStatsCollection() {
    if (!this.client) return;

    this.client.on('messageCreate', (message) => {
      if (!message.author.bot) {
        this.serverStats.messages++;
      }
    });

    this.client.on('guildMemberAdd', (member) => {
      this.serverStats.newMembers++;
      this.serverStats.members++;
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      if (!oldState.channel && newState.channel) {
        this.recordVoiceJoin();
      }
    });

    const statsResetTask = cron.schedule('0 0 * * *', () => {
      this.resetDailyStats();
    }, {
      scheduled: true,
      timezone: process.env.POST_TIMEZONE || 'America/New_York'
    });

    this.tasks.set('statsReset', statsResetTask);
  }

  recordVoiceJoin() {
    this.serverStats.voiceActivity.totalJoins++;
    
    const hour = new Date().getHours();
    if (!this.serverStats.voiceActivity.hourlyStats[hour]) {
      this.serverStats.voiceActivity.hourlyStats[hour] = 0;
    }
    this.serverStats.voiceActivity.hourlyStats[hour]++;

    const peakHour = Object.entries(this.serverStats.voiceActivity.hourlyStats)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    this.serverStats.voiceActivity.peakHour = `${peakHour}:00`;
  }

  resetDailyStats() {
    this.serverStats = {
      messages: 0,
      members: this.client?.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) || 0,
      newMembers: 0,
      voiceActivity: {
        totalJoins: 0,
        peakHour: null,
        hourlyStats: {}
      }
    };
    
    this.logger.info('Daily stats reset');
  }

  addCustomSchedule(name, schedule, callback, timezone) {
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    if (this.tasks.has(name)) {
      this.tasks.get(name).stop();
    }

    const task = cron.schedule(schedule, callback, {
      scheduled: true,
      timezone: timezone || process.env.POST_TIMEZONE || 'America/New_York'
    });

    this.tasks.set(name, task);
    this.logger.info(`Added custom schedule "${name}": ${schedule}`);

    return task;
  }

  removeSchedule(name) {
    if (this.tasks.has(name)) {
      this.tasks.get(name).stop();
      this.tasks.delete(name);
      this.logger.info(`Removed schedule: ${name}`);
      return true;
    }
    return false;
  }

  listSchedules() {
    return Array.from(this.tasks.keys());
  }

  getStats() {
    return {
      ...this.serverStats,
      activeSchedules: this.listSchedules().length
    };
  }

  stop() {
    for (const [name, task] of this.tasks) {
      task.stop();
      this.logger.info(`Stopped schedule: ${name}`);
    }
    this.tasks.clear();
  }

  trackPostEngagement(message) {
    // Track reactions after 5 minutes
    setTimeout(async () => {
      try {
        const updatedMessage = await message.fetch();
        const reactions = updatedMessage.reactions.cache;
        const reactionCount = reactions.reduce((acc, reaction) => acc + reaction.count, 0);
        
        this.logger.info(`Post engagement after 5 min: ${reactionCount} reactions`);
        
        // Track thread replies if any
        if (updatedMessage.hasThread) {
          const thread = await updatedMessage.thread.fetch();
          this.logger.info(`Post has ${thread.messageCount} replies in thread`);
        }
      } catch (error) {
        this.logger.error('Error tracking post engagement:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

module.exports = ScheduledPosts;