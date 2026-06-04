/**
 * Server-side API configuration.
 * These functions run in Next.js Server Components / Route Handlers only.
 * The AF_API_KEY is never sent to the browser.
 */

export const AF_BASE = 'https://v3.football.api-sports.io';

export function afHeaders(): HeadersInit {
  const key = process.env.AF_API_KEY ?? '';
  if (!key) console.warn('[serverApi] AF_API_KEY is not set');
  return { 'x-apisports-key': key };
}

/** Retry with exponential back-off on 429. */
export async function fetchAF(path: string, retries = 2, delayMs = 3000): Promise<Response> {
  const res = await fetch(`${AF_BASE}${path}`, {
    headers: afHeaders(),
    // Next.js fetch cache: revalidate server data every hour for most pages.
    next: { revalidate: 3600 },
  });
  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchAF(path, retries - 1, delayMs * 2);
  }
  return res;
}

export function hasBodyErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as object).length > 0;
  return false;
}

/** Derive api-football season year from current date (European calendar). */
export function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

export const COMP_CODE_TO_LEAGUE_ID: Record<string, number> = {
  WC:   1,   CWC: 15,  EURO: 4,  CA:   9,  AFCN: 6,  UNL: 5,
  CL:   2,   EL:  3,   UECL: 848,
  LIBT: 13,  CSUD: 11,
  PL:   39,  PD:  140, SA:  135, BL1:  78, FL1:  61,
  DED:  88,  PPL: 94,  SPL: 179, JPL: 144, TSL: 203, SAPL: 307,
  ELC:  40,  SD:  141, SB:  136, BL2:  79, FL2:  62,
  BSA:  71,  ARG: 128, MX:  262, MLS: 253, COL: 239, CHI: 265,
  J1:   98,  CSL: 169,
  FAC:  45,  LCC:  48, CDR: 143, DFB:  81, CI:  137, CDF:  66,
};

export const LEAGUE_ID_TO_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(COMP_CODE_TO_LEAGUE_ID).map(([k, v]) => [v, k])
);

export const CUP_CODES = new Set([
  'WC', 'CWC', 'EURO', 'CA', 'AFCN', 'UNL',
  'CL', 'EL', 'UECL', 'LIBT', 'CSUD',
  'FAC', 'LCC', 'CDR', 'DFB', 'CI', 'CDF',
]);
