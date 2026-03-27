/**
 * draw2data configuration
 *
 * Set VITE_OVERTURE_PROXY_URL in your .env file to enable Overture Maps extraction.
 * Without it, the app falls back to OpenStreetMap Overpass API (which has rate limits).
 *
 * Local dev:  VITE_OVERTURE_PROXY_URL=http://localhost:8787
 * Production: VITE_OVERTURE_PROXY_URL=https://draw2data-proxy.<your-subdomain>.workers.dev
 */
export const OVERTURE_PROXY_URL = import.meta.env.VITE_OVERTURE_PROXY_URL || '';

export const isOvertureEnabled = (): boolean => OVERTURE_PROXY_URL.length > 0;
