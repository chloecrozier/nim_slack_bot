/**
 * Simple Configuration for NIM Slack Bot
 * 
 * Loads environment variables and provides basic validation
 */

require('dotenv').config();

const config = {
  // Server settings
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Slack configuration
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
  },

  // NVIDIA NIM API configuration
  nim: {
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    endpoint: process.env.NVIDIA_NIM_ENDPOINT,
    model: process.env.NVIDIA_NIM_MODEL || 'llama-2-70b-chat',
    timeout: parseInt(process.env.NIM_TIMEOUT) || 30000, // 30 seconds
    maxRetries: parseInt(process.env.NIM_MAX_RETRIES) || 2
  },

  // Scheduling settings
  scheduling: {
    maxTasks: 15,
    defaultBreakMinutes: 15,
    maxScheduleHours: 12
  }
};

/**
 * Validate required configuration
 */
function validateConfig() {
  const required = [
    { key: 'SLACK_BOT_TOKEN', value: config.slack.botToken },
    { key: 'SLACK_SIGNING_SECRET', value: config.slack.signingSecret },
    { key: 'NVIDIA_NIM_API_KEY', value: config.nim.apiKey },
    { key: 'NVIDIA_NIM_ENDPOINT', value: config.nim.endpoint }
  ];

  const missing = required.filter(({ value }) => !value).map(({ key }) => key);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('📝 Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  // Validate NIM endpoint format
  if (!config.nim.endpoint.startsWith('http')) {
    console.error('❌ NVIDIA_NIM_ENDPOINT must start with http:// or https://');
    process.exit(1);
  }

  console.log('✅ Configuration validated successfully');
}

// Validate on load (except in tests)
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = config; 