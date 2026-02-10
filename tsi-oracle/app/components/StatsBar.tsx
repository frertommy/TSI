interface StatsBarProps {
  totalTeams: number;
  leagueCount: number;
  topTsi: number;
  avgTsi: number;
}

export default function StatsBar({ totalTeams, leagueCount, topTsi, avgTsi }: StatsBarProps) {
  const stats = [
    { label: 'Teams Tracked', value: totalTeams.toString() },
    { label: 'Leagues', value: leagueCount.toString() },
    { label: 'Top TSI', value: topTsi.toString() },
    { label: 'Avg TSI', value: `~${avgTsi}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
        >
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider">
            {stat.label}
          </div>
          <div className="text-xl font-bold mt-1 tabular-nums text-[var(--foreground)]">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
