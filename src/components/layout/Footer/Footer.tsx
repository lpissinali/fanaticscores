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

        {/* Product */}
        <div className={styles.col}>
          <span className={styles.colHeading}>Product</span>
          {['Today', 'Schedule', 'Competitions', 'Share Studio'].map((l) => (
            <a key={l} href="#" className={styles.link}>{l}</a>
          ))}
        </div>

        {/* Company */}
        <div className={styles.col}>
          <span className={styles.colHeading}>Company</span>
          {['About', 'Blog', 'Careers', 'Press'].map((l) => (
            <a key={l} href="#" className={styles.link}>{l}</a>
          ))}
        </div>

        {/* Get the app */}
        <div className={styles.col}>
          <span className={styles.colHeading}>Get the app</span>
          <a href="#" className={styles.appBtn}>App Store</a>
          <a href="#" className={styles.appBtn}>Google Play</a>
        </div>
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
