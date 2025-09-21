/**
 * Token验证模块 - Cloudflare Worker版本
 * 
 * 适用于Cloudflare Worker环境的Token验证实现
 * 支持Edge计算场景下的高性能Token验证
 */

/**
 * Token验证结果接口
 */
interface TokenValidationResult {
  is_valid: boolean;
  is_banned: boolean;
  status: string;
  error_message: string | null;
  response_code: number | null;
  response_body: string | null;
  debug_info: DebugInfo | null;
}

/**
 * 调试信息接口
 */
interface DebugInfo {
  request_url: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_headers: Record<string, string>;
  response_body: string;
  response_status_text: string;
}

/**
 * Worker环境的Token验证器
 */
export class WorkerTokenValidator {
  private enableDebug: boolean;
  private timeout: number;

  constructor(options: { enableDebug?: boolean; timeout?: number } = {}) {
    this.enableDebug = options.enableDebug || false;
    this.timeout = options.timeout || 30000;
  }

  /**
   * 验证Token有效性
   * 
   * @param token - 要验证的访问令牌
   * @param tenantUrl - 租户API基础URL
   * @returns 验证结果Promise
   */
  async validateToken(token: string, tenantUrl: string): Promise<TokenValidationResult> {
    if (!token || !tenantUrl) {
      throw new Error('Token and tenant URL are required');
    }

    // 确保租户URL以斜杠结尾
    const baseUrl = tenantUrl.endsWith('/') ? tenantUrl : `${tenantUrl}/`;
    const apiUrl = `${baseUrl}find-missing`;
    
    // 准备请求体（空对象用于find-missing端点）
    const requestBody = {};
    
    // 准备请求头
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    let response: Response;
    let responseText: string;
    let statusCode: number;
    let responseHeaders: Record<string, string> = {};

    try {
      // 在Worker环境中发送请求
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
        // Worker环境中的超时控制
        signal: AbortSignal.timeout(this.timeout)
      });
      
      statusCode = response.status;
      responseText = await response.text();
      
      // 收集响应头
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw new Error(`Network error: ${error.message}`);
    }

    // 创建调试信息
    const debugInfo: DebugInfo = {
      request_url: apiUrl,
      request_headers: requestHeaders,
      request_body: JSON.stringify(requestBody),
      response_headers: responseHeaders,
      response_body: responseText,
      response_status_text: response.statusText
    };



    // 分析响应并返回结果
    return this.analyzeResponse(statusCode, responseText, debugInfo);
  }

  /**
   * 批量验证多个Token（Worker环境优化版本）
   * 
   * @param tokens - Token和租户URL的数组
   * @param options - 选项配置
   * @returns 验证结果数组
   */
  async validateTokensBatch(
    tokens: Array<[string, string]>, 
    options: { concurrency?: number } = {}
  ): Promise<Array<TokenValidationResult | Error>> {
    const concurrency = options.concurrency || 5; // Worker环境可以支持更高并发
    const results: Array<TokenValidationResult | Error> = [];
    
    // 分批处理以控制并发数量
    for (let i = 0; i < tokens.length; i += concurrency) {
      const batch = tokens.slice(i, i + concurrency);
      const batchPromises = batch.map(async ([token, tenantUrl]) => {
        try {
          return await this.validateToken(token, tenantUrl);
        } catch (error: any) {
          return error;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * 快速检查Token状态（仅返回基本信息）
   */
  async quickCheck(token: string, tenantUrl: string): Promise<{
    isValid: boolean;
    isBanned: boolean;
    status: string;
  }> {
    try {
      const result = await this.validateToken(token, tenantUrl);
      return {
        isValid: result.is_valid,
        isBanned: result.is_banned,
        status: result.status
      };
    } catch (error) {
      return {
        isValid: false,
        isBanned: false,
        status: 'ERROR'
      };
    }
  }

  /**
   * 分析API响应并确定Token状态
   */
  private analyzeResponse(
    statusCode: number, 
    responseBody: string, 
    debugInfo: DebugInfo
  ): TokenValidationResult {
    const responseBodyLower = responseBody.toLowerCase();

    // 检查是否包含"suspended"关键词（不管状态码）
    if (responseBodyLower.includes('suspended')) {
      return {
        is_valid: false,
        is_banned: true,
        status: 'SUSPENDED',
        error_message: 'Account is suspended based on response content',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    }

    // 检查是否包含"invalid token"关键词
    if (responseBodyLower.includes('invalid token')) {
      return {
        is_valid: false,
        is_banned: false,
        status: 'INVALID_TOKEN',
        error_message: 'Token is invalid',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    }

    // 根据HTTP状态码判断
    if (statusCode >= 200 && statusCode < 300) {
      // 成功状态码且无"suspended"关键词 - 账户活跃
      return {
        is_valid: true,
        is_banned: false,
        status: 'ACTIVE',
        error_message: null,
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    } else if (statusCode === 401) {
      // 未授权 - Token无效或账户被封禁
      return {
        is_valid: false,
        is_banned: true,
        status: 'UNAUTHORIZED',
        error_message: 'Token is invalid or account is banned',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    } else if (statusCode === 403) {
      // 禁止访问 - 账户可能被封禁
      return {
        is_valid: false,
        is_banned: true,
        status: 'FORBIDDEN',
        error_message: 'Access forbidden - account may be banned',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    } else if (statusCode === 429) {
      // 速率限制 - 账户活跃但被限流
      return {
        is_valid: true,
        is_banned: false,
        status: 'RATE_LIMITED',
        error_message: 'Rate limited - account is active but throttled',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    } else if (statusCode >= 500 && statusCode < 600) {
      // 服务器错误 - 无法确定封禁状态
      return {
        is_valid: false,
        is_banned: false,
        status: 'SERVER_ERROR',
        error_message: 'Server error - cannot determine ban status',
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    } else {
      // 其他错误状态码 - 可能的封禁
      return {
        is_valid: false,
        is_banned: true,
        status: 'UNKNOWN_ERROR',
        error_message: `Unknown error - possible ban: ${responseBody}`,
        response_code: statusCode,
        response_body: responseBody,
        debug_info: debugInfo
      };
    }
  }
}

// 导出类型定义
export type { TokenValidationResult, DebugInfo };
