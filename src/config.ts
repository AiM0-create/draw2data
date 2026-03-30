/**
 * draw2data configuration
 *
 * Set VITE_OVERTURE_PROXY_URL in your .env file to override the extraction API URL.
 *
 * Local dev:  VITE_OVERTURE_PROXY_URL=http://localhost:8787
 * Production: Uses Vercel API at /api (same origin) or Cloudflare Worker
 */
export const OVERTURE_PROXY_URL = import.meta.env.VITE_OVERTURE_PROXY_URL || '/api';

export const isOvertureEnabled = (): boolean => OVERTURE_PROXY_URL.length > 0;
