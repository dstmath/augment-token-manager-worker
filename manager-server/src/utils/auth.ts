import bcrypt from 'bcrypt';
import { UserCredentialsMap } from '../types/index.js';

/**
 * Parse user credentials from environment variable
 * Format: "username:password,username2:password2"
 */
export function parseUserCredentials(credentials: string): UserCredentialsMap {
  const map = new Map<string, string>();
  
  if (!credentials) {
    return map;
  }
  
  const pairs = credentials.split(',');
  for (const pair of pairs) {
    const [username, password] = pair.split(':');
    if (username && password) {
      map.set(username.trim(), password.trim());
    }
  }
  
  return map;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate session expiry date
 */
export function getSessionExpiryDate(hours: number = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

