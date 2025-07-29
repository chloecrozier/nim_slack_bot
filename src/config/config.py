"""
Application configuration for the NIM Slack Scheduling Bot

This file:
- Loads environment variables using pydantic for validation
- Provides default values and type checking
- Exports configuration class for different components
- Handles different environments (development, production, test)
"""

import os
from typing import Optional, List, Dict, Any
from pydantic import BaseSettings, validator
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class SlackConfig(BaseSettings):
    """Slack-specific configuration settings"""
    bot_token: str
    signing_secret: str
    app_token: Optional[str] = None
    socket_mode: bool = False
    
    class Config:
        env_prefix = "SLACK_"

class NIMConfig(BaseSettings):
    """NVIDIA NIM API configuration settings"""
    api_key: str
    endpoint: str
    model: str = "llama-2-70b-chat"
    timeout: int = 30  # seconds
    max_retries: int = 3
    
    class Config:
        env_prefix = "NVIDIA_NIM_"

class DatabaseConfig(BaseSettings):
    """Database configuration settings"""
    url: Optional[str] = None
    
    # PostgreSQL settings
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "nim_slack_bot"
    postgres_user: str = "postgres"
    postgres_password: Optional[str] = None
    postgres_ssl: bool = False
    
    # MongoDB settings
    mongo_host: str = "localhost"
    mongo_port: int = 27017
    mongo_db: str = "nim_slack_bot"
    mongo_user: Optional[str] = None
    mongo_password: Optional[str] = None
    
    class Config:
        env_prefix = "DB_"

class RedisConfig(BaseSettings):
    """Redis configuration for caching and rate limiting"""
    url: Optional[str] = None
    host: str = "localhost"
    port: int = 6379
    password: Optional[str] = None
    ttl: int = 3600  # 1 hour default
    
    class Config:
        env_prefix = "REDIS_"

class AIConfig(BaseSettings):
    """AI and scheduling specific configuration"""
    max_tasks_per_schedule: int = 20
    default_break_duration: int = 15  # minutes
    max_schedule_duration: int = 12   # hours
    
    # Task type configurations
    task_types: Dict[str, Dict[str, Any]] = {
        "meeting": {
            "min_duration": 15,  # minutes
            "max_duration": 120,
            "buffer_time": 5
        },
        "learning": {
            "min_duration": 30,
            "max_duration": 180,
            "buffer_time": 10,
            "preferred_times": ["09:00", "10:00", "14:00"]  # optimal focus hours
        },
        "general": {
            "min_duration": 15,
            "max_duration": 240,
            "buffer_time": 5
        }
    }

class Config(BaseSettings):
    """Main application configuration"""
    
    # Application settings
    PORT: int = 3000
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    FLASK_MODE: bool = False  # Use Flask for production deployment
    
    # Component configurations
    SLACK_BOT_TOKEN: str
    SLACK_SIGNING_SECRET: str
    SLACK_APP_TOKEN: Optional[str] = None
    
    NVIDIA_NIM_API_KEY: str
    NVIDIA_NIM_ENDPOINT: str
    NVIDIA_NIM_MODEL: str = "llama-2-70b-chat"
    
    DATABASE_URL: Optional[str] = None
    
    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_REQUESTS_PER_HOUR: int = 1000
    
    # Monitoring and analytics
    ANALYTICS_ENABLED: bool = False
    SENTRY_DSN: Optional[str] = None
    
    class Config:
        case_sensitive = True
        env_file = ".env"
    
    @validator('LOG_LEVEL')
    def validate_log_level(cls, v):
        """Ensure log level is valid"""
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in valid_levels:
            raise ValueError(f'LOG_LEVEL must be one of {valid_levels}')
        return v.upper()
    
    @property
    def slack(self) -> SlackConfig:
        """Get Slack configuration"""
        return SlackConfig(
            bot_token=self.SLACK_BOT_TOKEN,
            signing_secret=self.SLACK_SIGNING_SECRET,
            app_token=self.SLACK_APP_TOKEN,
            socket_mode=self.SLACK_APP_TOKEN is not None
        )
    
    @property
    def nim(self) -> NIMConfig:
        """Get NIM configuration"""
        return NIMConfig(
            api_key=self.NVIDIA_NIM_API_KEY,
            endpoint=self.NVIDIA_NIM_ENDPOINT,
            model=self.NVIDIA_NIM_MODEL
        )
    
    @property
    def database(self) -> DatabaseConfig:
        """Get database configuration"""
        return DatabaseConfig(url=self.DATABASE_URL)
    
    @property
    def redis(self) -> RedisConfig:
        """Get Redis configuration"""
        return RedisConfig()
    
    @property
    def ai(self) -> AIConfig:
        """Get AI configuration"""
        return AIConfig()

# Global configuration instance
config = Config()

def get_config() -> Config:
    """Get the global configuration instance"""
    return config 