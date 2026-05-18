import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from './i18n';
import HomePage from './pages/home/HomePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />} />
        <Route path="/en/">
          <Route index element={<HomePage locale="en" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
