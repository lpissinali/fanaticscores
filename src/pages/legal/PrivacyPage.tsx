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
      <h1 className={styles.docTitle}>Privacy Policy</h1>
      <p className={styles.docDate}>Last updated: 21 May 2026</p>

      <h2>1. Overview</h2>
      <p>
        Fanatic Scores ("we", "us") is committed to protecting your privacy. This policy explains
        what information we collect, how we use it, and your rights in relation to it. Because
        Fanatic Scores requires no account or sign-in, we collect very little personal data.
      </p>

      <h2>2. Information we collect</h2>
      <p>
        <strong>Data you provide directly.</strong> We do not require you to create an account,
        provide an email address, or submit any personal information to use the Service.
      </p>
      <p>
        <strong>Data collected automatically.</strong> When you visit Fanatic Scores, our hosting
        provider (Google Firebase) may collect standard server logs, including your IP address,
        browser type, operating system, referring URLs and pages visited. This data is used for
        security monitoring only.
      </p>
      <p>
        <strong>Analytics (consent-based).</strong> If you choose "Accept all" on the cookie
        consent banner, Google Analytics 4 (GA4) is activated. GA4 collects anonymised usage
        data (pages visited, session duration, browser type). No personally identifiable
        information is sent to Google.
      </p>
      <p>
        <strong>Local storage.</strong> We store certain data in your browser's local storage and
        session storage (for example, cached match scores, your "Following" preferences, and your
        analytics consent choice). This data never leaves your device and is not transmitted to
        our servers.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To deliver live match data and competition information.</li>
        <li>To improve the performance and reliability of the Service.</li>
        <li>To diagnose technical problems and prevent abuse.</li>
      </ul>
      <p>We do not use your data for advertising, profiling or automated decision-making.</p>

      <h2>4. Third-party services</h2>
      <p>
        The Service uses the following third-party providers, each with their own privacy policies:
      </p>
      <ul>
        <li>
          <strong>API-Football (api-sports.io)</strong> — supplies live match data, standings and
          statistics. See <a href="https://www.api-football.com/privacy" target="_blank" rel="noreferrer">their privacy policy</a>.
        </li>
        <li>
          <strong>Google Firebase</strong> — provides hosting and our Firestore database.
          See <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer">Firebase's privacy policy</a>.
        </li>
        <li>
          <strong>Google Analytics 4</strong> — collects anonymised usage analytics when you
          opt in. See <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google's privacy policy</a>.
        </li>
        <li>
          <strong>Anthropic</strong> — powers our AI match brief feature (Claude API). Match
          data is sent to Anthropic's API to generate a short summary; no personal data is
          included. See <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer">Anthropic's privacy policy</a>.
        </li>
      </ul>
      <p>
        We do not sell, rent or share your personal data with any third party for marketing purposes.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Server log data is retained for up to 90 days for security purposes and then deleted.
        Browser-side data (local storage) is controlled entirely by you and can be cleared at any
        time through your browser settings.
      </p>

      <h2>6. Children's privacy</h2>
      <p>
        The Service is not directed at children under the age of 13. We do not knowingly collect
        personal data from children. If you believe a child has provided us with personal data,
        please contact us and we will delete it promptly.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location, you may have rights under applicable data protection law,
        including the right to access, correct or delete personal data we hold about you.
        Because we collect minimal personal data, most requests can be satisfied simply by
        clearing your browser's local storage. For server-side log data, please contact us directly.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The date at the top of this page
        indicates the most recent revision. Continued use of the Service after changes are posted
        constitutes acceptance of the revised policy.
      </p>

      <h2>9. Contact</h2>
      <p>
        If you have any questions or requests relating to your privacy, please contact us at{' '}
        <a href="mailto:privacy@fanaticscores.com">privacy@fanaticscores.com</a>.
      </p>
    </div>
  );
}

export default function PrivacyPage({ locale }: Props) {
  useSEO({ title: 'Privacy Policy', description: 'Read the FanaticScores Privacy Policy.', canonical: '/en/privacy' });
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
            <span className={styles.mobTopTitle}>Privacy Policy</span>
          </div>
          <div className={styles.mobContent}><Content /><Footer /></div>
        </div>
      </div>
    </>
  );
}
