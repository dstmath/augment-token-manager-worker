# Deployment Guide

## Environment Setup

### Development Environment

1. **Create Configuration File**
   ```bash
   # Copy example configuration
   cp wrangler-dev.toml.example wrangler-dev.toml
   ```

2. **Create KV Namespaces for Development**
   ```bash
   npm run kv:create:dev
   ```

3. **Configure Development Environment**
   - Edit `wrangler-dev.toml` with your actual values:
     - Replace KV namespace IDs with the ones created above
     - Update EMAIL_DOMAINS, EMAIL_API_BASE_URL, EMAIL_API_TOKEN with your email service
     - Set USER_CREDENTIALS with your admin credentials

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Production Environment

1. **Create Configuration File**
   ```bash
   # Copy example configuration
   cp wrangler.toml.example wrangler.toml
   ```

2. **Create KV Namespaces for Production**
   ```bash
   npm run kv:create:prod
   ```

3. **Configure Production Environment**
   - Edit `wrangler.toml` with your actual values:
     - Replace KV namespace IDs with the ones created above
     - Update ALLOWED_ORIGINS with your production domain
     - Update EMAIL_DOMAINS, EMAIL_API_BASE_URL, EMAIL_API_TOKEN with your email service
     - Set USER_CREDENTIALS with secure production credentials

4. **Deploy to Production**
   ```bash
   npm run deploy
   ```

## Environment Configurations

### Development (wrangler-dev.toml)
- Name: `augtoken-manager-dev`
- Higher rate limits for testing
- Localhost CORS origins
- Development KV namespaces

### Production (wrangler.toml)
- Name: `augtoken-manager`
- Production rate limits
- Production domain CORS origins
- Production KV namespaces

## Manual Commands

### KV Namespace Management
```bash
# Create individual namespaces (simplified structure)
wrangler kv:namespace create TOKENS_KV
wrangler kv:namespace create SESSIONS_KV

# List namespaces
wrangler kv:namespace list

# Delete namespace (be careful!)
wrangler kv:namespace delete --namespace-id=<id>
```

### Configuration Management
```bash
# All configuration is in wrangler.toml files
# No secrets management needed - credentials are in environment variables

# List current configuration
wrangler whoami
wrangler kv:namespace list
```

### Deployment Commands
```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy

# View deployment logs
wrangler tail

# View worker analytics
wrangler analytics
```

## Environment Variables

### Required Configuration (set in wrangler.toml)
- `USER_CREDENTIALS`: User credentials (supports array format or string format)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `SESSION_EXPIRES_IN`: Session expiration time (e.g., "24h")
- `RATE_LIMIT_LOGIN`: Login attempts per minute
- `RATE_LIMIT_API`: API requests per minute

### Email Service Configuration
- `EMAIL_DOMAINS`: Array of available email domains
- `EMAIL_API_BASE_URL`: Base URL of external email service (API path is hardcoded)
- `EMAIL_API_TOKEN`: Authentication token for email service

### Optional Configuration
- `TOKEN_VALIDATION_TIMEOUT`: Timeout for token validation (default: "30000")

## Troubleshooting

### Common Issues

1. **KV Namespace Not Found**
   - Ensure KV namespaces are created and IDs are correct in wrangler.toml

2. **CORS Errors**
   - Check ALLOWED_ORIGINS includes your frontend domain
   - Verify protocol (http/https) matches

3. **Authentication Failures**
   - Verify USER_CREDENTIALS format is correct (array format recommended)
   - Check session expiration settings

4. **Rate Limiting**
   - Adjust rate limits in wrangler.toml if needed
   - Monitor usage patterns

### Debugging
```bash
# View real-time logs
wrangler tail

# Check worker status
wrangler status

# Validate configuration
wrangler validate
```
