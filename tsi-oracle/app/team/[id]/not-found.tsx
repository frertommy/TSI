import Link from 'next/link';

export default function TeamNotFound() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">404</h1>
      <p className="text-[var(--text-muted)] mb-8">Team not found.</p>
      <Link
        href="/"
        className="inline-block px-6 py-2 text-sm rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)] transition-colors"
      >
        ← Back to Rankings
      </Link>
    </main>
  );
}
