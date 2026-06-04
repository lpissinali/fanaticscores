/* ============================================================
   Fanatic Scores — English (default) translations
   Add new keys here; mirror structure in future locale files.
   ============================================================ */

const common = {
  nav: {
    today:       'Today',
    schedule:    'Schedule',
    competitions:'Competitions',
    following:   'Following',
    shareStudio: 'Share Studio',
  },
  home: {
    eyebrow:    (dateStr: string) => dateStr,
    heading:    "Today's matches",
    searchPlaceholder: 'Search teams, competitions…',
  },
  match: {
    live:       'LIVE',
    ht:         'HT',
    ft:         'FT',
    scheduled:  'Scheduled',
    aggregate:  'Agg.',
  },
  ai: {
    pulseTitle:  'AI Pulse',
    askAnything: 'Ask anything',
    tonightsRead:"Tonight's read",
  },
  studio: {
    promoLabel:  'New · Share Studio',
    promoHeading:'Turn any moment into a post',
    promoCta:    'Try Share Studio',
  },
  trending: {
    heading: 'Trending now',
  },
  footer: {
    tagline:    'Scores for fanatics.',
    product:    'Product',
    company:    'Company',
    getTheApp:  'Get the app',
    links: {
      today:       'Today',
      schedule:    'Schedule',
      competitions:'Competitions',
      studio:      'Share Studio',
      about:       'About',
      blog:        'Blog',
      careers:     'Careers',
      press:       'Press',
      appStore:    'App Store',
      googlePlay:  'Google Play',
      terms:       'Terms',
      privacy:     'Privacy',
      cookies:     'Cookies',
      dataSources: 'Data sources',
      status:      'Status',
    },
    copyright: (year: number) => `© ${year} Fanatic Scores`,
  },
} as const;

export default common;
export type CommonTranslations = typeof common;
