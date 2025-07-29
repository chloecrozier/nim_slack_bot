/**
 * Interactive Component Handlers
 * 
 * This module handles:
 * - Button interactions (task completion, modifications)
 * - Modal submissions
 * - Select menu interactions
 * - Schedule sharing and collaboration
 */

const nimService = require('../services/nim-service');
const slackService = require('../services/slack-service');
const scheduleService = require('../services/schedule-service');
const logger = require('../utils/logger');

class InteractionHandlers {
  /**
   * Handle task completion button clicks
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleTaskCompletion(ack, body, client) {
    await ack();

    try {
      const actionValue = JSON.parse(body.actions[0].value);
      const { task_id, index } = actionValue;

      logger.info('Handling task completion', {
        userId: body.user.id,
        taskId: task_id,
        taskIndex: index
      });

      // Update task status in database
      await scheduleService.updateTaskStatus(task_id, 'completed', {
        completionNotes: `Completed via Slack interaction at ${new Date().toISOString()}`
      });

      // Update the message to reflect completion
      await this.updateMessageWithTaskCompletion(client, body, index);

      // Send completion confirmation
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `✅ Task marked as completed! Great job! 🎉`
      });

    } catch (error) {
      logger.error('Error handling task completion:', error);
      
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: '❌ Failed to mark task as completed. Please try again.'
      });
    }
  }

  /**
   * Handle schedule modification requests
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleScheduleModification(ack, body, client) {
    await ack();

    try {
      // Open a modal for schedule modification
      const modal = this.buildScheduleModificationModal();

      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal
      });

    } catch (error) {
      logger.error('Error opening schedule modification modal:', error);
      
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: '❌ Failed to open modification dialog. Please try again.'
      });
    }
  }

  /**
   * Handle schedule modal submissions
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   * @param {Object} view - Modal view data
   */
  async handleScheduleModal(ack, body, client, view) {
    try {
      // Extract form data from modal
      const formData = this.extractModalData(view);

      if (!formData.isValid) {
        // Send validation errors back to modal
        await ack({
          response_action: 'errors',
          errors: formData.errors
        });
        return;
      }

      // Acknowledge the submission
      await ack();

      // Process the modification request
      await this.processScheduleModification(body, client, formData);

    } catch (error) {
      logger.error('Error handling schedule modal:', error);
      await ack();
    }
  }

