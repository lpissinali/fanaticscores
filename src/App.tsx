import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from './i18n';
import HomePage from './pages/home/HomePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
        <Route path="/en/">
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today"  element={<HomePage locale="en" />} />
          <Route path=":date"  element={<HomePage locale="en" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}/today`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
