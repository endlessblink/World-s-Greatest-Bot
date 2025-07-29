class VoiceHandler {
  constructor(client, services, logger) {
    this.client = client;
    this.services = services;
    this.logger = logger;
    this.recentJoins = new Map();
    this.burstTracker = new Map();
    this.userHourlyTracker = new Map();
    this.dailyCounter = 0;
    this.dailyResetTime = this.getTodayResetTime();
    
    // Configurable settings from environment
    this.COOLDOWN_MS = (parseInt(process.env.USER_COOLDOWN_SECONDS) || 5) * 1000;
    this.BURST_LIMIT = parseInt(process.env.BURST_LIMIT_COUNT) || 10;
    this.BURST_WINDOW_MS = (parseInt(process.env.BURST_LIMIT_WINDOW_MINUTES) || 10) * 60 * 1000;
    this.DAILY_LIMIT = parseInt(process.env.GLOBAL_DAILY_LIMIT) || 500;
    this.USER_HOURLY_LIMIT = parseInt(process.env.USER_HOURLY_LIMIT) || 3;
    
    // Message templates
    this.discordTemplate = process.env.DISCORD_MESSAGE_TEMPLATE || '@everyone 🎤 **{displayName}** just joined **{channelName}**! Come hang out! 🎉';
    this.whatsappTemplate = process.env.WHATSAPP_MESSAGE_TEMPLATE || '🎤 {displayName} just joined "{channelName}" voice channel on Discord! 🎉';
  }

  async handleVoiceStateUpdate(oldState, newState) {
    try {
      const joinedChannel = this.getUserJoinedChannel(oldState, newState);
      
      if (joinedChannel) {
        await this.handleUserJoinedVoice(newState.member, joinedChannel);
      }

      const leftChannel = this.getUserLeftChannel(oldState, newState);
      if (leftChannel) {
        this.logger.info(`${newState.member.user.tag} left voice channel: ${leftChannel.name}`);
      }

    } catch (error) {
      this.logger.error('Error handling voice state update:', error);
    }
  }

  getUserJoinedChannel(oldState, newState) {
    if (!oldState.channel && newState.channel) {
      return newState.channel;
    }
    return null;
  }

  getUserLeftChannel(oldState, newState) {
    if (oldState.channel && !newState.channel) {
      return oldState.channel;
    }
    return null;
  }

  async handleUserJoinedVoice(member, channel) {
    const userId = member.user.id;
    const now = Date.now();
    
    // Check user cooldown
    if (this.recentJoins.has(userId)) {
      const lastJoin = this.recentJoins.get(userId);
      if (now - lastJoin < this.COOLDOWN_MS) {
        this.logger.debug(`Ignoring rapid rejoin for ${member.user.tag}`);
        return;
      }
    }

    // Check user hourly limit
    if (!this.checkUserHourlyLimit(userId, now)) {
      this.logger.warn(`User ${member.user.tag} exceeded hourly limit (${this.USER_HOURLY_LIMIT} notifications per hour)`);
      return;
    }

    // Check burst protection
    if (!this.checkBurstLimit(now)) {
      this.logger.warn(`Burst limit exceeded (${this.BURST_LIMIT} notifications in ${this.BURST_WINDOW_MS/60000} minutes)`);
      return;
    }

    // Check daily limit
    if (!this.checkDailyLimit(now)) {
      this.logger.warn(`Daily notification limit exceeded (${this.DAILY_LIMIT} per day)`);
      return;
    }

    this.recentJoins.set(userId, now);
    this.updateBurstTracker(now);
    this.updateUserHourlyTracker(userId, now);
    this.dailyCounter++;
    
    setTimeout(() => {
      this.recentJoins.delete(userId);
    }, this.COOLDOWN_MS);

    this.logger.info(`${member.user.tag} joined voice channel: ${channel.name}`);

    await Promise.allSettled([
      this.sendDiscordNotification(member, channel),
      this.sendWhatsAppNotification(member, channel)
    ]);
  }

  async sendDiscordNotification(member, channel) {
    try {
      const notificationChannelId = process.env.NOTIFICATION_CHANNEL_ID;
      if (!notificationChannelId) {
        this.logger.warn('NOTIFICATION_CHANNEL_ID not configured');
        return;
      }

      const notificationChannel = await this.client.channels.fetch(notificationChannelId);
      if (!notificationChannel) {
        this.logger.error('Could not find notification channel');
        return;
      }

      const message = this.discordTemplate
        .replace('{displayName}', member.displayName)
        .replace('{channelName}', channel.name);
      
      await notificationChannel.send(message);
      this.logger.info(`Sent Discord notification for ${member.user.tag}`);

    } catch (error) {
      this.logger.error('Error sending Discord notification:', error);
    }
  }

  async sendWhatsAppNotification(member, channel) {
    try {
      if (!this.services.whatsapp.isConfigured()) {
        this.logger.warn('WhatsApp service not configured');
        return;
      }

      const message = this.whatsappTemplate
        .replace('{displayName}', member.displayName)
        .replace('{channelName}', channel.name);
      
      const result = await this.services.whatsapp.sendGroupMessage(message);
      this.logger.info(`WhatsApp API response for ${member.user.tag}:`, result);

    } catch (error) {
      this.logger.error('Error sending WhatsApp notification:', error.message || error);
      this.logger.error('Full error details:', error.response?.data || error);
    }
  }
  
  getTodayResetTime() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }

  checkBurstLimit(now) {
    const windowStart = now - this.BURST_WINDOW_MS;
    const recentNotifications = this.burstTracker.get('notifications') || [];
    
    // Clean old entries
    const validNotifications = recentNotifications.filter(time => time > windowStart);
    this.burstTracker.set('notifications', validNotifications);
    
    return validNotifications.length < this.BURST_LIMIT;
  }

  updateBurstTracker(now) {
    const notifications = this.burstTracker.get('notifications') || [];
    notifications.push(now);
    this.burstTracker.set('notifications', notifications);
  }

  checkUserHourlyLimit(userId, now) {
    const oneHour = 60 * 60 * 1000;
    const windowStart = now - oneHour;
    const userNotifications = this.userHourlyTracker.get(userId) || [];
    
    // Clean old entries
    const validNotifications = userNotifications.filter(time => time > windowStart);
    this.userHourlyTracker.set(userId, validNotifications);
    
    return validNotifications.length < this.USER_HOURLY_LIMIT;
  }

  updateUserHourlyTracker(userId, now) {
    const notifications = this.userHourlyTracker.get(userId) || [];
    notifications.push(now);
    this.userHourlyTracker.set(userId, notifications);
  }

  checkDailyLimit(now) {
    // Reset daily counter if it's a new day
    if (now > this.dailyResetTime + 24 * 60 * 60 * 1000) {
      this.dailyCounter = 0;
      this.dailyResetTime = this.getTodayResetTime();
    }
    
    return this.dailyCounter < this.DAILY_LIMIT;
  }

  getStats() {
    const now = Date.now();
    const windowStart = now - this.BURST_WINDOW_MS;
    const recentNotifications = this.burstTracker.get('notifications') || [];
    const validNotifications = recentNotifications.filter(time => time > windowStart);
    
    // Get user hourly stats
    const oneHour = 60 * 60 * 1000;
    const hourStart = now - oneHour;
    const userHourlyStats = {};
    for (const [userId, notifications] of this.userHourlyTracker.entries()) {
      const validUserNotifications = notifications.filter(time => time > hourStart);
      if (validUserNotifications.length > 0) {
        userHourlyStats[userId] = validUserNotifications.length;
      }
    }
    
    return {
      burstCount: validNotifications.length,
      burstLimit: this.BURST_LIMIT,
      dailyCount: this.dailyCounter,
      dailyLimit: this.DAILY_LIMIT,
      cooldownMs: this.COOLDOWN_MS,
      userHourlyLimit: this.USER_HOURLY_LIMIT,
      userHourlyStats: userHourlyStats
    };
  }
}

module.exports = VoiceHandler;