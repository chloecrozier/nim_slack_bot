/**
 * Slash Command Handlers
 * 
 * This module handles:
 * - /schedule command processing
 * - /schedule-help command
 * - Input parsing and validation
 * - Integration with NIM and Slack services
 * - Error handling and user feedback
 */

const nimService = require('../services/nim-service');
const slackService = require('../services/slack-service');
const scheduleService = require('../services/schedule-service');
const { parseScheduleCommand, validateTimeframe, validateTasks } = require('../utils/validators');
const logger = require('../utils/logger');

class SlashCommandHandlers {
  /**
   * Handle the main /schedule slash command
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} say - Slack say function for responses
   * @param {Object} command - Slack command object
   */
  async handleScheduleCommand(ack, say, command) {
    // Acknowledge the command immediately (Slack requires response within 3 seconds)
    await ack();

    try {
      logger.info('Processing schedule command', {
        userId: command.user_id,
        channelId: command.channel_id,
        text: command.text
      });

      // Parse the command input
      const parsedInput = parseScheduleCommand(command.text);
      
      if (!parsedInput.timeframe) {
        await slackService.sendErrorMessage(
          command.channel_id,
          'Please provide a timeframe. Example: `/schedule 9AM-5PM "Review code (high, general)"`'
        );
        return;
      }

      if (!parsedInput.tasks || parsedInput.tasks.length === 0) {
        await slackService.sendErrorMessage(
          command.channel_id,
          'Please provide at least one task. Example: `"Review code (high, general)"`'
        );
        return;
      }

      // Validate input
      const timeframeValidation = validateTimeframe(parsedInput.timeframe);
      if (!timeframeValidation.isValid) {
        await slackService.sendErrorMessage(
          command.channel_id,
          `Invalid timeframe: ${timeframeValidation.error}`
        );
        return;
      }

      const tasksValidation = validateTasks(parsedInput.tasks);
      if (!tasksValidation.isValid) {
        await slackService.sendErrorMessage(
          command.channel_id,
          `Invalid task format: ${tasksValidation.error}`
        );
        return;
      }

      // Send "thinking" message to user
      const thinkingMessage = await say({
        text: '🤖 Analyzing your tasks and creating an optimized schedule...',
        response_type: 'in_channel'
      });

      try {
        // Generate schedule using NIM service
        const schedule = await nimService.generateSchedule(
          parsedInput.timeframe,
          parsedInput.tasks
        );

        // Save schedule to database
        const savedSchedule = await scheduleService.saveSchedule({
          userId: command.user_id,
          channelId: command.channel_id,
          timeframe: parsedInput.timeframe,
          tasks: parsedInput.tasks,
          generatedSchedule: schedule,
          originalCommand: command.text
        });

        // Send the formatted schedule to Slack
        await slackService.sendScheduleMessage(
          command.channel_id,
          schedule,
          parsedInput.timeframe
        );

        // Delete the "thinking" message
        await slackService.client.chat.delete({
          channel: command.channel_id,
          ts: thinkingMessage.ts
        });

        logger.info('Schedule generated and sent successfully', {
          userId: command.user_id,
          scheduleId: savedSchedule.id,
          taskCount: parsedInput.tasks.length
        });

      } catch (nimError) {
        logger.error('Failed to generate schedule with NIM:', nimError);
        
        // Delete thinking message and send error
        await slackService.client.chat.delete({
          channel: command.channel_id,
          ts: thinkingMessage.ts
        });

        await slackService.sendErrorMessage(
          command.channel_id,
          'Failed to generate schedule. The AI service might be temporarily unavailable. Please try again later.'
        );
      }

    } catch (error) {
      logger.error('Error in schedule command handler:', error);
      
      await slackService.sendErrorMessage(
        command.channel_id,
        'An unexpected error occurred. Please try again or contact support.'
      );
    }
  }

  /**
   * Handle the /schedule-help command
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} say - Slack say function for responses
   * @param {Object} command - Slack command object
   */
  async handleHelpCommand(ack, say, command) {
    await ack();

    try {
      logger.info('Processing help command', {
        userId: command.user_id,
        channelId: command.channel_id
      });

      await slackService.sendHelpMessage(command.channel_id, command.user_id);

    } catch (error) {
      logger.error('Error in help command handler:', error);
      
      await slackService.sendErrorMessage(
        command.channel_id,
        'Failed to show help information. Please try again.'
      );
    }
  }

  /**
   * Handle schedule regeneration requests
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleRegenerateSchedule(ack, body, client) {
    await ack();

    try {
      const originalScheduleId = body.actions[0].value;
      const originalSchedule = await scheduleService.getSchedule(originalScheduleId);

      if (!originalSchedule) {
        await slackService.sendErrorMessage(
          body.channel.id,
          'Original schedule not found. Please create a new schedule.'
        );
        return;
      }

      // Regenerate with original parameters
      const newSchedule = await nimService.generateSchedule(
        originalSchedule.timeframe,
        originalSchedule.tasks
      );

      // Update the message
      await slackService.updateScheduleMessage(
        body.channel.id,
        body.message.ts,
        newSchedule
      );

      logger.info('Schedule regenerated successfully', {
        userId: body.user.id,
        originalScheduleId
      });

    } catch (error) {
      logger.error('Error regenerating schedule:', error);
      
      await slackService.sendErrorMessage(
        body.channel.id,
        'Failed to regenerate schedule. Please try creating a new one.'
      );
    }
  }

  /**
   * Process schedule modification requests
   * This opens a modal for users to modify their schedule
   * 
   * @param {Object} ack - Slack acknowledgment function
   * @param {Object} body - Slack interaction body
   * @param {Object} client - Slack client
   */
  async handleScheduleModification(ack, body, client) {
    await ack();

    try {
      // TODO: Implement modal for schedule modification
      // This would allow users to:
      // - Adjust task times
      // - Change priorities
      // - Add/remove tasks
      // - Set preferences

      const modal = {
        type: 'modal',
        callback_id: 'schedule_modal',
        title: {
          type: 'plain_text',
          text: 'Modify Schedule'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🔧 Schedule modification feature coming soon!\n\nFor now, you can:\n• Use `/schedule` to create a new schedule\n• Click "🔄 Regenerate" for a new version'
            }
          }
        ],
        close: {
          type: 'plain_text',
          text: 'Close'
        }
      };

      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal
      });

    } catch (error) {
      logger.error('Error handling schedule modification:', error);
    }
  }
}

module.exports = new SlashCommandHandlers(); 