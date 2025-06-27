const axios = require('axios');

class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.perplexityKey = process.env.PERPLEXITY_API_KEY;
  }

  isConfigured() {
    if (this.provider === 'openai') {
      return !!this.openaiKey;
    } else if (this.provider === 'anthropic') {
      return !!this.anthropicKey;
    } else if (this.provider === 'perplexity') {
      return !!this.perplexityKey;
    }
    return false;
  }

  async generateContent(prompt, context = {}) {
    if (!this.isConfigured()) {
      throw new Error('LLM service not properly configured');
    }

    const fullPrompt = this.buildPrompt(prompt, context);

    if (this.provider === 'openai') {
      return await this.callOpenAI(fullPrompt);
    } else if (this.provider === 'anthropic') {
      return await this.callAnthropic(fullPrompt);
    } else if (this.provider === 'perplexity') {
      return await this.callPerplexity(fullPrompt);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  buildPrompt(masterPrompt, context) {
    let prompt = masterPrompt;
    
    if (context.date) {
      prompt += `\n\nDate: ${context.date}`;
    }
    
    if (context.serverActivity) {
      prompt += `\n\nRecent server activity:\n${context.serverActivity}`;
    }
    
    if (context.voiceChannelStats) {
      prompt += `\n\nVoice channel activity:\n${context.voiceChannelStats}`;
    }
    
    prompt += '\n\nPlease generate an engaging Discord post (max 300 characters) that would encourage community participation.';
    
    return prompt;
  }

  async callOpenAI(prompt) {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly Discord community manager creating engaging posts to bring people together.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from OpenAI');
      }

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (status === 429) {
          throw new Error('OpenAI rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`OpenAI API error: ${data.error?.message || 'Bad request'}`);
        }
        
        throw new Error(`OpenAI API error (${status}): ${JSON.stringify(data)}`);
      }
      
      throw new Error(`Failed to call OpenAI: ${error.message}`);
    }
  }

  async callAnthropic(prompt) {
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        temperature: 0.8,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        headers: {
          'x-api-key': this.anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      });

      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text.trim();
      } else {
        throw new Error('Invalid response from Anthropic');
      }

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error('Invalid Anthropic API key');
        } else if (status === 429) {
          throw new Error('Anthropic rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`Anthropic API error: ${data.error?.message || 'Bad request'}`);
        }
        
        throw new Error(`Anthropic API error (${status}): ${JSON.stringify(data)}`);
      }
      
      throw new Error(`Failed to call Anthropic: ${error.message}`);
    }
  }

  async callPerplexity(prompt) {
    try {
      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides accurate and up-to-date information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.perplexityKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from Perplexity');
      }

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          throw new Error('Invalid Perplexity API key');
        } else if (status === 429) {
          throw new Error('Perplexity rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`Perplexity API error: ${data.error?.message || 'Bad request'}`);
        }
        
        throw new Error(`Perplexity API error (${status}): ${JSON.stringify(data)}`);
      }
      
      throw new Error(`Failed to call Perplexity: ${error.message}`);
    }
  }

  async generateScheduledPost(serverStats = {}) {
    if (this.provider === 'perplexity' && this.perplexityKey) {
      return await this.generateWFHArticlePost();
    }
    
    const masterPrompt = process.env.MASTER_PROMPT || 'Create an engaging post about the Discord community activities.';
    
    const context = {
      date: new Date().toLocaleDateString(),
      serverActivity: this.formatServerActivity(serverStats),
      voiceChannelStats: this.formatVoiceStats(serverStats.voiceActivity || {})
    };

    return await this.generateContent(masterPrompt, context);
  }

  async generateWFHArticlePost() {
    // Diverse WFH topics to rotate through
    const wfhTopics = [
      'latest remote work statistics and productivity trends',
      'work from home mental health and wellbeing research', 
      'home office ergonomics and setup best practices',
      'remote team collaboration and communication strategies',
      'digital nomad lifestyle and location independence trends',
      'work life balance challenges and solutions for remote workers',
      'hybrid workplace culture and management approaches',
      'remote work tools and technology adoption',
      'virtual meeting fatigue and video call optimization',
      'remote work career advancement and professional development',
      'distributed team management and leadership',
      'remote work cybersecurity and data protection'
    ];
    
    // Select a random topic for variety
    const selectedTopic = wfhTopics[Math.floor(Math.random() * wfhTopics.length)];
    
    try {
      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a workplace analyst who writes insightful, thought-provoking content about remote work. Your writing style is analytical, professional, and engaging. Use minimal emojis (1-2 max), blend data with practical insights, and avoid promotional language.'
          },
          {
            role: 'user',
            content: `Search for the latest information about: ${selectedTopic}

Find compelling and recent insights, research, or trends from this week. Create a Discord post that:

1. Leads with a compelling headline or insight
2. Combines data/statistics with practical observations
3. Analyzes what this reveals about remote work evolution
4. Includes actionable insights or thought-provoking questions
5. Ends with a meaningful conclusion
6. Keep it under 1200 characters (save space for source URLs)
7. Include numbered source citations [1], [2], etc.
8. Use analytical but accessible tone
9. Minimal emojis (1-2 maximum)

Reference style: "The 2025 Work Revolution: When Office Walls Crumbled for Good - This isn't just workplace evolution—it's a fundamental reimagining of how and where humans collaborate."

Focus on insights that genuinely help people understand and navigate remote work better.`
          }
        ],
        max_tokens: 250,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.perplexityKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        let content = response.data.choices[0].message.content.trim();
        
        // Add source URLs if available
        if (response.data.citations && response.data.citations.length > 0) {
          content += '\n\n**Sources:**';
          response.data.citations.forEach((url, index) => {
            content += `\n[${index + 1}] ${url}`;
          });
        }
        
        return content;
      } else {
        throw new Error('Invalid response from Perplexity');
      }

    } catch (error) {
      console.error('Perplexity API error:', error);
      // Fallback to a generic WFH tip if API fails
      return this.getFallbackWFHPost();
    }
  }

  getFallbackWFHPost() {
    const insights = [
      '**The Productivity Paradox of 2025**\n\nRemote workers log 51 additional productive minutes daily compared to their office counterparts, yet 42% report collaboration as their primary challenge. This data reveals a fascinating contradiction: we\'ve solved individual productivity but struggle with collective output.\n\nThe pattern suggests we\'re optimizing for the wrong metrics. Individual efficiency gains may be masking systemic collaboration inefficiencies that compound over time.',
      
      '**The Mental Health Divide in Remote Work**\n\n67% of remote workers report improved work-life balance, but 34% struggle with isolation and loneliness. The psychological infrastructure of distributed teams remains underdeveloped compared to our technological capabilities.\n\nWe\'ve solved the "where" of work but not the "how" of human connection in digital spaces.',
      
      '**The Ergonomics Crisis Hidden in Plain Sight**\n\n78% of remote workers experience physical discomfort, yet only 23% have proper ergonomic setups. The long-term health implications of improvised home offices may create a generation of workplace-related injuries.\n\nThis represents a massive shift in occupational health responsibility from employers to individuals.',
      
      '**Digital Nomadism: The Geography of Talent**\n\nLocation-independent workers now represent 4.8 million Americans, a 131% increase since 2019. This isn\'t just remote work—it\'s the complete decoupling of productivity from geography.\n\nWe\'re witnessing the birth of a truly global labor market where talent flows to opportunity, not proximity.',
      
      '**The Zoom Fatigue Phenomenon**\n\nVirtual meetings cause 13% more cognitive fatigue than in-person interactions due to increased visual processing demands. Our brains aren\'t optimized for the artificial intimacy of video calls.\n\nThis suggests we need new communication protocols designed for digital-first interaction, not digital adaptations of physical meetings.',
      
      '**The Career Advancement Paradox**\n\n43% of remote workers feel their career progression has stalled, despite productivity gains. Visibility and opportunity remain tied to physical presence in many organizations.\n\nThis reveals a fundamental disconnect between performance measurement and career development in distributed work environments.',
      
      '**The Home Office Real Estate Revolution**\n\nDedicated home office space increases productivity by 27% but only 31% of remote workers have access to one. Housing costs now directly impact work performance in ways previously unimaginable.\n\nThe boundary between personal real estate decisions and professional success has completely dissolved.',
      
      '**Virtual Team Dynamics: The New Social Physics**\n\nRemote teams with structured daily check-ins outperform traditional teams by 19% in project completion rates. The absence of physical cues requires more intentional communication frameworks.\n\nWe\'re discovering that human collaboration operates differently in digital spaces—not worse, just fundamentally different.'
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
  }

  formatServerActivity(stats) {
    if (!stats.messages && !stats.members) {
      return 'Server activity data not available.';
    }
    
    let activity = [];
    
    if (stats.messages) {
      activity.push(`${stats.messages} messages posted today`);
    }
    
    if (stats.members) {
      activity.push(`${stats.members} active members`);
    }
    
    if (stats.newMembers) {
      activity.push(`${stats.newMembers} new members joined`);
    }
    
    return activity.join(', ');
  }

  formatVoiceStats(voiceActivity) {
    if (!voiceActivity.totalJoins) {
      return 'No voice channel activity today.';
    }
    
    return `${voiceActivity.totalJoins} voice channel joins, peak activity at ${voiceActivity.peakHour || 'various times'}`;
  }
}

module.exports = LLMService;