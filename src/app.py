"""
Main application entry point for the NIM Slack Scheduling Bot

This file:
- Initializes the Slack Bolt app
- Sets up middleware and error handling
- Registers slash commands and interactive handlers
- Starts the HTTP server
- Handles graceful shutdown
"""

import os
import signal
import logging
from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler

from config.config import Config
from handlers.slash_commands import SlashCommandHandlers
from handlers.interactions import InteractionHandlers
from utils.logger import setup_logger

# Initialize configuration and logging
config = Config()
logger = setup_logger(__name__)

# Initialize Slack app with configuration
app = App(
    token=config.SLACK_BOT_TOKEN,
    signing_secret=config.SLACK_SIGNING_SECRET,
    process_before_response=True
)

# Initialize handlers
slash_handlers = SlashCommandHandlers()
interaction_handlers = InteractionHandlers()

# Global middleware for logging and request processing
@app.middleware
def log_request(body, next):
    """Log incoming Slack requests for debugging and monitoring"""
    logger.info(f"Processing Slack event: {body.get('type', 'unknown')}")
    next()

# Register slash command handlers
@app.command("/schedule")
def handle_schedule_command(ack, say, command):
    """
    Handle the main /schedule slash command
    Processes user input and generates AI-powered schedules
    """
    slash_handlers.handle_schedule_command(ack, say, command)

@app.command("/schedule-help")
def handle_help_command(ack, say, command):
    """
    Handle the /schedule-help command
    Provides usage examples and documentation
    """
    slash_handlers.handle_help_command(ack, say, command)

# Register interactive component handlers
@app.action("modify_schedule")
def handle_schedule_modification(ack, body, client):
    """Handle schedule modification button clicks"""
    interaction_handlers.handle_schedule_modification(ack, body, client)

@app.action("complete_task")
def handle_task_completion(ack, body, client):
    """Handle task completion tracking"""
    interaction_handlers.handle_task_completion(ack, body, client)

@app.view("schedule_modal")
def handle_schedule_modal(ack, body, client, view):
    """Handle schedule creation/editing modal submissions"""
    interaction_handlers.handle_schedule_modal(ack, body, client, view)

# Global error handler
@app.error
def global_error_handler(error, body, logger):
    """Handle all uncaught errors in the application"""
    logger.error(f"Slack app error: {error}")
    logger.error(f"Request body: {body}")

def create_flask_app():
    """
    Create Flask app for production deployment
    This allows the bot to run on platforms like Heroku, AWS, etc.
    """
    from flask import Flask, request
    
    flask_app = Flask(__name__)
    handler = SlackRequestHandler(app)
    
    @flask_app.route("/slack/events", methods=["POST"])
    def slack_events():
        return handler.handle(request)
    
    @flask_app.route("/health", methods=["GET"])
    def health_check():
        return {"status": "healthy", "service": "nim-slack-bot"}
    
    return flask_app

def setup_signal_handlers():
    """Setup graceful shutdown handlers"""
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        # Perform cleanup here (close DB connections, etc.)
        exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

def main():
    """Main application entry point"""
    try:
        setup_signal_handlers()
        
        if config.FLASK_MODE:
            # Run with Flask for production
            flask_app = create_flask_app()
            flask_app.run(
                host="0.0.0.0",
                port=config.PORT,
                debug=config.DEBUG
            )
        else:
            # Run with built-in server for development
            app.start(port=config.PORT)
            logger.info(f"⚡️ NIM Slack Scheduling Bot is running on port {config.PORT}!")
            
    except Exception as error:
        logger.error(f"Failed to start app: {error}")
        exit(1)

if __name__ == "__main__":
    main() 