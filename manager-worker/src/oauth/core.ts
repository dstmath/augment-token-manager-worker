/**
 * OAuth Core Module - Cloudflare Worker Implementation
 * 
 * This module provides a complete OAuth 2.0 PKCE flow implementation
 * migrated from the Rust oauth-module to Cloudflare Worker environment.
 */

import { CryptoUtils } from './crypto';

export interface OAuthState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  creationTime: number;
}

export interface TokenResponse {
  access_token: string;
  tenant_url: string;
  email?: string;
  portal_url?: string;
}

export interface AccountStatus {
  is_banned: boolean;
  status: 'ACTIVE' | 'ERROR' | 'SUSPENDED';
  error_message?: string;
  response_code: number;
  response_body: string;
}

export interface OAuthConfig {
  clientId: string;
  authBaseUrl: string;
  redirectUri?: string;
  scope?: string;
}

/**
 * OAuth Core Class - Main OAuth functionality
 */
export class OAuthCore {
  private config: OAuthConfig;
  private crypto: CryptoUtils;

  constructor(config: Partial<OAuthConfig> = {}) {
    this.config = {
      clientId: config.clientId || 'v',
      authBaseUrl: config.authBaseUrl || 'https://auth.augmentcode.com',
      redirectUri: config.redirectUri || '',
      scope: config.scope || ''
    };
    this.crypto = new CryptoUtils();
  }

  /**
   * Create OAuth state with PKCE parameters
   * Replaces Rust's create_oauth_state function - exact copy of Rust logic
   */
  async createOAuthState(): Promise<OAuthState> {
    // 生成32字节的随机代码验证器 (exact same as Rust)
    const codeVerifier = this.crypto.generateCodeVerifier();

    // 根据代码验证器生成代码挑战 (SHA256哈希) (exact same as Rust)
    const codeChallenge = await this.crypto.sha256(codeVerifier);

    // 生成状态参数用于防止CSRF攻击 (exact same as Rust)
    const state = this.crypto.generateState();

    // 记录创建时间 (exact same as Rust)
    const creationTime = Date.now();

    return {
      codeVerifier,
      codeChallenge,
      state,
      creationTime
    };
  }

  /**
   * Generate authorization URL
   * Replaces Rust's generate_authorize_url function - exact copy of Rust logic
   */
  generateAuthorizeUrl(oauthState: OAuthState, redirectUri?: string): string {
    const authUrl = new URL(`${this.config.authBaseUrl}/authorize`);

    // Exact same order as Rust version
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', oauthState.codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('state', oauthState.state);
    authUrl.searchParams.set('redirect_uri', redirectUri || '');
    authUrl.searchParams.set('prompt', 'login');

    return authUrl.toString();
  }

  /**
   * Exchange authorization code for access token
   * Replaces Rust's get_augment_access_token function
   */
  async getAccessToken(
    tenantUrl: string,
    codeVerifier: string,
    code: string,
    redirectUri?: string
  ): Promise<TokenResponse> {
    // Validate required parameters
    if (!tenantUrl) {
      throw new Error('Tenant URL is required');
    }
    if (!codeVerifier) {
      throw new Error('Code verifier is required');
    }
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Use the same URL format as Rust version: tenantUrl + "token"
    const tokenUrl = `${tenantUrl}token`;

    const requestBody = {
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri || this.config.redirectUri || '',
      code: code
    };



    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header for PKCE flow
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json() as any;
    
    if (!result.access_token) {
      throw new Error('No access token in response');
    }

    return {
      access_token: result.access_token,
      tenant_url: tenantUrl,
      email: result.email,
      portal_url: result.portal_url
    };
  }

  /**
   * Complete OAuth flow with authorization code
   * Replaces Rust's complete_augment_oauth_flow function
   */
  async completeOAuthFlow(
    oauthState: OAuthState,
    codeInput: string,
    redirectUri?: string
  ): Promise<TokenResponse> {
    let parsedCode: any;
    
    try {
      parsedCode = JSON.parse(codeInput);
    } catch (error) {
      throw new Error('Invalid authorization code format - expected JSON');
    }

    // Verify state parameter to prevent CSRF attacks
    if (parsedCode.state !== oauthState.state) {
      throw new Error('State parameter mismatch - possible CSRF attack');
    }

    if (!parsedCode.code) {
      throw new Error('Missing authorization code');
    }

    if (!parsedCode.tenant_url) {
      throw new Error('Missing tenant URL');
    }

    const tokenResponse = await this.getAccessToken(
      parsedCode.tenant_url,
      oauthState.codeVerifier,
      parsedCode.code,
      redirectUri
    );

    return tokenResponse;
  }

  /**
   * Check account status
   * Replaces Rust's check_account_ban_status function
   */
  async checkAccountStatus(token: string, tenantUrl: string): Promise<AccountStatus> {
    const baseUrl = tenantUrl.endsWith('/') ? tenantUrl : `${tenantUrl}/`;
    const apiUrl = `${baseUrl}find-missing`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      const responseBody = await response.text();
      const statusCode = response.status;

      return {
        is_banned: statusCode !== 200 && responseBody.toLowerCase().includes('suspended'),
        status: response.ok ? 'ACTIVE' : (responseBody.toLowerCase().includes('suspended') ? 'SUSPENDED' : 'ERROR'),
        error_message: response.ok ? undefined : responseBody,
        response_code: statusCode,
        response_body: responseBody
      };
    } catch (error) {
      return {
        is_banned: false,
        status: 'ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        response_code: 0,
        response_body: ''
      };
    }
  }
}
