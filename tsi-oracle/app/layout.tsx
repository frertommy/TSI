import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TSI Oracle — Team Strength Index',
  description: 'Elo-based ratings for top European football clubs. Financial-grade team analytics powered by ClubElo data.',
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
