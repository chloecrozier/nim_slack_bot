/**
 * Simple Tests for Utility Functions
 */

const { parseScheduleCommand, parseTask, validateTimeframe } = require('../src/utils');

describe('Utility Functions', () => {
  
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
      expect(result.error).toBeDefined();
    });

    test('should handle input without quotes', () => {
      const result = parseScheduleCommand('9AM-5PM no quotes');
      expect(result.error).toBeDefined();
    });
  });

  describe('parseTask', () => {
    test('should parse task with priority and type', () => {
      const task = parseTask('Complete project (high, general)', 1);
      
      expect(task.description).toBe('Complete project');
      expect(task.priority).toBe('high');
      expect(task.type).toBe('general');
    });

    test('should use defaults for simple task', () => {
      const task = parseTask('Simple task', 1);
      
      expect(task.description).toBe('Simple task');
      expect(task.priority).toBe('medium');
      expect(task.type).toBe('general');
    });
  });

  describe('validateTimeframe', () => {
    test('should accept valid formats', () => {
      expect(validateTimeframe('9AM-5PM')).toBeNull();
      expect(validateTimeframe('morning')).toBeNull();
      expect(validateTimeframe('09:00-17:00')).toBeNull();
    });

    test('should reject invalid formats', () => {
      expect(validateTimeframe('')).toBeTruthy();
      expect(validateTimeframe('invalid')).toBeTruthy();
    });
  });
}); 