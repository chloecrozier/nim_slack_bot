/**
 * Schedule Service
 * 
 * This service handles:
 * - Schedule database operations (CRUD)
 * - Schedule analytics and metrics
 * - User preferences management
 * - Schedule history and retrieval
 */

const { Pool } = require('pg');
const config = require('../config/config');
const logger = require('../utils/logger');

class ScheduleService {
  constructor() {
    // Initialize database connection pool
    this.pool = new Pool({
      connectionString: config.database.url,
      ssl: config.database.postgres.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection on startup
    this.testConnection();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
    }
  }

  /**
   * Save a new schedule to the database
   * 
   * @param {Object} scheduleData - Schedule data to save
   * @param {string} scheduleData.userId - Slack user ID
   * @param {string} scheduleData.channelId - Slack channel ID
   * @param {string} scheduleData.timeframe - Original timeframe string
   * @param {Array} scheduleData.tasks - Original task array
   * @param {Object} scheduleData.generatedSchedule - AI-generated schedule
   * @param {string} scheduleData.originalCommand - Original slash command
   * @returns {Promise<Object>} Saved schedule with ID
   */
  async saveSchedule(scheduleData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // First, ensure user exists or create them
      const user = await this.ensureUserExists(client, scheduleData.userId);

      // Parse timeframe to extract start/end times
      const { startTime, endTime } = this.parseTimeframe(scheduleData.timeframe);

      // Insert schedule
      const scheduleQuery = `
        INSERT INTO schedules (
          user_id, slack_channel_id, original_command, timeframe,
          timeframe_start, timeframe_end, generated_schedule,
          total_tasks, total_duration_minutes, productivity_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const scheduleValues = [
        user.id,
        scheduleData.channelId,
        scheduleData.originalCommand,
        scheduleData.timeframe,
        startTime,
        endTime,
        JSON.stringify(scheduleData.generatedSchedule),
        scheduleData.generatedSchedule.summary?.total_tasks || scheduleData.tasks.length,
        scheduleData.generatedSchedule.summary?.total_duration || 0,
        scheduleData.generatedSchedule.summary?.productivity_score || null
      ];

      const scheduleResult = await client.query(scheduleQuery, scheduleValues);
      const schedule = scheduleResult.rows[0];

      // Insert individual tasks
      if (scheduleData.generatedSchedule.schedule) {
        for (let i = 0; i < scheduleData.generatedSchedule.schedule.length; i++) {
          const task = scheduleData.generatedSchedule.schedule[i];
          const originalTask = scheduleData.tasks.find(t => t.id === task.task_id) || {};

          await this.saveTask(client, {
            scheduleId: schedule.id,
            taskOrder: i + 1,
            originalInput: originalTask.description || task.task,
            description: task.task,
            priority: task.priority,
            type: task.type,
            scheduledStartTime: task.start_time,
            scheduledEndTime: task.end_time,
            estimatedDuration: task.duration,
            preferredTime: originalTask.preferred_time,
            schedulingReasoning: task.reasoning
          });
        }
      }

      await client.query('COMMIT');
      
      logger.info('Schedule saved successfully', {
        scheduleId: schedule.id,
        userId: scheduleData.userId,
        taskCount: scheduleData.tasks.length
      });

      return schedule;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save schedule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a schedule by ID
   * 
   * @param {string} scheduleId - Schedule UUID
   * @returns {Promise<Object|null>} Schedule data or null if not found
   */
  async getSchedule(scheduleId) {
    try {
      const query = `
        SELECT s.*, u.slack_user_id, u.username, u.display_name
        FROM schedules s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [scheduleId]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('Failed to get schedule:', error);
      throw error;
    }
  }

