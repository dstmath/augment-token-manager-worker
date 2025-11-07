/**
 * API Configuration
 * 
 * This file contains the base URL for API requests.
 * Update this when migrating from Cloudflare Worker to your own server.
 */

// API Base URL
// Development: Use local server
// Production: Use your deployed server URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

// Export default for convenience
export default API_BASE_URL;

