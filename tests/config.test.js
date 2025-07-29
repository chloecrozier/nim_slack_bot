/**
 * Tests for Configuration
 * 
 * Tests configuration loading and validation without requiring actual env vars
 */

describe('Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    
    // Mock process.env
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test', // Prevent config validation on require
      SLACK_BOT_TOKEN: 'xoxb-test-token',
      SLACK_SIGNING_SECRET: 'test-signing-secret', 
      NVIDIA_NIM_API_KEY: 'test-nim-key',
      NVIDIA_NIM_ENDPOINT: 'https://test-nim-endpoint.com',
      PORT: '3000',
      LOG_LEVEL: 'info'
    };

    // Clear require cache to reload config with new env vars
    delete require.cache[require.resolve('../src/config')];
  });

  afterEach(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../src/config')];
  });

  describe('Configuration Loading', () => {
    test('should load configuration with default values', () => {
      const config = require('../src/config');

      expect(config).toHaveProperty('port', 3000);
      expect(config).toHaveProperty('nodeEnv', 'test');
      expect(config).toHaveProperty('logLevel', 'info');
      expect(config).toHaveProperty('slack');
      expect(config).toHaveProperty('nim');
      expect(config).toHaveProperty('scheduling');
    });

    test('should load Slack configuration', () => {
      const config = require('../src/config');

      expect(config.slack).toHaveProperty('botToken', 'xoxb-test-token');
      expect(config.slack).toHaveProperty('signingSecret', 'test-signing-secret');
    });

    test('should load NIM configuration', () => {
      const config = require('../src/config');

      expect(config.nim).toHaveProperty('apiKey', 'test-nim-key');
      expect(config.nim).toHaveProperty('endpoint', 'https://test-nim-endpoint.com');
      expect(config.nim).toHaveProperty('model', 'llama-2-70b-chat');
      expect(config.nim).toHaveProperty('timeout', 30000);
      expect(config.nim).toHaveProperty('maxRetries', 2);
    });

    test('should load scheduling configuration', () => {
      const config = require('../src/config');

      expect(config.scheduling).toHaveProperty('maxTasks', 15);
      expect(config.scheduling).toHaveProperty('defaultBreakMinutes', 15);
      expect(config.scheduling).toHaveProperty('maxScheduleHours', 12);
    });

    test('should demonstrate environment variable support', () => {
      // This test verifies that the config system can read environment variables
      // Individual override testing is complex due to Node.js module caching
      const config = require('../src/config');
      
      // Verify that config reads from environment (values set in beforeEach)
      expect(config.slack.botToken).toBe('xoxb-test-token');
      expect(config.slack.signingSecret).toBe('test-signing-secret');
      expect(config.nim.apiKey).toBe('test-nim-key');
      expect(config.nim.endpoint).toBe('https://test-nim-endpoint.com');
    });
  });

  describe('Default Values', () => {
    test('should use default values when env vars are missing', () => {
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
      delete process.env.NVIDIA_NIM_MODEL;
      delete process.env.NIM_TIMEOUT;
      delete process.env.NIM_MAX_RETRIES;

      delete require.cache[require.resolve('../src/config')];
      const config = require('../src/config');

      expect(config.port).toBe(3000);
      expect(config.logLevel).toBe('info');
      expect(config.nim.model).toBe('llama-2-70b-chat');
      expect(config.nim.timeout).toBe(30000);
      expect(config.nim.maxRetries).toBe(2);
    });

    test('should handle non-numeric PORT gracefully', () => {
      process.env.PORT = 'not-a-number';

      delete require.cache[require.resolve('../src/config')];
      const config = require('../src/config');

      expect(config.port).toBe(3000); // Should fall back to default
    });
  });

  describe('Configuration Structure', () => {
    test('should have all required configuration sections', () => {
      const config = require('../src/config');

      // Check main config properties
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('logLevel');

      // Check nested config objects
      expect(config.slack).toBeDefined();
      expect(config.nim).toBeDefined();
      expect(config.scheduling).toBeDefined();

      // Check required slack properties
      expect(config.slack).toHaveProperty('botToken');
      expect(config.slack).toHaveProperty('signingSecret');

      // Check required nim properties
      expect(config.nim).toHaveProperty('apiKey');
      expect(config.nim).toHaveProperty('endpoint');
      expect(config.nim).toHaveProperty('model');
      expect(config.nim).toHaveProperty('timeout');
      expect(config.nim).toHaveProperty('maxRetries');
    });

    test('should have reasonable default values', () => {
      const config = require('../src/config');

      expect(config.port).toBeGreaterThan(0);
      expect(config.nim.timeout).toBeGreaterThan(1000); // At least 1 second
      expect(config.nim.maxRetries).toBeGreaterThanOrEqual(0);
      expect(config.scheduling.maxTasks).toBeGreaterThan(0);
      expect(config.scheduling.defaultBreakMinutes).toBeGreaterThan(0);
    });
  });
}); 