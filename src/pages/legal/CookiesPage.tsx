'use client';
import { useRouter } from 'next/navigation';
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
      <p className={styles.docDate}>Last updated: 21 May 2026</p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files placed on your device by websites you visit. They are widely
        used to make websites work efficiently and to provide information to site owners. Fanatic
        Scores uses browser storage technologies and, with your consent, analytics scripts
        described below.
      </p>

      <h2>2. Your consent choices</h2>
      <p>
        When you first visit Fanatic Scores, a banner asks you to choose between two options:
      </p>
      <ul>
        <li>
          <strong>Essential only</strong> — only strictly necessary browser storage is used
          (match data caching, your Following preferences, and your consent choice itself).
          No analytics data is collected.
        </li>
        <li>
          <strong>Accept all</strong> — in addition to essential storage, Google Analytics 4
          is enabled to help us understand how the site is used in aggregate. No personally
          identifiable information is sent to Google.
        </li>
      </ul>
      <p>
        We implement GA4 Consent Mode v2. The analytics script loads on every visit but collects
        no data unless you choose "Accept all". You can change your choice at any time by clearing
        your browser storage (see section 5).
      </p>

      <h2>3. Essential browser storage (always active)</h2>

      <h3>Local storage</h3>
      <p>
        We use <code>localStorage</code> to cache match data, standings and other API responses on
        your device. This reduces API requests and makes the app load faster on repeat visits.
        Cached entries expire automatically (typically within 1–12 hours).
      </p>
      <ul>
        <li><strong>Purpose:</strong> Performance caching of football data.</li>
        <li><strong>Data stored:</strong> Match scores, standings, head-to-head records.</li>
        <li><strong>Personal data:</strong> None.</li>
        <li><strong>Expiry:</strong> 1 hour (live data) to 24 hours (historical data).</li>
      </ul>

      <h3>Consent preference</h3>
      <ul>
        <li><strong>Key:</strong> <code>fs_consent</code></li>
        <li><strong>Purpose:</strong> Remembers whether you accepted or declined analytics.</li>
        <li><strong>Data stored:</strong> The string <code>"all"</code> or <code>"essential"</code>.</li>
        <li><strong>Personal data:</strong> None.</li>
        <li><strong>Expiry:</strong> Until you clear site data.</li>
      </ul>

      <h3>Following preferences</h3>
      <ul>
        <li><strong>Key:</strong> <code>fs_following_v1</code></li>
        <li><strong>Purpose:</strong> Stores the list of teams you have chosen to follow.</li>
        <li><strong>Data stored:</strong> Team names, IDs and crest URLs. Never leaves your device.</li>
        <li><strong>Personal data:</strong> None.</li>
        <li><strong>Expiry:</strong> Until you clear site data or unfollow all teams.</li>
      </ul>

      <h2>4. Analytics storage (only with "Accept all")</h2>
      <p>
        If you choose "Accept all", we activate <strong>Google Analytics 4</strong> (GA4) via
        the <code>gtag.js</code> library. GA4 uses cookies and similar technologies to measure
        page views, session duration and navigation paths. All data is aggregated and anonymised
        — IP addresses are not stored by Google under our configuration.
      </p>
      <ul>
        <li><strong>Provider:</strong> Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.</li>
        <li><strong>Cookie names:</strong> <code>_ga</code>, <code>_ga_*</code></li>
        <li><strong>Purpose:</strong> Aggregate usage analytics to improve the Service.</li>
        <li><strong>Personal data:</strong> None intentionally collected. IP addresses are anonymised.</li>
        <li><strong>Expiry:</strong> <code>_ga</code> — 2 years; <code>_ga_*</code> — 2 years.</li>
        <li><strong>Google's privacy policy:</strong>{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">policies.google.com/privacy</a>
        </li>
      </ul>

      <h2>5. Third-party infrastructure storage</h2>
      <p>
        Our hosting provider, Google Firebase, may set its own cookies or storage entries for
        operational purposes (e.g. routing, DDoS protection). These are strictly necessary and
        not used for advertising. See{' '}
        <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer">
          Firebase's privacy policy
        </a>{' '}
        for details.
      </p>

      <h2>6. No advertising</h2>
      <p>
        Fanatic Scores does not run advertisements and does not use advertising networks or
        social media tracking pixels. We do not share any data about your browsing behaviour
        with advertisers or data brokers.
      </p>

      <h2>7. How to clear storage or change your consent</h2>
      <p>
        You can clear all locally stored data at any time through your browser settings. In most
        browsers, go to <strong>Settings → Privacy &amp; Security → Clear browsing data</strong>{' '}
        and select "Cookies and other site data". This removes your consent preference — the
        banner will reappear on your next visit so you can make a fresh choice. The app will
        continue to work normally.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this Cookies Policy from time to time. The date at the top of this page
        indicates the most recent revision.
      </p>

      <h2>9. Contact</h2>
      <p>
        If you have questions about how we use browser storage, please contact us at{' '}
        <a href="mailto:privacy@fanaticscores.com">privacy@fanaticscores.com</a>.
      </p>
    </div>
  );
}

export default function CookiesPage({ locale }: Props) {
  useSEO({ title: 'Cookies Policy', description: 'Learn how FanaticScores uses browser storage and analytics.', canonical: '/en/cookies' });
  const router = useRouter();
  return (
    <>
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />
          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => router.back()}>
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
            <button className={styles.mobBackBtn} onClick={() => router.back()}>
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
