const axios = require('axios');
const { PromptTemplate } = require("@langchain/core/prompts");
const { LLMChain } = require("langchain/chains");
const { ChatPerplexity } = require("@langchain/community/chat_models/perplexity");

class LLMService {
  constructor(logger) {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.perplexityKey = process.env.PERPLEXITY_API_KEY;
    this.logger = logger;
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
      const messages = [
        {
          role: 'system',
          content: 'You are a professional content strategist with expertise in creating engaging, data-driven short-form content. Your role is to generate high-quality, concise content that combines real-time research with compelling storytelling.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: messages,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.perplexityKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      this.logger.info('Perplexity API Full Response:', JSON.stringify(response.data, null, 2));

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

  async generateScheduledPost(options = {}) {
    const { stats = {}, masterPrompt, searchQuery } = options;

    if (!masterPrompt || !searchQuery) {
      this.logger.warn('Missing masterPrompt or searchQuery for scheduled post');
      return 'No content available at the moment. Please check back later.';
    }

    const topics = searchQuery.split(',').map(t => t.trim());
    const selectedTopic = topics[Math.floor(Math.random() * topics.length)];

    const promptTemplate = PromptTemplate.fromTemplate(`
      **ROLE:** You are a professional content strategist specializing in data-driven industry analysis. Your expertise includes synthesizing real-time research into actionable insights with academic rigor.

      **TASK:** Generate a Discord post (max 1200 chars) about {topic} using this structure:

      **1. COMPELLING HEADLINE**  
      - Create a provocative, data-anchored title under 15 words

      **2. INSIGHTFUL ANALYSIS (2-3 paragraphs)**  
      - Open with a statistically significant finding (2023-2025 data only)  
      - Integrate 3 specific metrics (e.g., "37% promotion gap," "4.2x visibility penalty")  
      - Cite sources using [1][2] notation after each data point  
      - Analyze systemic implications (proximity bias, measurement flaws)  
      - Maintain professional tone: Zero emojis, no colloquialisms  

      **3. ACTIONABLE INSIGHT (1 paragraph)**  
      - Provide one executable strategy for remote workers  
      - OR pose a discussion-worthy organizational paradox  

      **4. CONCLUSION (1 paragraph)**  
      - Forward-looking perspective with industry evolution forecast  

      **5. SOURCES**  
      - List 3-4 authoritative references (2024-2025 studies only)  
      - Format: [1] <Full URL> (e.g., [1] <https://www.example.com/study>)
      - Total character count includes sources  

      **RESEARCH PROTOCOL:**  
      1. Prioritize peer-reviewed journals and established research institutes  
      2. Cross-verify all statistics with 
2 sources  
      3. Reject data older than 2023  
      4. Flag any conflicting findings in analysis  

      **WRITING STANDARDS:**  
      - Active voice with concise syntax  
      - Paragraphs 
3 sentences. Aim for short, impactful sentences.  
      - Use bullet points for lists (e.g., for actionable insights or key takeaways) where appropriate.  
      - Quantitative emphasis (80% data, 20% interpretation)  
      - Avoid: Anecdotes, self-references, filler phrases  

      **EXAMPLE OUTPUT:**  
      "Remote Promotion Penalty: The 31% Visibility Gap [1]  
      New Stanford data reveals remote workers receive 31% fewer promotions despite 22% higher productivity metrics [2][3]. This exposes systemic proximity bias where..."  

      **PLATFORM CONSTRAINTS:**  
      - Discord formatting (basic markdown allowed: **bolding**, *italics* only; no lists or complex structures)  
      - Source URLs must be wrapped in angle brackets (e.g., <https://example.com>) to be clickable.  
      - Strict 1200-character ceiling  
      - Current date: Monday, June 30, 2025  
    `);

    const model = new ChatPerplexity({
      apiKey: this.perplexityKey,
      model: "llama-3.1-sonar-small-128k-online",
      temperature: 0.7,
      maxTokens: 400,
    });

    const chain = new LLMChain({ llm: model, prompt: promptTemplate });

    const response = await chain.invoke({ topic: selectedTopic });
    return response.text;
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
    
    return `${voiceChannelActivity.totalJoins} voice channel joins, peak activity at ${voiceChannelActivity.peakHour || 'various times'}`;
  }
}

module.exports = LLMService;