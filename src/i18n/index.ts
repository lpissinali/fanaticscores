/* ============================================================
   Fanatic Scores — i18n entry point
   Currently only English is supported.
   To add a language: create src/i18n/<locale>/common.ts
   and add it to the LOCALES map below.
   ============================================================ */

import en from './en/common';

export const SUPPORTED_LOCALES = ['en'] as const;
export const DEFAULT_LOCALE    = 'en' as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const locales = { en } as const;

export function getTranslations(locale: SupportedLocale = DEFAULT_LOCALE) {
  return locales[locale] ?? locales[DEFAULT_LOCALE];
}

/** Checks whether a path segment is a known locale prefix */
export function isLocaleSegment(segment: string): segment is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(segment);
}
