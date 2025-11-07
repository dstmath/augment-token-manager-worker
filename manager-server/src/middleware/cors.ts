import cors from 'cors';
import { config } from '../config/env.js';

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);

