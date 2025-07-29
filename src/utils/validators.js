/**
 * Input Validation Utilities
 * 
 * This module provides:
 * - Command input parsing
 * - Timeframe validation and normalization
 * - Task format validation
 * - Priority and type validation
 * - Error message generation
 */

const moment = require('moment');
const logger = require('./logger');

/**
 * Parse the /schedule command input
 * 
 * @param {string} text - Raw command text from Slack
 * @returns {Object} Parsed timeframe and tasks
 */
function parseScheduleCommand(text) {
  try {
    if (!text || text.trim() === '') {
      return { timeframe: null, tasks: [] };
    }

    // Split by quotes to separate timeframe from quoted tasks
    const parts = text.match(/([^"]+)|"([^"]*)"/g);
    
    if (!parts || parts.length === 0) {
      return { timeframe: null, tasks: [] };
    }

    // First non-quoted part should be the timeframe
    const timeframe = parts[0].trim();
    
    // Remaining quoted parts are tasks
    const tasks = parts.slice(1)
      .filter(part => part.startsWith('"') && part.endsWith('"'))
      .map(part => parseTask(part.slice(1, -1))) // Remove quotes
      .filter(task => task !== null);

    return { timeframe, tasks };

  } catch (error) {
    logger.error('Error parsing schedule command:', error);
    return { timeframe: null, tasks: [] };
  }
}

/**
 * Parse individual task from text
 * 
 * @param {string} taskText - Task description with priority and type
 * @returns {Object|null} Parsed task object or null if invalid
 */
function parseTask(taskText) {
  try {
    // Pattern to match: "description (priority, type)" or "description (priority, type, preferred_time)"
    const match = taskText.match(/^(.+?)\s*\(([^)]+)\)$/);
    
    if (!match) {
      // Simple task without parentheses - use defaults
      return {
        id: generateTaskId(),
        description: taskText.trim(),
        priority: 'medium',
        type: 'general',
        preferred_time: null
      };
    }

    const description = match[1].trim();
    const params = match[2].split(',').map(p => p.trim().toLowerCase());

    // Extract priority and type from parameters
    const validPriorities = ['high', 'medium', 'low'];
    const validTypes = ['general', 'meeting', 'learning'];
    
    let priority = 'medium';
    let type = 'general';
    let preferred_time = null;

    params.forEach(param => {
      if (validPriorities.includes(param)) {
        priority = param;
      } else if (validTypes.includes(param)) {
        type = param;
      } else if (isValidTime(param)) {
        preferred_time = param;
      }
    });

    return {
      id: generateTaskId(),
      description,
      priority,
      type,
      preferred_time
    };

  } catch (error) {
    logger.error('Error parsing task:', error);
    return null;
  }
}

/**
 * Validate timeframe format and convert to standard format
 * 
 * @param {string} timeframe - User input timeframe
 * @returns {Object} Validation result with normalized timeframe
 */
function validateTimeframe(timeframe) {
  try {
    if (!timeframe || typeof timeframe !== 'string') {
      return {
        isValid: false,
        error: 'Timeframe is required'
      };
    }

    const normalized = normalizeTimeframe(timeframe.trim());
    
    if (!normalized) {
      return {
        isValid: false,
        error: 'Invalid timeframe format. Use formats like "9AM-5PM", "09:00-17:00", or "morning"'
      };
    }

    // Validate that end time is after start time
    if (normalized.startTime >= normalized.endTime) {
      return {
        isValid: false,
        error: 'End time must be after start time'
      };
    }

    // Validate reasonable duration (at least 1 hour, max 16 hours)
    const duration = normalized.endTime - normalized.startTime;
    if (duration < 60) {
      return {
        isValid: false,
        error: 'Schedule duration must be at least 1 hour'
      };
    }
    
    if (duration > 960) { // 16 hours
      return {
        isValid: false,
        error: 'Schedule duration cannot exceed 16 hours'
      };
    }

    return {
      isValid: true,
      normalized,
      duration
    };

  } catch (error) {
    logger.error('Error validating timeframe:', error);
    return {
      isValid: false,
      error: 'Invalid timeframe format'
    };
  }
}

/**
 * Normalize various timeframe formats to standard format
 * 
 * @param {string} timeframe - Raw timeframe input
 * @returns {Object|null} Normalized timeframe object or null if invalid
 */
function normalizeTimeframe(timeframe) {
  const formats = [
    // "9AM-5PM", "9am-5pm"
    /^(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)$/i,
    // "09:00-17:00", "9:00-17:00"
    /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/,
    // "9:00 AM - 5:00 PM"
    /^(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i
  ];

  // Try different patterns
  for (const format of formats) {
    const match = timeframe.match(format);
    if (match) {
      return parseTimeMatch(match);
    }
  }

  // Handle preset timeframes
  const presets = {
    'morning': { start: '09:00', end: '12:00' },
    'afternoon': { start: '13:00', end: '17:00' },
    'evening': { start: '18:00', end: '21:00' },
    'workday': { start: '09:00', end: '17:00' },
    'business hours': { start: '09:00', end: '17:00' }
  };

  const preset = presets[timeframe.toLowerCase()];
  if (preset) {
    return {
      startTime: timeToMinutes(preset.start),
      endTime: timeToMinutes(preset.end),
      formatted: `${preset.start} - ${preset.end}`
    };
  }

  return null;
}

/**
 * Parse time match results into normalized format
 */
function parseTimeMatch(match) {
  // TODO: Implement comprehensive time parsing
  // This is a simplified version - full implementation would handle:
  // - 12/24 hour formats
  // - AM/PM indicators
  // - Various separators
  // - Edge cases like midnight crossing
  
  return null; // Placeholder
}

/**
 * Convert time string to minutes since midnight
 * 
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 * 
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Validate array of tasks
 * 
 * @param {Array} tasks - Array of task objects
 * @returns {Object} Validation result
 */
function validateTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return {
      isValid: false,
      error: 'Tasks must be provided as an array'
    };
  }

  if (tasks.length === 0) {
    return {
      isValid: false,
      error: 'At least one task is required'
    };
  }

  if (tasks.length > 20) {
    return {
      isValid: false,
      error: 'Maximum 20 tasks allowed per schedule'
    };
  }

  // Validate each task
  for (let i = 0; i < tasks.length; i++) {
    const taskValidation = validateTask(tasks[i]);
    if (!taskValidation.isValid) {
      return {
        isValid: false,
        error: `Task ${i + 1}: ${taskValidation.error}`
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate individual task object
 * 
 * @param {Object} task - Task object to validate
 * @returns {Object} Validation result
 */
function validateTask(task) {
  if (!task || typeof task !== 'object') {
    return {
      isValid: false,
      error: 'Task must be an object'
    };
  }

  if (!task.description || typeof task.description !== 'string' || task.description.trim() === '') {
    return {
      isValid: false,
      error: 'Task description is required'
    };
  }

  if (task.description.length > 200) {
    return {
      isValid: false,
      error: 'Task description cannot exceed 200 characters'
    };
  }

  const validPriorities = ['high', 'medium', 'low'];
  if (task.priority && !validPriorities.includes(task.priority)) {
    return {
      isValid: false,
      error: `Priority must be one of: ${validPriorities.join(', ')}`
    };
  }

  const validTypes = ['general', 'meeting', 'learning'];
  if (task.type && !validTypes.includes(task.type)) {
    return {
      isValid: false,
      error: `Type must be one of: ${validTypes.join(', ')}`
    };
  }

  if (task.preferred_time && !isValidTime(task.preferred_time)) {
    return {
      isValid: false,
      error: 'Invalid preferred time format'
    };
  }

  return { isValid: true };
}

/**
 * Check if string represents a valid time
 * 
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} Whether time is valid
 */
function isValidTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return false;
  }

  // Simple time validation - could be expanded
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Generate unique task ID
 * 
 * @returns {string} Unique task identifier
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  parseScheduleCommand,
  parseTask,
  validateTimeframe,
  validateTasks,
  validateTask,
  normalizeTimeframe,
  timeToMinutes,
  minutesToTime,
  isValidTime,
  generateTaskId
}; 