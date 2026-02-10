interface TeamHeaderProps {
  name: string;
  leagueName: string;
  tsiDisplay: number;
  elo: number;
  rank: number;
  changePercent7d: number;
  leagueRank?: number;
}

export default function TeamHeader({
  name,
  leagueName,
  tsiDisplay,
  elo,
  rank,
  changePercent7d,
  leagueRank,
}: TeamHeaderProps) {
  const isPositive = changePercent7d > 0;
  const isNegative = changePercent7d < 0;

  return (
    <div className="mb-8">
      <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)]">
        {name}
      </h1>
      <p className="text-[var(--text-muted)] text-sm mt-1">{leagueName}</p>

      <div className="flex items-end gap-6 mt-4">
        {/* Hero TSI number */}
        <div>
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">
            TSI Score
          </div>
          <div className="text-5xl md:text-6xl font-bold tabular-nums text-[var(--foreground)]">
            {Math.round(tsiDisplay)}
          </div>
        </div>

        {/* Elo */}
        <div className="mb-1">
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">
            Elo
          </div>
          <div className="text-xl text-[var(--text-dim)] tabular-nums">
            {Math.round(elo)}
          </div>
        </div>

        {/* 7d change */}
        <div className="mb-1">
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">
            7d Change
          </div>
          <div
            className={`text-xl tabular-nums ${
              isPositive
                ? 'text-[var(--accent-green)]'
                : isNegative
                ? 'text-[var(--accent-red)]'
                : 'text-[var(--text-dim)]'
            }`}
          >
            {isPositive ? '▲' : isNegative ? '▼' : '—'}{' '}
            {changePercent7d !== 0
              ? `${Math.abs(changePercent7d).toFixed(1)}%`
              : '0.0%'}
          </div>
        </div>
      </div>

      {/* Rank badges */}
      <div className="flex gap-2 mt-4">
        <span className="text-xs px-3 py-1 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
          #{rank} Overall
        </span>
        {leagueRank && (
          <span className="text-xs px-3 py-1 rounded-full bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--card-border)]">
            #{leagueRank} in {leagueName}
          </span>
        )}
      </div>
    </div>
  );
}
