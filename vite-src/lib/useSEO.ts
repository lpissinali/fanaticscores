/**
 * useSEO — lightweight DOM-based SEO helper (no extra library).
 *
 * Sets document.title, <meta> description, robots, Open Graph,
 * Twitter Card, and <link rel="canonical"> on every render cycle.
 */
import { useEffect } from 'react';

export const SITE_NAME = 'FanaticScores';
export const BASE_URL  = 'https://www.fanaticscores.com';
const DEFAULT_DESC     = 'Real-time football scores, live match data and AI-powered match cards — all in one place.';
const DEFAULT_IMAGE    = `${BASE_URL}/og-default.png`;

export interface SEOProps {
  /** Page-level title; appended with "| FanaticScores". Omit to use the site default. */
  title?: string;
  description?: string;
  /** Path only, e.g. "/en/today". Full URL constructed with BASE_URL. */
  canonical?: string;
  ogImage?: string;
  /** Set true for pages that should not be indexed (e.g. studio share URLs). */
  noIndex?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setMeta(selector: string, content: string) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    // Parse the attribute from the selector, e.g. [property="og:title"]
    const m = selector.match(/\[(\w+)="([^"]+)"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSEO({ title, description, canonical, ogImage, noIndex = false }: SEOProps = {}) {
  useEffect(() => {
    const fullTitle  = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Today's Football Scores`;
    const desc       = description ?? DEFAULT_DESC;
    const canonicUrl = `${BASE_URL}${canonical ?? '/en/today'}`;
    const img        = ogImage ?? DEFAULT_IMAGE;

    // Basic
    document.title = fullTitle;
    setMeta('[name="description"]',           desc);
    setMeta('[name="robots"]',                noIndex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    setMeta('[property="og:title"]',          fullTitle);
    setMeta('[property="og:description"]',    desc);
    setMeta('[property="og:url"]',            canonicUrl);
    setMeta('[property="og:image"]',          img);
    setMeta('[property="og:type"]',           'website');
    setMeta('[property="og:site_name"]',      SITE_NAME);

    // Twitter Card
    setMeta('[name="twitter:card"]',          'summary_large_image');
    setMeta('[name="twitter:title"]',         fullTitle);
    setMeta('[name="twitter:description"]',   desc);
    setMeta('[name="twitter:image"]',         img);

    // Canonical
    setLink('canonical', canonicUrl);
  }, [title, description, canonical, ogImage, noIndex]);
}
