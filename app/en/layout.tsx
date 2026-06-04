import CookieBanner from '@/src/components/shared/CookieBanner/CookieBanner';

// The en layout wraps all /en/* routes.
// Sidebar is rendered inside each page (matches the existing page-level layout pattern).
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CookieBanner />
    </>
  );
}
