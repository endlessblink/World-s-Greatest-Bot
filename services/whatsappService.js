const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.instanceId = process.env.GREEN_API_INSTANCE_ID;
    this.token = process.env.GREEN_API_TOKEN;
    this.groupId = process.env.WHATSAPP_GROUP_ID;
    this.baseURL = `https://api.green-api.com/waInstance${this.instanceId}`;
    
    this.rateLimitCount = 0;
    this.rateLimitResetTime = 0;
    this.RATE_LIMIT_PER_HOUR = parseInt(process.env.WHATSAPP_HOURLY_LIMIT) || 50;
  }

  isConfigured() {
    return !!(this.instanceId && this.token && this.groupId);
  }

  async sendGroupMessage(message) {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp service not properly configured');
    }

    if (!this.checkRateLimit()) {
      throw new Error('WhatsApp rate limit exceeded');
    }

    try {
      const url = `${this.baseURL}/sendMessage/${this.token}`;
      
      const payload = {
        chatId: this.groupId,
        message: message
      };

      console.log('WhatsApp API Request:', { url, payload });
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('WhatsApp API Response:', response.data);

      this.updateRateLimit();

      if (response.data && response.data.idMessage) {
        return {
          success: true,
          messageId: response.data.idMessage
        };
      } else {
        throw new Error('Invalid response from Green API');
      }

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 429) {
          throw new Error('Rate limit exceeded by Green API');
        } else if (status === 401) {
          throw new Error('Invalid Green API credentials');
        } else if (status === 400) {
          throw new Error(`Bad request to Green API: ${JSON.stringify(data)}`);
        }
        
        throw new Error(`Green API error (${status}): ${JSON.stringify(data)}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request to Green API timed out');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  async getAccountInfo() {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp service not properly configured');
    }

    try {
      const url = `${this.baseURL}/getSettings/${this.token}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }

  checkRateLimit() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (now - this.rateLimitResetTime > oneHour) {
      this.rateLimitCount = 0;
      this.rateLimitResetTime = now;
    }
    
    return this.rateLimitCount < this.RATE_LIMIT_PER_HOUR;
  }

  updateRateLimit() {
    this.rateLimitCount++;
  }

  getRateLimitStatus() {
    return {
      count: this.rateLimitCount,
      limit: this.RATE_LIMIT_PER_HOUR,
      resetTime: new Date(this.rateLimitResetTime + 60 * 60 * 1000)
    };
  }
}

module.exports = WhatsAppService;