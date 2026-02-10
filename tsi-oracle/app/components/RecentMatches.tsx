interface Match {
  date: string;
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}

interface RecentMatchesProps {
  matches: Match[];
}

const RESULT_STYLES: Record<string, string> = {
  W: 'bg-[var(--accent-green)]/15 text-[var(--accent-green)] border-[var(--accent-green)]/20',
  D: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  L: 'bg-[var(--accent-red)]/15 text-[var(--accent-red)] border-[var(--accent-red)]/20',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecentMatches({ matches }: RecentMatchesProps) {
  if (matches.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Recent Matches
        </h2>
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center text-sm text-[var(--text-dim)]">
          Match history coming soon.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        Recent Matches
      </h2>
      <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--card-border)]">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Opponent</th>
              <th className="px-4 py-3 text-center">H/A</th>
              <th className="px-4 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-center">Result</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, i) => (
              <tr
                key={`${match.date}-${match.opponent}-${i}`}
                className="border-b border-[var(--card-border)]/50 last:border-b-0"
              >
                <td className="px-4 py-2.5 text-sm text-[var(--text-muted)] tabular-nums">
                  {formatDate(match.date)}
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--foreground)]">
                  {match.opponent}
                </td>
                <td className="px-4 py-2.5 text-sm text-center text-[var(--text-dim)]">
                  {match.isHome ? 'H' : 'A'}
                </td>
                <td className="px-4 py-2.5 text-sm text-center tabular-nums text-[var(--foreground)]">
                  {match.goalsFor}-{match.goalsAgainst}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`inline-block w-7 text-center text-xs font-bold py-0.5 rounded border ${
                      RESULT_STYLES[match.result] || ''
                    }`}
                  >
                    {match.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
