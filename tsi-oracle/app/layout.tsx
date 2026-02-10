import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TSI Oracle — Team Strength Index',
  description: 'Elo-based team strength ratings for top European football clubs. Powered by ClubElo data.',
  openGraph: {
    title: 'TSI Oracle — Team Strength Index',
    description: 'Elo-based team strength ratings for top European football clubs.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
