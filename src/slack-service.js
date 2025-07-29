/**
 * Slack Service
 * 
 * Simple service for formatting and sending Slack messages
 */

class SlackService {
  /**
   * Create a formatted schedule message
   */
  createScheduleMessage(schedule, timeframe) {
    const blocks = [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 Your Schedule (${timeframe})`
        }
      },
      {
        type: 'divider'
      }
    ];

    // Add each scheduled task
    if (schedule.schedule && schedule.schedule.length > 0) {
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
            value: JSON.stringify({ 
              task_id: item.task_id || index, 
              index: index,
              task: item.task 
            })
          }
        });

        // Add reasoning if available
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
    }

    // Add summary if available
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
              text: `*Tasks:* ${schedule.summary.total_tasks}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:* ${Math.floor(schedule.summary.total_duration / 60)}h ${schedule.summary.total_duration % 60}m`
            },
            {
              type: 'mrkdwn',
              text: `*Score:* ${schedule.summary.productivity_score || 'N/A'}/10`
            }
          ]
        }
      );
    }

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔄 Regenerate'
          },
          action_id: 'regenerate_schedule',
          value: JSON.stringify({ timeframe, tasks: schedule.originalTasks || [] })
        }
      ]
    });

    // Add recommendations if available
    if (schedule.recommendations && schedule.recommendations.length > 0) {
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Tips:*\n' + schedule.recommendations.map(rec => `• ${rec}`).join('\n')
          }
        }
      );
    }

    // Show error if fallback was used
    if (schedule.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Note:* ${schedule.error}`
        }
      });
    }

    return {
      text: `📅 Your optimized schedule for ${timeframe}`,
      blocks: blocks
    };
  }

  /**
   * Create help message
   */
  createHelpMessage() {
    return {
      text: 'NIM Scheduling Bot Help',
      blocks: [
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
            text: 'I create optimized schedules using AI! Here\'s how:'
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
            text: '*⏰ Timeframes:*\n• `9AM-5PM` or `09:00-17:00`\n• `morning`, `afternoon`, `workday`'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📋 Tasks:*\n`"Description (priority, type)"`\n\n*Priorities:* high, medium, low\n*Types:* general, meeting, learning'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Examples:*\n`/schedule 9AM-5PM "Review code (high, general)" "Team standup (medium, meeting)"`\n\n`/schedule morning "Focus work (high, general)" "Learning time (low, learning)"`'
          }
        }
      ]
    };
  }

  /**
   * Create error message
   */
  createErrorMessage(error) {
    return {
      text: `Error: ${error}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Error:* ${error}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Try `/schedule-help` for usage examples.'
            }
          ]
        }
      ]
    };
  }

  /**
   * Mark a task as complete by updating the message
   */
  async markTaskComplete(client, body, taskInfo) {
    try {
      const blocks = [...body.message.blocks];
      
      // Find and update the task block
      let updated = false;
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === 'section' && 
            blocks[i].accessory?.action_id === 'complete_task' &&
            blocks[i].accessory?.value === body.actions[0].value) {
          
          // Update button to show completion
          blocks[i].accessory = {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Done'
            },
            style: 'primary',
            action_id: 'task_completed',
            value: 'completed'
          };

          // Add strikethrough to task text
          if (blocks[i].text?.text) {
            blocks[i].text.text = blocks[i].text.text.replace(
              /^(.*?)(\n.*?)$/,
              '~$1~$2'
            );
          }
          
          updated = true;
          break;
        }
      }

      if (updated) {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          blocks: blocks
        });
      }

    } catch (error) {
      console.error('Failed to mark task complete:', error);
    }
  }

  /**
   * Extract schedule data from a message (for regeneration)
   */
  extractScheduleData(message) {
    // Simple extraction - in a real app you might store this data
    // For now, return null to indicate regeneration isn't available
    return null;
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
}

module.exports = new SlackService(); 