import { Env, AuthenticatedRequest, Route, HttpMethod } from './types/index.js';
import { corsMiddleware, addCorsHeaders } from './middleware/cors.js';
import { authMiddleware, adminMiddleware, createApiRateLimitMiddleware } from './middleware/auth.js';
import { createErrorResponse, createNotFoundResponse } from './utils/response.js';

// Import route handlers
import {
  loginHandler,
  logoutHandler,
  validateTokenHandler,
  generateUrlHandler,
  validateResponseHandler
} from './routes/auth.js';

import {
  getTokensHandler,
  getTokenByIdHandler,
  createTokenHandler,
  updateTokenHandler,
  deleteTokenHandler,
  batchImportTokensHandler,
  validateTokenStatusHandler,
  batchValidateTokensHandler,
  refreshTokenHandler as refreshTokenInfoHandler,
  getTokenStatsHandler,
  shareTokenHandler,
  resetRechargeCardHandler
} from './routes/tokens.js';
import {
  getEmailDomainsHandler,
  generateEmailHandler,
  getVerificationCodeHandler,
  emailHealthHandler
} from './routes/email.js';

/**
 * Route definitions
 */
const routes: Route[] = [
  // Health check
  { method: 'GET', path: '/health', handler: healthHandler },

  // Auth routes (public)
  { method: 'POST', path: '/api/auth/login', handler: loginHandler },

  // Auth routes (protected)
  { method: 'POST', path: '/api/auth/logout', handler: logoutHandler, requiresAuth: true },
  { method: 'GET', path: '/api/auth/validate', handler: validateTokenHandler, requiresAuth: true },
  { method: 'GET', path: '/api/auth/generate-url', handler: generateUrlHandler, requiresAuth: true },
  { method: 'POST', path: '/api/auth/validate-response', handler: validateResponseHandler, requiresAuth: true },

  // Token management routes
  { method: 'GET', path: '/api/tokens', handler: getTokensHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens', handler: createTokenHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/batch-import', handler: batchImportTokensHandler, requiresAuth: true },
  { method: 'GET', path: '/api/tokens/stats', handler: getTokenStatsHandler, requiresAuth: true },
  { method: 'GET', path: '/api/tokens/:id', handler: getTokenByIdHandler, requiresAuth: true },
  { method: 'PUT', path: '/api/tokens/:id', handler: updateTokenHandler, requiresAuth: true },
  { method: 'DELETE', path: '/api/tokens/:id', handler: deleteTokenHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/:id/validate', handler: validateTokenStatusHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/batch-validate', handler: batchValidateTokensHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/:id/refresh', handler: refreshTokenInfoHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/:id/share', handler: shareTokenHandler, requiresAuth: true },
  { method: 'POST', path: '/api/tokens/:id/reset-card', handler: resetRechargeCardHandler, requiresAuth: true },

  // Email service routes (integration points for email worker)
  { method: 'GET', path: '/api/email/health', handler: emailHealthHandler, requiresAuth: true },
  { method: 'GET', path: '/api/email/domains', handler: getEmailDomainsHandler, requiresAuth: true },
  { method: 'POST', path: '/api/email/generate', handler: generateEmailHandler, requiresAuth: true },
  { method: 'GET', path: '/api/email/verification-code', handler: getVerificationCodeHandler, requiresAuth: true },
];

/**
 * Health check handler
 */
async function healthHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Augment Token Manager Worker is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Route matcher
 */
function matchRoute(method: HttpMethod, pathname: string): Route | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    // Exact match
    if (route.path === pathname) {
      return route;
    }

    // Parameter match (e.g., /api/tokens/:id)
    if (route.path.includes(':')) {
      const routeParts = route.path.split('/');
      const pathParts = pathname.split('/');

      if (routeParts.length !== pathParts.length) continue;

      let matches = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) continue; // Parameter
        if (routeParts[i] !== pathParts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) return route;
    }
  }

  return null;
}

/**
 * Main Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method as HttpMethod;

      // Handle static assets (frontend files)
      if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/health')) {
        try {
          // Try to fetch the requested file
          const assetResponse = await env.ASSETS.fetch(request);

          // If file found or cached, return it with proper headers
          if (assetResponse.status === 200 || assetResponse.status === 304) {
            const response = new Response(assetResponse.body, {
              status: assetResponse.status,
              statusText: assetResponse.statusText,
              headers: assetResponse.headers,
            });

            // Set proper MIME type for SVG files
            if (url.pathname.endsWith('.svg')) {
              response.headers.set('Content-Type', 'image/svg+xml');
            }

            // Add cache headers for static assets
            if (url.pathname.includes('.')) {
              response.headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
              response.headers.set('ETag', `"${Date.now()}"`); // Simple ETag
            }

            return response;
          }

          // If file not found and it's not a static asset, serve index.html for SPA routing
          if (assetResponse.status === 404 && !url.pathname.includes('.')) {
            const indexRequest = new Request(new URL('/', request.url), request);
            return env.ASSETS.fetch(indexRequest);
          }

          return assetResponse;
        } catch (error) {
          console.error('Asset fetch error:', error);
          // Fallback to index.html for SPA routing
          if (!url.pathname.includes('.')) {
            const indexRequest = new Request(new URL('/', request.url), request);
            return env.ASSETS.fetch(indexRequest);
          }
          return new Response('Asset not found', { status: 404 });
        }
      }

      // Handle CORS preflight
      const corsResponse = await corsMiddleware(request, env, ctx);
      if (corsResponse) {
        return corsResponse;
      }

      // Find matching route
      const route = matchRoute(method, url.pathname);
      if (!route) {
        const response = createNotFoundResponse('Route not found');
        return addCorsHeaders(response, env, request.headers.get('Origin'));
      }

      // Create authenticated request
      const authRequest = request as AuthenticatedRequest;

      // Apply rate limiting for API routes
      if (url.pathname.startsWith('/api/')) {
        const rateLimitMiddleware = createApiRateLimitMiddleware(env);
        const rateLimitResponse = await rateLimitMiddleware(request, env, ctx);
        if (rateLimitResponse) {
          return addCorsHeaders(rateLimitResponse, env, request.headers.get('Origin'));
        }
      }

      // Apply route-specific middlewares
      if (route.middlewares) {
        for (const middleware of route.middlewares) {
          const middlewareResponse = await middleware(authRequest, env, ctx);
          if (middlewareResponse) {
            return addCorsHeaders(middlewareResponse, env, request.headers.get('Origin'));
          }
        }
      }

      // Apply authentication middleware if required
      if (route.requiresAuth) {
        const authResponse = await authMiddleware(authRequest, env, ctx);
        if (authResponse) {
          return addCorsHeaders(authResponse, env, request.headers.get('Origin'));
        }
      }

      // Apply admin middleware if required
      if (route.requiresAdmin) {
        const adminResponse = await adminMiddleware(authRequest, env, ctx);
        if (adminResponse) {
          return addCorsHeaders(adminResponse, env, request.headers.get('Origin'));
        }
      }

      // Execute route handler
      const response = await route.handler(authRequest, env, ctx);

      // Add CORS headers to response
      return addCorsHeaders(response, env, request.headers.get('Origin'));

    } catch (error) {
      console.error('Worker error:', error);
      const errorResponse = createErrorResponse(
        'Internal server error',
        500,
        'INTERNAL_ERROR'
      );
      return addCorsHeaders(errorResponse, env, request.headers.get('Origin'));
    }
  },
};
