import { useNavigate } from 'react-router-dom';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import RailPromo from '../../components/shared/RailPromo/RailPromo';
import Footer from '../../components/layout/Footer/Footer';
import Icon from '../../components/shared/Icon/Icon';
import MobileBottomNav from '../../components/shared/MobileBottomNav/MobileBottomNav';
import styles from './CompetitionsPage.module.css';

interface CompetitionsPageProps { locale: SupportedLocale; }

// Mirrors LEAGUE_LIST in apiFootballFetch.ts — grouped by region
const COMPETITIONS = [
  {
    region: 'International',
    comps: [
      { code: 'WC',   name: 'FIFA World Cup',              country: 'World',      flag: '#8b6914', type: 'Cup'    },
      { code: 'CWC',  name: 'Club World Cup',              country: 'World',      flag: '#8b6914', type: 'Cup'    },
      { code: 'EURO', name: 'UEFA European Championship',  country: 'Europe',     flag: '#1a3a6b', type: 'Cup'    },
      { code: 'CA',   name: 'Copa America',                country: 'S. America', flag: '#006400', type: 'Cup'    },
      { code: 'AFCN', name: 'Africa Cup of Nations',       country: 'Africa',     flag: '#8b4513', type: 'Cup'    },
      { code: 'UNL',  name: 'UEFA Nations League',         country: 'Europe',     flag: '#1a3a6b', type: 'Cup'    },
    ],
  },
  {
    region: 'UEFA Club',
    comps: [
      { code: 'CL',   name: 'UEFA Champions League',       country: 'Europe',     flag: '#1a3a6b', type: 'Cup'    },
      { code: 'EL',   name: 'UEFA Europa League',          country: 'Europe',     flag: '#e87800', type: 'Cup'    },
      { code: 'UECL', name: 'UEFA Conference League',      country: 'Europe',     flag: '#1a6b3a', type: 'Cup'    },
      { code: 'LIBT', name: 'Copa Libertadores',           country: 'S. America', flag: '#006400', type: 'Cup'    },
      { code: 'CSUD', name: 'Copa Sudamericana',           country: 'S. America', flag: '#005500', type: 'Cup'    },
    ],
  },
  {
    region: 'Europe — Top Leagues',
    comps: [
      { code: 'PL',  name: 'Premier League',  country: 'England',      flag: '#3d0d6b', type: 'League' },
      { code: 'PD',  name: 'La Liga',         country: 'Spain',        flag: '#8b0000', type: 'League' },
      { code: 'SA',  name: 'Serie A',         country: 'Italy',        flag: '#003580', type: 'League' },
      { code: 'BL1', name: 'Bundesliga',      country: 'Germany',      flag: '#cc0000', type: 'League' },
      { code: 'FL1', name: 'Ligue 1',         country: 'France',       flag: '#003189', type: 'League' },
    ],
  },
  {
    region: 'Europe — Other Leagues',
    comps: [
      { code: 'DED',  name: 'Eredivisie',          country: 'Netherlands', flag: '#ff6600', type: 'League' },
      { code: 'PPL',  name: 'Primeira Liga',        country: 'Portugal',   flag: '#006600', type: 'League' },
      { code: 'SPL',  name: 'Scottish Premiership', country: 'Scotland',   flag: '#003399', type: 'League' },
      { code: 'JPL',  name: 'Jupiler Pro League',   country: 'Belgium',    flag: '#fdda24', type: 'League' },
      { code: 'TSL',  name: 'Super Lig',            country: 'Turkey',     flag: '#e30a17', type: 'League' },
      { code: 'SAPL', name: 'Saudi Pro League',     country: 'Saudi Arabia', flag: '#006400', type: 'League' },
    ],
  },
  {
    region: 'Europe — Second Divisions',
    comps: [
      { code: 'ELC', name: 'Championship', country: 'England', flag: '#2d0d5b', type: 'League' },
      { code: 'SD',  name: 'La Liga 2',    country: 'Spain',   flag: '#8b0000', type: 'League' },
      { code: 'SB',  name: 'Serie B',      country: 'Italy',   flag: '#003580', type: 'League' },
      { code: 'BL2', name: '2. Bundesliga', country: 'Germany', flag: '#cc0000', type: 'League' },
      { code: 'FL2', name: 'Ligue 2',      country: 'France',  flag: '#003189', type: 'League' },
    ],
  },
  {
    region: 'Europe — Domestic Cups',
    comps: [
      { code: 'FAC', name: 'FA Cup',        country: 'England', flag: '#3d0d6b', type: 'Cup' },
      { code: 'LCC', name: 'Carabao Cup',   country: 'England', flag: '#3d0d6b', type: 'Cup' },
      { code: 'CDR', name: 'Copa del Rey',  country: 'Spain',   flag: '#8b0000', type: 'Cup' },
      { code: 'DFB', name: 'DFB-Pokal',     country: 'Germany', flag: '#cc0000', type: 'Cup' },
      { code: 'CI',  name: 'Coppa Italia',  country: 'Italy',   flag: '#003580', type: 'Cup' },
      { code: 'CDF', name: 'Coupe de France', country: 'France', flag: '#003189', type: 'Cup' },
    ],
  },
  {
    region: 'Americas',
    comps: [
      { code: 'BSA', name: 'Brasileirao',     country: 'Brazil',     flag: '#006400', type: 'League' },
      { code: 'ARG', name: 'Liga Profesional', country: 'Argentina', flag: '#75aadb', type: 'League' },
      { code: 'MX',  name: 'Liga MX',          country: 'Mexico',    flag: '#006847', type: 'League' },
      { code: 'MLS', name: 'MLS',              country: 'USA',       flag: '#002a5c', type: 'League' },
      { code: 'COL', name: 'Primera A',        country: 'Colombia',  flag: '#fcd116', type: 'League' },
      { code: 'CHI', name: 'Primera Division', country: 'Chile',     flag: '#d52b1e', type: 'League' },
    ],
  },
  {
    region: 'Asia',
    comps: [
      { code: 'J1',  name: 'J1 League',          country: 'Japan', flag: '#bc002d', type: 'League' },
      { code: 'CSL', name: 'Chinese Super League', country: 'China', flag: '#de2910', type: 'League' },
    ],
  },
] as const;

