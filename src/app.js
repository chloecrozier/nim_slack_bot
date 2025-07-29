/**
 * Simple NIM Slack Scheduling Bot
 * 
 * A lightweight bot that uses your private NVIDIA NIM API
 * to create intelligent task schedules via Slack commands.
 */

const { App } = require('@slack/bolt');
const config = require('./config');
const nimService = require('./nim-service');
const slackService = require('./slack-service');
const { parseScheduleCommand, validateInput } = require('./utils');

// Initialize Slack app
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: false, // Use HTTP mode for simplicity
  port: config.port
});

/**
 * Handle /schedule slash command
 */
app.command('/schedule', async ({ command, ack, say }) => {
  // Acknowledge command immediately
  await ack();

  try {
    console.log(`📅 Schedule request from ${command.user_id}: ${command.text}`);

    // Parse and validate input
    const { timeframe, tasks, error } = parseScheduleCommand(command.text);
    
    if (error) {
      await say(slackService.createErrorMessage(error));
      return;
    }

    if (!timeframe || tasks.length === 0) {
      await say(slackService.createHelpMessage());
      return;
    }

    // Show "thinking" message
    const thinking = await say('🤖 Creating your optimized schedule...');

    try {
      // Generate schedule using NIM
      const schedule = await nimService.generateSchedule(timeframe, tasks);

      // Send formatted response
      await app.client.chat.update({
        channel: command.channel_id,
        ts: thinking.ts,
        ...slackService.createScheduleMessage(schedule, timeframe)
      });

      console.log(`✅ Schedule generated successfully for ${command.user_id}`);

    } catch (nimError) {
      console.error('NIM API Error:', nimError.message);
      
      await app.client.chat.update({
        channel: command.channel_id,
        ts: thinking.ts,
        ...slackService.createErrorMessage('Sorry, I had trouble generating your schedule. Please try again.')
      });
    }

  } catch (error) {
    console.error('Command Error:', error);
    await say(slackService.createErrorMessage('An unexpected error occurred. Please try again.'));
  }
});

/**
 * Handle /schedule-help command
 */
app.command('/schedule-help', async ({ ack, say }) => {
  await ack();
  await say(slackService.createHelpMessage());
});

/**
 * Handle task completion button clicks
 */
app.action('complete_task', async ({ body, ack, client }) => {
  await ack();

  try {
    // Parse the task info from button value
    const taskInfo = JSON.parse(body.actions[0].value);
    
    // Update the message to show completion
    await slackService.markTaskComplete(client, body, taskInfo);
    
    // Send confirmation
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: '✅ Task marked as completed! 🎉'
    });

  } catch (error) {
    console.error('Task completion error:', error);
  }
});

/**
 * Handle schedule regeneration
 */
app.action('regenerate_schedule', async ({ body, ack, client }) => {
  await ack();

  try {
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
            text: '🔄 *Regenerating schedule...* Please wait.'
          }
        }
      ]
    });

    // Extract original data from message (simplified approach)
    const originalData = slackService.extractScheduleData(body.message);
    
    if (originalData) {
      const newSchedule = await nimService.generateSchedule(originalData.timeframe, originalData.tasks);
      
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        ...slackService.createScheduleMessage(newSchedule, originalData.timeframe)
      });
    } else {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: '❌ Could not regenerate schedule. Please use `/schedule` to create a new one.'
      });
    }

  } catch (error) {
    console.error('Regeneration error:', error);
    
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: '❌ Failed to regenerate schedule. Please try creating a new one with `/schedule`.'
    });
  }
});

/**
 * Global error handler
 */
app.error(async (error) => {
  console.error('❌ Slack App Error:', error);
});

/**
 * Start the application
 */
async function start() {
  try {
    await app.start();
    console.log(`⚡️ NIM Slack Bot is running on port ${config.port}!`);
    console.log(`🔗 Make sure your Slack app's Request URL points to: http://your-domain.com:${config.port}/slack/events`);
  } catch (error) {
    console.error('❌ Failed to start app:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  start();
}

module.exports = { app }; 