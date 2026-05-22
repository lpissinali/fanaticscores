import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from './i18n';
import HomePage        from './pages/home/HomePage';
import MatchPage       from './pages/match/MatchPage';
import CompetitionPage  from './pages/competition/CompetitionPage';
import CompetitionsPage from './pages/competitions/CompetitionsPage';
import TeamPage         from './pages/team/TeamPage';
import TermsPage       from './pages/legal/TermsPage';
import PrivacyPage     from './pages/legal/PrivacyPage';
import CookiesPage     from './pages/legal/CookiesPage';
import StudioPage      from './pages/studio/StudioPage';
import FollowingPage   from './pages/following/FollowingPage';
import CookieBanner    from './components/shared/CookieBanner/CookieBanner';
import { useAnalytics }  from './lib/useAnalytics';

function Analytics() { useAnalytics(); return null; }

function App() {
  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
        <Route path="/en/">
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today"                element={<HomePage        locale="en" />} />
          <Route path="match/:matchId"        element={<MatchPage       locale="en" />} />
          <Route path="competitions"          element={<CompetitionsPage locale="en" />} />
          <Route path="competition/:compCode" element={<CompetitionPage  locale="en" />} />
          <Route path="team/:teamId"         element={<TeamPage          locale="en" />} />
          <Route path="terms"                element={<TermsPage       locale="en" />} />
          <Route path="privacy"              element={<PrivacyPage     locale="en" />} />
          <Route path="cookies"              element={<CookiesPage     locale="en" />} />
          <Route path="following"             element={<FollowingPage   locale="en" />} />
<Route path="studio"               element={<StudioPage      locale="en" />} />
          <Route path="studio/:matchId"      element={<StudioPage      locale="en" />} />
          <Route path=":date"                element={<HomePage        locale="en" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
      </Routes>
      <CookieBanner />
    </BrowserRouter>
  );
}

export default App;