  /**
   * Get user's recent schedules
   * 
   * @param {string} slackUserId - Slack user ID
   * @param {number} limit - Number of schedules to return
   * @returns {Promise<Array>} Array of recent schedules
   */
  async getUserSchedules(slackUserId, limit = 10) {
    try {
      const query = `
        SELECT s.*, COUNT(t.id) as task_count,
               COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
        FROM schedules s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN tasks t ON s.id = t.schedule_id
        WHERE u.slack_user_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [slackUserId, limit]);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get user schedules:', error);
      throw error;
    }
  }

  /**
   * Update task completion status
   * 
   * @param {string} taskId - Task UUID
   * @param {string} status - New status
   * @param {Object} updates - Additional updates
   * @returns {Promise<Object>} Updated task
   */
  async updateTaskStatus(taskId, status, updates = {}) {
    try {
      const setClause = ['status = $2'];
      const values = [taskId, status];
      let valueIndex = 3;

      // Add optional updates
      if (updates.completionNotes) {
        setClause.push(`completion_notes = $${valueIndex++}`);
        values.push(updates.completionNotes);
      }

      if (updates.userRating) {
        setClause.push(`user_rating = $${valueIndex++}`);
        values.push(updates.userRating);
      }

      if (updates.actualDuration) {
        setClause.push(`actual_duration_minutes = $${valueIndex++}`);
        values.push(updates.actualDuration);
      }

      if (status === 'completed') {
        setClause.push(`completed_at = CURRENT_TIMESTAMP`);
      }

      const query = `
        UPDATE tasks 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update task status:', error);
      throw error;
    }
  }

  /**
   * Get schedule analytics for a user
   * 
   * @param {string} slackUserId - Slack user ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Analytics data
   */
  async getScheduleAnalytics(slackUserId, days = 30) {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT s.id) as total_schedules,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          AVG(t.user_rating) as avg_rating,
          AVG(s.productivity_score) as avg_productivity_score,
          AVG(CASE WHEN t.actual_duration_minutes IS NOT NULL AND t.estimated_duration_minutes IS NOT NULL
                   THEN ABS(t.actual_duration_minutes - t.estimated_duration_minutes) END) as avg_duration_variance
        FROM schedules s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN tasks t ON s.id = t.schedule_id
        WHERE u.slack_user_id = $1 
          AND s.created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      `;

      const result = await this.pool.query(query, [slackUserId]);
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to get schedule analytics:', error);
      throw error;
    }
  }

  /**
   * Ensure user exists in database, create if not
   * 
   * @param {Object} client - Database client
   * @param {string} slackUserId - Slack user ID
   * @returns {Promise<Object>} User record
   */
  async ensureUserExists(client, slackUserId) {
    try {
      // Try to find existing user
      let result = await client.query(
        'SELECT * FROM users WHERE slack_user_id = $1',
        [slackUserId]
      );

      if (result.rows.length > 0) {
        // Update last active timestamp
        await client.query(
          'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE slack_user_id = $1',
          [slackUserId]
        );
        return result.rows[0];
      }

      // Create new user
      result = await client.query(`
        INSERT INTO users (slack_user_id, preferences)
        VALUES ($1, '{}')
        RETURNING *
      `, [slackUserId]);

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to ensure user exists:', error);
      throw error;
    }
  }

  /**
   * Save a task to the database
   * 
   * @param {Object} client - Database client
   * @param {Object} taskData - Task data to save
   * @returns {Promise<Object>} Saved task
   */
  async saveTask(client, taskData) {
    const query = `
      INSERT INTO tasks (
        schedule_id, task_order, original_input, description, priority, type,
        scheduled_start_time, scheduled_end_time, estimated_duration_minutes,
        preferred_time, scheduling_reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      taskData.scheduleId,
      taskData.taskOrder,
      taskData.originalInput,
      taskData.description,
      taskData.priority,
      taskData.type,
      taskData.scheduledStartTime,
      taskData.scheduledEndTime,
      taskData.estimatedDuration,
      taskData.preferredTime,
      taskData.schedulingReasoning
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  /**
   * Parse timeframe string to extract start/end times
   * 
   * @param {string} timeframe - Timeframe string
   * @returns {Object} Start and end times
   */
  parseTimeframe(timeframe) {
    // This is a simplified implementation
    // In a real application, you'd want more robust parsing
    const defaultStart = '09:00:00';
    const defaultEnd = '17:00:00';

    try {
      // Basic parsing for common formats
      const match = timeframe.match(/(\d{1,2}):?(\d{2})?\s*(?:AM|PM)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(?:AM|PM)?/i);
      
      if (match) {
        const startHour = match[1].padStart(2, '0');
        const startMin = (match[2] || '00').padStart(2, '0');
        const endHour = match[3].padStart(2, '0');
        const endMin = (match[4] || '00').padStart(2, '0');
        
        return {
          startTime: `${startHour}:${startMin}:00`,
          endTime: `${endHour}:${endMin}:00`
        };
      }
    } catch (error) {
      logger.warn('Failed to parse timeframe, using defaults:', error);
    }

    return {
      startTime: defaultStart,
      endTime: defaultEnd
    };
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

module.exports = new ScheduleService(); 