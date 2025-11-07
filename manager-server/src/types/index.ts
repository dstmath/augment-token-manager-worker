import { Request } from 'express';
import { User, Session, Token } from '@prisma/client';

// Extend Express Request with user and session
export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: Session;
  validatedData?: any;
  batchData?: any[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateTokenRequest {
  tenant_url?: string;
  access_token: string;
  portal_url?: string;
  email_note?: string;
  auth_session?: string;
}

export interface UpdateTokenRequest {
  tenant_url?: string;
  access_token?: string;
  portal_url?: string;
  email_note?: string;
  ban_status?: string;
  share_info?: string;
  is_shared?: boolean;
  auth_session?: string;
}

export interface SessionImportRequest {
  session_token: string;
  email_note?: string;
}

// Credit Consumption Types
export interface DateRange {
  start_date_iso: string;
  end_date_iso: string;
}

export interface CreditDataPoint {
  group_key?: string;
  date_range?: DateRange;
  credits_consumed: string;
}

export interface CreditConsumptionResponse {
  data_points: CreditDataPoint[];
}

export interface BatchCreditConsumptionResponse {
  stats_data: CreditConsumptionResponse;
  chart_data: CreditConsumptionResponse;
}

export interface CreditConsumptionRequest {
  auth_session: string;
}

// Email service types
export interface EmailGenerationOptions {
  type?: 'mixed' | 'word';
  prefix?: string;
  length?: number;
  domain?: string;
  customDomain?: string;
}

// Validation types
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Error types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token response type (matching frontend expectations)
export interface TokenResponse {
  id: string;
  tenant_url?: string;
  access_token: string;
  portal_url?: string;
  email_note?: string;
  ban_status?: string;
  portal_info?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  share_info?: string;
  is_shared?: boolean;
  auth_session?: string;
}

// Session response type
export interface SessionResponse {
  userId: string;
  username: string;
  role: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

// User credentials map
export type UserCredentialsMap = Map<string, string>;

