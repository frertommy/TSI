'use client';

const LEAGUES = [
  { code: '', label: 'All' },
  { code: 'ENG', label: 'Premier League' },
  { code: 'ESP', label: 'La Liga' },
  { code: 'GER', label: 'Bundesliga' },
  { code: 'ITA', label: 'Serie A' },
  { code: 'FRA', label: 'Ligue 1' },
];

interface LeagueFilterProps {
  selected: string;
  onChange: (league: string) => void;
}

export default function LeagueFilter({ selected, onChange }: LeagueFilterProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
      {LEAGUES.map((league) => (
        <button
          key={league.code}
          onClick={() => onChange(league.code)}
          className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
            selected === league.code
              ? 'bg-[var(--accent-blue)] text-white'
              : 'bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] border border-[var(--card-border)]'
          }`}
        >
          {league.label}
        </button>
      ))}
    </div>
  );
}
