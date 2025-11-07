import { Env, AuthenticatedRequest, ValidationRule } from '../types/index.js';
import { validateData, ValidationRules } from '../utils/validation.js';
import { createValidationErrorResponse, parseJsonBody } from '../utils/response.js';

/**
 * Generic validation middleware factory
 */
export function createValidationMiddleware(rules: ValidationRule[]) {
  return async (
    request: AuthenticatedRequest,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response | null> => {
    try {
      // Only validate requests with body
      if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
        return null;
      }

      // Parse request body
      const body = await parseJsonBody(request);
      
      // Validate against rules
      const validation = validateData(body, rules);
      
      if (!validation.isValid) {
        return createValidationErrorResponse(validation.errors);
      }
      
      // Attach validated data to request for use in handlers
      (request as any).validatedData = body;
      
      return null; // Continue to next middleware/handler
    } catch (error) {
      return createValidationErrorResponse(['Invalid JSON in request body']);
    }
  };
}

/**
 * Login validation middleware
 */
export const loginValidationMiddleware = createValidationMiddleware(ValidationRules.login);

/**
 * Token creation validation middleware
 */
export const createTokenValidationMiddleware = createValidationMiddleware(ValidationRules.createToken);

/**
 * UUID creation validation middleware
 */
export const createUuidValidationMiddleware = createValidationMiddleware(ValidationRules.createUuid);

/**
 * Activation code creation validation middleware
 */
export const createActivationCodeValidationMiddleware = createValidationMiddleware(ValidationRules.createActivationCode);

/**
 * Email subscription validation middleware
 */
export const emailSubscriptionValidationMiddleware = createValidationMiddleware(ValidationRules.emailSubscription);

/**
 * ID parameter validation middleware
 */
export async function idValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // Find ID parameter in path (usually the last part or before an action)
  let id: string | null = null;
  
  // Common patterns: /api/tokens/:id, /api/tokens/:id/action
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === 'tokens' || pathParts[i] === 'uuid' || pathParts[i] === 'activation') {
      if (i + 1 < pathParts.length && pathParts[i + 1]) {
        id = pathParts[i + 1];
        break;
      }
    }
  }
  
  if (id) {
    // Validate ID format (UUID or custom format)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return createValidationErrorResponse(['Invalid ID format']);
    }
    
    // Attach ID to request for use in handlers
    (request as any).params = { id };
  }
  
  return null;
}

/**
 * Query parameter validation middleware
 */
export async function queryValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const errors: string[] = [];
  
  // Validate pagination parameters
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');
  
  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    }
  }
  
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100000) {
      errors.push('Limit must be between 1 and 100000');
    }
  }
  
  // Validate search parameters
  const search = url.searchParams.get('search');
  if (search && search.length > 100) {
    errors.push('Search query too long (max 100 characters)');
  }
  
  // Validate category filter
  const category = url.searchParams.get('category');
  if (category && category.length > 50) {
    errors.push('Category filter too long (max 50 characters)');
  }
  
  // Validate sort parameters
  const sort = url.searchParams.get('sort');
  const validSortFields = ['name', 'createdAt', 'updatedAt', 'category'];
  if (sort && !validSortFields.includes(sort)) {
    errors.push(`Invalid sort field. Valid options: ${validSortFields.join(', ')}`);
  }
  
  const order = url.searchParams.get('order');
  if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
    errors.push('Order must be "asc" or "desc"');
  }
  
  if (errors.length > 0) {
    return createValidationErrorResponse(errors);
  }
  
  return null;
}

/**
 * File upload validation middleware
 */
export async function fileUploadValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext,
  maxSizeBytes: number = 5 * 1024 * 1024, // 5MB default
  allowedTypes: string[] = ['application/json', 'text/csv', 'text/plain']
): Promise<Response | null> {
  const contentType = request.headers.get('Content-Type');
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return null; // Not a file upload
  }
  
  const contentLength = request.headers.get('Content-Length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return createValidationErrorResponse([
        `File too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB`
      ]);
    }
  }
  
  return null;
}

/**
 * Batch operation validation middleware
 */
export async function batchValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext,
  maxBatchSize: number = 100
): Promise<Response | null> {
  try {
    if (request.method !== 'POST') {
      return null;
    }
    
    const body = await parseJsonBody(request);
    
    // Check if it's a batch operation
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return createValidationErrorResponse(['Batch cannot be empty']);
      }
      
      if (body.length > maxBatchSize) {
        return createValidationErrorResponse([
          `Batch too large. Maximum ${maxBatchSize} items allowed`
        ]);
      }
      
      // Attach batch data to request
      (request as any).batchData = body;
    } else if (body.items && Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return createValidationErrorResponse(['Batch items cannot be empty']);
      }
      
      if (body.items.length > maxBatchSize) {
        return createValidationErrorResponse([
          `Batch too large. Maximum ${maxBatchSize} items allowed`
        ]);
      }
      
      // Attach batch data to request
      (request as any).batchData = body.items;
    }
    
    return null;
  } catch (error) {
    return createValidationErrorResponse(['Invalid JSON in request body']);
  }
}

/**
 * Date range validation middleware
 */
export async function dateRangeValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const errors: string[] = [];
  
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date format');
    }
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date format');
    }
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      errors.push('Start date cannot be after end date');
    }
    
    // Check if date range is too large (e.g., more than 1 year)
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (end.getTime() - start.getTime() > maxRangeMs) {
      errors.push('Date range too large (maximum 1 year)');
    }
  }
  
  if (errors.length > 0) {
    return createValidationErrorResponse(errors);
  }
  
  return null;
}

/**
 * API version validation middleware
 */
export async function apiVersionValidationMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext,
  supportedVersions: string[] = ['v1']
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // Look for version in path (e.g., /api/v1/tokens)
  let version: string | null = null;
  for (const part of pathParts) {
    if (part.match(/^v\d+$/)) {
      version = part;
      break;
    }
  }
  
  // Also check Accept-Version header
  const headerVersion = request.headers.get('Accept-Version');
  if (headerVersion) {
    version = headerVersion;
  }
  
  if (version && !supportedVersions.includes(version)) {
    return new Response(JSON.stringify({
      success: false,
      error: `Unsupported API version: ${version}`,
      supportedVersions,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return null;
}
