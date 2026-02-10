'use client';

import { useState, useEffect, useCallback } from 'react';
import StatsBar from './components/StatsBar';
import LeagueFilter from './components/LeagueFilter';
import TeamTable from './components/TeamTable';
import { StatsSkeleton } from './components/LoadingSkeleton';

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

interface TeamsResponse {
  teams: Team[];
  total: number;
  updatedAt: string | null;
}

interface League {
  code: string;
  name: string;
  teamCount: number;
  avgTsiDisplay: number;
  topTeam: { id: string; name: string; tsiDisplay: number } | null;
}

interface LeaguesResponse {
  leagues: League[];
}

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leagues for stats
  useEffect(() => {
    async function fetchLeagues() {
      try {
        const res = await fetch('/api/leagues');
        if (!res.ok) throw new Error('Failed to fetch leagues');
        const data: LeaguesResponse = await res.json();
        setLeagues(data.leagues);
      } catch {
        // Stats are non-critical, don't block on error
      } finally {
        setStatsLoading(false);
      }
    }
    fetchLeagues();
  }, []);

  const fetchTeams = useCallback(async (league: string, lim: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', lim.toString());
      if (league) params.set('league', league);

      const res = await fetch(`/api/teams?${params}`);
      if (!res.ok) throw new Error('Failed to fetch teams');

      const data: TeamsResponse = await res.json();
      setTeams(data.teams);
      setTotal(data.total);
    } catch {
      setError('Unable to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams(selectedLeague, limit);
  }, [selectedLeague, limit, fetchTeams]);

  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    setLimit(10);
  };

  const handleLoadMore = () => {
    setLimit((prev) => prev + 10);
  };

  // Compute stats
  const totalTeams = leagues.reduce((sum, l) => sum + l.teamCount, 0) || total;
  const leagueCount = leagues.length;
  const topTsi = teams.length > 0 ? Math.round(teams[0].tsiDisplay) : 0;
  const avgTsi =
    leagues.length > 0
      ? Math.round(
          leagues.reduce((sum, l) => sum + l.avgTsiDisplay * l.teamCount, 0) /
            leagues.reduce((sum, l) => sum + l.teamCount, 0)
        )
      : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)]">
            TSI Oracle
          </h1>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            LIVE
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm md:text-base">
          Team Strength Index — Elo-based ratings for top European football clubs
        </p>
        <p className="text-[var(--text-dim)] text-xs mt-1">
          Powered by ClubElo data &middot; Updated daily
        </p>
      </header>

      {/* Stats Bar */}
      <section className="mb-8">
        {statsLoading ? (
          <StatsSkeleton />
        ) : (
          <StatsBar
            totalTeams={totalTeams}
            leagueCount={leagueCount}
            topTsi={topTsi}
            avgTsi={avgTsi}
          />
        )}
      </section>

      {/* League Filter */}
      <section className="mb-6">
        <LeagueFilter selected={selectedLeague} onChange={handleLeagueChange} />
      </section>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5 text-[var(--accent-red)] text-sm">
          {error}
        </div>
      )}

      {/* Team Table */}
      <section>
        <TeamTable
          teams={teams}
          loading={loading}
          hasMore={teams.length < total}
          onLoadMore={handleLoadMore}
        />
      </section>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-[var(--card-border)] text-center text-xs text-[var(--text-dim)]">
        <p>
          TSI Oracle v1.0 &middot; Data from ClubElo &middot; Engine: Elo + Sigmoid Mapping (μ=1850, σ=120)
        </p>
      </footer>
    </main>
  );
}
