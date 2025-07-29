/**
 * Slack Service
 * 
 * This service handles:
 * - Slack message formatting and sending
 * - Interactive component generation
 * - User data management
 * - Channel and user lookups
 * - Block Kit UI components
 */

const { WebClient } = require('@slack/web-api');
const config = require('../config/config');
const logger = require('../utils/logger');

class SlackService {
  constructor() {
    this.client = new WebClient(config.slack.botToken);
  }

  /**
   * Send a schedule as a formatted Slack message
   * 
   * @param {string} channel - Slack channel ID
   * @param {Object} schedule - Generated schedule from NIM
   * @param {string} originalTimeframe - User's requested timeframe
   * @returns {Promise<Object>} Slack API response
   */
  async sendScheduleMessage(channel, schedule, originalTimeframe) {
    try {
      const blocks = this.buildScheduleBlocks(schedule, originalTimeframe);
      
      const response = await this.client.chat.postMessage({
        channel: channel,
        text: `📅 Your optimized schedule for ${originalTimeframe}`,
        blocks: blocks,
        unfurl_links: false,
        unfurl_media: false
      });

      logger.info('Schedule message sent successfully', { 
        channel, 
        messageTs: response.ts 
      });
      
      return response;
      
    } catch (error) {
      logger.error('Failed to send schedule message:', error);
      throw new Error(`Failed to send schedule: ${error.message}`);
    }
  }

  /**
   * Send help/usage information
   * 
   * @param {string} channel - Slack channel ID
   * @param {string} userId - User ID for personalized help
   * @returns {Promise<Object>} Slack API response
   */
  async sendHelpMessage(channel, userId) {
    try {
      const blocks = this.buildHelpBlocks();
      
      const response = await this.client.chat.postMessage({
        channel: channel,
        text: 'NIM Scheduling Bot Help',
        blocks: blocks
      });

      return response;
      
    } catch (error) {
      logger.error('Failed to send help message:', error);
      throw error;
    }
  }

  /**
   * Send error message to user
   * 
   * @param {string} channel - Slack channel ID
   * @param {string} errorMessage - Error description
   * @param {boolean} isEphemeral - Whether message should be visible only to user
   */
  async sendErrorMessage(channel, errorMessage, isEphemeral = false) {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Error:* ${errorMessage}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Try `/schedule-help` for usage examples or contact support if the issue persists.'
            }
          ]
        }
      ];

      await this.client.chat.postMessage({
        channel: channel,
        text: `Error: ${errorMessage}`,
        blocks: blocks,
        response_type: isEphemeral ? 'ephemeral' : 'in_channel'
      });
      
    } catch (error) {
      logger.error('Failed to send error message:', error);
    }
  }

  /**
   * Update an existing message with new schedule data
   * 
   * @param {string} channel - Slack channel ID
   * @param {string} messageTs - Timestamp of message to update
   * @param {Object} schedule - Updated schedule data
   */
  async updateScheduleMessage(channel, messageTs, schedule) {
    try {
      const blocks = this.buildScheduleBlocks(schedule);
      
      await this.client.chat.update({
        channel: channel,
        ts: messageTs,
        text: '📅 Your updated schedule',
        blocks: blocks
      });
      
    } catch (error) {
      logger.error('Failed to update schedule message:', error);
      throw error;
    }
  }

  /**
   * Build Block Kit blocks for schedule display
   */
  buildScheduleBlocks(schedule, timeframe) {
    const blocks = [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 Your Schedule${timeframe ? ` (${timeframe})` : ''}`
        }
      },
      {
        type: 'divider'
      }
    ];

    // Schedule items
    schedule.schedule.forEach((item, index) => {
      const priorityEmoji = this.getPriorityEmoji(item.priority);
      const typeEmoji = this.getTypeEmoji(item.type);
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${typeEmoji} *${item.start_time} - ${item.end_time}* (${item.duration}m)\n${priorityEmoji} ${item.task}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✓ Complete'
          },
          action_id: 'complete_task',
          value: JSON.stringify({ task_id: item.task_id, index })
        }
      });

      if (item.reasoning) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `💡 ${item.reasoning}`
            }
          ]
        });
      }
    });

    // Summary section
    if (schedule.summary) {
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Tasks:* ${schedule.summary.total_tasks}`
            },
            {
              type: 'mrkdwn',
              text: `*Total Time:* ${Math.floor(schedule.summary.total_duration / 60)}h ${schedule.summary.total_duration % 60}m`
            },
            {
              type: 'mrkdwn',
              text: `*Break Time:* ${schedule.summary.break_time || 0}m`
            },
            {
              type: 'mrkdwn',
              text: `*Productivity Score:* ${schedule.summary.productivity_score || 'N/A'}/10`
            }
          ]
        }
      );
    }

    // Action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✏️ Modify Schedule'
          },
          action_id: 'modify_schedule',
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📤 Share'
          },
          action_id: 'share_schedule'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔄 Regenerate'
          },
          action_id: 'regenerate_schedule'
        }
      ]
    });

    // Recommendations
    if (schedule.recommendations && schedule.recommendations.length > 0) {
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Recommendations:*'
          }
        }
      );

      schedule.recommendations.forEach(rec => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${rec}`
          }
        });
      });
    }

    return blocks;
  }

  /**
   * Build help message blocks
   */
  buildHelpBlocks() {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 NIM Scheduling Bot Help'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'I help you create optimized schedules using AI! Here\'s how to use me:'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📝 Basic Usage:*\n`/schedule [timeframe] [tasks...]`'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*⏰ Timeframe Examples:*\n• `9AM-5PM` or `09:00-17:00`\n• `8:00 AM - 4:00 PM`\n• `morning` or `afternoon`'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📋 Task Format:*\n`"Task description (priority, type)"`\n\n*Priorities:* high, medium, low\n*Types:* general, meeting, learning'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💡 Examples:*\n`/schedule 9AM-5PM "Review code (high, general)" "Team meeting (high, meeting)" "Learn React (low, learning)"`\n\n`/schedule 8:00-16:00 "Finish presentation (high, general)" "1:1 with manager (medium, meeting)"`'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🆘 Need more help? Contact your workspace admin or check the documentation.'
          }
        ]
      }
    ];
  }

  /**
   * Get emoji for task priority
   */
  getPriorityEmoji(priority) {
    const emojis = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return emojis[priority] || '⚪';
  }

  /**
   * Get emoji for task type
   */
  getTypeEmoji(type) {
    const emojis = {
      meeting: '👥',
      learning: '📚',
      general: '⚡'
    };
    return emojis[type] || '📝';
  }

  /**
   * Get user information
   * 
   * @param {string} userId - Slack user ID
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(userId) {
    try {
      const response = await this.client.users.info({ user: userId });
      return response.user;
    } catch (error) {
      logger.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Get channel information
   * 
   * @param {string} channelId - Slack channel ID
   * @returns {Promise<Object>} Channel information
   */
  async getChannelInfo(channelId) {
    try {
      const response = await this.client.conversations.info({ channel: channelId });
      return response.channel;
    } catch (error) {
      logger.error('Failed to get channel info:', error);
      throw error;
    }
  }
}

module.exports = new SlackService(); 