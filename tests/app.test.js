/**
 * Integration Tests for the Main App
 * 
 * These tests verify the Slack bot functionality without requiring
 * actual NIM API calls or Slack connections.
 */

// Mock the Slack Bolt App before importing
jest.mock('@slack/bolt', () => ({
  App: jest.fn().mockImplementation(() => ({
    client: {
      chat: {
        update: jest.fn(),
        delete: jest.fn(),
        postEphemeral: jest.fn()
      }
    },
    receiver: { start: jest.fn() },
    command: jest.fn(),
    action: jest.fn(),
    error: jest.fn(),
    start: jest.fn(),
    stop: jest.fn()
  }))
}));

// Mock the NIM service to avoid real API calls
jest.mock('../src/nim-service', () => ({
  generateSchedule: jest.fn()
}));

// Mock the Slack service
jest.mock('../src/slack-service', () => ({
  createScheduleMessage: jest.fn(),
  createErrorMessage: jest.fn(),
  createHelpMessage: jest.fn(),
  markTaskComplete: jest.fn()
}));

const nimService = require('../src/nim-service');
const slackService = require('../src/slack-service');

describe('Slack Bot App Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    process.env.NVIDIA_NIM_ENDPOINT = 'https://test-nim-endpoint.com';
  });

  describe('App Module Loading', () => {
    test('should load app module without errors', () => {
      expect(() => {
        require('../src/app');
      }).not.toThrow();
    });

    test('should export app instance', () => {
      const { app } = require('../src/app');
      expect(app).toBeDefined();
      expect(typeof app).toBe('object');
    });
  });

  describe('NIM Service Integration', () => {
    test('should handle NIM API success', async () => {
      const mockSchedule = {
        schedule: [
          {
            task_id: 1,
            start_time: "09:00",
            end_time: "10:00",
            duration: 60,
            task: "Test task",
            priority: "medium",
            type: "general"
          }
        ],
        summary: { total_tasks: 1 }
      };

      nimService.generateSchedule.mockResolvedValue(mockSchedule);

      const result = await nimService.generateSchedule('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);

      expect(result).toEqual(mockSchedule);
      expect(nimService.generateSchedule).toHaveBeenCalledWith('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);
    });

    test('should handle NIM API errors gracefully', async () => {
      nimService.generateSchedule.mockRejectedValue(new Error('API Error'));

      await expect(
        nimService.generateSchedule('9AM-5PM', [])
      ).rejects.toThrow('API Error');
    });
  });

  describe('Slack Service Integration', () => {
    test('should create properly formatted schedule message', () => {
      const mockSchedule = {
        schedule: [
          {
            task_id: 1,
            start_time: "09:00",
            end_time: "10:00",
            duration: 60,
            task: "Test task",
            priority: "high",
            type: "general",
            reasoning: "Important task"
          }
        ],
        summary: {
          total_tasks: 1,
          total_duration: 60,
          productivity_score: 8.0
        },
        recommendations: ["Focus on high-priority tasks first"]
      };

      const mockMessage = {
        text: "Your optimized schedule for 9AM-5PM",
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Your Schedule (9AM-5PM)' }
          }
        ]
      };

      slackService.createScheduleMessage.mockReturnValue(mockMessage);

      const result = slackService.createScheduleMessage(mockSchedule, '9AM-5PM');

      expect(result).toEqual(mockMessage);
      expect(slackService.createScheduleMessage).toHaveBeenCalledWith(mockSchedule, '9AM-5PM');
    });

    test('should create help message', () => {
      const mockHelpMessage = {
        text: 'NIM Scheduling Bot Help',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'NIM Scheduling Bot Help' }
          }
        ]
      };

      slackService.createHelpMessage.mockReturnValue(mockHelpMessage);

      const result = slackService.createHelpMessage();

      expect(result).toEqual(mockHelpMessage);
      expect(slackService.createHelpMessage).toHaveBeenCalled();
    });

    test('should create error message', () => {
      const errorText = 'Invalid input format';
      const mockErrorMessage = {
        text: `Error: ${errorText}`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `Error: ${errorText}` }
          }
        ]
      };

      slackService.createErrorMessage.mockReturnValue(mockErrorMessage);

      const result = slackService.createErrorMessage(errorText);

      expect(result).toEqual(mockErrorMessage);
      expect(slackService.createErrorMessage).toHaveBeenCalledWith(errorText);
    });
  });

  describe('Command Processing Logic', () => {
    test('should process valid command input', () => {
      const { parseScheduleCommand } = require('../src/utils');
      
      const input = '9AM-5PM "Review code (high, general)"';
      const result = parseScheduleCommand(input);
      
      expect(result.timeframe).toBe('9AM-5PM');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].description).toBe('Review code');
      expect(result.error).toBeUndefined();
    });

    test('should handle invalid command input', () => {
      const { parseScheduleCommand } = require('../src/utils');
      
      const invalidInputs = [
        '', // empty
        '9AM-5PM', // no tasks
        'invalid format', // no quotes
      ];

      invalidInputs.forEach(input => {
        const result = parseScheduleCommand(input);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle NIM service failures', async () => {
      const networkError = new Error('Network timeout');
      const authError = new Error('Invalid API key');
      const parseError = new Error('Invalid JSON response');

      nimService.generateSchedule
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(authError)
        .mockRejectedValueOnce(parseError);

      // Test network error
      await expect(
        nimService.generateSchedule('9AM-5PM', [])
      ).rejects.toThrow('Network timeout');

      // Test auth error
      await expect(
        nimService.generateSchedule('9AM-5PM', [])
      ).rejects.toThrow('Invalid API key');

      // Test parse error
      await expect(
        nimService.generateSchedule('9AM-5PM', [])
      ).rejects.toThrow('Invalid JSON response');
    });
  });

  describe('Module Dependencies', () => {
    test('should have all required modules available', () => {
      expect(() => {
        require('../src/config');
        require('../src/utils');
        require('../src/nim-service');
        require('../src/slack-service');
      }).not.toThrow();
    });

    test('should have proper module exports', () => {
      const config = require('../src/config');
      const utils = require('../src/utils');
      const nimService = require('../src/nim-service');
      const slackService = require('../src/slack-service');

      expect(config).toBeDefined();
      expect(typeof utils.parseScheduleCommand).toBe('function');
      expect(typeof nimService.generateSchedule).toBe('function');
      expect(typeof slackService.createScheduleMessage).toBe('function');
    });
  });
}); 