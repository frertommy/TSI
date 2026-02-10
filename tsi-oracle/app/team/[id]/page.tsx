import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TeamHeader from '@/app/components/TeamHeader';
import TSIChart from '@/app/components/TSIChart';
import StatsCards from '@/app/components/StatsCards';
import ComponentBreakdown from '@/app/components/ComponentBreakdown';
import RecentMatches from '@/app/components/RecentMatches';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTeamData(id: string) {
  // Fetch team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single();

  if (teamError || !team) return null;

  // Fetch full history
  const { data: history } = await supabase
    .from('tsi_daily')
    .select('date, elo, tsi_display')
    .eq('team_id', id)
    .order('date', { ascending: true });

  // Fetch matches
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('home_team_id', id)
    .order('date', { ascending: false })
    .limit(20);

  const { data: awayMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('away_team_id', id)
    .order('date', { ascending: false })
    .limit(20);

  // Combine and sort matches
  const allMatches = [
    ...(homeMatches ?? []).map((m: Record<string, unknown>) => ({
      date: m.date as string,
      opponent: m.away_team_name as string,
      isHome: true,
      goalsFor: m.home_goals as number,
      goalsAgainst: m.away_goals as number,
      result: ((m.home_goals as number) > (m.away_goals as number)
        ? 'W'
        : (m.home_goals as number) < (m.away_goals as number)
        ? 'L'
        : 'D') as 'W' | 'D' | 'L',
    })),
    ...(awayMatches ?? []).map((m: Record<string, unknown>) => ({
      date: m.date as string,
      opponent: m.home_team_name as string,
      isHome: false,
      goalsFor: m.away_goals as number,
      goalsAgainst: m.home_goals as number,
      result: ((m.away_goals as number) > (m.home_goals as number)
        ? 'W'
        : (m.away_goals as number) < (m.home_goals as number)
        ? 'L'
        : 'D') as 'W' | 'D' | 'L',
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // Compute stats from history
  const historyPoints = (history ?? []) as { date: string; elo: number; tsi_display: number }[];
  let peakTsi = 0;
  let peakDate = '';
  let lowestTsi = Infinity;
  let lowestDate = '';

  for (const h of historyPoints) {
    const display = h.tsi_display;
    if (display > peakTsi) {
      peakTsi = display;
      peakDate = h.date;
    }
    if (display < lowestTsi) {
      lowestTsi = display;
      lowestDate = h.date;
    }
  }

  // Volatility: stddev of daily tsiDisplay pct changes over last 30 days
  const last30 = historyPoints.slice(-31);
  let volatility30d = 0;
  if (last30.length > 1) {
    const pctChanges: number[] = [];
    for (let i = 1; i < last30.length; i++) {
      const prev = last30[i - 1].tsi_display;
      const curr = last30[i].tsi_display;
      if (prev > 0) {
        pctChanges.push(((curr - prev) / prev) * 100);
      }
    }
    if (pctChanges.length > 0) {
      const mean = pctChanges.reduce((s, v) => s + v, 0) / pctChanges.length;
      const variance =
        pctChanges.reduce((s, v) => s + (v - mean) ** 2, 0) / pctChanges.length;
      volatility30d = Math.round(Math.sqrt(variance) * 100) / 100;
    }
  }

  // Get league rank
  const { data: leagueTeams } = await supabase
    .from('teams')
    .select('id, current_rank')
    .eq('league', team.league)
    .order('current_rank', { ascending: true });

  const leagueRank = leagueTeams
    ? leagueTeams.findIndex((t: { id: string }) => t.id === id) + 1
    : undefined;

  return {
    team: {
      id: team.id,
      name: team.name,
      league: team.league,
      leagueName: team.league_name,
      elo: team.current_elo,
      tsiDisplay: team.current_tsi_display,
      rank: team.current_rank,
      change7d: team.change_7d,
      changePercent7d: team.change_percent_7d,
    },
    history: historyPoints.map((h) => ({
      date: h.date,
      elo: h.elo,
      tsiDisplay: h.tsi_display,
    })),
    stats: {
      peakTsi: peakTsi === 0 ? null : peakTsi,
      peakDate: peakDate || null,
      lowestTsi: lowestTsi === Infinity ? null : lowestTsi,
      lowestDate: lowestDate || null,
      volatility30d,
    },
    matches: allMatches,
    leagueRank: leagueRank || undefined,
  };
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getTeamData(id);

  if (!data) {
    notFound();
  }

  const { team, history, stats, matches, leagueRank } = data;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors mb-6"
      >
        ← Back to Rankings
      </Link>

      {/* Team Header */}
      <TeamHeader
        name={team.name}
        leagueName={team.leagueName}
        tsiDisplay={team.tsiDisplay}
        elo={team.elo}
        rank={team.rank}
        changePercent7d={team.changePercent7d}
        leagueRank={leagueRank}
      />

      {/* TSI History Chart */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          TSI History
        </h2>
        <TSIChart history={history} />
      </section>

      {/* Stats Cards */}
      <section className="mb-8">
        <StatsCards
          peakTsi={stats.peakTsi}
          peakDate={stats.peakDate}
          lowestTsi={stats.lowestTsi}
          lowestDate={stats.lowestDate}
          volatility30d={stats.volatility30d}
          rank={team.rank}
        />
      </section>

      {/* Component Breakdown */}
      <section className="mb-8">
        <ComponentBreakdown elo={team.elo} tsiDisplay={team.tsiDisplay} />
      </section>

      {/* Recent Matches */}
      <section className="mb-8">
        <RecentMatches matches={matches} />
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
