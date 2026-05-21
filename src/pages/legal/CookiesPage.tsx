import { useNavigate } from 'react-router-dom';
import { useSEO } from '../../lib/useSEO';
import type { SupportedLocale } from '../../i18n';
import Footer from '../../components/layout/Footer/Footer';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Icon from '../../components/shared/Icon/Icon';
import styles from './LegalPage.module.css';

interface Props { locale: SupportedLocale; }

function Content() {
  return (
    <div className={styles.doc}>
      <p className={styles.docEyebrow}>Legal</p>
      <h1 className={styles.docTitle}>Cookies Policy</h1>
      <p className={styles.docDate}>Last updated: 1 June 2025</p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files placed on your device by websites you visit. They are widely
        used to make websites work efficiently and to provide information to site owners. Fanatic
        Scores uses browser storage technologies (described below) rather than traditional cookies.
      </p>

      <h2>2. How Fanatic Scores uses browser storage</h2>
      <p>
        We do <strong>not</strong> use tracking cookies, advertising cookies, or any third-party
        cookie-based analytics. Instead, Fanatic Scores uses two browser-native storage mechanisms:
      </p>

      <h2>Local storage</h2>
      <p>
        We use <code>localStorage</code> to cache match data, standings and other API responses on
        your device. This reduces the number of API requests and makes the app load faster on repeat
        visits. Cached entries expire automatically (typically within 1–12 hours depending on the
        type of data) and are never used to identify or track you.
      </p>
      <ul>
        <li><strong>Purpose:</strong> Performance caching of football data.</li>
        <li><strong>Data stored:</strong> Match scores, standings, head-to-head records, scorers.</li>
        <li><strong>Personal data:</strong> None.</li>
        <li><strong>Expiry:</strong> 1 hour (live data) to 12 hours (historical data).</li>
      </ul>

      <h2>Session storage</h2>
      <p>
        We use <code>sessionStorage</code> to keep basic match information available when you
        navigate between the home page and a match details page. This data exists only for the
        duration of your browser session and is deleted automatically when you close the tab.
      </p>
      <ul>
        <li><strong>Purpose:</strong> In-session navigation between pages.</li>
        <li><strong>Data stored:</strong> Match IDs, team names and scores.</li>
        <li><strong>Personal data:</strong> None.</li>
        <li><strong>Expiry:</strong> End of browser session.</li>
      </ul>

      <h2>3. Third-party storage</h2>
      <p>
        Our hosting provider, Google Firebase, may set its own cookies or storage entries for
        operational purposes (e.g. routing, DDoS protection). These are strictly necessary and
        not used for advertising. See{' '}
        <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer">
          Firebase's privacy policy
        </a>{' '}
        for details.
      </p>

      <h2>4. No advertising or tracking</h2>
      <p>
        Fanatic Scores does not run advertisements and does not use any advertising networks,
        third-party analytics scripts (such as Google Analytics), or social media tracking pixels.
        No data about your browsing behaviour is shared with advertisers or data brokers.
      </p>

      <h2>5. How to clear storage</h2>
      <p>
        You can clear all locally stored data at any time through your browser settings. In most
        browsers, go to <strong>Settings → Privacy &amp; Security → Clear browsing data</strong>{' '}
        and select "Cookies and other site data" or "Cached data". This will remove all Fanatic
        Scores cache entries. The app will continue to work normally — data will simply be
        re-fetched on next use.
      </p>

      <h2>6. Changes to this policy</h2>
      <p>
        We may update this Cookies Policy from time to time. The date at the top of this page
        indicates the most recent revision.
      </p>

      <h2>7. Contact</h2>
      <p>
        If you have questions about how we use browser storage, please contact us at{' '}
        <a href="mailto:privacy@fanaticscores.com">privacy@fanaticscores.com</a>.
      </p>
    </div>
  );
}

export default function CookiesPage({ locale }: Props) {
  useSEO({ title: 'Cookies Policy', description: 'Learn how FanaticScores uses browser storage instead of tracking cookies.', canonical: '/en/cookies' });
  const navigate = useNavigate();
  return (
    <>
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />
          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={14} /> Back
            </button>
            <Content />
            <Footer />
          </main>
        </div>
      </div>
      <div className={styles.mobileOnly}>
        <div className={styles.mobScreen}>
          <div className={styles.mobTopBar}>
            <button className={styles.mobBackBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={16} /> Back
            </button>
            <span className={styles.mobTopTitle}>Cookies Policy</span>
          </div>
          <div className={styles.mobContent}><Content /><Footer /></div>
        </div>
      </div>
    </>
  );
}
