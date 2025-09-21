/**
 * OAuth Request Handlers - Cloudflare Worker Implementation
 * 
 * This module provides HTTP request handlers for OAuth endpoints,
 * replacing Rust's HTTP server and warp routing.
 */

import { OAuthCore, OAuthState, TokenResponse, AccountStatus } from './core';
import { OAuthStorage } from './storage';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { Env } from '../types/index';

/**
 * OAuth Handlers Class - HTTP request processing
 * Replaces Rust's HTTP server and warp routing
 */
export class OAuthHandlers {
  private oauth: OAuthCore;
  private storage: OAuthStorage;

  constructor(env: Env) {
    // 使用硬编码的Augment OAuth配置
    this.oauth = new OAuthCore();
    this.storage = new OAuthStorage(env.SESSIONS_KV); // 使用SESSIONS_KV而不是OAUTH_KV
  }

  /**
   * Handle authorization URL generation request
   * GET /oauth/authorize
   * 
   * Replaces Rust's authorization URL generation
   */
  async handleAuthorize(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const redirectUri = url.searchParams.get('redirect_uri') || '';

      // Create OAuth state
      const oauthState = await this.oauth.createOAuthState();
      
      // Generate authorization URL
      const authUrl = this.oauth.generateAuthorizeUrl(oauthState, redirectUri);
      
      // Store OAuth state in KV
      await this.storage.storeOAuthState(oauthState.state, oauthState);
      


      return createSuccessResponse({
        auth_url: authUrl,
        state: oauthState.state,
        code_verifier: oauthState.codeVerifier,
        code_challenge: oauthState.codeChallenge,
        creation_time: oauthState.creationTime
      }, 'Authorization URL generated successfully');

    } catch (error) {
      console.error('Failed to generate authorization URL:', error);
      return createErrorResponse(
        'Failed to generate authorization URL: ' + (error instanceof Error ? error.message : 'Unknown error'),
        500
      );
    }
  }

  /**
   * Handle OAuth callback
   * GET /oauth/callback?code=...&state=...
   * 
   * Replaces Rust's callback handling
   */
  async handleCallback(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Check for authorization errors
      if (error) {
        console.error('OAuth authorization error:', { error, errorDescription });
        return createErrorResponse(
          `OAuth authorization failed: ${error}: ${errorDescription || 'No description provided'}`,
          400
        );
      }

      // Validate required parameters
      if (!code || !state) {
        return createErrorResponse(
          'Missing required parameters: Both code and state parameters are required',
          400
        );
      }

      // Retrieve stored OAuth state
      const oauthState = await this.storage.getOAuthState(state);
      if (!oauthState) {
        return createErrorResponse(
          'Invalid or expired state: OAuth state not found or has expired. Please restart the authorization process.',
          400
        );
      }

      // Construct authorization code JSON (Augment format)
      const codeJson = JSON.stringify({
        code,
        state,
        tenant_url: 'https://api.augmentcode.com/'
      });

      // Complete OAuth flow
      const result = await this.oauth.completeOAuthFlow(oauthState, codeJson);
      
      // Clean up stored state
      await this.storage.deleteOAuthState(state);



      return createSuccessResponse({
        access_token: result.access_token,
        tenant_url: result.tenant_url,
        email: result.email,
        portal_url: result.portal_url
      }, 'OAuth authorization completed successfully');

    } catch (error) {
      console.error('OAuth callback failed:', error);
      return createErrorResponse(
        'OAuth callback processing failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        500
      );
    }
  }

  /**
   * Handle token exchange
   * POST /oauth/token
   * 
   * Replaces Rust's token exchange handling
   */
  async handleToken(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        code_input: string;
        state: string;
        oauth_state?: OAuthState;
      };

      const { code_input, state, oauth_state } = body;

      if (!code_input || !state) {
        return createErrorResponse(
          'Missing required parameters: Both code_input and state are required',
          400
        );
      }

      // Get OAuth state from storage or use provided state
      let oauthState = oauth_state;
      if (!oauthState) {
        oauthState = await this.storage.getOAuthState(state);
        if (!oauthState) {
          return createErrorResponse(
            'Invalid or expired state: OAuth state not found or has expired. Please restart the authorization process.',
            400
          );
        }
      }

      // Complete OAuth flow
      const result = await this.oauth.completeOAuthFlow(oauthState, code_input);
      
      // Clean up stored state
      await this.storage.deleteOAuthState(state);



      return createSuccessResponse(result, 'Token exchange completed successfully');

    } catch (error) {
      console.error('Token exchange failed:', error);
      return createErrorResponse(
        'Token exchange failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        500
      );
    }
  }

  /**
   * Handle account status check
   * POST /oauth/status
   * 
   * Replaces Rust's account status checking
   */
  async handleStatus(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        token: string;
        tenant_url: string;
      };

      const { token, tenant_url } = body;

      if (!token || !tenant_url) {
        return createErrorResponse(
          'Missing required parameters: Both token and tenant_url are required',
          400
        );
      }

      // Check account status
      const status = await this.oauth.checkAccountStatus(token, tenant_url);

      console.log('Account status checked:', {
        tenantUrl: tenant_url,
        status: status.status,
        isBanned: status.is_banned,
        responseCode: status.response_code
      });

      return createSuccessResponse(status, 'Account status checked successfully');

    } catch (error) {
      console.error('Account status check failed:', error);
      return createErrorResponse(
        'Account status check failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        500
      );
    }
  }

  /**
   * Handle health check
   * GET /oauth/health
   */
  async handleHealth(request: Request): Promise<Response> {
    return createSuccessResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'oauth-module',
      version: '1.0.0'
    }, 'OAuth service is healthy');
  }
}
