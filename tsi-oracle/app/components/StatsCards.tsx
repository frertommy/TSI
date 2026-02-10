interface StatsCardsProps {
  peakTsi: number | null;
  peakDate: string | null;
  lowestTsi: number | null;
  lowestDate: string | null;
  volatility30d: number;
  rank: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StatsCards({
  peakTsi,
  peakDate,
  lowestTsi,
  lowestDate,
  volatility30d,
  rank,
}: StatsCardsProps) {
  const cards = [
    {
      label: 'Peak TSI',
      value: peakTsi != null ? Math.round(peakTsi).toString() : '—',
      sub: formatDate(peakDate),
      color: 'text-[var(--accent-green)]',
    },
    {
      label: 'Lowest TSI',
      value: lowestTsi != null ? Math.round(lowestTsi).toString() : '—',
      sub: formatDate(lowestDate),
      color: 'text-[var(--accent-red)]',
    },
    {
      label: '30d Volatility',
      value: `${volatility30d.toFixed(2)}%`,
      sub: 'Std dev of daily changes',
      color: 'text-[var(--accent-cyan)]',
    },
    {
      label: 'Current Rank',
      value: `#${rank}`,
      sub: 'Overall',
      color: 'text-[var(--accent-blue)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
        >
          <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider">
            {card.label}
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${card.color}`}>
            {card.value}
          </div>
          <div className="text-xs text-[var(--text-dim)] mt-1">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
