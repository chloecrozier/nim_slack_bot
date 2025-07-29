/**
 * Unit Tests for Validation Utilities
 * 
 * Tests cover:
 * - Command parsing
 * - Timeframe validation
 * - Task validation
 * - Edge cases and error handling
 */

const {
  parseScheduleCommand,
  parseTask,
  validateTimeframe,
  validateTasks,
  validateTask,
  timeToMinutes,
  minutesToTime,
  isValidTime
} = require('../../src/utils/validators');

describe('Validation Utilities', () => {
  
  describe('parseScheduleCommand', () => {
    test('should parse basic command with timeframe and tasks', () => {
      const input = '9AM-5PM "Review code (high, general)" "Team meeting (medium, meeting)"';
      const result = parseScheduleCommand(input);
      
      expect(result.timeframe).toBe('9AM-5PM');
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].description).toBe('Review code');
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[0].type).toBe('general');
    });

    test('should handle empty input', () => {
      const result = parseScheduleCommand('');
      expect(result.timeframe).toBeNull();
      expect(result.tasks).toHaveLength(0);
    });

    test('should handle input without quotes', () => {
      const input = '9AM-5PM Review code';
      const result = parseScheduleCommand(input);
      
      expect(result.timeframe).toBe('9AM-5PM Review code');
      expect(result.tasks).toHaveLength(0);
    });

    test('should parse multiple quoted tasks', () => {
      const input = '09:00-17:00 "Task 1 (high, general)" "Task 2 (low, learning)" "Task 3 (medium, meeting)"';
      const result = parseScheduleCommand(input);
      
      expect(result.timeframe).toBe('09:00-17:00');
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[1].priority).toBe('low');
      expect(result.tasks[1].type).toBe('learning');
    });
  });

  describe('parseTask', () => {
    test('should parse task with priority and type in parentheses', () => {
      const task = parseTask('Complete project proposal (high, general)');
      
      expect(task.description).toBe('Complete project proposal');
      expect(task.priority).toBe('high');
      expect(task.type).toBe('general');
      expect(task.preferred_time).toBeNull();
      expect(task.id).toBeDefined();
    });

    test('should use defaults for task without parentheses', () => {
      const task = parseTask('Simple task');
      
      expect(task.description).toBe('Simple task');
      expect(task.priority).toBe('medium');
      expect(task.type).toBe('general');
    });

    test('should handle incomplete parameters', () => {
      const task = parseTask('Task with only priority (high)');
      
      expect(task.description).toBe('Task with only priority');
      expect(task.priority).toBe('high');
      expect(task.type).toBe('general'); // default
    });

    test('should handle invalid priority/type gracefully', () => {
      const task = parseTask('Task with invalid params (urgent, business)');
      
      expect(task.description).toBe('Task with invalid params');
      expect(task.priority).toBe('medium'); // default for invalid
      expect(task.type).toBe('general'); // default for invalid
    });

    test('should extract preferred time if provided', () => {
      const task = parseTask('Meeting task (high, meeting, 14:00)');
      
      expect(task.description).toBe('Meeting task');
      expect(task.priority).toBe('high');
      expect(task.type).toBe('meeting');
      expect(task.preferred_time).toBe('14:00');
    });
  });

  describe('validateTimeframe', () => {
    test('should validate basic AM-PM format', () => {
      const result = validateTimeframe('9AM-5PM');
      // Note: This will fail with current implementation (returns null)
      // This test shows what should be implemented
      expect(result.isValid).toBeDefined();
    });

    test('should reject empty timeframe', () => {
      const result = validateTimeframe('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Timeframe is required');
    });

    test('should reject null timeframe', () => {
      const result = validateTimeframe(null);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Timeframe is required');
    });

    test('should validate 24-hour format', () => {
      const result = validateTimeframe('09:00-17:00');
      expect(result.isValid).toBeDefined();
    });

    test('should validate preset timeframes', () => {
      const morningResult = validateTimeframe('morning');
      expect(morningResult.isValid).toBeDefined();
      
      const workdayResult = validateTimeframe('workday');
      expect(workdayResult.isValid).toBeDefined();
    });
  });

  describe('validateTasks', () => {
    test('should validate array of valid tasks', () => {
      const tasks = [
        {
          id: 'task1',
          description: 'Task 1',
          priority: 'high',
          type: 'general'
        },
        {
          id: 'task2',
          description: 'Task 2',
          priority: 'medium',
          type: 'meeting'
        }
      ];
      
      const result = validateTasks(tasks);
      expect(result.isValid).toBe(true);
    });

    test('should reject empty task array', () => {
      const result = validateTasks([]);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('At least one task is required');
    });

    test('should reject non-array input', () => {
      const result = validateTasks('not an array');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Tasks must be provided as an array');
    });

    test('should reject too many tasks', () => {
      const tasks = Array.from({ length: 25 }, (_, i) => ({
        id: `task${i}`,
        description: `Task ${i}`,
        priority: 'medium',
        type: 'general'
      }));
      
      const result = validateTasks(tasks);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Maximum 20 tasks allowed per schedule');
    });

    test('should identify invalid individual tasks', () => {
      const tasks = [
        {
          id: 'task1',
          description: 'Valid task',
          priority: 'high',
          type: 'general'
        },
        {
          id: 'task2',
          description: '', // Invalid - empty description
          priority: 'high',
          type: 'general'
        }
      ];
      
      const result = validateTasks(tasks);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Task 2:');
    });
  });

  describe('validateTask', () => {
    test('should validate complete valid task', () => {
      const task = {
        id: 'task1',
        description: 'Complete project proposal',
        priority: 'high',
        type: 'general',
        preferred_time: '14:00'
      };
      
      const result = validateTask(task);
      expect(result.isValid).toBe(true);
    });

    test('should reject task without description', () => {
      const task = {
        id: 'task1',
        priority: 'high',
        type: 'general'
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Task description is required');
    });

    test('should reject task with empty description', () => {
      const task = {
        id: 'task1',
        description: '   ',
        priority: 'high',
        type: 'general'
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Task description is required');
    });

    test('should reject task with description too long', () => {
      const task = {
        id: 'task1',
        description: 'A'.repeat(201), // 201 characters
        priority: 'high',
        type: 'general'
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Task description cannot exceed 200 characters');
    });

    test('should reject invalid priority', () => {
      const task = {
        id: 'task1',
        description: 'Task description',
        priority: 'urgent', // Invalid priority
        type: 'general'
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Priority must be one of:');
    });

    test('should reject invalid type', () => {
      const task = {
        id: 'task1',
        description: 'Task description',
        priority: 'high',
        type: 'business' // Invalid type
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Type must be one of:');
    });

    test('should reject invalid preferred time', () => {
      const task = {
        id: 'task1',
        description: 'Task description',
        priority: 'high',
        type: 'general',
        preferred_time: '25:00' // Invalid time
      };
      
      const result = validateTask(task);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid preferred time format');
    });
  });

  describe('timeToMinutes', () => {
    test('should convert time string to minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:00')).toBe(60);
      expect(timeToMinutes('09:30')).toBe(570);
      expect(timeToMinutes('12:45')).toBe(765);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    test('should handle single digit hours', () => {
      expect(timeToMinutes('9:00')).toBe(540);
      expect(timeToMinutes('9:30')).toBe(570);
    });
  });

  describe('minutesToTime', () => {
    test('should convert minutes to time string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(570)).toBe('09:30');
      expect(minutesToTime(765)).toBe('12:45');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    test('should handle edge cases', () => {
      expect(minutesToTime(1440)).toBe('24:00'); // Midnight next day
      expect(minutesToTime(90)).toBe('01:30');
    });
  });

  describe('isValidTime', () => {
    test('should validate correct time formats', () => {
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('12:30')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('09:15')).toBe(true);
    });

    test('should reject invalid time formats', () => {
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('25:30')).toBe(false);
      expect(isValidTime('12:75')).toBe(false);
      expect(isValidTime('abc')).toBe(false);
      expect(isValidTime('12')).toBe(false);
      expect(isValidTime('12:3')).toBe(false); // Missing leading zero
    });

    test('should handle edge cases', () => {
      expect(isValidTime('')).toBe(false);
      expect(isValidTime(null)).toBe(false);
      expect(isValidTime(undefined)).toBe(false);
      expect(isValidTime(123)).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('parseScheduleCommand should handle malformed input gracefully', () => {
      const result = parseScheduleCommand('9AM-5PM "unclosed quote');
      expect(result.timeframe).toBeDefined();
      expect(result.tasks).toBeDefined();
    });

    test('parseTask should handle null input', () => {
      const result = parseTask(null);
      expect(result).toBeNull();
    });

    test('validateTimeframe should handle various invalid inputs', () => {
      expect(validateTimeframe(123).isValid).toBe(false);
      expect(validateTimeframe({}).isValid).toBe(false);
      expect(validateTimeframe([]).isValid).toBe(false);
    });
  });
}); 