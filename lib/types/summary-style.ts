/**
 * Summary Style Types
 * 
 * Shared type definitions for summary styles across the application.
 * Used by both frontend components and API routes.
 */

export type SummaryStyle = 'DEFAULT' | 'INVESTMENT' | 'TECH_DEEP_DIVE' | 'QUICK_DIGEST';

export const VALID_STYLES: readonly SummaryStyle[] = [
    'DEFAULT',
    'INVESTMENT',
    'TECH_DEEP_DIVE',
    'QUICK_DIGEST'
] as const;

export function isValidStyle(style: string): style is SummaryStyle {
    return VALID_STYLES.includes(style as SummaryStyle);
}
