/**
 * Integration Test - Bot Setup Verification
 * 
 * This test verifies that the bot can be set up and configured
 * properly without requiring actual NIM API calls.
 */

describe('Bot Integration Test', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    process.env.NVIDIA_NIM_ENDPOINT = 'https://test-nim-endpoint.com';

    // Clear require cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/src/')) {
        delete require.cache[key];
      }
    });
  });

  test('should load all required modules without errors', () => {
    expect(() => {
      require('../src/config');
      require('../src/utils');
      require('../src/nim-service');
      require('../src/slack-service');
    }).not.toThrow();
  });

  test('should validate complete workflow', async () => {
    const { parseScheduleCommand } = require('../src/utils');
    
    // Test input parsing
    const input = '9AM-5PM "Review code (high, general)" "Team meeting (medium, meeting)"';
    const parsed = parseScheduleCommand(input);
    
    expect(parsed.timeframe).toBe('9AM-5PM');
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].description).toBe('Review code');
    expect(parsed.tasks[0].priority).toBe('high');
    expect(parsed.tasks[0].type).toBe('general');
  });

  test('should create proper Slack message format', () => {
    const SlackService = require('../src/slack-service');
    
    const mockSchedule = {
      schedule: [
        {
          task_id: 1,
          start_time: "09:00",
          end_time: "10:00", 
          duration: 60,
          task: "Test task",
          priority: "high",
          type: "general"
        }
      ],
      summary: { total_tasks: 1, total_duration: 60 }
    };

    const message = SlackService.createScheduleMessage(mockSchedule, '9AM-5PM');
    
    expect(message).toHaveProperty('text');
    expect(message).toHaveProperty('blocks');
    expect(message.blocks).toBeInstanceOf(Array);
    expect(message.blocks.length).toBeGreaterThan(0);
  });

  test('should handle various input formats', () => {
    const { parseScheduleCommand } = require('../src/utils');
    
    const testCases = [
      {
        input: 'morning "Quick task (high, general)"',
        expectValid: true
      },
      {
        input: '09:00-17:00 "Meeting (medium, meeting)" "Learning (low, learning)"',
        expectValid: true
      },
      {
        input: '', // empty
        expectValid: false
      },
      {
        input: 'no-quotes-here',
        expectValid: false
      }
    ];

    testCases.forEach(({ input, expectValid }) => {
      const result = parseScheduleCommand(input);
      
      if (expectValid) {
        expect(result.timeframe).toBeTruthy();
        expect(result.tasks.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      } else {
        expect(result.error).toBeTruthy();
      }
    });
  });
});

describe('Error Handling', () => {
  test('should handle missing environment variables gracefully', () => {
    // Clear environment variables
    delete process.env.SLACK_BOT_TOKEN;
    process.env.NODE_ENV = 'test'; // Keep in test mode to avoid validation

    expect(() => {
      const config = require('../src/config');
      expect(config).toBeDefined();
    }).not.toThrow();
  });

  test('should provide helpful error messages', () => {
    const { parseScheduleCommand } = require('../src/utils');
    
    const result = parseScheduleCommand('invalid input');
    expect(result.error).toContain('provide at least one task');
  });
}); 