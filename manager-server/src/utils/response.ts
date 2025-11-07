import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types/index.js';

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 400
): { response: ApiResponse; statusCode: number } {
  return {
    response: {
      success: false,
      error,
    },
    statusCode,
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Send success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json(createSuccessResponse(data, message));
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 400
): Response {
  return res.status(statusCode).json({
    success: false,
    error,
  });
}

/**
 * Send paginated response
 */
export function sendPaginatedResponse<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number
): Response {
  return res.status(200).json(createPaginatedResponse(data, page, limit, total));
}

/**
 * Get pagination parameters from query
 */
export function getPaginationParams(query: any): { page: number; limit: number } {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100000, Math.max(1, parseInt(query.limit || '10', 10)));
  
  return { page, limit };
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody<T>(body: any): Promise<T> {
  return body as T;
}

