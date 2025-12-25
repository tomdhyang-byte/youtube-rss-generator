/**
 * Summary Language Types
 * 
 * Shared type definitions for summary languages across the application.
 * Used by both frontend components and API routes.
 * 
 * Languages:
 * - EN: English summaries
 * - ZH_TW: Traditional Chinese (繁體中文) summaries
 */

export type SummaryLanguage = 'EN' | 'ZH_TW';

export const VALID_LANGUAGES: readonly SummaryLanguage[] = [
    'EN',
    'ZH_TW',
] as const;

export function isValidLanguage(lang: string): lang is SummaryLanguage {
    return VALID_LANGUAGES.includes(lang as SummaryLanguage);
}

/**
 * Convert frontend locale to SummaryLanguage enum value.
 * 
 * @param locale - The frontend locale (e.g., 'en', 'zh-TW')
 * @returns The corresponding SummaryLanguage value
 */
export function localeToSummaryLanguage(locale: string): SummaryLanguage {
    return locale === 'zh-TW' ? 'ZH_TW' : 'EN';
}
