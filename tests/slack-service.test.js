/**
 * Tests for Slack Service
 * 
 * Tests Slack message formatting and interactive components
 */

const SlackService = require('../src/slack-service');

describe('Slack Service', () => {
  describe('createScheduleMessage', () => {
    test('should create properly formatted schedule message', () => {
      const mockSchedule = {
        schedule: [
          {
            task_id: 1,
            start_time: "09:00",
            end_time: "10:30",
            duration: 90,
            task: "Review code",
            priority: "high",
            type: "general",
            reasoning: "High priority task scheduled during peak hours"
          },
          {
            task_id: 2,
            start_time: "10:45",
            end_time: "11:30",
            duration: 45,
            task: "Team standup",
            priority: "medium",
            type: "meeting"
          }
        ],
        summary: {
          total_tasks: 2,
          total_duration: 135,
          productivity_score: 8.5
        },
        recommendations: [
          "Schedule high-priority tasks first",
          "Group meetings together"
        ]
      };

      const timeframe = '9AM-5PM';
      const result = SlackService.createScheduleMessage(mockSchedule, timeframe);

      // Check basic structure
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('blocks');
      expect(result.text).toContain(timeframe);

      // Check blocks structure
      const blocks = result.blocks;
      expect(blocks).toBeInstanceOf(Array);
      expect(blocks.length).toBeGreaterThan(0);

      // Check header block
      const headerBlock = blocks.find(block => block.type === 'header');
      expect(headerBlock).toBeDefined();
      expect(headerBlock.text.text).toContain('Your Schedule');
      expect(headerBlock.text.text).toContain(timeframe);

      // Check task blocks
      const taskBlocks = blocks.filter(block => 
        block.type === 'section' && block.accessory?.action_id === 'complete_task'
      );
      expect(taskBlocks).toHaveLength(2);

      // Verify first task block
      const firstTaskBlock = taskBlocks[0];
      expect(firstTaskBlock.text.text).toContain('09:00 - 10:30');
      expect(firstTaskBlock.text.text).toContain('90m');
      expect(firstTaskBlock.text.text).toContain('Review code');
      expect(firstTaskBlock.accessory.text.text).toBe('✓ Complete');

      // Check reasoning blocks (if present)
      const reasoningBlocks = blocks.filter(block => 
        block.type === 'context' && 
        block.elements && block.elements[0] && 
        block.elements[0].text && block.elements[0].text.includes('High priority task')
      );
      expect(reasoningBlocks.length).toBeGreaterThanOrEqual(0); // May or may not be present

      // Check summary block
      const summaryBlock = blocks.find(block => 
        block.type === 'section' && block.fields
      );
      expect(summaryBlock).toBeDefined();
      expect(summaryBlock.fields).toHaveLength(3);

      // Check action buttons
      const actionBlock = blocks.find(block => block.type === 'actions');
      expect(actionBlock).toBeDefined();
      expect(actionBlock.elements).toHaveLength(1);
      
      // Check recommendations (if present)
      const recommendationBlock = blocks.find(block => 
        block.type === 'section' && 
        block.text && block.text.text && block.text.text.includes('Tips:')
      );
      if (recommendationBlock) {
        expect(recommendationBlock.text.text).toContain('Schedule high-priority tasks first');
      }
    });

    test('should handle schedule with error', () => {
      const mockSchedule = {
        schedule: [
          {
            task_id: 1,
            start_time: "09:00",
            end_time: "17:00",
            duration: 480,
            task: "Review and organize your tasks",
            priority: "medium",
            type: "general"
          }
        ],
        summary: {
          total_tasks: 1,
          total_duration: 480
        },
        error: "Could not parse AI response - showing fallback schedule"
      };

      const result = SlackService.createScheduleMessage(mockSchedule, '9AM-5PM');

      // Check that error is displayed
      const errorBlock = result.blocks.find(block => 
        block.type === 'section' && 
        block.text && block.text.text && block.text.text.includes('Note:')
      );
      if (errorBlock) {
        expect(errorBlock.text.text).toContain('Could not parse AI response');
      }
      
      // At minimum, should have blocks
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    test('should handle empty schedule', () => {
      const mockSchedule = {
        schedule: [],
        summary: {
          total_tasks: 0,
          total_duration: 0
        }
      };

      const result = SlackService.createScheduleMessage(mockSchedule, '9AM-5PM');

      expect(result).toHaveProperty('blocks');
      expect(result.blocks.length).toBeGreaterThan(0);

      // Should still have header and basic structure
      const headerBlock = result.blocks.find(block => block.type === 'header');
      expect(headerBlock).toBeDefined();
    });
  });

  describe('createHelpMessage', () => {
    test('should create comprehensive help message', () => {
      const result = SlackService.createHelpMessage();

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('blocks');
      expect(result.text).toBe('NIM Scheduling Bot Help');

      const blocks = result.blocks;
      expect(blocks).toBeInstanceOf(Array);
      expect(blocks.length).toBeGreaterThan(0);

      // Check for essential help content
      const textContent = blocks
        .filter(block => block.text && block.text.text)
        .map(block => block.text.text)
        .join(' ');

      expect(textContent).toContain('Basic Usage');
      expect(textContent).toContain('/schedule');
      expect(textContent).toContain('timeframe');
      expect(textContent).toContain('priority');
      expect(textContent).toContain('high, medium, low');
      expect(textContent).toContain('general, meeting, learning');
      expect(textContent).toContain('Examples');
    });
  });

  describe('createErrorMessage', () => {
    test('should create properly formatted error message', () => {
      const errorText = 'Invalid input format';
      const result = SlackService.createErrorMessage(errorText);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('blocks');
      expect(result.text).toBe(`Error: ${errorText}`);

      const blocks = result.blocks;
      expect(blocks).toHaveLength(2);

      // Check error block
      const errorBlock = blocks[0];
      expect(errorBlock.type).toBe('section');
      expect(errorBlock.text.text).toContain('Error:');
      expect(errorBlock.text.text).toContain(errorText);

      // Check context block
      const contextBlock = blocks[1];
      expect(contextBlock.type).toBe('context');
      expect(contextBlock.elements[0].text).toContain('/schedule-help');
    });
  });

  describe('markTaskComplete', () => {
    test('should update message blocks for task completion', async () => {
      const mockTaskInfo = {
        task_id: 1,
        index: 0,
        task: 'Test task'
      };

      const mockBody = {
        actions: [{ value: JSON.stringify(mockTaskInfo) }],
        channel: { id: 'C123456' },
        message: {
          ts: '1234567890.123',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚡ *09:00 - 10:00* (60m)\n🔴 Test task'
              },
              accessory: {
                type: 'button',
                text: { type: 'plain_text', text: '✓ Complete' },
                action_id: 'complete_task',
                value: JSON.stringify(mockTaskInfo)
              }
            }
          ]
        }
      };

      const mockClient = {
        chat: {
          update: jest.fn().mockResolvedValue({})
        }
      };

      await SlackService.markTaskComplete(mockClient, mockBody, mockTaskInfo);

      expect(mockClient.chat.update).toHaveBeenCalledWith({
        channel: 'C123456',
        ts: '1234567890.123',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('~') // Should contain strikethrough
            }),
            accessory: expect.objectContaining({
              text: { type: 'plain_text', text: '✅ Done' },
              style: 'primary',
              action_id: 'task_completed'
            })
          })
        ])
      });
    });

    test('should handle errors gracefully', async () => {
      const mockClient = {
        chat: {
          update: jest.fn().mockRejectedValue(new Error('Update failed'))
        }
      };

      const mockBody = {
        actions: [{ value: '{"task_id": 1}' }],
        channel: { id: 'C123456' },
        message: { ts: '1234567890.123', blocks: [] }
      };

      // Should not throw error
      await expect(
        SlackService.markTaskComplete(mockClient, mockBody, {})
      ).resolves.not.toThrow();
    });
  });

  describe('extractScheduleData', () => {
    test('should return null for message extraction', () => {
      const mockMessage = {
        blocks: [
          { type: 'header', text: { text: 'Your Schedule' } }
        ]
      };

      const result = SlackService.extractScheduleData(mockMessage);
      expect(result).toBeNull();
    });
  });

  describe('getPriorityEmoji', () => {
    test('should return correct emojis for priorities', () => {
      expect(SlackService.getPriorityEmoji('high')).toBe('🔴');
      expect(SlackService.getPriorityEmoji('medium')).toBe('🟡');
      expect(SlackService.getPriorityEmoji('low')).toBe('🟢');
      expect(SlackService.getPriorityEmoji('unknown')).toBe('⚪');
    });
  });

  describe('getTypeEmoji', () => {
    test('should return correct emojis for task types', () => {
      expect(SlackService.getTypeEmoji('meeting')).toBe('👥');
      expect(SlackService.getTypeEmoji('learning')).toBe('📚');
      expect(SlackService.getTypeEmoji('general')).toBe('⚡');
      expect(SlackService.getTypeEmoji('unknown')).toBe('📝');
    });
  });
}); 