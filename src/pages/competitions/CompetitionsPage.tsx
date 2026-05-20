import { useNavigate } from 'react-router-dom';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import Icon from '../../components/shared/Icon/Icon';
import styles from './CompetitionsPage.module.css';

interface CompetitionsPageProps { locale: SupportedLocale; }

// Mirrors the priority list in footballDataFetch — grouped by region
const COMPETITIONS = [
  {
    region: 'Europe',
    comps: [
      { code: 'CL',  name: 'UEFA Champions League', country: 'Europe',      flag: '#1a3a6b', type: 'Cup'    },
      { code: 'PL',  name: 'Premier League',         country: 'England',     flag: '#3d0d6b', type: 'League' },
      { code: 'PD',  name: 'Primera Division',       country: 'Spain',       flag: '#8b0000', type: 'League' },
      { code: 'SA',  name: 'Serie A',                country: 'Italy',       flag: '#003580', type: 'League' },
      { code: 'BL1', name: 'Bundesliga',             country: 'Germany',     flag: '#cc0000', type: 'League' },
      { code: 'FL1', name: 'Ligue 1',                country: 'France',      flag: '#003189', type: 'League' },
      { code: 'ELC', name: 'Championship',           country: 'England',     flag: '#2d0d5b', type: 'League' },
      { code: 'DED', name: 'Eredivisie',             country: 'Netherlands', flag: '#ff6600', type: 'League' },
      { code: 'PPL', name: 'Primeira Liga',          country: 'Portugal',    flag: '#006600', type: 'League' },
    ],
  },
  {
    region: 'Americas',
    comps: [
      { code: 'BSA', name: 'Campeonato Brasileiro', country: 'Brazil', flag: '#006400', type: 'League' },
    ],
  },
  {
    region: 'World',
    comps: [
      { code: 'WC', name: 'FIFA World Cup', country: 'World', flag: '#8b6914', type: 'Cup' },
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
        </div>
      </div>
    </>
  );
}
