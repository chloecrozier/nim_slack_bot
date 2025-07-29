/**
 * Application configuration for the NIM Slack Scheduling Bot
 * 
 * This file:
 * - Loads environment variables
 * - Provides default values and validation
 * - Exports configuration objects for different components
 * - Handles different environments (development, production, test)
 */

require('dotenv').config();

const config = {
  // Application settings
  app: {
    port: parseInt(process.env.PORT) || 3000,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Slack configuration
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: process.env.SLACK_SOCKET_MODE === 'true' || false
  },

  // NVIDIA NIM API configuration
  nim: {
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    endpoint: process.env.NVIDIA_NIM_ENDPOINT,
    model: process.env.NVIDIA_NIM_MODEL || 'llama-2-70b-chat',
    timeout: parseInt(process.env.NIM_TIMEOUT) || 30000, // 30 seconds
    maxRetries: parseInt(process.env.NIM_MAX_RETRIES) || 3
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    // PostgreSQL specific settings
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'nim_slack_bot',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true'
    },
    // MongoDB specific settings
    mongodb: {
      host: process.env.MONGO_HOST || 'localhost',
      port: parseInt(process.env.MONGO_PORT) || 27017,
      database: process.env.MONGO_DB || 'nim_slack_bot',
      username: process.env.MONGO_USER,
      password: process.env.MONGO_PASSWORD
    }
  },

  // Redis configuration for caching and rate limiting
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.REDIS_TTL) || 3600 // 1 hour default
  },

  // Rate limiting configuration
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60,
    requestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR) || 1000
  },

  // Analytics and monitoring
  monitoring: {
    analyticsEnabled: process.env.ANALYTICS_ENABLED === 'true',
    sentryDsn: process.env.SENTRY_DSN,
    metricsPort: parseInt(process.env.METRICS_PORT) || 9090
  },

  // AI/NIM specific settings
  ai: {
    // Default prompt templates and settings
    maxTasksPerSchedule: parseInt(process.env.MAX_TASKS_PER_SCHEDULE) || 20,
    defaultBreakDuration: parseInt(process.env.DEFAULT_BREAK_DURATION) || 15, // minutes
    maxScheduleDuration: parseInt(process.env.MAX_SCHEDULE_DURATION) || 12, // hours
    
    // Task type settings
    taskTypes: {
      meeting: {
        minDuration: 15, // minutes
        maxDuration: 120,
        bufferTime: 5
      },
      learning: {
        minDuration: 30,
        maxDuration: 180,
        bufferTime: 10,
        preferredTimes: ['09:00', '10:00', '14:00'] // optimal focus hours
      },
      general: {
        minDuration: 15,
        maxDuration: 240,
        bufferTime: 5
      }
    }
  }
};

/**
 * Validate required configuration values
 */
function validateConfig() {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'NVIDIA_NIM_API_KEY',
    'NVIDIA_NIM_ENDPOINT'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate configuration on load
if (config.app.environment !== 'test') {
  validateConfig();
}

module.exports = config; 