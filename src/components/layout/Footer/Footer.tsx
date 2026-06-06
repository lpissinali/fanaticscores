'use client';
import Link from 'next/link';
import FSLogo from '../../shared/FSLogo/FSLogo';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>

        {/* Brand column */}
        <div>
          <FSLogo size={56} />
          <p className={styles.tagline}>
            Live scores, AI Pulse and Share Studio for football fans.
          </p>
          {/* Social links — re-enable when accounts are live
          <div className={styles.social}>
            {[['X', 'x'], ['IG', 'instagram'], ['TT', 'tiktok']].map(([label, id]) => (
              <a key={id} href="#" className={styles.socialIcon}>{label}</a>
            ))}
          </div>
          */}
        </div>

        {/* SEO block */}
        <div className={styles.seoBlock}>
          <p className={styles.seoPara}>
            Fanatic Scores delivers real-time football scores, live match updates and full-time results
            across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League
            and more. Follow every goal, half-time score and final whistle as it happens.
          </p>
          <p className={styles.seoPara}>
            Track league tables, head-to-head records and recent form for clubs across Europe and beyond.
            Our live scores update every minute so you never miss a moment — whether you're following
            a title race, a relegation battle or a cup upset.
          </p>
          <p className={styles.seoPara}>
            From match-day schedules to detailed competition standings, Fanatic Scores is the fastest
            way to stay on top of football results worldwide. Free, no account required.
          </p>
        </div>

        {/* Competition links — SEO internal linking */}
        <div className={styles.compLinks}>
          {[
            {
              heading: 'Top Leagues',
              links: [
                { label: 'Premier League',  href: '/en/competition/PL'  },
                { label: 'La Liga',         href: '/en/competition/PD'  },
                { label: 'Serie A',         href: '/en/competition/SA'  },
                { label: 'Bundesliga',      href: '/en/competition/BL1' },
                { label: 'Ligue 1',         href: '/en/competition/FL1' },
                { label: 'Eredivisie',      href: '/en/competition/DED' },
                { label: 'Primeira Liga',   href: '/en/competition/PPL' },
              ],
            },
            {
              heading: 'European Cups',
              links: [
                { label: 'Champions League',    href: '/en/competition/CL'   },
                { label: 'Europa League',       href: '/en/competition/EL'   },
                { label: 'Conference League',   href: '/en/competition/UECL' },
                { label: 'Nations League',      href: '/en/competition/UNL'  },
              ],
            },
            {
              heading: 'International',
              links: [
                { label: 'FIFA World Cup',  href: '/en/competition/WC'   },
                { label: 'UEFA Euro',       href: '/en/competition/EURO' },
                { label: 'Copa América',    href: '/en/competition/CA'   },
                { label: 'Club World Cup',  href: '/en/competition/CWC'  },
                { label: 'AFCON',           href: '/en/competition/AFCN' },
              ],
            },
            {
              heading: 'Americas',
              links: [
                { label: 'Copa Libertadores', href: '/en/competition/LIBT' },
                { label: 'Brasileirão',       href: '/en/competition/BSA'  },
                { label: 'Liga Argentina',    href: '/en/competition/ARG'  },
                { label: 'MLS',               href: '/en/competition/MLS'  },
                { label: 'Liga MX',           href: '/en/competition/MX'   },
              ],
            },
          ].map(({ heading, links }) => (
            <div key={heading} className={styles.compGroup}>
              <div className={styles.compGroupHeading}>{heading}</div>
              {links.map(({ label, href }) => (
                <Link key={href} href={href} className={styles.compLink}>{label}</Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className={styles.bottom}>
          <span className={styles.copy}>
            &copy; {year} Fanatic Scores &middot; Not affiliated with any league or club
          </span>
          <div className={styles.legalLinks}>
            <Link href="/en/terms"   className={styles.legalLink}>Terms</Link>
            <Link href="/en/privacy" className={styles.legalLink}>Privacy</Link>
            <Link href="/en/cookies" className={styles.legalLink}>Cookies</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
