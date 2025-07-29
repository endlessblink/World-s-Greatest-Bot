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

  async createScheduledPost() {
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
        masterPrompt,
        searchQuery
      });

      // Generate contextual discussion question
      try {
        const discussionQuestion = await this.llmService.generateDiscussionQuestion(postContent);
        // Add question to the same message with proper spacing
        postContent = postContent + '\n\n' + discussionQuestion;
      } catch (error) {
        this.logger.error('Error generating discussion question:', error);
      }

      // Ensure combined content doesn't exceed Discord's 2000 character limit
      const finalContent = postContent.length > 2000 
        ? postContent.substring(0, 1950) + '...' 
        : postContent;

      await channel.send(finalContent);
      
      this.logger.info('Successfully posted scheduled content with discussion');
      
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
}

module.exports = ScheduledPosts;