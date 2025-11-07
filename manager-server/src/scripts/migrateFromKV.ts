/**
 * Migration script to transfer data from Cloudflare KV to MySQL
 * 
 * This script:
 * 1. Fetches all tokens from Cloudflare KV
 * 2. Fetches all sessions from Cloudflare KV
 * 3. Imports them into MySQL database
 * 
 * Prerequisites:
 * - Set CF_ACCOUNT_ID, CF_TOKENS_KV_NAMESPACE_ID, CF_SESSIONS_KV_NAMESPACE_ID, CF_API_TOKEN in .env
 * - Run `npm run prisma:migrate` to create database tables
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../config/database.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

interface KVListResult {
  result: Array<{ name: string }>;
  result_info: {
    cursor?: string;
    count: number;
  };
}

interface KVValue {
  value: string;
}

/**
 * Fetch all keys from a KV namespace
 */
async function listAllKVKeys(
  accountId: string,
  namespaceId: string,
  apiToken: string,
  prefix?: string
): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  
  do {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`
    );
    
    if (prefix) url.searchParams.set('prefix', prefix);
    if (cursor) url.searchParams.set('cursor', cursor);
    url.searchParams.set('limit', '1000');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list KV keys: ${response.statusText}`);
    }
    
    const data: KVListResult = await response.json();
    keys.push(...data.result.map(item => item.name));
    cursor = data.result_info.cursor;
    
  } while (cursor);
  
  return keys;
}

/**
 * Fetch a value from KV
 */
async function getKVValue(
  accountId: string,
  namespaceId: string,
  apiToken: string,
  key: string
): Promise<string | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to get KV value: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Migrate tokens from KV to MySQL
 */
async function migrateTokens(
  accountId: string,
  namespaceId: string,
  apiToken: string
): Promise<number> {
  console.log('📦 Fetching tokens from Cloudflare KV...');
  
  const tokenKeys = await listAllKVKeys(accountId, namespaceId, apiToken, 'token:');
  console.log(`Found ${tokenKeys.length} tokens in KV`);
  
  let migratedCount = 0;
  
  for (const key of tokenKeys) {
    try {
      const value = await getKVValue(accountId, namespaceId, apiToken, key);
      if (!value) continue;
      
      const tokenData = JSON.parse(value);
      
      // Find or create user for the token
      let user = await prisma.user.findFirst({
        where: { username: tokenData.created_by || 'admin' },
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: tokenData.created_by || 'admin',
            password: 'migrated', // Placeholder password
            role: 'USER',
          },
        });
      }
      
      // Check if token already exists
      const existingToken = await prisma.token.findUnique({
        where: { id: tokenData.id },
      });
      
      if (existingToken) {
        console.log(`⏭️  Token ${tokenData.id} already exists, skipping`);
        continue;
      }
      
      // Create token in MySQL
      await prisma.token.create({
        data: {
          id: tokenData.id,
          tenantUrl: tokenData.tenant_url,
          accessToken: tokenData.access_token,
          portalUrl: tokenData.portal_url,
          emailNote: tokenData.email_note,
          banStatus: tokenData.ban_status,
          portalInfo: tokenData.portal_info,
          shareInfo: tokenData.share_info,
          isShared: tokenData.is_shared || false,
          authSession: tokenData.auth_session,
          createdBy: user.id,
          createdAt: new Date(tokenData.created_at),
          updatedAt: new Date(tokenData.updated_at),
        },
      });
      
      migratedCount++;
      console.log(`✅ Migrated token ${tokenData.id} (${migratedCount}/${tokenKeys.length})`);
      
    } catch (error) {
      console.error(`❌ Failed to migrate token ${key}:`, error);
    }
  }
  
  return migratedCount;
}

/**
 * Migrate sessions from KV to MySQL
 */
async function migrateSessions(
  accountId: string,
  namespaceId: string,
  apiToken: string
): Promise<number> {
  console.log('\n📦 Fetching sessions from Cloudflare KV...');
  
  const sessionKeys = await listAllKVKeys(accountId, namespaceId, apiToken, 'session:');
  console.log(`Found ${sessionKeys.length} sessions in KV`);
  
  let migratedCount = 0;
  
  for (const key of sessionKeys) {
    try {
      const value = await getKVValue(accountId, namespaceId, apiToken, key);
      if (!value) continue;
      
      const sessionData = JSON.parse(value);
      
      // Find or create user for the session
      let user = await prisma.user.findFirst({
        where: { username: sessionData.username },
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: sessionData.username,
            password: 'migrated', // Placeholder password
            role: sessionData.role === 'admin' ? 'ADMIN' : 'USER',
          },
        });
      }
      
      // Check if session already exists
      const existingSession = await prisma.session.findUnique({
        where: { sessionId: sessionData.sessionId },
      });
      
      if (existingSession) {
        console.log(`⏭️  Session ${sessionData.sessionId} already exists, skipping`);
        continue;
      }
      
      // Only migrate sessions that haven't expired
      const expiresAt = new Date(sessionData.expiresAt);
      if (expiresAt < new Date()) {
        console.log(`⏭️  Session ${sessionData.sessionId} has expired, skipping`);
        continue;
      }
      
      // Create session in MySQL
      await prisma.session.create({
        data: {
          sessionId: sessionData.sessionId,
          userId: user.id,
          expiresAt,
          createdAt: new Date(sessionData.createdAt),
        },
      });
      
      migratedCount++;
      console.log(`✅ Migrated session ${sessionData.sessionId} (${migratedCount}/${sessionKeys.length})`);
      
    } catch (error) {
      console.error(`❌ Failed to migrate session ${key}:`, error);
    }
  }
  
  return migratedCount;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting migration from Cloudflare KV to MySQL...\n');
  
  // Validate environment variables
  const accountId = process.env.CF_ACCOUNT_ID;
  const tokensNamespaceId = process.env.CF_TOKENS_KV_NAMESPACE_ID;
  const sessionsNamespaceId = process.env.CF_SESSIONS_KV_NAMESPACE_ID;
  const apiToken = process.env.CF_API_TOKEN;
  
  if (!accountId || !tokensNamespaceId || !sessionsNamespaceId || !apiToken) {
    console.error('❌ Missing required environment variables:');
    console.error('   - CF_ACCOUNT_ID');
    console.error('   - CF_TOKENS_KV_NAMESPACE_ID');
    console.error('   - CF_SESSIONS_KV_NAMESPACE_ID');
    console.error('   - CF_API_TOKEN');
    process.exit(1);
  }
  
  try {
    // Migrate tokens
    const tokenCount = await migrateTokens(accountId, tokensNamespaceId, apiToken);
    console.log(`\n✅ Successfully migrated ${tokenCount} tokens`);
    
    // Migrate sessions
    const sessionCount = await migrateSessions(accountId, sessionsNamespaceId, apiToken);
    console.log(`\n✅ Successfully migrated ${sessionCount} sessions`);
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();

