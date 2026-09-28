import type { Metadata } from 'next';

// Only here for the window title. The presenter view is a client page, which
// can't export metadata itself, and a <title> rendered from it loses to the
// root layout's. "Presenter view" is how the presenter tells this window
// apart from the audience screen's in the taskbar and the window switcher.
export const metadata: Metadata = {
  title: 'Presenter view',
};

export default function PresenterViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
