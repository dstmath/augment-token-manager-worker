import prisma from '../config/database.js';
import { CreateTokenRequest, UpdateTokenRequest, TokenResponse } from '../types/index.js';
import { Token } from '@prisma/client';

/**
 * Token Service
 * Handles all token-related database operations
 */
export class TokenService {
  /**
   * Convert Prisma Token to TokenResponse format
   */
  private toTokenResponse(token: Token): TokenResponse {
    return {
      id: token.id,
      tenant_url: token.tenantUrl || undefined,
      access_token: token.accessToken,
      portal_url: token.portalUrl || undefined,
      email_note: token.emailNote || undefined,
      ban_status: token.banStatus || undefined,
      portal_info: token.portalInfo || undefined,
      created_at: token.createdAt.toISOString(),
      updated_at: token.updatedAt.toISOString(),
      created_by: token.createdBy,
      share_info: token.shareInfo || undefined,
      is_shared: token.isShared,
      auth_session: token.authSession || undefined,
    };
  }

  /**
   * Create a new token
   */
  async createToken(tokenData: CreateTokenRequest, createdBy: string): Promise<TokenResponse> {
    const now = new Date();
    
    const token = await prisma.token.create({
      data: {
        tenantUrl: tokenData.tenant_url,
        accessToken: tokenData.access_token,
        portalUrl: tokenData.portal_url,
        emailNote: tokenData.email_note,
        authSession: tokenData.auth_session,
        banStatus: JSON.stringify({ 
          status: 'NORMAL', 
          reason: 'Initial state', 
          updated_at: now.toISOString() 
        }),
        portalInfo: '{}',
        createdBy,
      },
    });
    
    return this.toTokenResponse(token);
  }

  /**
   * Get token by ID
   */
  async getTokenById(tokenId: string): Promise<TokenResponse | null> {
    const token = await prisma.token.findUnique({
      where: { id: tokenId },
    });
    
    return token ? this.toTokenResponse(token) : null;
  }

  /**
   * List tokens with pagination and sorting
   */
  async listTokens(
    page: number = 1,
    limit: number = 10,
    createdBy?: string
  ): Promise<{
    tokens: TokenResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const where = createdBy ? { createdBy } : {};
    
    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // Sort by created_at descending
        skip,
        take: limit,
      }),
      prisma.token.count({ where }),
    ]);
    
    return {
      tokens: tokens.map(t => this.toTokenResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update token
   */
  async updateToken(tokenId: string, updates: UpdateTokenRequest): Promise<TokenResponse | null> {
    const existingToken = await prisma.token.findUnique({
      where: { id: tokenId },
    });
    
    if (!existingToken) {
      return null;
    }
    
    const token = await prisma.token.update({
      where: { id: tokenId },
      data: {
        ...(updates.tenant_url !== undefined && { tenantUrl: updates.tenant_url }),
        ...(updates.access_token !== undefined && { accessToken: updates.access_token }),
        ...(updates.portal_url !== undefined && { portalUrl: updates.portal_url }),
        ...(updates.email_note !== undefined && { emailNote: updates.email_note }),
        ...(updates.ban_status !== undefined && { banStatus: updates.ban_status }),
        ...(updates.share_info !== undefined && { shareInfo: updates.share_info }),
        ...(updates.is_shared !== undefined && { isShared: updates.is_shared }),
        ...(updates.auth_session !== undefined && { authSession: updates.auth_session }),
      },
    });
    
    return this.toTokenResponse(token);
  }

  /**
   * Delete token
   */
  async deleteToken(tokenId: string): Promise<boolean> {
    try {
      await prisma.token.delete({
        where: { id: tokenId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Search tokens by email or other criteria
   */
  async searchTokens(params: {
    search?: string;
    category?: string;
    createdBy?: string;
  }): Promise<TokenResponse[]> {
    const where: any = {};
    
    if (params.createdBy) {
      where.createdBy = params.createdBy;
    }
    
    if (params.search) {
      where.OR = [
        { emailNote: { contains: params.search } },
        { tenantUrl: { contains: params.search } },
        { portalUrl: { contains: params.search } },
      ];
    }
    
    const tokens = await prisma.token.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return tokens.map(t => this.toTokenResponse(t));
  }

  /**
   * Get token statistics
   */
  async getTokenStats(createdBy?: string): Promise<{
    total: number;
    shared: number;
    normal: number;
    banned: number;
  }> {
    const where = createdBy ? { createdBy } : {};
    
    const [total, shared] = await Promise.all([
      prisma.token.count({ where }),
      prisma.token.count({ where: { ...where, isShared: true } }),
    ]);
    
    // Count tokens by ban status
    const tokens = await prisma.token.findMany({
      where,
      select: { banStatus: true },
    });
    
    let normal = 0;
    let banned = 0;
    
    for (const token of tokens) {
      try {
        const status = token.banStatus ? JSON.parse(token.banStatus) : { status: 'NORMAL' };
        if (status.status === 'NORMAL') {
          normal++;
        } else {
          banned++;
        }
      } catch {
        normal++;
      }
    }
    
    return { total, shared, normal, banned };
  }

  /**
   * Batch import tokens
   */
  async batchImportTokens(
    tokens: CreateTokenRequest[],
    createdBy: string
  ): Promise<TokenResponse[]> {
    const now = new Date();
    
    const createdTokens = await prisma.$transaction(
      tokens.map(tokenData =>
        prisma.token.create({
          data: {
            tenantUrl: tokenData.tenant_url,
            accessToken: tokenData.access_token,
            portalUrl: tokenData.portal_url,
            emailNote: tokenData.email_note,
            authSession: tokenData.auth_session,
            banStatus: JSON.stringify({ 
              status: 'NORMAL', 
              reason: 'Initial state', 
              updated_at: now.toISOString() 
            }),
            portalInfo: '{}',
            createdBy,
          },
        })
      )
    );
    
    return createdTokens.map(t => this.toTokenResponse(t));
  }

  /**
   * Get tokens by email note
   */
  async getTokensByEmail(emailNote: string): Promise<TokenResponse[]> {
    const tokens = await prisma.token.findMany({
      where: { emailNote },
      orderBy: { createdAt: 'desc' },
    });
    
    return tokens.map(t => this.toTokenResponse(t));
  }
}

