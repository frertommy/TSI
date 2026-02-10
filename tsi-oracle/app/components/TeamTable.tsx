'use client';

import { useRouter } from 'next/navigation';

const LEAGUE_SHORT: Record<string, string> = {
  ENG: 'ENG',
  ESP: 'ESP',
  GER: 'GER',
  ITA: 'ITA',
  FRA: 'FRA',
};

interface Team {
  id: string;
  name: string;
  league: string;
  leagueName: string;
  elo: number;
  tsiDisplay: number;
  rank: number;
  change7d: number;
  changePercent7d: number;
}

interface TeamTableProps {
  teams: Team[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function TeamTable({ teams, loading, hasMore, onLoadMore }: TeamTableProps) {
  const router = useRouter();

  if (loading && teams.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded bg-[var(--card-bg)] animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-dim)]">
        No teams found.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-[var(--text-dim)] uppercase tracking-wider border-b border-[var(--card-border)]">
              <th className="pb-3 pr-3 w-12">#</th>
              <th className="pb-3 pr-3">Team</th>
              <th className="pb-3 pr-3 hidden sm:table-cell">League</th>
              <th className="pb-3 pr-3 text-right">TSI</th>
              <th className="pb-3 pr-3 text-right hidden md:table-cell">Elo</th>
              <th className="pb-3 text-right">7d</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const isPositive = team.changePercent7d > 0;
              const isNegative = team.changePercent7d < 0;

              return (
                <tr
                  key={team.id}
                  onClick={() => router.push(`/team/${team.id}`)}
                  className="border-b border-[var(--card-border)]/50 hover:bg-[var(--card-bg)] cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-3 text-[var(--text-dim)] tabular-nums text-sm">
                    {team.rank}
                  </td>
                  <td className="py-3 pr-3 font-medium text-[var(--foreground)]">
                    {team.name}
                  </td>
                  <td className="py-3 pr-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-muted)]">
                      {LEAGUE_SHORT[team.league] || team.league}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-lg tabular-nums text-[var(--foreground)]">
                    {Math.round(team.tsiDisplay)}
                  </td>
                  <td className="py-3 pr-3 text-right hidden md:table-cell text-sm text-[var(--text-dim)] tabular-nums">
                    {Math.round(team.elo)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-sm">
                    <span
                      className={
                        isPositive
                          ? 'text-[var(--accent-green)]'
                          : isNegative
                          ? 'text-[var(--accent-red)]'
                          : 'text-[var(--text-dim)]'
                      }
                    >
                      {isPositive ? '▲' : isNegative ? '▼' : '—'}
                      {' '}
                      {team.changePercent7d !== 0
                        ? `${Math.abs(team.changePercent7d).toFixed(1)}%`
                        : '0.0%'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 text-sm rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}
