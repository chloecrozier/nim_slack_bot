-- NIM Slack Scheduling Bot Database Schema
-- This file defines the complete database structure for the application
-- 
-- Tables:
-- - users: Store user preferences and settings
-- - schedules: Store generated schedules and associated data
-- - tasks: Individual tasks within schedules
-- - user_sessions: Track user interactions and state
-- - analytics: Store usage analytics and metrics

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table: Store Slack user information and preferences
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slack_user_id VARCHAR(50) UNIQUE NOT NULL,
    slack_team_id VARCHAR(50),
    username VARCHAR(100),
    display_name VARCHAR(100),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- User preferences for scheduling
    preferences JSONB DEFAULT '{}',
    -- Example preferences structure:
    -- {
    --   "default_work_hours": "09:00-17:00",
    --   "preferred_break_duration": 15,
    --   "task_type_preferences": {
    --     "learning": {"preferred_times": ["09:00", "14:00"]},
    --     "meetings": {"buffer_time": 10}
    --   },
    --   "notification_settings": {
    --     "schedule_reminders": true,
    --     "task_completion_reminders": false
    --   }
    -- }
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft delete support
    is_active BOOLEAN DEFAULT true
);

-- Schedules table: Store generated schedules
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Original request data
    slack_channel_id VARCHAR(50) NOT NULL,
    slack_message_ts VARCHAR(50), -- Timestamp of the schedule message
    original_command TEXT, -- The original /schedule command
    
    -- Schedule parameters
    timeframe VARCHAR(100) NOT NULL, -- e.g., "9AM-5PM", "09:00-17:00"
    timeframe_start TIME,
    timeframe_end TIME,
    schedule_date DATE DEFAULT CURRENT_DATE,
    
    -- Generated schedule data
    generated_schedule JSONB NOT NULL,
    -- Example structure:
    -- {
    --   "schedule": [...],
    --   "summary": {...},
    --   "recommendations": [...],
    --   "metadata": {
    --     "generation_time": "2024-01-01T10:00:00Z",
    --     "nim_model": "llama-2-70b-chat",
    --     "version": "1.0"
    --   }
    -- }
    
    -- Schedule metadata
    total_tasks INTEGER DEFAULT 0,
    total_duration_minutes INTEGER DEFAULT 0,
    productivity_score DECIMAL(3,1), -- 0.0 to 10.0
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Tasks table: Individual tasks within schedules
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    
    -- Task identification
    task_order INTEGER NOT NULL, -- Order within the schedule
    original_input TEXT, -- Original task description from user
    
    -- Task details
    description TEXT NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('general', 'meeting', 'learning')),
    
    -- Scheduling information
    scheduled_start_time TIME,
    scheduled_end_time TIME,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    
    -- Task metadata
    preferred_time TIME,
    buffer_time_minutes INTEGER DEFAULT 5,
    dependencies JSONB DEFAULT '[]', -- Array of task IDs this task depends on
    
    -- Status and completion
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled, skipped
    completion_notes TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    -- AI-generated insights
    scheduling_reasoning TEXT, -- Why the AI scheduled it at this time
    duration_reasoning TEXT,   -- How the AI estimated the duration
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- User sessions: Track user interactions and maintain state
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slack_channel_id VARCHAR(50) NOT NULL,
    
    -- Session data
    session_data JSONB DEFAULT '{}',
    -- Example: temporary data for multi-step interactions
    -- {
    --   "current_schedule_draft": {...},
    --   "modification_context": {...},
    --   "interaction_state": "awaiting_confirmation"
    -- }
    
    -- Session metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    -- Session status
    is_active BOOLEAN DEFAULT true
);

-- Analytics table: Store usage metrics and insights
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- schedule_created, task_completed, command_used, etc.
    event_data JSONB NOT NULL,
    
    -- User context (nullable for privacy)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    slack_team_id VARCHAR(50),
    
    -- Performance metrics
    processing_time_ms INTEGER,
    nim_response_time_ms INTEGER,
    error_details JSONB,
    
    -- Timestamp
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Users indexes
CREATE INDEX idx_users_slack_user_id ON users(slack_user_id);
CREATE INDEX idx_users_slack_team_id ON users(slack_team_id);
CREATE INDEX idx_users_last_active ON users(last_active_at);

-- Schedules indexes
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_channel_id ON schedules(slack_channel_id);
CREATE INDEX idx_schedules_date ON schedules(schedule_date);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_created_at ON schedules(created_at);

-- Tasks indexes
CREATE INDEX idx_tasks_schedule_id ON tasks(schedule_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_scheduled_time ON tasks(scheduled_start_time, scheduled_end_time);

-- User sessions indexes
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_channel_id ON user_sessions(slack_channel_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(is_active);

-- Analytics indexes
CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_recorded_at ON analytics(recorded_at);

-- Triggers for automatic timestamp updates

-- Update timestamps on record changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Views for common queries

-- Active schedules with user information
CREATE VIEW active_schedules_with_users AS
SELECT 
    s.*,
    u.slack_user_id,
    u.username,
    u.display_name,
    u.timezone,
    COUNT(t.id) as task_count,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM schedules s
JOIN users u ON s.user_id = u.id
LEFT JOIN tasks t ON s.id = t.schedule_id
WHERE s.status = 'active' AND u.is_active = true
GROUP BY s.id, u.id;

-- Task completion statistics
CREATE VIEW task_completion_stats AS
SELECT 
    u.slack_user_id,
    t.type,
    t.priority,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    AVG(t.actual_duration_minutes) as avg_actual_duration,
    AVG(t.estimated_duration_minutes) as avg_estimated_duration,
    AVG(t.user_rating) as avg_rating
FROM tasks t
JOIN schedules s ON t.schedule_id = s.id
JOIN users u ON s.user_id = u.id
WHERE t.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY u.slack_user_id, t.type, t.priority;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores Slack user information and scheduling preferences';
COMMENT ON TABLE schedules IS 'Stores generated schedules with AI recommendations';
COMMENT ON TABLE tasks IS 'Individual tasks within schedules with completion tracking';
COMMENT ON TABLE user_sessions IS 'Temporary session data for multi-step interactions';
COMMENT ON TABLE analytics IS 'Usage metrics and performance analytics';

COMMENT ON COLUMN schedules.generated_schedule IS 'Complete JSON schedule generated by NIM AI';
COMMENT ON COLUMN tasks.dependencies IS 'JSON array of task IDs that must be completed first';
COMMENT ON COLUMN users.preferences IS 'JSON object containing user scheduling preferences'; 