import { Link } from 'react-router-dom';
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
          <div className={styles.social}>
            {[['X', 'x'], ['IG', 'instagram'], ['TT', 'tiktok']].map(([label, id]) => (
              <a key={id} href="#" className={styles.socialIcon}>{label}</a>
            ))}
          </div>
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

        {/* Bottom bar */}
        <div className={styles.bottom}>
          <span className={styles.copy}>
            &copy; {year} Fanatic Scores &middot; Not affiliated with any league or club
          </span>
          <div className={styles.legalLinks}>
            <Link to="/en/terms"   className={styles.legalLink}>Terms</Link>
            <Link to="/en/privacy" className={styles.legalLink}>Privacy</Link>
            <Link to="/en/cookies" className={styles.legalLink}>Cookies</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
