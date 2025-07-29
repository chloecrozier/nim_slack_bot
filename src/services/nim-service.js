/**
 * NVIDIA NIM API Service
 * 
 * This service handles:
 * - Authentication with NVIDIA NIM API
 * - Schedule optimization requests
 * - Task duration estimation
 * - Error handling and retries
 * - Response parsing and validation
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class NIMService {
  constructor() {
    this.apiKey = config.nim.apiKey;
    this.endpoint = config.nim.endpoint;
    this.model = config.nim.model;
    this.timeout = config.nim.timeout;
    this.maxRetries = config.nim.maxRetries;
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('NIM API Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        logger.error('NIM API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('NIM API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('NIM API Response Error:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate an optimized schedule using NIM AI
   * 
   * @param {string} timeframe - The available time window (e.g., "9:00 AM - 5:00 PM")
   * @param {Array} tasks - Array of task objects with priority, type, and description
   * @returns {Promise<Object>} Optimized schedule with time estimates
   */
  async generateSchedule(timeframe, tasks) {
    try {
      const prompt = this.buildSchedulePrompt(timeframe, tasks);
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert productivity assistant specializing in optimal task scheduling.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent scheduling
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const scheduleData = JSON.parse(response.data.choices[0].message.content);
      return this.validateScheduleResponse(scheduleData);
      
    } catch (error) {
      logger.error('Failed to generate schedule:', error);
      throw new Error(`Schedule generation failed: ${error.message}`);
    }
  }

  /**
   * Estimate duration for individual tasks
   * 
   * @param {Array} tasks - Array of task objects
   * @returns {Promise<Array>} Tasks with estimated durations
   */
  async estimateTaskDurations(tasks) {
    try {
      const prompt = this.buildDurationPrompt(tasks);
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at estimating task durations based on descriptions and complexity.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const estimations = JSON.parse(response.data.choices[0].message.content);
      return this.mergeTaskEstimations(tasks, estimations);
      
    } catch (error) {
      logger.error('Failed to estimate task durations:', error);
      throw new Error(`Duration estimation failed: ${error.message}`);
    }
  }

  /**
   * Build the prompt for schedule optimization
   */
  buildSchedulePrompt(timeframe, tasks) {
    return `
Create an optimal daily schedule for the following tasks within the timeframe: ${timeframe}

Tasks:
${tasks.map((task, index) => `
${index + 1}. ${task.description}
   - Priority: ${task.priority}
   - Type: ${task.type}
   ${task.preferred_time ? `- Preferred time: ${task.preferred_time}` : ''}
`).join('')}

Consider:
- Task priorities (high > medium > low)
- Task types and optimal timing:
  * Meetings: Schedule at specified times or suggest optimal collaboration hours
  * Learning: Best during high-focus periods (typically 9-11 AM or 2-4 PM)
  * General: Flexible based on priority and complexity
- Realistic time estimates based on task descriptions
- 5-15 minute buffer time between tasks
- Include 15-30 minute breaks for schedules longer than 4 hours

Respond with JSON in this exact format:
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
      "reasoning": "High priority task scheduled during peak productivity hours"
    }
  ],
  "summary": {
    "total_tasks": 5,
    "total_duration": 420,
    "break_time": 45,
    "productivity_score": 8.5
  },
  "recommendations": [
    "Schedule high-priority tasks during morning peak hours",
    "Group similar task types together for better focus"
  ]
}`;
  }

  /**
   * Build the prompt for duration estimation
   */
  buildDurationPrompt(tasks) {
    return `
Estimate realistic durations (in minutes) for the following tasks:

${tasks.map((task, index) => `
${index + 1}. ${task.description}
   - Priority: ${task.priority}
   - Type: ${task.type}
`).join('')}

Consider task complexity, type, and typical duration for similar work.

Respond with JSON in this format:
{
  "estimations": [
    {
      "task_id": 1,
      "estimated_duration": 90,
      "confidence": "high",
      "reasoning": "Complex task requiring research and documentation"
    }
  ]
}`;
  }

  /**
   * Make HTTP request to NIM API with retry logic
   */
  async makeRequest(endpoint, data, retryCount = 0) {
    try {
      const response = await this.client.post(endpoint, data);
      return response;
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.warn(`Retrying NIM API request (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        return this.makeRequest(endpoint, data, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableStatus = [408, 429, 500, 502, 503, 504];
    return retryableStatus.includes(error.response?.status) || error.code === 'ECONNRESET';
  }

  /**
   * Delay utility for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate and sanitize schedule response from NIM
   */
  validateScheduleResponse(scheduleData) {
    // TODO: Add comprehensive validation logic
    // - Check required fields
    // - Validate time formats
    // - Ensure no overlapping tasks
    // - Verify task priorities match input
    
    if (!scheduleData.schedule || !Array.isArray(scheduleData.schedule)) {
      throw new Error('Invalid schedule format received from NIM');
    }
    
    return scheduleData;
  }

  /**
   * Merge task estimations with original task data
   */
  mergeTaskEstimations(tasks, estimations) {
    return tasks.map((task, index) => ({
      ...task,
      estimated_duration: estimations.estimations[index]?.estimated_duration || 60, // Default 1 hour
      estimation_confidence: estimations.estimations[index]?.confidence || 'medium'
    }));
  }
}

module.exports = new NIMService(); 