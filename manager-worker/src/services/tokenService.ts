import { Env, TokenRecord, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';
import { WorkerTokenValidator, TokenValidationResult } from './tokenValidator.js';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Token management service
 */
export class TokenService {
  constructor(private env: Env) {}

  /**
   * Create a new token
   */
  async createToken(tokenData: CreateTokenRequest, createdBy: string): Promise<TokenRecord> {
    const tokenId = generateUUID();
    const now = new Date().toISOString();
    
    const token: TokenRecord = {
      id: tokenId,
      tenant_url: tokenData.tenant_url,
      access_token: tokenData.access_token,
      portal_url: tokenData.portal_url,
      email_note: tokenData.email_note,
      ban_status: JSON.stringify({ status: 'NORMAL', reason: 'Initial state', updated_at: now }), // New status format
      portal_info: '{}', // Default empty JSON
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    };
    
    // Store token in KV
    await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(token));

    // Update token index for listing (simple approach)
    await this.addToTokenIndex(tokenId);

    // Update email index for fast lookup
    if (token.email_note) {
      await this.addToEmailIndex(token.email_note, tokenId);
    }
    
    return token;
  }

  /**
   * Get token by ID
   */
  async getTokenById(tokenId: string): Promise<TokenRecord | null> {
    const tokenData = await this.env.TOKENS_KV.get(`token:${tokenId}`);
    return tokenData ? JSON.parse(tokenData) : null;
  }

  /**
   * Update token
   */
  async updateToken(tokenId: string, updates: UpdateTokenRequest): Promise<TokenRecord | null> {
    const existingToken = await this.getTokenById(tokenId);
    if (!existingToken) {
      return null;
    }

    const updatedToken: TokenRecord = {
      ...existingToken,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

    // Update email index if email_note changed
    if (updates.email_note && updates.email_note !== existingToken.email_note) {
      if (existingToken.email_note) {
        await this.removeFromEmailIndex(existingToken.email_note, tokenId);
      }
      await this.addToEmailIndex(updates.email_note, tokenId);
    }

    return updatedToken;
  }

  /**
   * Delete token
   */
  async deleteToken(tokenId: string): Promise<boolean> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return false;
    }
    
    await this.env.TOKENS_KV.delete(`token:${tokenId}`);
    await this.removeFromTokenIndex(tokenId);

    // Remove from email index
    if (token.email_note) {
      await this.removeFromEmailIndex(token.email_note, tokenId);
    }
    
    return true;
  }

  /**
   * List tokens with pagination
   */
  async listTokens(page: number = 1, limit: number = 10): Promise<{
    tokens: TokenRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Get token index
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];
    
    const total = tokenIds.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedIds = tokenIds.slice(startIndex, endIndex);
    
    // Fetch tokens
    const tokens: TokenRecord[] = [];
    for (const tokenId of paginatedIds) {
      const token = await this.getTokenById(tokenId);
      if (token) {
        tokens.push(token);
      }
    }
    
    // Sort tokens by created_at in descending order (newest first)
    tokens.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    return {
      tokens,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Search tokens by criteria
   */
  async searchTokens(criteria: {
    search?: string;
    category?: string;
    createdBy?: string;
  }): Promise<TokenRecord[]> {
    // Get all tokens (in a real implementation, you'd use a proper search index)
    const { tokens } = await this.listTokens(1, 100000); // Get up to 100000 tokens
    
    let filteredTokens = tokens;
    
    // Apply search filter
    if (criteria.search) {
      const searchTerm = criteria.search.toLowerCase();
      filteredTokens = filteredTokens.filter(token => 
        token.access_token.toLowerCase().includes(searchTerm) ||
        token.tenant_url?.toLowerCase().includes(searchTerm) ||
        token.email_note?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply created by filter
    if (criteria.createdBy) {
      filteredTokens = filteredTokens.filter(token => 
        token.created_by === criteria.createdBy
      );
    }
    
    // Sort by created_at in descending order (newest first)
    filteredTokens.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    return filteredTokens;
  }

  /**
   * Batch import tokens
   */
  async batchImportTokens(tokens: CreateTokenRequest[], createdBy: string): Promise<{
    success: TokenRecord[];
    failed: { token: CreateTokenRequest; error: string }[];
  }> {
    const success: TokenRecord[] = [];
    const failed: { token: CreateTokenRequest; error: string }[] = [];
    
    for (const tokenData of tokens) {
      try {
        const token = await this.createToken(tokenData, createdBy);
        success.push(token);
      } catch (error) {
        failed.push({
          token: tokenData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return { success, failed };
  }

  /**
   * Validate token status (check if token is still valid)
   */
  async validateTokenStatus(tokenId: string): Promise<{
    isValid: boolean;
    status: string;
    token?: TokenRecord;
  }> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return { isValid: false, status: 'Token not found' };
    }

    try {
      // 检查必要字段
      if (!token.tenant_url || !token.access_token) {
        return { isValid: false, status: 'Token缺少必要的字段', token };
      }

      // 使用新的Token验证模块，硬编码超时时间
      const timeout = 30000; // 硬编码30秒超时
      const validator = new WorkerTokenValidator({ enableDebug: false, timeout });
      const validationResult: TokenValidationResult = await validator.validateToken(
        token.access_token,
        token.tenant_url
      );

      let isValid = false;
      let status = '';
      let banStatusValue = '';

      // 根据验证结果设置状态
      if (validationResult.is_valid && !validationResult.is_banned) {
        isValid = true;
        status = 'Token状态正常';
        banStatusValue = 'NORMAL';
      } else if (validationResult.is_banned) {
        isValid = false;
        status = `Token已被封禁: ${validationResult.status}`;
        banStatusValue = 'BANNED';
      } else {
        isValid = false;
        status = `Token已失效: ${validationResult.status}`;
        banStatusValue = 'INVALID';
      }

      // 更新ban_status，使用新的状态枚举和详细信息
      const banStatus = JSON.stringify({
        status: banStatusValue,
        reason: validationResult.error_message || status,
        validation_status: validationResult.status,
        response_code: validationResult.response_code,
        updated_at: new Date().toISOString()
      });

      const updatedToken: TokenRecord = {
        ...token,
        ban_status: banStatus,
        updated_at: new Date().toISOString(),
        // 保留原有的portal_info，不要覆盖
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return {
        isValid,
        status,
        token: updatedToken,
      };

    } catch (error) {
      console.error('Token validation error:', error);
      return {
        isValid: false,
        status: `验证过程中发生错误: ${error instanceof Error ? error.message : 'Unknown error'}`,
        token,
      };
    }
  }

  /**
   * Batch validate multiple tokens
   */
  async validateTokensBatch(tokenIds: string[]): Promise<Array<{
    tokenId: string;
    isValid: boolean;
    status: string;
    token?: TokenRecord;
    error?: string;
  }>> {
    const results = [];

    // 获取所有tokens
    const tokens = await Promise.all(
      tokenIds.map(id => this.getTokenById(id))
    );

    // 准备验证数据
    const validTokens = tokens.filter(token => token !== null) as TokenRecord[];
    const tokenPairs: Array<[string, string]> = validTokens
      .filter(token => token.tenant_url && token.access_token)
      .map(token => [token.access_token!, token.tenant_url!]);

    if (tokenPairs.length === 0) {
      return tokenIds.map(id => ({
        tokenId: id,
        isValid: false,
        status: 'Token not found or missing required fields',
        error: 'Invalid token data'
      }));
    }

    // 使用批量验证，硬编码超时时间
    const timeout = 30000; // 硬编码30秒超时
    const validator = new WorkerTokenValidator({ enableDebug: false, timeout });
    const validationResults = await validator.validateTokensBatch(tokenPairs, { concurrency: 3 });

    // 处理结果
    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      const token = tokens[i];

      if (!token) {
        results.push({
          tokenId,
          isValid: false,
          status: 'Token not found',
          error: 'Token not found'
        });
        continue;
      }

      if (!token.tenant_url || !token.access_token) {
        results.push({
          tokenId,
          isValid: false,
          status: 'Token缺少必要的字段',
          token,
          error: 'Missing required fields'
        });
        continue;
      }

      // 找到对应的验证结果
      const validTokenIndex = validTokens.findIndex(t => t.id === tokenId);
      const validationResult = validationResults[validTokenIndex];

      if (validationResult instanceof Error) {
        results.push({
          tokenId,
          isValid: false,
          status: 'Validation error',
          token,
          error: validationResult.message
        });
        continue;
      }

      // 处理验证结果
      let isValid = false;
      let status = '';
      let banStatusValue = '';

      if (validationResult.is_valid && !validationResult.is_banned) {
        isValid = true;
        status = 'Token状态正常';
        banStatusValue = 'NORMAL';
      } else if (validationResult.is_banned) {
        isValid = false;
        status = `Token已被封禁: ${validationResult.status}`;
        banStatusValue = 'BANNED';
      } else {
        isValid = false;
        status = `Token已失效: ${validationResult.status}`;
        banStatusValue = 'INVALID';
      }

      // 更新token状态
      const banStatus = JSON.stringify({
        status: banStatusValue,
        reason: validationResult.error_message || status,
        validation_status: validationResult.status,
        response_code: validationResult.response_code,
        updated_at: new Date().toISOString()
      });

      const updatedToken: TokenRecord = {
        ...token,
        ban_status: banStatus,
        updated_at: new Date().toISOString(),
      };

      // 保存更新的token
      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      results.push({
        tokenId,
        isValid,
        status,
        token: updatedToken
      });
    }

    return results;
  }

  /**
   * Refresh token information (fetch latest data from API)
   */
  async refreshTokenInfo(tokenId: string): Promise<TokenRecord | null> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return null;
    }

    try {
      // 从 portal_url 中提取 token 参数
      const portalUrl = token.portal_url;
      if (!portalUrl) {
        throw new Error('Token 没有 portal_url 信息');
      }

      const tokenParam = this.extractTokenFromURL(portalUrl);
      if (!tokenParam) {
        throw new Error('从 portal_url 解析 token 参数失败');
      }

      // 第一步：获取客户信息
      const customerInfo = await this.getCustomerFromLink(tokenParam);

      // 第二步：获取账户余额信息
      const ledgerInfo = await this.getLedgerSummary(customerInfo, tokenParam);

      // 第三步：计算过期时间（effective_date + 1个月）
      let expiryDate = '';
      if (ledgerInfo.credit_blocks && ledgerInfo.credit_blocks.length > 0) {
        const firstBlock = ledgerInfo.credit_blocks[0];
        if (firstBlock.effective_date) {
          try {
            const effectiveDate = new Date(firstBlock.effective_date);
            // 加 1 个月
            effectiveDate.setMonth(effectiveDate.getMonth() + 1);
            expiryDate = effectiveDate.toISOString();
          } catch (e) {
            console.error('Failed to parse effective_date:', e);
          }
        }
      }

      // 第四步：更新 portal_info 和状态
      const portalInfo = {
        credits_balance: this.parseCreditsBalance(ledgerInfo.credits_balance),
        is_active: ledgerInfo.credit_blocks.length > 0 ? ledgerInfo.credit_blocks[0].is_active : false,
        expiry_date: expiryDate,
      };

      // 刷新操作只更新portal_info，不修改ban_status
      const updatedToken: TokenRecord = {
        ...token,
        portal_info: JSON.stringify(portalInfo),
        updated_at: new Date().toISOString(),
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return updatedToken;

    } catch (error) {
      console.error('Token refresh error:', error);
      // 如果刷新失败，至少更新时间戳
      const updatedToken: TokenRecord = {
        ...token,
        updated_at: new Date().toISOString(),
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return updatedToken;
    }
  }

  /**
   * 从 portal_url 中提取 token 参数
   */
  private extractTokenFromURL(portalUrl: string): string | null {
    try {
      const url = new URL(portalUrl);
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  /**
   * 第一步：获取客户信息
   */
  private async getCustomerFromLink(tokenParam: string): Promise<any> {
    const apiUrl = `https://portal.withorb.com/api/v1/customer_from_link?token=${tokenParam}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Connection': 'keep-alive',
        'Referer': `https://portal.withorb.com/view?token=${tokenParam}`,
        'Origin': 'https://portal.withorb.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`客户信息 API 返回错误状态码: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 第二步：获取账户余额信息
   */
  private async getLedgerSummary(customerInfo: any, tokenParam: string): Promise<any> {
    if (!customerInfo.customer?.ledger_pricing_units?.length) {
      throw new Error('客户信息中没有 pricing unit');
    }

    const customerId = customerInfo.customer.id;
    const pricingUnitId = customerInfo.customer.ledger_pricing_units[0].id;

    const apiUrl = `https://portal.withorb.com/api/v1/customers/${customerId}/ledger_summary?pricing_unit_id=${pricingUnitId}&token=${tokenParam}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Referer': `https://portal.withorb.com/view?token=${tokenParam}`,
        'Origin': 'https://portal.withorb.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    if (!response.ok) {
      throw new Error(`账户余额 API 返回错误状态码: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 解析 credits_balance 字符串为数字
   */
  private parseCreditsBalance(creditsStr: string): number {
    // 移除小数点，将 "16.00" 转换为 16
    const dotIndex = creditsStr.indexOf('.');
    if (dotIndex !== -1) {
      creditsStr = creditsStr.substring(0, dotIndex);
    }

    return parseInt(creditsStr, 10) || 0;
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    total: number;
    active: number;
    banned: number;
    expired: number;
  }> {
    const { tokens } = await this.listTokens(1, 1000); // Get up to 1000 tokens
    
    let active = 0;
    let banned = 0;
    let expired = 0;
    
    for (const token of tokens) {
      const status = await this.validateTokenStatus(token.id);
      if (status.status === 'active') active++;
      else if (status.status === 'banned') banned++;
      else if (status.status === 'expired') expired++;
    }
    
    return {
      total: tokens.length,
      active,
      banned,
      expired,
    };
  }

  /**
   * Add token ID to index for listing
   */
  private async addToTokenIndex(tokenId: string): Promise<void> {
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];
    
    if (!tokenIds.includes(tokenId)) {
      tokenIds.unshift(tokenId); // Add to beginning for newest first
      await this.env.TOKENS_KV.put('token_index', JSON.stringify(tokenIds));
    }
  }

  /**
   * Remove token ID from index
   */
  private async removeFromTokenIndex(tokenId: string): Promise<void> {
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];

    const filteredIds = tokenIds.filter(id => id !== tokenId);
    await this.env.TOKENS_KV.put('token_index', JSON.stringify(filteredIds));
  }

  /**
   * Add token ID to email index
   */
  private async addToEmailIndex(emailNote: string, tokenId: string): Promise<void> {
    if (!emailNote) return;

    const indexKey = `email_index:${emailNote}`;
    const indexData = await this.env.TOKENS_KV.get(indexKey);
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];

    if (!tokenIds.includes(tokenId)) {
      tokenIds.push(tokenId);
      await this.env.TOKENS_KV.put(indexKey, JSON.stringify(tokenIds));
    }
  }

  /**
   * Remove token ID from email index
   */
  private async removeFromEmailIndex(emailNote: string, tokenId: string): Promise<void> {
    if (!emailNote) return;

    const indexKey = `email_index:${emailNote}`;
    const indexData = await this.env.TOKENS_KV.get(indexKey);
    if (!indexData) return;

    const tokenIds: string[] = JSON.parse(indexData);
    const filteredIds = tokenIds.filter(id => id !== tokenId);

    if (filteredIds.length === 0) {
      // Remove empty index
      await this.env.TOKENS_KV.delete(indexKey);
    } else {
      await this.env.TOKENS_KV.put(indexKey, JSON.stringify(filteredIds));
    }
  }

  /**
   * Get tokens by email note (optimized with index, fallback to scan)
   */
  async getTokensByEmailNote(emailNote: string): Promise<TokenRecord[]> {
    try {
      if (!emailNote) return [];

      // Try to use email index for fast lookup
      const indexKey = `email_index:${emailNote}`;
      const indexData = await this.env.TOKENS_KV.get(indexKey);

      if (indexData) {
        // Index exists, use it for fast lookup
        const tokenIds: string[] = JSON.parse(indexData);
        const tokens: TokenRecord[] = [];

        // Fetch tokens by ID
        for (const tokenId of tokenIds) {
          const token = await this.getTokenById(tokenId);
          if (token) {
            tokens.push(token);
          }
        }

        // Sort by created_at in descending order (newest first)
        tokens.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });

        return tokens;
      } else {
        // Index doesn't exist, fallback to scan and build index
        console.log(`Email index not found for ${emailNote}, falling back to scan and building index`);
        return await this.scanAndBuildEmailIndex(emailNote);
      }
    } catch (error) {
      console.error('Error getting tokens by email note:', error);
      // Fallback to scan on any error
      return await this.scanAndBuildEmailIndex(emailNote);
    }
  }

  /**
   * Scan all tokens for email_note and build index (fallback for legacy data)
   */
  private async scanAndBuildEmailIndex(emailNote: string): Promise<TokenRecord[]> {
    try {
      // Get all tokens using the original method
      const { tokens } = await this.listTokens(1, 100000);
      const matchingTokens = tokens.filter((token: TokenRecord) => token.email_note === emailNote);

      // Build index for all tokens we scanned (not just matching ones)
      const emailIndexMap = new Map<string, string[]>();

      for (const token of tokens) {
        if (token.email_note) {
          if (!emailIndexMap.has(token.email_note)) {
            emailIndexMap.set(token.email_note, []);
          }
          emailIndexMap.get(token.email_note)!.push(token.id);
        }
      }

      // Save all email indexes we found
      for (const [email, tokenIds] of emailIndexMap) {
        const indexKey = `email_index:${email}`;
        await this.env.TOKENS_KV.put(indexKey, JSON.stringify(tokenIds));
      }

      console.log(`Built email indexes for ${emailIndexMap.size} email addresses`);

      // Sort matching tokens by created_at in descending order (newest first)
      matchingTokens.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      return matchingTokens;
    } catch (error) {
      console.error('Error in scanAndBuildEmailIndex:', error);
      return [];
    }
  }

  /**
   * Rebuild all email indexes (for data migration)
   */
  async rebuildAllEmailIndexes(): Promise<{ processed: number; indexed: number }> {
    try {
      console.log('Starting email index rebuild...');

      // Get all tokens
      const { tokens } = await this.listTokens(1, 10000); // Increase limit for migration

      // Clear existing email indexes (optional, for clean rebuild)
      // Note: This is a simple approach, in production you might want to be more careful

      // Build new indexes
      const emailIndexMap = new Map<string, string[]>();
      let processedCount = 0;

      for (const token of tokens) {
        processedCount++;
        if (token.email_note) {
          if (!emailIndexMap.has(token.email_note)) {
            emailIndexMap.set(token.email_note, []);
          }
          emailIndexMap.get(token.email_note)!.push(token.id);
        }
      }

      // Save all email indexes
      for (const [email, tokenIds] of emailIndexMap) {
        const indexKey = `email_index:${email}`;
        await this.env.TOKENS_KV.put(indexKey, JSON.stringify(tokenIds));
      }

      console.log(`Email index rebuild completed: processed ${processedCount} tokens, created ${emailIndexMap.size} email indexes`);

      return {
        processed: processedCount,
        indexed: emailIndexMap.size
      };
    } catch (error) {
      console.error('Error rebuilding email indexes:', error);
      throw error;
    }
  }
}
