import { ApiResponse, PaginatedResponse } from '../types/index.js';

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    // 移除timestamp，前端未使用
  };

  const responseBody = JSON.stringify(response);

  return new Response(responseBody, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  error: string,
  status: number = 400,
  code?: string
): Response {
  const response: ApiResponse = {
    success: false,
    error,
    // 移除timestamp，前端未使用
  };

  if (code) {
    (response as any).code = code;
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a paginated API response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response {
  const totalPages = Math.ceil(total / limit);
  
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    message,
    // 移除timestamp，前端未使用
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle CORS preflight requests
 */
export function createCorsResponse(allowedOrigins: string[]): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.join(', '),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: Response, allowedOrigins: string[]): Response {
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return newResponse;
}

/**
 * Create a not found response
 */
export function createNotFoundResponse(message: string = 'Resource not found'): Response {
  return createErrorResponse(message, 404, 'NOT_FOUND');
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse(message: string = 'Unauthorized'): Response {
  return createErrorResponse(message, 401, 'UNAUTHORIZED');
}

/**
 * Create a forbidden response
 */
export function createForbiddenResponse(message: string = 'Forbidden'): Response {
  return createErrorResponse(message, 403, 'FORBIDDEN');
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(errors: string[]): Response {
  return createErrorResponse(
    `Validation failed: ${errors.join(', ')}`,
    400,
    'VALIDATION_ERROR'
  );
}

/**
 * Create a rate limit exceeded response
 */
export function createRateLimitResponse(message: string = 'Rate limit exceeded'): Response {
  return createErrorResponse(message, 429, 'RATE_LIMIT_EXCEEDED');
}

/**
 * Create an internal server error response
 */
export function createInternalErrorResponse(message: string = 'Internal server error'): Response {
  return createErrorResponse(message, 500, 'INTERNAL_ERROR');
}

/**
 * Parse request body as JSON with error handling
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    const text = await request.text();

    if (!text.trim()) {
      throw new Error('Request body is empty');
    }

    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Extract query parameters from URL
 */
export function getQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Extract pagination parameters from query string
 */
export function getPaginationParams(url: URL): { page: number; limit: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100000, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  
  return { page, limit };
}
