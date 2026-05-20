import styles from './Footer.module.css';
import FSLogo from '../../shared/FSLogo/FSLogo';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>

        {/* Brand column */}
        <div className={styles.brand}>
          <FSLogo size={28} />
          <p className={styles.tagline}>Scores for fanatics.</p>
          <div className={styles.social}>
            {['X', 'Instagram', 'Threads'].map((s) => (
              <a key={s} href="#" className={styles.socialLink}>{s}</a>
            ))}
          </div>
        </div>

        {/* SEO content — spans the space previously used by Product, Company and Get the app */}
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

        {/* Get the app — commented out until native apps are ready
        <div className={styles.col}>
          <span className={styles.colHeading}>Get the app</span>
          <a href="#" className={styles.appBtn}>App Store</a>
          <a href="#" className={styles.appBtn}>Google Play</a>
        </div>
        */}

      </div>

      <div className={styles.bottom}>
        <span className={styles.copy}>© {year} Fanatic Scores</span>
        <div className={styles.legalLinks}>
          {['Terms', 'Privacy', 'Cookies', 'Data sources', 'Status'].map((l) => (
            <a key={l} href="#" className={styles.legalLink}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
