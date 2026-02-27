/**
 * Market color generation utilities
 * Generates consistent colors for marketplace tags based on market name hash
 */

/** Color configuration for UI tags */
export interface MarketColorConfig {
  /** Background color (rgba for transparency) */
  bg: string;
  /** Text color (hex) */
  color: string;
  /** Border color (rgba for transparency) */
  borderColor: string;
}

/** 预设的 12 种市场颜色 - 精心挑选的色相，确保区分度和可读性 */
const MARKET_PALETTE: MarketColorConfig[] = [
  { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', borderColor: 'rgba(239, 68, 68, 0.2)' },   // Red
  { bg: 'rgba(249, 115, 22, 0.1)', color: '#EA580C', borderColor: 'rgba(249, 115, 22, 0.2)' },  // Orange
  { bg: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04', borderColor: 'rgba(234, 179, 8, 0.2)' },    // Yellow
  { bg: 'rgba(34, 197, 94, 0.1)', color: '#16A34A', borderColor: 'rgba(34, 197, 94, 0.2)' },    // Green
  { bg: 'rgba(20, 184, 166, 0.1)', color: '#0D9488', borderColor: 'rgba(20, 184, 166, 0.2)' },  // Teal
  { bg: 'rgba(6, 182, 212, 0.1)', color: '#0891B2', borderColor: 'rgba(6, 182, 212, 0.2)' },    // Cyan
  { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563EB', borderColor: 'rgba(59, 130, 246, 0.2)' },   // Blue
  { bg: 'rgba(99, 102, 241, 0.1)', color: '#4F46E5', borderColor: 'rgba(99, 102, 241, 0.2)' },   // Indigo
  { bg: 'rgba(139, 92, 246, 0.1)', color: '#7C3AED', borderColor: 'rgba(139, 92, 246, 0.2)' },   // Violet
  { bg: 'rgba(236, 72, 153, 0.1)', color: '#DB2777', borderColor: 'rgba(236, 72, 153, 0.2)' },   // Pink
  { bg: 'rgba(168, 162, 158, 0.1)', color: '#78716C', borderColor: 'rgba(168, 162, 158, 0.2)' },  // Stone
  { bg: 'rgba(107, 114, 128, 0.1)', color: '#4B5563', borderColor: 'rgba(107, 114, 128, 0.2)' }, // Gray
];

/**
 * Simple string hash function
 * Produces consistent hash values for the same input string
 * @param str - Input string to hash
 * @returns Numeric hash value (non-negative integer)
 */
function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get color configuration for a marketplace
 * Colors are consistent for the same market name across sessions
 * @param marketName - Name of the marketplace
 * @returns Color configuration with bg, color, and borderColor
 */
export function getMarketColorConfig(marketName: string): MarketColorConfig {
  const index = stringHash(marketName) % MARKET_PALETTE.length;
  return MARKET_PALETTE[index];
}
