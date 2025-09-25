# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a minimal Token Management System built with:
- Frontend: Vue.js 3 with TypeScript
- Backend: Cloudflare Worker with TypeScript
- Data Storage: Cloudflare KV (key-value storage)
- UI Framework: Tabler + Bootstrap Vue Next

The system provides session-based authentication, token management CRUD operations, OAuth authorization flows, and optional email service integration.

## Project Structure

```
augment-token-manager-worker/
├── manager-vue/         # Vue.js frontend application
├── manager-worker/      # Cloudflare Worker backend API
├── docs/               # Documentation
└── .claude/            # Claude Code configuration
```

## Development Commands

### Frontend (manager-vue/)

```bash
# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Code formatting
npm run format
```

### Backend (manager-worker/)

```bash
# Development server with wrangler
npm run dev

# Deploy to Cloudflare
npm run deploy

# Type checking
npm run typecheck

# Code formatting
npm run format

# Linting
npm run lint
```

## Architecture Overview

### Frontend (Vue 3 + TypeScript)
- State management: Pinia
- Routing: vue-router
- UI Components: Tabler + Bootstrap Vue Next
- Main views: LoginView.vue, TokenManagerView.vue
- API communication through fetch requests to backend

### Backend (Cloudflare Worker)
- Entry point: src/index.ts
- Routes defined in route array with middleware support
- Authentication: Session-based with middleware
- Data storage: Cloudflare KV namespaces (TOKENS_KV, SESSIONS_KV)
- CORS handling and rate limiting
- Static asset serving for frontend files

### Key Routes

**Authentication:**
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- GET /api/auth/validate - Token validation

**Token Management:**
- GET /api/tokens - List all tokens
- POST /api/tokens - Create new token
- GET /api/tokens/:id - Get specific token
- PUT /api/tokens/:id - Update token
- DELETE /api/tokens/:id - Delete token
- POST /api/tokens/batch-import - Bulk import tokens
- POST /api/tokens/batch-validate - Bulk validate tokens
- POST /api/tokens/batch-share - Batch share tokens

### Configuration

**Required:**
- TOKENS_KV and SESSIONS_KV KV namespaces
- USER_CREDENTIALS environment variable

**Optional:**
- EMAIL_DOMAINS, EMAIL_API_BASE_URL, EMAIL_API_TOKEN for email service integration

## Deployment Process

1. Build frontend: `cd manager-vue && npm run build`
2. Configure wrangler.toml with KV namespace IDs
3. Deploy worker: `cd manager-worker && npm run deploy`