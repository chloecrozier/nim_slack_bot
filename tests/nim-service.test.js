/**
 * Tests for NIM Service
 * 
 * Tests the NIM API integration with mocked HTTP calls
 */

const axios = require('axios');
const NIMService = require('../src/nim-service');

// Mock axios to avoid real API calls
jest.mock('axios');
const mockedAxios = axios;

// Mock config to avoid loading actual environment variables
jest.mock('../src/config', () => ({
  nim: {
    apiKey: 'test-api-key',
    endpoint: 'https://test-nim-endpoint.com',
    model: 'test-model',
    timeout: 30000,
    maxRetries: 2
  }
}));

describe('NIM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateSchedule', () => {
    test('should generate schedule successfully', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schedule: [
                    {
                      task_id: 1,
                      start_time: "09:00",
                      end_time: "10:30",
                      duration: 90,
                      task: "Review code",
                      priority: "high",
                      type: "general",
                      reasoning: "High priority task scheduled first"
                    }
                  ],
                  summary: {
                    total_tasks: 1,
                    total_duration: 90,
                    productivity_score: 8.5
                  },
                  recommendations: ["Focus on high-priority tasks first"]
                })
              }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const timeframe = '9AM-5PM';
      const tasks = [
        { description: 'Review code', priority: 'high', type: 'general' }
      ];

      const result = await NIMService.generateSchedule(timeframe, tasks);

      expect(result).toHaveProperty('schedule');
      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0]).toHaveProperty('task_id', 1);
      expect(result.schedule[0]).toHaveProperty('task', 'Review code');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('total_tasks', 1);

      // Verify API call was made correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-nim-endpoint.com/chat/completions',
        expect.objectContaining({
          model: 'test-model',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('expert productivity assistant')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(timeframe)
            })
          ]),
          temperature: 0.3,
          max_tokens: 2000
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          timeout: 30000
        })
      );
    });

    test('should handle JSON response with markdown code blocks', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify({
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
                  summary: { total_tasks: 1, total_duration: 60 }
                }) + '\n```'
              }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await NIMService.generateSchedule('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);

      expect(result).toHaveProperty('schedule');
      expect(result.schedule).toHaveLength(1);
    });

    test('should create fallback schedule for invalid JSON response', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Invalid JSON response from AI'
              }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await NIMService.generateSchedule('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);

      expect(result).toHaveProperty('schedule');
      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0].task).toBe('Review and organize your tasks');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Could not parse AI response');
    });

    test('should create fallback schedule for missing schedule array', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: { total_tasks: 1 },
                  // Missing schedule array
                })
              }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await NIMService.generateSchedule('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);

      expect(result).toHaveProperty('schedule');
      expect(result.schedule).toHaveLength(1);
      expect(result).toHaveProperty('error');
    });

    test('should retry on retryable errors', async () => {
      // First call fails with 500 error, second succeeds
      const networkError = {
        response: { status: 500 },
        message: 'Internal Server Error'
      };

      const successResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
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
                })
              }
            }
          ]
        }
      };

      mockedAxios.post
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const result = await NIMService.generateSchedule('9AM-5PM', [
        { description: 'Test task', priority: 'medium', type: 'general' }
      ]);

      expect(result).toHaveProperty('schedule');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should fail after max retries', async () => {
      const networkError = {
        response: { status: 500 },
        message: 'Internal Server Error'
      };

      mockedAxios.post.mockRejectedValue(networkError);

      await expect(
        NIMService.generateSchedule('9AM-5PM', [
          { description: 'Test task', priority: 'medium', type: 'general' }
        ])
      ).rejects.toThrow('Failed to generate schedule');

      // Should retry maxRetries + 1 times (initial + 2 retries = 3 total)
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const authError = {
        response: { status: 401 },
        message: 'Unauthorized'
      };

      mockedAxios.post.mockRejectedValue(authError);

      await expect(
        NIMService.generateSchedule('9AM-5PM', [
          { description: 'Test task', priority: 'medium', type: 'general' }
        ])
      ).rejects.toThrow('Failed to generate schedule');

      // Should only be called once (no retries for 401)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildSchedulePrompt', () => {
    test('should build proper prompt with tasks', () => {
      const timeframe = '9AM-5PM';
      const tasks = [
        { description: 'Review code', priority: 'high', type: 'general' },
        { description: 'Team meeting', priority: 'medium', type: 'meeting' },
        { description: 'Learning session', priority: 'low', type: 'learning' }
      ];

      // Access the private method through the instance
      const prompt = NIMService.buildSchedulePrompt(timeframe, tasks);

      expect(prompt).toContain(timeframe);
      expect(prompt).toContain('Review code');
      expect(prompt).toContain('Priority: high');
      expect(prompt).toContain('Type: general');
      expect(prompt).toContain('Team meeting');
      expect(prompt).toContain('Learning session');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('task_id');
      expect(prompt).toContain('start_time');
      expect(prompt).toContain('end_time');
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable errors', () => {
      const retryableErrors = [
        { code: 'ECONNABORTED' }, // Timeout
        { response: { status: 500 } }, // Server error
        { response: { status: 502 } }, // Bad gateway
        { response: { status: 503 } }, // Service unavailable
        { response: { status: 504 } }, // Gateway timeout
        { response: { status: 429 } }  // Rate limit
      ];

      retryableErrors.forEach(error => {
        expect(NIMService.isRetryableError(error)).toBe(true);
      });
    });

    test('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        { response: { status: 400 } }, // Bad request
        { response: { status: 401 } }, // Unauthorized
        { response: { status: 403 } }, // Forbidden
        { response: { status: 404 } }, // Not found
        { message: 'Some other error' }
      ];

      nonRetryableErrors.forEach(error => {
        expect(NIMService.isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('delay', () => {
    test('should delay for specified time', async () => {
      const start = Date.now();
      await NIMService.delay(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow for some timing variance
    });
  });
}); 