/**
 * Utility Functions
 * 
 * Simple parsing and validation for the Slack bot
 */

/**
 * Parse the /schedule command input
 * 
 * @param {string} text - Raw command text from Slack
 * @returns {Object} Parsed timeframe, tasks, and any errors
 */
function parseScheduleCommand(text) {
  try {
    if (!text || text.trim() === '') {
      return { 
        error: 'Please provide a timeframe and tasks. Try `/schedule-help` for examples.' 
      };
    }

    // Split by quotes to separate timeframe from quoted tasks
    const parts = text.match(/([^"]+)|"([^"]*)"/g) || [];
    
    if (parts.length === 0) {
      return { 
        error: 'Invalid format. Use: `/schedule [timeframe] "task 1 (priority, type)" "task 2 (priority, type)"`' 
      };
    }

    // First part is the timeframe
    const timeframe = parts[0].trim();
    
    // Remaining quoted parts are tasks
    const taskStrings = parts.slice(1)
      .filter(part => part.startsWith('"') && part.endsWith('"'))
      .map(part => part.slice(1, -1)); // Remove quotes

    if (taskStrings.length === 0) {
      return { 
        error: 'Please provide at least one task in quotes. Example: `"Review code (high, general)"`' 
      };
    }

    // Parse individual tasks
    const tasks = taskStrings.map((taskStr, index) => parseTask(taskStr, index + 1))
      .filter(task => task !== null);

    if (tasks.length === 0) {
      return { 
        error: 'No valid tasks found. Use format: `"Description (priority, type)"`' 
      };
    }

    // Validate timeframe
    const timeframeError = validateTimeframe(timeframe);
    if (timeframeError) {
      return { error: timeframeError };
    }

    return { timeframe, tasks };

  } catch (error) {
    return { 
      error: 'Failed to parse command. Try `/schedule-help` for the correct format.' 
    };
  }
}

/**
 * Parse individual task string
 * 
 * @param {string} taskStr - Task string like "Do something (high, general)"
 * @param {number} taskNum - Task number for error messages
 * @returns {Object|null} Parsed task object or null if invalid
 */
function parseTask(taskStr, taskNum) {
  try {
    // Pattern: "description (priority, type)"
    const match = taskStr.match(/^(.+?)\s*\(([^)]+)\)$/);
    
    if (!match) {
      // Simple task without parentheses - use defaults
      return {
        id: `task_${taskNum}`,
        description: taskStr.trim(),
        priority: 'medium',
        type: 'general'
      };
    }

    const description = match[1].trim();
    const params = match[2].split(',').map(p => p.trim().toLowerCase());

    // Extract priority and type
    const validPriorities = ['high', 'medium', 'low'];
    const validTypes = ['general', 'meeting', 'learning'];
    
    let priority = 'medium';
    let type = 'general';

    params.forEach(param => {
      if (validPriorities.includes(param)) {
        priority = param;
      } else if (validTypes.includes(param)) {
        type = param;
      }
    });

    return {
      id: `task_${taskNum}`,
      description,
      priority,
      type
    };

  } catch (error) {
    console.error(`Failed to parse task ${taskNum}:`, error);
    return null;
  }
}

/**
 * Validate timeframe format
 * 
 * @param {string} timeframe - User input timeframe
 * @returns {string|null} Error message or null if valid
 */
function validateTimeframe(timeframe) {
  if (!timeframe || timeframe.trim() === '') {
    return 'Timeframe is required';
  }

  const tf = timeframe.toLowerCase().trim();
  
  // Check preset timeframes
  const presets = ['morning', 'afternoon', 'evening', 'workday', 'business hours'];
  if (presets.includes(tf)) {
    return null; // Valid preset
  }

  // Check time range formats
  const timeRangePatterns = [
    /^\d{1,2}(am|pm)\s*-\s*\d{1,2}(am|pm)$/i,           // 9AM-5PM
    /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/,               // 09:00-17:00
    /^\d{1,2}:\d{2}\s*(am|pm)\s*-\s*\d{1,2}:\d{2}\s*(am|pm)$/i // 9:00 AM - 5:00 PM
  ];

  const isValidFormat = timeRangePatterns.some(pattern => pattern.test(tf));
  
  if (!isValidFormat) {
    return 'Invalid timeframe format. Use formats like "9AM-5PM", "09:00-17:00", or "morning"';
  }

  return null; // Valid
}

/**
 * Validate complete input
 * 
 * @param {Object} input - Parsed input object
 * @returns {Object} Validation result
 */
function validateInput(input) {
  if (input.error) {
    return { isValid: false, error: input.error };
  }

  if (!input.timeframe) {
    return { isValid: false, error: 'Timeframe is required' };
  }

  if (!input.tasks || input.tasks.length === 0) {
    return { isValid: false, error: 'At least one task is required' };
  }

  if (input.tasks.length > 15) {
    return { isValid: false, error: 'Maximum 15 tasks allowed per schedule' };
  }

  return { isValid: true };
}

/**
 * Generate a simple task ID
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

module.exports = {
  parseScheduleCommand,
  parseTask,
  validateTimeframe,
  validateInput,
  generateTaskId
}; 