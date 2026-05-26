/**
 * prerender.mjs -- post-build static HTML generator
 *
 * Run after `vite build`. For each key route, writes a route-specific
 * index.html inside dist/ with correct <title>, <meta>, and
 * <link rel="canonical"> baked into the <head>. Firebase Hosting serves
 * static files before the SPA catch-all rewrite, so crawlers get
 * meaningful metadata immediately without waiting for JavaScript.
 *
 * Pages with static content (legal pages, competitions list, individual
 * competition pages) also get their body content injected inside a
 * <noscript> block so Googlebot can index it on first crawl.
 *
 * Usage:  node scripts/prerender.mjs
 * Env:    run from the project root after `vite build`
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir   = resolve(__dirname, '../dist');
const contentDir = resolve(__dirname, 'content');
const BASE_URL  = 'https://www.fanaticscores.com';
const SITE_NAME = 'FanaticScores';

// ── Competition metadata (mirrors CompetitionsPage.tsx) ───────────────────────

const COMPETITIONS = [
  { code: 'PL',   name: 'Premier League',             country: 'England',       region: 'Europe - Top Leagues' },
  { code: 'PD',   name: 'La Liga',                    country: 'Spain',         region: 'Europe - Top Leagues' },
  { code: 'SA',   name: 'Serie A',                    country: 'Italy',         region: 'Europe - Top Leagues' },
  { code: 'BL1',  name: 'Bundesliga',                 country: 'Germany',       region: 'Europe - Top Leagues' },
  { code: 'FL1',  name: 'Ligue 1',                    country: 'France',        region: 'Europe - Top Leagues' },
  { code: 'WC',   name: 'FIFA World Cup',             country: 'World',         region: 'International' },
  { code: 'CWC',  name: 'Club World Cup',             country: 'World',         region: 'International' },
  { code: 'EURO', name: 'UEFA European Championship', country: 'Europe',        region: 'International' },
  { code: 'CA',   name: 'Copa America',               country: 'South America', region: 'International' },
  { code: 'AFCN', name: 'Africa Cup of Nations',      country: 'Africa',        region: 'International' },
  { code: 'UNL',  name: 'UEFA Nations League',        country: 'Europe',        region: 'International' },
  { code: 'CL',   name: 'UEFA Champions League',      country: 'Europe',        region: 'UEFA Club' },
  { code: 'EL',   name: 'UEFA Europa League',         country: 'Europe',        region: 'UEFA Club' },
  { code: 'UECL', name: 'UEFA Conference League',     country: 'Europe',        region: 'UEFA Club' },
  { code: 'LIBT', name: 'Copa Libertadores',          country: 'South America', region: 'UEFA Club' },
  { code: 'CSUD', name: 'Copa Sudamericana',          country: 'South America', region: 'UEFA Club' },
  { code: 'DED',  name: 'Eredivisie',                 country: 'Netherlands',   region: 'Europe - Other Leagues' },
  { code: 'PPL',  name: 'Primeira Liga',              country: 'Portugal',      region: 'Europe - Other Leagues' },
  { code: 'SPL',  name: 'Scottish Premiership',       country: 'Scotland',      region: 'Europe - Other Leagues' },
  { code: 'JPL',  name: 'Jupiler Pro League',         country: 'Belgium',       region: 'Europe - Other Leagues' },
  { code: 'TSL',  name: 'Super Lig',                  country: 'Turkey',        region: 'Europe - Other Leagues' },
  { code: 'SAPL', name: 'Saudi Pro League',           country: 'Saudi Arabia',  region: 'Europe - Other Leagues' },
  { code: 'ELC',  name: 'Championship',               country: 'England',       region: 'Europe - Second Divisions' },
  { code: 'SD',   name: 'La Liga 2',                  country: 'Spain',         region: 'Europe - Second Divisions' },
  { code: 'SB',   name: 'Serie B',                    country: 'Italy',         region: 'Europe - Second Divisions' },
  { code: 'BL2',  name: '2. Bundesliga',              country: 'Germany',       region: 'Europe - Second Divisions' },
  { code: 'FL2',  name: 'Ligue 2',                    country: 'France',        region: 'Europe - Second Divisions' },
  { code: 'FAC',  name: 'FA Cup',                     country: 'England',       region: 'Europe - Domestic Cups' },
  { code: 'LCC',  name: 'Carabao Cup',                country: 'England',       region: 'Europe - Domestic Cups' },
  { code: 'CDR',  name: 'Copa del Rey',               country: 'Spain',         region: 'Europe - Domestic Cups' },
  { code: 'DFB',  name: 'DFB-Pokal',                  country: 'Germany',       region: 'Europe - Domestic Cups' },
  { code: 'CI',   name: 'Coppa Italia',               country: 'Italy',         region: 'Europe - Domestic Cups' },
  { code: 'CDF',  name: 'Coupe de France',            country: 'France',        region: 'Europe - Domestic Cups' },
  { code: 'BSA',  name: 'Brasileirao',                country: 'Brazil',        region: 'Americas' },
  { code: 'ARG',  name: 'Liga Profesional',           country: 'Argentina',     region: 'Americas' },
  { code: 'MX',   name: 'Liga MX',                    country: 'Mexico',        region: 'Americas' },
  { code: 'MLS',  name: 'MLS',                        country: 'USA',           region: 'Americas' },
  { code: 'COL',  name: 'Primera A',                  country: 'Colombia',      region: 'Americas' },
  { code: 'CHI',  name: 'Primera Division',           country: 'Chile',         region: 'Americas' },
  { code: 'J1',   name: 'J1 League',                  country: 'Japan',         region: 'Asia' },
  { code: 'CSL',  name: 'Chinese Super League',       country: 'China',         region: 'Asia' },
];

// ── HTML helpers ──────────────────────────────────────────────────────────────

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapNoscript(html) {
  return '\n<noscript>\n' + html + '\n</noscript>\n';
}

function readContent(filename) {
  return readFileSync(resolve(contentDir, filename), 'utf-8').trim();
}

const TEAMS = JSON.parse(readFileSync(resolve(contentDir, 'teams.json'), 'utf-8'));

// ── Per-page static content builders ─────────────────────────────────────────

function buildCompetitionsContent() {
  const regions = [...new Set(COMPETITIONS.map(c => c.region))];
  const sections = regions.map(region => {
    const comps = COMPETITIONS.filter(c => c.region === region);
    const items = comps
      .map(c => '    <li><a href="/en/competition/' + c.code + '">' + escapeAttr(c.name) + ' (' + escapeAttr(c.country) + ')</a></li>')
      .join('\n');
    return '  <section>\n    <h2>' + escapeAttr(region) + '</h2>\n    <ul>\n' + items + '\n    </ul>\n  </section>';
  }).join('\n');
  return wrapNoscript('<main aria-label="All football competitions">\n' + sections + '\n</main>');
}

function buildCompetitionContent(comp) {
  const lines = [
    '<main>',
    '  <h1>' + escapeAttr(comp.name) + ' - Standings &amp; Results</h1>',
    '  <p>Live standings, results, fixtures and top scorers for ' + escapeAttr(comp.name) + ' (' + escapeAttr(comp.country) + ') on FanaticScores.</p>',
    '  <p>Track every matchday, goal scorer and standings update for ' + escapeAttr(comp.name) + ' -- the ' + escapeAttr(comp.region) + ' competition from ' + escapeAttr(comp.country) + '.</p>',
    '  <p><a href="/en/competitions">Browse all competitions on FanaticScores</a></p>',
    '</main>',
  ];
  return wrapNoscript(lines.join('\n'));
}

// ── Route definitions ─────────────────────────────────────────────────────────

const STATIC_ROUTES = [
  {
    path:        '/en/today',
    title:       SITE_NAME + ' - Today\'s Football Scores',
    description: 'Real-time football scores, live match data and AI-powered match cards -- all in one place.',
    canonical:   '/en/today',
  },
  {
    path:         '/en/competitions',
    title:        'All Football Competitions | ' + SITE_NAME,
    description:  'Browse all football competitions on FanaticScores -- Champions League, Premier League, La Liga, Serie A, Bundesliga and more.',
    canonical:    '/en/competitions',
    buildContent: buildCompetitionsContent,
  },
  {
    path:         '/en/terms',
    title:        'Terms & Conditions | ' + SITE_NAME,
    description:  'Terms and Conditions for ' + SITE_NAME + '. Read our rules for using the service.',
    canonical:    '/en/terms',
    buildContent: () => wrapNoscript(readContent('terms.html')),
  },
  {
    path:         '/en/privacy',
    title:        'Privacy Policy | ' + SITE_NAME,
    description:  'Privacy Policy for ' + SITE_NAME + '. Learn how we handle your data.',
    canonical:    '/en/privacy',
    buildContent: () => wrapNoscript(readContent('privacy.html')),
  },
  {
    path:         '/en/cookies',
    title:        'Cookie Policy | ' + SITE_NAME,
    description:  'Cookie Policy for ' + SITE_NAME + '. Learn about the cookies we use and how to manage them.',
    canonical:    '/en/cookies',
    buildContent: () => wrapNoscript(readContent('cookies.html')),
  },
  ...COMPETITIONS.map(c => ({
    path:         '/en/competition/' + c.code,
    title:        c.name + ' - Standings & Results | ' + SITE_NAME,
    description:  'Live standings, results, fixtures and top scorers for ' + c.name + ' (' + c.country + ') on FanaticScores.',
    canonical:    '/en/competition/' + c.code,
    buildContent: () => buildCompetitionContent(c),
  })),
  ...TEAMS.map(t => ({
    path:        '/en/team/' + t.id,
    title:       t.name + ' - Fixtures, Results & Stats | ' + SITE_NAME,
    description: 'Live fixtures, results and statistics for ' + t.name + ' (' + t.league + ', ' + t.country + ') on FanaticScores.',
    canonical:   '/en/team/' + t.id,
    buildContent: () => wrapNoscript(
      '<main>\n' +
      '  <h1>' + escapeAttr(t.name) + ' - Fixtures &amp; Results</h1>\n' +
      '  <p>Live match fixtures, results and statistics for ' + escapeAttr(t.name) + ' from ' + escapeAttr(t.league) + ' (' + escapeAttr(t.country) + ').</p>\n' +
      '  <p><a href="/en/competitions">Browse all competitions on FanaticScores</a></p>\n' +
      '</main>'
    ),
  })),
];

// ── Template injection ────────────────────────────────────────────────────────

function injectMeta(template, route) {
  const { title, description, canonical } = route;
  const canonUrl = BASE_URL + canonical;

  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escapeAttr(title) + '</title>');

  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    '$1' + escapeAttr(description) + '$2',
  );

  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    '$1' + escapeAttr(canonUrl) + '$2',
  );

  html = html.replace(
    /(<meta property="og:title"\s+content=")[^"]*(")/,
    '$1' + escapeAttr(title) + '$2',
  );

  html = html.replace(
    /(<meta property="og:description"\s+content=")[^"]*(")/,
    '$1' + escapeAttr(description) + '$2',
  );

  html = html.replace(
    /(<meta property="og:url"\s+content=")[^"]*(")/,
    '$1' + escapeAttr(canonUrl) + '$2',
  );

  html = html.replace(
    /(<meta name="twitter:title"\s+content=")[^"]*(")/,
    '$1' + escapeAttr(title) + '$2',
  );

  html = html.replace(
    /(<meta name="twitter:description"\s+content=")[^"]*(")/,
    '$1' + escapeAttr(description) + '$2',
  );

  if (typeof route.buildContent === 'function') {
    html = html.replace('</body>', route.buildContent() + '</body>');
  }

  return html;
}

// ── Write route file ──────────────────────────────────────────────────────────

function writeRoute(routePath, html) {
  const relative = routePath.replace(/^\//, '');
  const dir = resolve(distDir, relative);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

(function main() {
  console.log('\nprerender -- generating static route shells...\n');

  let template;
  try {
    template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');
  } catch {
    console.error('dist/index.html not found -- run vite build first.');
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const route of STATIC_ROUTES) {
    try {
      const html = injectMeta(template, route);
      writeRoute(route.path, html);
      console.log('  ok  ' + route.path);
      ok++;
    } catch (err) {
      console.warn('  FAIL  ' + route.path + ' -- ' + err.message);
      fail++;
    }
  }

  console.log('prerender complete -- ' + ok + ' routes written' + (fail ? ', ' + fail + ' failed' : '') + '.');
})();
