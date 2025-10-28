/**
 * Credit Consumption Routes
 * 
 * Provides API endpoints to fetch credit usage statistics from Augment Code.
 * Based on augment-token-mng implementation.
 */

import { Env, AuthenticatedRequest, CreditConsumptionRequest, BatchCreditConsumptionResponse, CreditConsumptionResponse } from '../types/index.js';
import { createSuccessResponse, createErrorResponse, parseJsonBody } from '../utils/response.js';
import { getCurrentUser } from '../middleware/auth.js';

/**
 * Exchange auth session for app session
 * This is required to access Augment app APIs
 */
async function exchangeAuthSessionForAppSession(authSession: string): Promise<string | null> {
  try {
    console.log('Exchanging auth session for app session...');
    
    // Access app.augmentcode.com with auth session cookie
    // The server will set a _session cookie for app.augmentcode.com
    const response = await fetch('https://app.augmentcode.com/', {
      method: 'GET',
      headers: {
        'Cookie': `session=${authSession}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual', // Don't follow redirects automatically
    });

    console.log('Exchange response status:', response.status);

    // Extract _session cookie from Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) {
      console.error('No Set-Cookie header in response');
      return null;
    }

    console.log('Set-Cookie header:', setCookieHeader.substring(0, 100) + '...');

    // Parse _session cookie
    const sessionMatch = setCookieHeader.match(/_session=([^;]+)/);
    if (!sessionMatch) {
      console.error('No _session cookie found in Set-Cookie header');
      return null;
    }

    const appSession = sessionMatch[1];
    console.log('Successfully extracted app session, length:', appSession.length);
    
    return appSession;
  } catch (error) {
    console.error('Failed to exchange auth session for app session:', error);
    return null;
  }
}

/**
 * Fetch credit consumption data from Augment API
 */
async function fetchCreditConsumption(
  appSession: string,
  groupBy: 'NONE' | 'MODEL_NAME',
  granularity: 'DAY' | 'TOTAL',
  billingCycle: 'CURRENT_BILLING_CYCLE' = 'CURRENT_BILLING_CYCLE'
): Promise<CreditConsumptionResponse> {
  const url = `https://app.augmentcode.com/api/credit-consumption?groupBy=${groupBy}&granularity=${granularity}&billingCycle=${billingCycle}`;
  
  console.log('Fetching credit consumption from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `_session=${encodeURIComponent(appSession)}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Credit consumption API error:', response.status, errorText);
    throw new Error(`Credit consumption API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;
  console.log('Credit consumption response:', JSON.stringify(data).substring(0, 200));

  // Transform response to match our interface
  return {
    data_points: (data.dataPoints || []).map((point: any) => ({
      group_key: point.groupKey,
      date_range: point.dateRange ? {
        start_date_iso: point.dateRange.startDateIso,
        end_date_iso: point.dateRange.endDateIso,
      } : undefined,
      credits_consumed: point.creditsConsumed || '0',
    })),
  };
}

/**
 * Get batch credit consumption data (stats + chart)
 * POST /api/credits/consumption
 */
export async function getBatchCreditConsumptionHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await parseJsonBody<CreditConsumptionRequest>(request);

    if (!body.auth_session) {
      return createErrorResponse('auth_session is required', 400);
    }

    console.log('Starting batch credit consumption fetch for user:', user.id);

    // Step 1: Exchange auth session for app session
    // Check cache first
    const cacheKey = `app_session:${body.auth_session}`;
    let appSession = await env.SESSIONS_KV.get(cacheKey);

    if (!appSession) {
      console.log('No cached app session, exchanging...');
      appSession = await exchangeAuthSessionForAppSession(body.auth_session);
      
      if (!appSession) {
        return createErrorResponse(
          'Failed to exchange auth session for app session. Please ensure the auth session is valid.',
          400
        );
      }

      // Cache app session for 1 hour
      await env.SESSIONS_KV.put(cacheKey, appSession, { expirationTtl: 3600 });
      console.log('Cached app session');
    } else {
      console.log('Using cached app session');
    }

    // Step 2: Fetch both stats and chart data in parallel
    const [statsData, chartData] = await Promise.all([
      fetchCreditConsumption(appSession, 'NONE', 'DAY'),
      fetchCreditConsumption(appSession, 'MODEL_NAME', 'TOTAL'),
    ]);

    const result: BatchCreditConsumptionResponse = {
      stats_data: statsData,
      chart_data: chartData,
    };

    console.log('Successfully fetched batch credit consumption data');

    return createSuccessResponse(result, 'Credit consumption data fetched successfully');
  } catch (error) {
    console.error('Failed to fetch credit consumption:', error);
    return createErrorResponse(
      'Failed to fetch credit consumption: ' + (error instanceof Error ? error.message : 'Unknown error'),
      500
    );
  }
}

