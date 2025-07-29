# NIM Slack Scheduling Bot

A simple Slack bot that uses your private NVIDIA NIM API to create optimized daily task schedules.

## 🎯 Overview

This bot takes a timeframe and a list of tasks from users, then uses AI to generate an intelligent schedule with:
- Optimized task ordering based on priority, type, and dependencies
- Realistic time estimates for each task
- Smart scheduling that considers task types and optimal productivity patterns

## ✨ Features

- **AI-Powered Scheduling**: Uses your private NVIDIA NIM API
- **Simple Setup**: No database or complex deployment required
- **Flexible Input**: Accepts various timeframe formats (e.g., "8:00 AM - 4:00 PM", "9-17")
- **Task Types**: Handles general, meeting, and learning tasks with priorities
- **Interactive Slack Messages**: Complete/modify tasks with buttons

## 🚀 Quick Setup

### 1. Prerequisites

- Node.js 18+ installed
- A Slack app with bot permissions
- Private NVIDIA NIM API access

### 2. Installation

```bash
# Clone or download this project
cd nim_slack_bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` with your credentials:

```bash
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# Your Private NVIDIA NIM API
NVIDIA_NIM_API_KEY=your-private-nim-api-key
NVIDIA_NIM_ENDPOINT=https://your-nim-endpoint.com

# Optional
PORT=3000
LOG_LEVEL=info
```

### 4. Create Slack App

1. Go to [api.slack.com](https://api.slack.com) → "Create New App"
2. Choose "From scratch" → Name it "NIM Scheduler"
3. **OAuth & Permissions**: Add these scopes:
   - `chat:write`
   - `commands`
   - `users:read`
4. **Slash Commands**: Create `/schedule` command pointing to `http://your-domain.com/slack/events`
5. **Install App** to your workspace

### 5. Run the Bot

```bash
# Start the bot
npm start

# For development with auto-restart
npm run dev
```

## 📱 Usage

### Basic Command
```
/schedule 9AM-5PM "Review code (high, general)" "Team meeting (medium, meeting)" "Learn React (low, learning)"
```

### Task Format
Tasks should be in quotes with format: `"Description (priority, type)"`

**Priorities**: `high`, `medium`, `low`  
**Types**: `general`, `meeting`, `learning`

### Examples
```
/schedule 8:00-16:00 "Finish presentation (high, general)" "1:1 with manager (medium, meeting)"

/schedule morning "Quick standup (medium, meeting)" "Focus work (high, general)"

/schedule 13:00-17:00 "Code review (high, general)" "Documentation (low, general)" "Learning session (low, learning)"
```

## 🔧 How It Works

1. **Parse Input**: Extracts timeframe and tasks from your slash command
2. **AI Processing**: Sends to your NIM API with intelligent prompts
3. **Smart Scheduling**: AI considers task types, priorities, and optimal timing
4. **Interactive Response**: Returns formatted schedule with action buttons

## 📋 File Structure

```
nim_slack_bot/
├── src/
│   ├── app.js              # Main application
│   ├── config.js           # Configuration
│   ├── nim-service.js      # NIM API integration
│   ├── slack-service.js    # Slack message handling
│   └── utils.js            # Utilities and validation
├── .env.example            # Environment template
├── package.json            # Dependencies
└── README.md              # This file
```

## 🛠️ Customization

### Modify AI Prompts
Edit `src/nim-service.js` to customize how the AI schedules tasks:

```javascript
// Change scheduling logic, add new task types, etc.
const prompt = `Create an optimal schedule considering...`;
```

### Add New Task Types
Update the validation in `src/utils.js`:

```javascript
const validTypes = ['general', 'meeting', 'learning', 'break', 'admin'];
```

### Change Response Format
Modify `src/slack-service.js` to customize the Slack message appearance.

## 🔍 Troubleshooting

**Bot not responding?**
- Check your Slack app's Request URL is correct
- Verify bot token has correct permissions
- Check console logs for errors

**NIM API errors?**
- Verify your API key and endpoint
- Check API quota/rate limits
- Ensure your NIM endpoint is accessible

**Slash command not working?**
- Reinstall the Slack app to your workspace
- Check the slash command configuration
- Verify the Request URL is publicly accessible

## 📝 Development

```bash
# Run with auto-restart during development
npm run dev

# View logs
tail -f logs/app.log

# Test the validation utilities
npm test
```

---

**That's it!** A simple, powerful scheduling bot using your private NIM API. No databases, no complex deployment - just install, configure, and run.