export default function CompetitionsPage({ locale }: CompetitionsPageProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />
          <main className={styles.main}>
            <div className={styles.header}>
              <h1 className={styles.title}>Competitions</h1>
              <p className={styles.subtitle}>All leagues and tournaments tracked on Fanatic Scores</p>
            </div>

            {COMPETITIONS.map(group => (
              <section key={group.region} className={styles.group}>
                <h2 className={styles.groupTitle}>{group.region}</h2>
                <div className={styles.grid}>
                  {group.comps.map(comp => (
                    <button
                      key={comp.code}
                      className={styles.card}
                      onClick={() => navigate(`/${locale}/competition/${comp.code}`)}
                    >
                      <div className={styles.cardFlag} style={{ backgroundColor: comp.flag }} aria-hidden="true" />
                      <div className={styles.cardBody}>
                        <div className={styles.cardCountry}>{comp.country}</div>
                        <div className={styles.cardName}>{comp.name}</div>
                      </div>
                      <span className={['chip', comp.type === 'Cup' ? 'live' : ''].filter(Boolean).join(' ')}
                        style={comp.type === 'Cup' ? { background: 'var(--orange-soft)', color: 'var(--orange)', borderColor: 'transparent' } : {}}>
                        {comp.type}
                      </span>
                      <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          <Footer />
          </main>
          <aside className={styles.rail}>
            <RailPromo locale={locale} />
          </aside>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className="screen">
          <div className={styles.mobTopBar}>
            <button className="fs-btn ghost" style={{ width: 36, height: 36, padding: 0, borderColor: 'transparent' }}
              onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={20} />
            </button>
            <span className={styles.mobTitle}>Competitions</span>
            <div style={{ width: 36 }} />
          </div>

          <div className="scroll" style={{ padding: '12px 0 90px' }}>
            {COMPETITIONS.map(group => (
              <section key={group.region}>
                <div className={styles.mobGroupLabel}>{group.region}</div>
                {group.comps.map(comp => (
                  <button
                    key={comp.code}
                    className={styles.mobRow}
                    onClick={() => navigate(`/${locale}/competition/${comp.code}`)}
                  >
                    <div className={styles.mobFlag} style={{ backgroundColor: comp.flag }} aria-hidden="true" />
                    <div className={styles.mobRowBody}>
                      <div className={styles.mobRowCountry}>{comp.country}</div>
                      <div className={styles.mobRowName}>{comp.name}</div>
                    </div>
                    <span className={['chip', comp.type === 'Cup' ? '' : ''].filter(Boolean).join(' ')}
                      style={{ fontSize: 10, padding: '2px 7px' }}>
                      {comp.type}
                    </span>
                    <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)' }} />
                  </button>
                ))}
              </section>
            ))}
          <div style={{ padding: '0 16px' }}><Footer /></div>
          </div>
          <MobileBottomNav locale={locale} activeTab="comp" />
        </div>
      </div>
    </>
  );
}
