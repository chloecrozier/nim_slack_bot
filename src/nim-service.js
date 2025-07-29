/**
 * NVIDIA NIM API Service
 * 
 * Simple service to generate schedules using your private NIM API
 */

const axios = require('axios');
const config = require('./config');

class NIMService {
  constructor() {
    this.apiKey = config.nim.apiKey;
    this.endpoint = config.nim.endpoint;
    this.model = config.nim.model;
    this.timeout = config.nim.timeout;
    this.maxRetries = config.nim.maxRetries;
  }

  /**
   * Generate an optimized schedule using NIM AI
   * 
   * @param {string} timeframe - Time window (e.g., "9:00 AM - 5:00 PM")
   * @param {Array} tasks - Array of task objects
   * @returns {Promise<Object>} Generated schedule
   */
  async generateSchedule(timeframe, tasks) {
    const prompt = this.buildSchedulePrompt(timeframe, tasks);
    
    console.log(`🤖 Calling NIM API for ${tasks.length} tasks in timeframe: ${timeframe}`);

    try {
      const response = await this.callNIM(prompt);
      const schedule = this.parseScheduleResponse(response);
      
      console.log(`✅ Generated schedule with ${schedule.schedule?.length || 0} items`);
      return schedule;

    } catch (error) {
      console.error('❌ NIM API Error:', error.message);
      throw new Error(`Failed to generate schedule: ${error.message}`);
    }
  }

  /**
   * Call the NIM API with retry logic
   */
  async callNIM(prompt, attempt = 1) {
    try {
      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert productivity assistant. Create optimal daily schedules based on user tasks and timeframes. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data.choices[0].message.content;

    } catch (error) {
      if (attempt <= this.maxRetries && this.isRetryableError(error)) {
        console.log(`⏳ Retrying NIM API call (${attempt}/${this.maxRetries})...`);
        await this.delay(1000 * attempt); // Progressive delay
        return this.callNIM(prompt, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Build the scheduling prompt
   */
  buildSchedulePrompt(timeframe, tasks) {
    const taskList = tasks.map((task, i) => 
      `${i + 1}. ${task.description} (Priority: ${task.priority}, Type: ${task.type})`
    ).join('\n');

    return `
Create an optimal daily schedule for these tasks within timeframe: ${timeframe}

Tasks:
${taskList}

Guidelines:
- High priority tasks should be scheduled first
- Learning tasks work best in morning (9-11 AM) or early afternoon (2-4 PM)
- Meetings should be grouped when possible
- Include 5-15 minute buffer time between tasks
- Add breaks for schedules longer than 4 hours

Respond with JSON in this EXACT format:
{
  "schedule": [
    {
      "task_id": 1,
      "start_time": "09:00",
      "end_time": "10:30",
      "duration": 90,
      "task": "Complete project proposal",
      "priority": "high",
      "type": "general",
      "reasoning": "High priority task scheduled during peak morning hours"
    }
  ],
  "summary": {
    "total_tasks": ${tasks.length},
    "total_duration": 480,
    "productivity_score": 8.5
  },
  "recommendations": [
    "Schedule high-priority tasks during morning peak hours"
  ]
}`;
  }

  /**
   * Parse and validate the NIM response
   */
  parseScheduleResponse(response) {
    try {
      // Clean up the response (remove any markdown code blocks)
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const schedule = JSON.parse(cleanResponse);

      // Basic validation
      if (!schedule.schedule || !Array.isArray(schedule.schedule)) {
        throw new Error('Invalid schedule format - missing schedule array');
      }

      // Ensure all required fields exist
      schedule.schedule.forEach((item, index) => {
        if (!item.task || !item.start_time || !item.end_time) {
          throw new Error(`Invalid task at index ${index} - missing required fields`);
        }
      });

      return schedule;

    } catch (error) {
      console.error('❌ Failed to parse NIM response:', error.message);
      console.error('Raw response:', response);
      
      // Return a fallback schedule
      return this.createFallbackSchedule(response);
    }
  }

  /**
   * Create a simple fallback schedule if parsing fails
   */
  createFallbackSchedule(originalResponse) {
    return {
      schedule: [
        {
          task_id: 1,
          start_time: "09:00",
          end_time: "17:00",
          duration: 480,
          task: "Review and organize your tasks",
          priority: "medium",
          type: "general",
          reasoning: "AI response could not be parsed - please try again"
        }
      ],
      summary: {
        total_tasks: 1,
        total_duration: 480,
        productivity_score: 5.0
      },
      recommendations: [
        "Try rephrasing your tasks or timeframe",
        "Ensure tasks follow the format: 'Description (priority, type)'"
      ],
      error: "Could not parse AI response - showing fallback schedule"
    };
  }

  /**
   * Check if error should trigger a retry
   */
  isRetryableError(error) {
    if (error.code === 'ECONNABORTED') return true; // Timeout
    if (error.response?.status >= 500) return true; // Server errors
    if (error.response?.status === 429) return true; // Rate limit
    return false;
  }

  /**
   * Simple delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NIMService(); 