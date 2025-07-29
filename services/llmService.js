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

      **TASK:** Generate a Discord post (STRICT MAXIMUM 1200 characters) about {topic} using this structure:

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
      - CRITICAL: Total character count MUST NOT exceed 1200 characters (including sources)
      - If approaching limit, prioritize core message over extensive sourcing
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
    let content = response.text;

    // If content is still too long, try AI shortening first, then fallback to truncation
    if (content.length > 1200) {
      this.logger.warn(`Content too long (${content.length} chars), attempting AI shortening`);
      content = await this.shortenWithOpenAI(content);
    }

    return content;
  }

  async shortenWithOpenAI(longContent) {
    try {
      this.logger.info(`Using OpenAI to shorten content from ${longContent.length} characters`);

      const shortenPrompt = `Shorten this work-from-home Discord post to EXACTLY 1200 characters or less while preserving:

1. The bold headline (keep intact)
2. Key statistics and data points
3. Main insights and conclusions  
4. ALL source citations with clickable URLs in format [1] <https://example.com>

CRITICAL REQUIREMENTS:
- Maximum 1200 characters total (including sources)
- Preserve professional tone
- Keep all source URLs clickable with < > brackets
- Maintain markdown formatting (**bold**)
- No additional text, explanations, or meta-comments

Original content:
${longContent}

Return ONLY the shortened post:`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content editor specializing in preserving key information while meeting strict character limits. Always preserve source citations and URLs.'
          },
          {
            role: 'user',
            content: shortenPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const shortenedContent = response.data.choices[0].message.content.trim();
        
        if (shortenedContent.length <= 1200) {
          this.logger.info(`Content successfully shortened to ${shortenedContent.length} characters using OpenAI`);
          return shortenedContent;
        } else {
          this.logger.warn(`OpenAI shortened content still too long (${shortenedContent.length} chars), using fallback`);
          return this.intelligentTruncate(longContent);
        }
      } else {
        throw new Error('Invalid response from OpenAI shortening service');
      }

    } catch (error) {
      this.logger.error('Error shortening content with OpenAI:', error);
      this.logger.info('Falling back to intelligent truncation');
      return this.intelligentTruncate(longContent);
    }
  }

  async shortenContent(longContent) {
    try {
      this.logger.info(`Content too long (${longContent.length} chars), attempting to shorten...`);
      
      const shortenPrompt = `
        Shorten this Discord post to exactly 1200 characters or less while preserving:
        1. The main headline and key statistics
        2. One actionable insight
        3. At least 2 source citations
        4. Professional tone
        
        Original content:
        ${longContent}
        
        Return only the shortened version with no extra text or explanations.
      `;

      let shortenedContent;
      
      if (this.provider === 'perplexity') {
        shortenedContent = await this.callPerplexity(shortenPrompt);
      } else if (this.provider === 'openai') {
        shortenedContent = await this.callOpenAI(shortenPrompt);
      } else if (this.provider === 'anthropic') {
        shortenedContent = await this.callAnthropic(shortenPrompt);
      }

      // Final fallback: intelligent truncation if AI shortening fails
      if (!shortenedContent || shortenedContent.length > 1200) {
        return this.intelligentTruncate(longContent);
      }

      this.logger.info(`Content successfully shortened to ${shortenedContent.length} characters`);
      return shortenedContent;

    } catch (error) {
      this.logger.error('Error shortening content:', error);
      return this.intelligentTruncate(longContent);
    }
  }

  intelligentTruncate(content) {
    if (content.length <= 1200) return content;

    // First, try to extract and preserve sources section
    const sourcesMatch = content.match(/### Sources[\s\S]*$/i) || 
                        content.match(/Sources:?[\s\S]*$/i) ||
                        content.match(/\[1\][\s\S]*$/);
    
    let sourcesSection = '';
    let mainContent = content;
    
    if (sourcesMatch) {
      sourcesSection = sourcesMatch[0];
      mainContent = content.substring(0, sourcesMatch.index);
    }

    // Calculate available space for main content
    const maxMainLength = 1150 - sourcesSection.length;
    
    if (mainContent.length > maxMainLength) {
      // Find the last complete sentence before the limit
      let lastSentenceEnd = mainContent.lastIndexOf('.', maxMainLength);
      
      if (lastSentenceEnd === -1) {
        lastSentenceEnd = mainContent.lastIndexOf('!', maxMainLength);
      }
      if (lastSentenceEnd === -1) {
        lastSentenceEnd = mainContent.lastIndexOf('?', maxMainLength);
      }
      
      // If no sentence ending found, look for last space
      if (lastSentenceEnd === -1) {
        lastSentenceEnd = mainContent.lastIndexOf(' ', maxMainLength);
      }
      
      // Fallback to hard truncation
      if (lastSentenceEnd === -1) {
        lastSentenceEnd = maxMainLength;
      }

      mainContent = mainContent.substring(0, lastSentenceEnd + 1);
    }

    // Combine main content with sources
    let result = mainContent;
    if (sourcesSection && result.length + sourcesSection.length + 10 < 1200) {
      result += '\n\n' + sourcesSection;
    } else if (sourcesSection) {
      // Try to include at least one source
      const firstSource = sourcesSection.match(/\[1\][^[]*?<[^>]+>/);
      if (firstSource && result.length + firstSource[0].length + 10 < 1200) {
        result += '\n\n' + firstSource[0];
      }
    }
    
    return result;
  }

  async generateDiscussionQuestion(postContent) {
    try {
      this.logger.info('Generating contextual discussion question');

      const questionPrompt = `Analyze this work-from-home Discord post and generate ONE engaging discussion question that:

1. Relates directly to the key topic/statistics mentioned
2. Encourages community members to share personal experiences
3. Is thought-provoking but not controversial
4. Can be answered by both experienced and new remote workers
5. Starts conversation, not debate

Post content to analyze:
${postContent}

Generate exactly ONE question (max 150 characters) that would spark healthy discussion. Return only the question with no additional text:`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a community engagement specialist who creates discussion questions that foster inclusive conversation and knowledge sharing among remote workers.'
          },
          {
            role: 'user',
            content: questionPrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const question = response.data.choices[0].message.content.trim();
        this.logger.info(`Generated discussion question: ${question}`);
        return `💬 **Discussion:** ${question}`;
      } else {
        throw new Error('Invalid response from OpenAI question generation');
      }

    } catch (error) {
      this.logger.error('Error generating discussion question:', error);
      // Fallback to generic questions based on common WFH topics
      const fallbackQuestions = [
        "💬 **Discussion:** What's your biggest remote work challenge this week?",
        "💬 **Discussion:** How do you maintain work-life balance when working from home?",
        "💬 **Discussion:** What's your most effective productivity tip for remote work?",
        "💬 **Discussion:** How has remote work changed your career perspective?",
        "💬 **Discussion:** What tools or setup improvements have made the biggest difference for you?"
      ];
      return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }
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