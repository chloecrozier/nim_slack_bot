# Deployment Guide

This guide covers deploying the NIM Slack Scheduling Bot to various cloud platforms.

## Prerequisites

- NVIDIA NIM API access and credentials
- Slack app created and configured
- Database (PostgreSQL) provisioned
- Domain name (for production)

## Environment Setup

### Required Environment Variables

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token  # For Socket Mode

# NVIDIA NIM Configuration
NVIDIA_NIM_API_KEY=your-nim-api-key
NVIDIA_NIM_ENDPOINT=https://your-nim-endpoint
NVIDIA_NIM_MODEL=llama-2-70b-chat

# Database
DATABASE_URL=postgresql://user:pass@host:port/database

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Optional
REDIS_URL=redis://localhost:6379
SENTRY_DSN=your-sentry-dsn
```

## Deployment Options

### 1. Docker Deployment

#### Build Image

```bash
# Create Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY database/ ./database/

# Create logs directory
RUN mkdir -p logs

# Set up non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
EOF

# Build and run
docker build -t nim-slack-bot .
docker run -d --env-file .env -p 3000:3000 nim-slack-bot
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nim_slack_bot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

### 2. Heroku Deployment

#### Setup

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-nim-slack-bot

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set SLACK_BOT_TOKEN=your-token
heroku config:set SLACK_SIGNING_SECRET=your-secret
heroku config:set NVIDIA_NIM_API_KEY=your-key
heroku config:set NVIDIA_NIM_ENDPOINT=your-endpoint

# Deploy
git push heroku main
```

#### Procfile

```
web: npm start
release: npm run db:migrate
```

### 3. AWS Deployment

#### Using AWS App Runner

```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci
      - npm run build
run:
  runtime-version: 18
  command: npm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

#### Using ECS Fargate

```json
{
  "family": "nim-slack-bot",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "nim-slack-bot",
      "image": "your-account.dkr.ecr.region.amazonaws.com/nim-slack-bot:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "SLACK_BOT_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:slack-bot-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/nim-slack-bot",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 4. Google Cloud Run

#### Deploy

```bash
# Build and submit to Cloud Build
gcloud builds submit --tag gcr.io/PROJECT-ID/nim-slack-bot

# Deploy to Cloud Run
gcloud run deploy nim-slack-bot \
  --image gcr.io/PROJECT-ID/nim-slack-bot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets SLACK_BOT_TOKEN=slack-bot-token:latest \
  --set-secrets NVIDIA_NIM_API_KEY=nim-api-key:latest
```

#### cloudbuild.yaml

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/nim-slack-bot', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/nim-slack-bot']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'nim-slack-bot'
      - '--image'
      - 'gcr.io/$PROJECT_ID/nim-slack-bot'
      - '--platform'
      - 'managed'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
```

## Database Setup

### Migration Scripts

```bash
# Create migration script
cat > database/migrate.js << EOF
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
EOF
```

### Backup Strategy

```bash
# Automated backup script
cat > scripts/backup.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Upload to cloud storage (example: AWS S3)
aws s3 cp $BACKUP_FILE s3://your-backup-bucket/backups/

# Clean up local file
rm $BACKUP_FILE

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x scripts/backup.sh
```

## Monitoring & Logging

### Health Check Endpoint

```javascript
// Add to src/app.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

### Application Metrics

```javascript
// Optional: Add Prometheus metrics
const promClient = require('prom-client');

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const slackCommandsTotal = new promClient.Counter({
  name: 'slack_commands_total',
  help: 'Total number of Slack commands processed',
  labelNames: ['command', 'status']
});
```

## Security Considerations

### Environment Variables

- Use secrets management (AWS Secrets Manager, Azure Key Vault, etc.)
- Never commit secrets to version control
- Rotate API keys regularly
- Use least-privilege IAM policies

### Network Security

```yaml
# Example security group (AWS)
SecurityGroupRules:
  - IpProtocol: tcp
    FromPort: 3000
    ToPort: 3000
    CidrIp: 0.0.0.0/0  # Restrict to Slack IPs in production
  - IpProtocol: tcp
    FromPort: 443
    ToPort: 443
    CidrIp: 0.0.0.0/0
```

### SSL/TLS

```nginx
# Nginx configuration for SSL termination
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Scaling Considerations

### Horizontal Scaling

- Use load balancer for multiple instances
- Implement session affinity if needed
- Use Redis for shared state

### Vertical Scaling

- Monitor CPU and memory usage
- Adjust container resources based on load
- Implement auto-scaling policies

### Database Scaling

- Use connection pooling
- Implement read replicas for analytics
- Consider database sharding for large datasets

## Troubleshooting

### Common Issues

1. **Slack verification fails**
   - Check signing secret
   - Verify request timestamp
   - Ensure proper URL configuration

2. **NIM API timeouts**
   - Increase timeout values
   - Implement retry logic
   - Monitor API quotas

3. **Database connection issues**
   - Check connection string format
   - Verify SSL requirements
   - Monitor connection pool usage

### Log Analysis

```bash
# View recent logs
kubectl logs -f deployment/nim-slack-bot --tail=100

# Search for errors
grep "ERROR" /var/log/nim-slack-bot.log | tail -20

# Monitor performance
grep "Performance" /var/log/nim-slack-bot.log | grep "duration.*[5-9][0-9][0-9][0-9]"
```

## Maintenance

### Regular Tasks

- Update dependencies monthly
- Rotate API keys quarterly
- Review and clean up logs
- Monitor database growth
- Test backup restoration
- Review security configurations

### Update Process

```bash
# Zero-downtime deployment example
kubectl set image deployment/nim-slack-bot nim-slack-bot=gcr.io/project/nim-slack-bot:v2.0.0
kubectl rollout status deployment/nim-slack-bot
kubectl rollout history deployment/nim-slack-bot
``` 