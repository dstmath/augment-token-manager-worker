/**
 * Simplified authentication utilities
 * Replaces JWT-based authentication with simple session tokens
 */

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Simple password hashing using Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Extract session token from Authorization header
 */
export function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Parse user credentials from environment variable
 * Supports both formats:
 * - Array format: ["admin:password123", "user:userpass"]
 * - String format: "user1:pass1,user2:pass2,admin:adminpass" (legacy)
 */
export function parseUserCredentials(credentialsInput: string | string[]): Map<string, string> {
  const credentials = new Map<string, string>();

  if (!credentialsInput) {
    return credentials;
  }

  let credentialsList: string[];

  // Handle array format (preferred)
  if (Array.isArray(credentialsInput)) {
    credentialsList = credentialsInput;
  } else {
    // Handle string format (legacy support)
    credentialsList = credentialsInput.split(',');
  }

  for (const credential of credentialsList) {
    const trimmed = credential.trim();
    const colonIndex = trimmed.indexOf(':');

    if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
      const username = trimmed.substring(0, colonIndex).trim();
      const password = trimmed.substring(colonIndex + 1).trim();

      if (username && password) {
        credentials.set(username, password);
      }
    }
  }

  return credentials;
}

/**
 * Calculate session expiration time
 */
export function getSessionExpirationTime(expiresIn: string = '24h'): Date {
  const now = new Date();
  const hours = parseInt(expiresIn.replace('h', '')) || 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
