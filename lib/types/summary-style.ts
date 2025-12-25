/**
 * Summary Style Types
 * 
 * Shared type definitions for summary styles across the application.
 * Used by both frontend components and API routes.
 * 
 * Styles:
 * - DEFAULT: 深度筆記 (Deep Notes) - Comprehensive structured summary
 * - QUICK_READ: 省時速讀 (Quick Read) - Executive briefing for busy readers
 */

export type SummaryStyle = 'DEFAULT' | 'QUICK_READ';

export const VALID_STYLES: readonly SummaryStyle[] = [
    'DEFAULT',
    'QUICK_READ',
] as const;

export function isValidStyle(style: string): style is SummaryStyle {
    return VALID_STYLES.includes(style as SummaryStyle);
}
