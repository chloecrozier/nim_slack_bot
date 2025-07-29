/**
 * Main application entry point for the NIM Slack Scheduling Bot
 * 
 * This file:
 * - Initializes the Slack Bolt app
 * - Sets up middleware and error handling
 * - Registers slash commands and interactive handlers
 * - Starts the HTTP server
 * - Handles graceful shutdown
 */

const { App } = require('@slack/bolt');
const config = require('./config/config');
const slashCommands = require('./handlers/slash-commands');
const interactions = require('./handlers/interactions');
const logger = require('./utils/logger');

// Initialize Slack app with configuration
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: config.slack.socketMode,
  appToken: config.slack.appToken,
  port: config.app.port
});

/**
 * Global middleware for logging and error handling
 */
app.use(async ({ logger, next }) => {
  logger.info('Processing Slack event');
  await next();
});

/**
 * Register slash command handlers
 * These handle user inputs like /schedule and /schedule-help
 */
app.command('/schedule', slashCommands.handleScheduleCommand);
app.command('/schedule-help', slashCommands.handleHelpCommand);

/**
 * Register interactive component handlers
 * These handle button clicks, select menus, and modal submissions
 */
app.action('modify_schedule', interactions.handleScheduleModification);
app.action('complete_task', interactions.handleTaskCompletion);
app.view('schedule_modal', interactions.handleScheduleModal);

/**
 * Global error handler
 */
app.error(async (error) => {
  logger.error('Slack app error:', error);
});

/**
 * Start the application
 */
async function start() {
  try {
    await app.start();
    logger.info(`⚡️ NIM Slack Scheduling Bot is running on port ${config.app.port}!`);
  } catch (error) {
    logger.error('Failed to start app:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handling
 */
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

// Start the application if this file is run directly
if (require.main === module) {
  start();
}

module.exports = { app, start }; 