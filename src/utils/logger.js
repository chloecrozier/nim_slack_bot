/**
 * Logging Utility
 * 
 * This module provides:
 * - Structured logging with Winston
 * - Different log levels and formats
 * - File and console transports
 * - Request/response logging
 * - Error tracking integration
 */

const winston = require('winston');
const config = require('../config/config');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create transports array
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: config.app.environment === 'development' ? consoleFormat : logFormat,
    level: config.app.logLevel.toLowerCase()
  })
];

// Add file transports for production
if (config.app.environment === 'production') {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.app.logLevel.toLowerCase(),
  format: logFormat,
  defaultMeta: {
    service: 'nim-slack-bot',
    environment: config.app.environment
  },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false
});

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: 'logs/exceptions.log',
    format: logFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: 'logs/rejections.log',
    format: logFormat
  })
);

/**
 * Log Slack API requests
 * 
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} data - Request data
 * @param {number} duration - Request duration in ms
 */
logger.logSlackRequest = (method, url, data, duration) => {
  logger.info('Slack API Request', {
    type: 'slack_api_request',
    method,
    url,
    duration,
    data: data ? JSON.stringify(data).substring(0, 500) : null // Truncate for privacy
  });
};

/**
 * Log Slack API responses
 * 
 * @param {string} url - Request URL
 * @param {number} status - Response status
 * @param {Object} response - Response data
 * @param {number} duration - Request duration in ms
 */
logger.logSlackResponse = (url, status, response, duration) => {
  const logLevel = status >= 400 ? 'error' : 'info';
  
  logger[logLevel]('Slack API Response', {
    type: 'slack_api_response',
    url,
    status,
    duration,
    response: response ? JSON.stringify(response).substring(0, 500) : null
  });
};

/**
 * Log NIM API requests
 * 
 * @param {Object} requestData - NIM request data
 * @param {number} duration - Request duration in ms
 */
logger.logNIMRequest = (requestData, duration) => {
  logger.info('NIM API Request', {
    type: 'nim_api_request',
    model: requestData.model,
    duration,
    tokens: requestData.max_tokens,
    temperature: requestData.temperature
  });
};

/**
 * Log NIM API responses
 * 
 * @param {Object} response - NIM response data
 * @param {number} duration - Request duration in ms
 */
logger.logNIMResponse = (response, duration) => {
  logger.info('NIM API Response', {
    type: 'nim_api_response',
    duration,
    usage: response.usage,
    model: response.model,
    responseLength: response.choices?.[0]?.message?.content?.length || 0
  });
};

/**
 * Log user interactions
 * 
 * @param {string} userId - Slack user ID
 * @param {string} action - Action performed
 * @param {Object} metadata - Additional metadata
 */
logger.logUserInteraction = (userId, action, metadata = {}) => {
  logger.info('User Interaction', {
    type: 'user_interaction',
    userId,
    action,
    ...metadata
  });
};

/**
 * Log schedule operations
 * 
 * @param {string} operation - Operation type (create, update, delete)
 * @param {string} scheduleId - Schedule ID
 * @param {string} userId - User ID
 * @param {Object} metadata - Additional metadata
 */
logger.logScheduleOperation = (operation, scheduleId, userId, metadata = {}) => {
  logger.info('Schedule Operation', {
    type: 'schedule_operation',
    operation,
    scheduleId,
    userId,
    ...metadata
  });
};

/**
 * Log performance metrics
 * 
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
logger.logPerformance = (operation, duration, metadata = {}) => {
  const logLevel = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes > 5s
  
  logger[logLevel]('Performance Metric', {
    type: 'performance',
    operation,
    duration,
    ...metadata
  });
};

/**
 * Log database operations
 * 
 * @param {string} operation - Database operation
 * @param {string} table - Table name
 * @param {number} duration - Query duration in ms
 * @param {Object} metadata - Additional metadata
 */
logger.logDatabaseOperation = (operation, table, duration, metadata = {}) => {
  const logLevel = duration > 1000 ? 'warn' : 'debug'; // Warn if query takes > 1s
  
  logger[logLevel]('Database Operation', {
    type: 'database_operation',
    operation,
    table,
    duration,
    ...metadata
  });
};

/**
 * Create child logger with additional context
 * 
 * @param {Object} context - Additional context to include in all logs
 * @returns {Object} Child logger instance
 */
logger.child = (context) => {
  return logger.child(context);
};

// Add stream for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger; 