  /**
   * Handle schedule sharing requests
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleScheduleSharing(ack, body, client) {
    await ack();

    try {
      // Open channel/user selection modal
      const modal = this.buildSharingModal();

      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal
      });

    } catch (error) {
      logger.error('Error opening sharing modal:', error);
    }
  }

  /**
   * Handle schedule regeneration
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleScheduleRegeneration(ack, body, client) {
    await ack();

    try {
      // Extract schedule data from the message
      const originalScheduleData = await this.extractScheduleFromMessage(body.message);

      if (!originalScheduleData) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: '❌ Could not find original schedule data for regeneration.'
        });
        return;
      }

      // Show loading state
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: '🔄 Regenerating your schedule...',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🔄 *Regenerating your schedule...*\n\nPlease wait while I create a new optimized version.'
            }
          }
        ]
      });

      // Generate new schedule
      const newSchedule = await nimService.generateSchedule(
        originalScheduleData.timeframe,
        originalScheduleData.tasks
      );

      // Update message with new schedule
      await slackService.updateScheduleMessage(
        body.channel.id,
        body.message.ts,
        newSchedule
      );

      logger.info('Schedule regenerated successfully', {
        userId: body.user.id,
        channelId: body.channel.id
      });

    } catch (error) {
      logger.error('Error regenerating schedule:', error);
      
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: '❌ Failed to regenerate schedule. Please try creating a new one.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ *Failed to regenerate schedule*\n\nSomething went wrong. Please try using `/schedule` to create a new schedule.'
            }
          }
        ]
      });
    }
  }

  /**
   * Update message to show task completion
   * 
   * @param {Object} client - Slack client
   * @param {Object} body - Interaction body
   * @param {number} taskIndex - Index of completed task
   */
  async updateMessageWithTaskCompletion(client, body, taskIndex) {
    try {
      // Get current message blocks
      const blocks = [...body.message.blocks];

      // Find and update the task block
      let blockIndex = 0;
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === 'section' && blocks[i].accessory?.action_id === 'complete_task') {
          if (blockIndex === taskIndex) {
            // Update the button to show completion
            blocks[i].accessory = {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Completed'
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
            break;
          }
          blockIndex++;
        }
      }

      // Update the message
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        blocks: blocks
      });

    } catch (error) {
      logger.error('Failed to update message with task completion:', error);
    }
  }

  /**
   * Build schedule modification modal
   * 
   * @returns {Object} Modal view definition
   */
  buildScheduleModificationModal() {
    return {
      type: 'modal',
      callback_id: 'schedule_modification_modal',
      title: {
        type: 'plain_text',
        text: 'Modify Schedule'
      },
      submit: {
        type: 'plain_text',
        text: 'Update Schedule'
      },
      close: {
        type: 'plain_text',
        text: 'Cancel'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*What would you like to modify?*'
          }
        },
        {
          type: 'input',
          block_id: 'modification_type',
          element: {
            type: 'checkboxes',
            action_id: 'modification_options',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Adjust task times'
                },
                value: 'adjust_times'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Change task priorities'
                },
                value: 'change_priorities'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Add new tasks'
                },
                value: 'add_tasks'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Remove tasks'
                },
                value: 'remove_tasks'
              }
            ]
          },
          label: {
            type: 'plain_text',
            text: 'Modification Options'
          }
        },
        {
          type: 'input',
          block_id: 'modification_notes',
          element: {
            type: 'plain_text_input',
            action_id: 'notes',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Describe what changes you\'d like to make...'
            }
          },
          label: {
            type: 'plain_text',
            text: 'Modification Details'
          },
          optional: true
        }
      ]
    };
  }

  /**
   * Build sharing modal
   * 
   * @returns {Object} Modal view definition
   */
  buildSharingModal() {
    return {
      type: 'modal',
      callback_id: 'schedule_sharing_modal',
      title: {
        type: 'plain_text',
        text: 'Share Schedule'
      },
      submit: {
        type: 'plain_text',
        text: 'Share'
      },
      close: {
        type: 'plain_text',
        text: 'Cancel'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Where would you like to share your schedule?*'
          }
        },
        {
          type: 'input',
          block_id: 'share_target',
          element: {
            type: 'multi_conversations_select',
            action_id: 'channels',
            placeholder: {
              type: 'plain_text',
              text: 'Select channels or users'
            }
          },
          label: {
            type: 'plain_text',
            text: 'Share with'
          }
        },
        {
          type: 'input',
          block_id: 'share_message',
          element: {
            type: 'plain_text_input',
            action_id: 'message',
            placeholder: {
              type: 'plain_text',
              text: 'Add a message (optional)'
            }
          },
          label: {
            type: 'plain_text',
            text: 'Message'
          },
          optional: true
        }
      ]
    };
  }

  /**
   * Extract data from modal submission
   * 
   * @param {Object} view - Modal view data
   * @returns {Object} Extracted and validated data
   */
  extractModalData(view) {
    try {
      const values = view.state.values;
      
      // Extract modification options
      const modificationType = values.modification_type?.modification_options?.selected_options || [];
      const notes = values.modification_notes?.notes?.value || '';

      // Basic validation
      const errors = {};
      if (modificationType.length === 0) {
        errors.modification_type = 'Please select at least one modification option';
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        data: {
          modificationType: modificationType.map(opt => opt.value),
          notes
        }
      };

    } catch (error) {
      logger.error('Error extracting modal data:', error);
      return {
        isValid: false,
        errors: { general: 'Failed to process form data' },
        data: {}
      };
    }
  }

  /**
   * Process schedule modification request
   * 
   * @param {Object} body - Interaction body
   * @param {Object} client - Slack client
   * @param {Object} formData - Extracted form data
   */
  async processScheduleModification(body, client, formData) {
    try {
      // For now, show a message that modification is being processed
      await client.chat.postEphemeral({
        channel: body.user.id, // Send as DM
        user: body.user.id,
        text: `🔧 *Schedule modification request received!*\n\nModifications: ${formData.data.modificationType.join(', ')}\nNotes: ${formData.data.notes || 'None'}\n\n_This feature is coming soon! For now, please use \`/schedule\` to create a new schedule._`
      });

    } catch (error) {
      logger.error('Error processing schedule modification:', error);
    }
  }

  /**
   * Extract schedule data from message for regeneration
   * 
   * @param {Object} message - Slack message object
   * @returns {Object|null} Schedule data or null if not found
   */
  async extractScheduleFromMessage(message) {
    try {
      // This is a simplified implementation
      // In a real application, you might store schedule metadata
      // in the message or retrieve it from the database
      
      // For now, return null to indicate data extraction is not implemented
      return null;

    } catch (error) {
      logger.error('Error extracting schedule from message:', error);
      return null;
    }
  }
}

module.exports = new InteractionHandlers(); 