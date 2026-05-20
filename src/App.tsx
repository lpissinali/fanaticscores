import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from './i18n';
import HomePage        from './pages/home/HomePage';
import MatchPage       from './pages/match/MatchPage';
import CompetitionPage from './pages/competition/CompetitionPage';
import TermsPage       from './pages/legal/TermsPage';
import PrivacyPage     from './pages/legal/PrivacyPage';
import CookiesPage     from './pages/legal/CookiesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
        <Route path="/en/">
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today"                element={<HomePage        locale="en" />} />
          <Route path="match/:matchId"        element={<MatchPage       locale="en" />} />
          <Route path="competition/:compCode" element={<CompetitionPage locale="en" />} />
          <Route path="terms"                element={<TermsPage       locale="en" />} />
          <Route path="privacy"              element={<PrivacyPage     locale="en" />} />
          <Route path="cookies"              element={<CookiesPage     locale="en" />} />
          <Route path=":date"                element={<HomePage        locale="en" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
